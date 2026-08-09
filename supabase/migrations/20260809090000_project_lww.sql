-- Deux écritures qui ne doivent jamais reculer : les projets envoyés par
-- plusieurs navigateurs et le miroir Polar livré par webhooks désordonnés.

create function public.upsert_project_lww(
  project_id uuid,
  project_user_id uuid,
  project_name text,
  project_data jsonb,
  project_updated_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  written boolean;
begin
  insert into public.projects (id, user_id, name, data, updated_at)
  values (project_id, project_user_id, project_name, project_data, project_updated_at)
  on conflict (id) do update
    set user_id = excluded.user_id,
        name = excluded.name,
        data = excluded.data,
        updated_at = excluded.updated_at
    where excluded.updated_at > public.projects.updated_at
  returning true into written;

  return coalesce(written, false);
end;
$$;

revoke all on function public.upsert_project_lww(uuid, uuid, text, jsonb, timestamptz)
  from public, anon;
grant execute on function public.upsert_project_lww(uuid, uuid, text, jsonb, timestamptz)
  to authenticated;

-- L'horodatage appartient au message signé par Polar. `updated_at`, lui, dit
-- seulement quand notre serveur a reçu le message et ne permet donc pas de
-- reconnaître un ancien état arrivé en retard.
alter table public.entitlements
  add column source_updated_at timestamptz;

create function public.apply_entitlements_if_newer(
  p_user_id uuid,
  p_polar_customer_id text,
  p_licence_granted_at timestamptz,
  p_cloud_status text,
  p_cloud_period_end timestamptz,
  p_source_updated_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  written boolean;
  current_source timestamptz;
begin
  insert into public.entitlements (
    user_id,
    polar_customer_id,
    licence_granted_at,
    cloud_status,
    cloud_period_end,
    source_updated_at,
    updated_at
  ) values (
    p_user_id,
    p_polar_customer_id,
    p_licence_granted_at,
    p_cloud_status,
    p_cloud_period_end,
    p_source_updated_at,
    now()
  )
  on conflict (user_id) do update
    set polar_customer_id = excluded.polar_customer_id,
        licence_granted_at = excluded.licence_granted_at,
        cloud_status = excluded.cloud_status,
        cloud_period_end = excluded.cloud_period_end,
        source_updated_at = excluded.source_updated_at,
        updated_at = now()
    where public.entitlements.source_updated_at is null
       or excluded.source_updated_at > public.entitlements.source_updated_at
  returning true into written;

  if written then
    return 'written';
  end if;

  select source_updated_at
    into current_source
    from public.entitlements
    where user_id = p_user_id;

  if p_source_updated_at < current_source then
    return 'ignored';
  end if;
  return 'unchanged';
end;
$$;

revoke all on function public.apply_entitlements_if_newer(
  uuid, text, timestamptz, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_entitlements_if_newer(
  uuid, text, timestamptz, text, timestamptz, timestamptz
) to service_role;
