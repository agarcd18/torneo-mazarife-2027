-- ============================================================================
-- TORNEO DE FÚTBOL SALA · VILLAR DE MAZARIFE
-- Esquema completo de Supabase (Postgres + RLS con Contraseña Maestra + Realtime + Storage)
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. TABLA DE ORGANIZADORES Y FUNCIÓN DE AUTORIZACIÓN (Mazarife25 + Supabase Auth)
create table if not exists public.organizers (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.organizers enable row level security;

-- Función RLS centralizada:
-- Autoriza la escritura (INSERT / UPDATE / DELETE) si:
--   A) El cliente web ha iniciado sesión con la contraseña maestra 'Mazarife25'
--      (enviada automáticamente por la app en la cabecera HTTP 'x-torneo-key'), O
--   B) El usuario tiene sesión de Supabase Auth y su email está en public.organizers.
create or replace function public.is_organizer()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hdrs json;
  master_key text;
  jwt_email text;
begin
  begin
    hdrs := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
    master_key := coalesce(hdrs ->> 'x-torneo-key', '');
  exception when others then
    master_key := '';
  end;

  if master_key = 'Mazarife25' then
    return true;
  end if;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if jwt_email <> '' and exists (select 1 from public.organizers where lower(email) = jwt_email) then
    return true;
  end if;

  return false;
end;
$$;

drop policy if exists "organizers_read_self" on public.organizers;
create policy "organizers_read_self" on public.organizers
  for select using (public.is_organizer());

-- 2. EQUIPOS (Incluye control de pagos de FASE 1: payment_status y payment_amount)
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#1f7a4a',
  group_name text check (group_name in ('A', 'B')),
  group_order integer,
  payment_status text not null default 'pending' check (payment_status in ('paid', 'pending')),
  payment_amount numeric(10,2),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.teams add column if not exists payment_status text not null default 'pending';
alter table public.teams add column if not exists payment_amount numeric(10,2);
alter table public.teams add column if not exists paid_at timestamptz;

-- 3. JUGADORES (Nombre, dorsal, check de portero)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  number integer,
  is_goalkeeper boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_players_team on public.players(team_id);

-- 4. PARTIDOS (Con cronómetro inteligente por timestamp)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('group', 'QF', 'SF', 'F')),
  group_name text check (group_name in ('A', 'B')),
  round integer,
  code text,
  match_date text,
  match_time text,
  court integer default 1,
  sort_index integer not null default 0,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'live', 'finished')),
  walkover_winner_id uuid references public.teams(id) on delete set null,
  penalty_home integer,
  penalty_away integer,
  clock_running boolean not null default false,
  clock_base integer not null default 0,
  clock_started_at timestamptz,
  period integer not null default 1,
  created_at timestamptz not null default now()
);

-- 5. GOLES (Los penaltis de tanda van en matches.penalty_home/away y NO suman aquí)
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  minute integer,
  own_goal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_goals_match on public.goals(match_id);

-- 6. TARJETAS (Amarilla = 1pt FP, Roja = 3pts FP)
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  minute integer,
  card_type text not null check (card_type in ('yellow', 'red')),
  second_yellow boolean not null default false,
  suspension_matches integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_cards_match on public.cards(match_id);

-- 7. PORTEROS POR PARTIDO
create table if not exists public.goalkeepers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  from_minute integer not null default 0,
  created_at timestamptz not null default now()
);

-- 8. AJUSTES DEL TORNEO (Cuota de inscripción, contabilidad, sorteos, tasca, anuncios)
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

-- 9. MOVIMIENTOS DE CONTABILIDAD (FASE 2)
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  category text not null,
  concept text not null,
  amount numeric(10,2) not null check (amount >= 0),
  entry_date text not null default to_char(now(), 'YYYY-MM-DD'),
  created_at timestamptz not null default now()
);

-- 10. TABLÓN DE ANUNCIOS, TASCA Y GALERÍA (FASE 5)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  event_time text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tasca_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Bocadillos',
  name text not null,
  price numeric(10,2) not null,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  public_url text not null,
  author_name text,
  caption text,
  created_at timestamptz not null default now()
);

-- 11. HISTORIAL DE AUDITORÍA AUTOMÁTICO
create table if not exists public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_email text,
  table_name text not null,
  action text not null,
  row_id text,
  old_data jsonb,
  new_data jsonb
);

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid text;
  who text;
begin
  who := coalesce(nullif(auth.jwt() ->> 'email', ''), 'Organizador (Mazarife25)');
  if tg_op = 'DELETE' then
    rid := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key');
    insert into public.audit_log (actor_email, table_name, action, row_id, old_data, new_data)
    values (who, tg_table_name, tg_op, rid, to_jsonb(old), null);
    return old;
  else
    rid := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key');
    insert into public.audit_log (actor_email, table_name, action, row_id, old_data, new_data)
    values (who, tg_table_name, tg_op, rid, case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
    return new;
  end if;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['teams','players','matches','goals','cards','goalkeepers','settings','finance_entries','photos']
  loop
    execute format('drop trigger if exists trg_audit_%I on public.%I;', t, t);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.log_audit_event();', t, t);
  end loop;
end $$;

-- ============================================================================
-- POLÍTICAS RLS (Lectura pública / Escritura autorizada con Mazarife25)
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['teams','players','matches','goals','cards','goalkeepers','settings','announcements','tasca_items','photos']
  loop
    t := trim(t);
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%I_public_read" on public.%I;', t, t);
    execute format('create policy "%I_public_read" on public.%I for select using (true);', t, t);
    execute format('drop policy if exists "%I_org_write" on public.%I;', t, t);
    execute format('create policy "%I_org_write" on public.%I for all using (public.is_organizer()) with check (public.is_organizer());', t, t);
  end loop;
end $$;

-- Permitir a los asistentes del torneo subir fotos colaborativas en public.photos
drop policy if exists "photos_public_insert" on public.photos;
create policy "photos_public_insert" on public.photos
  for insert with check (true);

-- Finanzas y Auditoría: protegidas por public.is_organizer() (Mazarife25)
alter table public.finance_entries enable row level security;
drop policy if exists "finance_org_all" on public.finance_entries;
create policy "finance_org_all" on public.finance_entries
  for all using (public.is_organizer()) with check (public.is_organizer());

alter table public.audit_log enable row level security;
drop policy if exists "audit_org_read" on public.audit_log;
create policy "audit_org_read" on public.audit_log
  for select using (public.is_organizer());

-- ============================================================================
-- 12. SUPABASE STORAGE: BUCKET PÚBLICO PARA GALERÍA DE FOTOS (MÁX. 5 MB)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-photos',
  'tournament-photos',
  true,
  5242880, -- 5 MB exactos
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880;

drop policy if exists "photos_storage_public_read" on storage.objects;
create policy "photos_storage_public_read" on storage.objects
  for select using (bucket_id = 'tournament-photos');

drop policy if exists "photos_storage_public_upload" on storage.objects;
create policy "photos_storage_public_upload" on storage.objects
  for insert with check (bucket_id = 'tournament-photos');

drop policy if exists "photos_storage_org_delete" on storage.objects;
create policy "photos_storage_org_delete" on storage.objects
  for delete using (bucket_id = 'tournament-photos');

-- ============================================================================
-- 13. REALTIME: PUBLICAR TABLAS PARA ACTUALIZACIONES EN VIVO
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['teams','players','matches','goals','cards','goalkeepers','settings','photos']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
