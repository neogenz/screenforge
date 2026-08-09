-- Durable account deletion queue.
--
-- Deliberately no foreign key to auth.users: the row must outlive the identity
-- whose Storage folder it guards and cleans.
create table public.account_deletion_jobs (
  user_id uuid primary key,
  status text not null default 'prepared' check (status in ('prepared', 'cleanup')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_jobs enable row level security;
revoke all on public.account_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.account_deletion_jobs to service_role;

-- The old JWT remains signed after auth.users is deleted. Reading auth.uid()
-- here therefore keeps uploads closed until the durable cleanup row is gone.
create function public.account_deletion_pending() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.account_deletion_jobs
    where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.account_deletion_pending() from public, anon;
grant execute on function public.account_deletion_pending() to authenticated;

drop policy "assets_insert_own" on storage.objects;
create policy "assets_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_cloud())
    and not (select public.account_deletion_pending())
  );

drop policy "assets_update_own" on storage.objects;
create policy "assets_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.has_cloud())
    and not (select public.account_deletion_pending())
  );
