-- PRINTORA V40.1
-- Выполнить ОДИН РАЗ в Supabase → SQL Editor.
-- Создаёт/исправляет расчётную историю и отдельные облачные справочники.
create extension if not exists pgcrypto;

-- ================================================================
-- 1. История расчётов
-- ================================================================
create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  calculation_data jsonb not null default '{}'::jsonb,
  order_number_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.calculations add column if not exists order_number_key text;
alter table public.calculations add column if not exists updated_at timestamptz not null default now();
create index if not exists calculations_user_created_idx on public.calculations(user_id,created_at desc);
create index if not exists calculations_user_mode_created_idx on public.calculations(user_id,mode,created_at desc);

-- Заполняем order_number_key только для уже уникальных номеров.
with x as (
  select id,user_id,nullif(lower(btrim(coalesce(calculation_data->>'order_number',''))),'') as k,
         count(*) over(partition by user_id,nullif(lower(btrim(coalesce(calculation_data->>'order_number',''))),'')) as cnt
  from public.calculations where mode in ('quick','detail')
)
update public.calculations c set order_number_key=x.k
from x where c.id=x.id and x.k is not null and x.cnt=1;

create unique index if not exists calculations_user_order_number_key_uidx
  on public.calculations(user_id,order_number_key)
  where order_number_key is not null and order_number_key<>'';

create or replace function public.printora_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists trg_printora_calculations_updated_at on public.calculations;
create trigger trg_printora_calculations_updated_at before update on public.calculations
for each row execute function public.printora_set_updated_at();

alter table public.calculations enable row level security;
grant usage on schema public to authenticated;
revoke all on table public.calculations from anon,authenticated;
grant select,insert,update,delete on table public.calculations to authenticated;
drop policy if exists "Users read own calculations" on public.calculations;
create policy "Users read own calculations" on public.calculations for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Users insert own calculations" on public.calculations;
create policy "Users insert own calculations" on public.calculations for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users update own calculations" on public.calculations;
create policy "Users update own calculations" on public.calculations for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users delete own calculations" on public.calculations;
create policy "Users delete own calculations" on public.calculations for delete to authenticated using ((select auth.uid())=user_id);

-- ================================================================
-- 2. Материалы
-- ================================================================
create table if not exists public.printora_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_key text generated always as (lower(trim(name))) stored,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Удаляем старые дубли по одному пользователю/названию, оставляя самую раннюю запись.
with ranked as (
  select id,row_number() over(partition by user_id,name_key order by created_at asc,id asc) rn
  from public.printora_materials
)
delete from public.printora_materials m using ranked r where m.id=r.id and r.rn>1;
create unique index if not exists printora_materials_user_name_uq on public.printora_materials(user_id,name_key);
create index if not exists printora_materials_user_created_idx on public.printora_materials(user_id,created_at desc);
alter table public.printora_materials enable row level security;
grant usage on schema public to authenticated;
revoke all on table public.printora_materials from anon,authenticated;
grant select,insert,update,delete on table public.printora_materials to authenticated;
drop policy if exists "Users read own printora materials" on public.printora_materials;
create policy "Users read own printora materials" on public.printora_materials for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Users insert own printora materials" on public.printora_materials;
create policy "Users insert own printora materials" on public.printora_materials for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users update own printora materials" on public.printora_materials;
create policy "Users update own printora materials" on public.printora_materials for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users delete own printora materials" on public.printora_materials;
create policy "Users delete own printora materials" on public.printora_materials for delete to authenticated using ((select auth.uid())=user_id);

-- ================================================================
-- 3. Станки
-- ================================================================
create table if not exists public.printora_machines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_key text generated always as (lower(trim(name))) stored,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
with ranked as (
  select id,row_number() over(partition by user_id,name_key order by created_at asc,id asc) rn
  from public.printora_machines
)
delete from public.printora_machines m using ranked r where m.id=r.id and r.rn>1;
create unique index if not exists printora_machines_user_name_uq on public.printora_machines(user_id,name_key);
create index if not exists printora_machines_user_created_idx on public.printora_machines(user_id,created_at desc);
alter table public.printora_machines enable row level security;
grant usage on schema public to authenticated;
revoke all on table public.printora_machines from anon,authenticated;
grant select,insert,update,delete on table public.printora_machines to authenticated;
drop policy if exists "Users read own printora machines" on public.printora_machines;
create policy "Users read own printora machines" on public.printora_machines for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Users insert own printora machines" on public.printora_machines;
create policy "Users insert own printora machines" on public.printora_machines for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users update own printora machines" on public.printora_machines;
create policy "Users update own printora machines" on public.printora_machines for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users delete own printora machines" on public.printora_machines;
create policy "Users delete own printora machines" on public.printora_machines for delete to authenticated using ((select auth.uid())=user_id);

-- ================================================================
-- 4. Разовая миграция старых библиотечных записей
-- ================================================================
insert into public.printora_materials(user_id,name,data,created_at,updated_at)
select user_id,trim(calculation_data->>'name'),
       jsonb_build_object('id',calculation_data->>'id','name',trim(calculation_data->>'name'),'type',coalesce(calculation_data->>'type','Материал'),'lengthM',coalesce(nullif(calculation_data->>'lengthM',''),'0'),'widthMm',coalesce(nullif(calculation_data->>'widthMm',''),'0'),'priceM2',coalesce(nullif(calculation_data->>'priceM2',''),'0')),
       created_at,now()
from public.calculations
where mode in ('detail','material') and trim(coalesce(calculation_data->>'__printora_library',''))='material' and trim(coalesce(calculation_data->>'name',''))<>''
on conflict(user_id,name_key) do nothing;

insert into public.printora_machines(user_id,name,data,created_at,updated_at)
select user_id,trim(calculation_data->>'name'),
       jsonb_build_object('id',calculation_data->>'id','name',trim(calculation_data->>'name'),'type',coalesce(calculation_data->>'type','Другое'),'speed',coalesce(nullif(calculation_data->>'speed',''),'0'),'power',coalesce(nullif(calculation_data->>'power',''),'0'),'setup',coalesce(nullif(calculation_data->>'setup',''),'0'),'machineRate',coalesce(nullif(calculation_data->>'machineRate',''),'0'),'laborRate',coalesce(nullif(calculation_data->>'laborRate',''),'0'),'powerRate',coalesce(nullif(calculation_data->>'powerRate',''),'0')),
       created_at,now()
from public.calculations
where mode in ('detail','machine') and trim(coalesce(calculation_data->>'__printora_library',''))='machine' and trim(coalesce(calculation_data->>'name',''))<>''
on conflict(user_id,name_key) do nothing;


-- ================================================================
-- 5. Финальная публикация схемы / PostgREST
-- ================================================================
-- Явно открываем схему public для API-ролей.
grant usage on schema public to authenticated;
grant select,insert,update,delete on table public.calculations to authenticated;
grant select,insert,update,delete on table public.printora_materials to authenticated;
grant select,insert,update,delete on table public.printora_machines to authenticated;

-- Проверяем, что все три таблицы действительно существуют.
do $$
begin
  if to_regclass('public.calculations') is null then raise exception 'PRINTORA: public.calculations не создана'; end if;
  if to_regclass('public.printora_materials') is null then raise exception 'PRINTORA: public.printora_materials не создана'; end if;
  if to_regclass('public.printora_machines') is null then raise exception 'PRINTORA: public.printora_machines не создана'; end if;
end;
$$;

notify pgrst,'reload schema';

select
  to_regclass('public.calculations') as calculations,
  to_regclass('public.printora_materials') as printora_materials,
  to_regclass('public.printora_machines') as printora_machines;
