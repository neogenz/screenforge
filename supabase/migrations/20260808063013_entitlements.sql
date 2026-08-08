-- Le miroir des droits achetés.
--
-- Une ligne par compte, écrite par le seul backend, lue par son titulaire.
-- Ce n'est pas la source de vérité : Polar l'est. C'est une projection, réécrite
-- en entier à chaque `customer.state_changed`, pour que l'éditeur sache ce qu'il
-- a le droit de faire sans interroger un tiers à chaque export.
--
-- Deux droits, pas un plan. La Licence est un achat unique et perpétuel — une
-- date d'acquisition, jamais d'échéance. Le Cloud est un abonnement annuel — un
-- statut et une fin de période. Une colonne `plan text` ne peut pas porter
-- « a payé une fois, et est abonné depuis mars ».

create table public.entitlements (
  -- Le compte est la clé : un utilisateur, une ligne, pour toujours. Pas de
  -- `id` de substitution — il n'y a rien à distinguer de plus.
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- L'identifiant Polar du client, gardé pour tracer un droit jusqu'à sa vente.
  -- Le lien inverse ne demande aucune table de correspondance : le checkout
  -- pose `external_customer_id` = l'`id` Supabase.
  polar_customer_id text not null,
  -- Perpétuelle : une date d'octroi et rien d'autre. Une résiliation du Cloud
  -- ne l'efface jamais ; seul un remboursement de la Licence le fait, en
  -- révoquant le bénéfice côté Polar.
  licence_granted_at timestamptz,
  -- Le statut de l'abonnement Cloud tel que Polar le donne, ou `null` quand il
  -- n'y en a pas. Volontairement du texte libre : c'est la valeur d'un tiers,
  -- et un `check` ici casserait à la première valeur qu'il ajoute.
  cloud_status text,
  cloud_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Une seule policy, et un seul verbe.
--
-- Le titulaire lit sa ligne, et c'est tout ce qu'il peut faire : un droit qu'on
-- peut s'écrire soi-même n'est pas un droit, c'est un champ de formulaire. Les
-- écritures passent par le rôle `service_role`, qui court-circuite la RLS et
-- ne vit que dans le backend.
create policy "entitlements_select_own"
  on public.entitlements for select to authenticated
  using ((select auth.uid()) = user_id);

-- Les GRANT disent la même chose une seconde fois, un cran plus bas : même si
-- une policy d'écriture était ajoutée par erreur, `authenticated` n'aurait pas
-- le droit de table qui va avec.
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;

-- `service_role` court-circuite la RLS, mais pas les droits de table : sans
-- cette ligne, le webhook remonterait `permission denied for table entitlements`
-- après un paiement encaissé. Les privilèges par défaut du schéma ne s'appliquent
-- pas aux tables créées par les migrations — mesuré : le rôle n'avait que
-- REFERENCES, TRIGGER et TRUNCATE.
grant select, insert, update, delete on public.entitlements to service_role;
