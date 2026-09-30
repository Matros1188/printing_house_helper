-- PRINTORA V40 — обязательная облачная схема и защита данных
-- Выполнить ОДИН РАЗ в Supabase → SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  calculation_data jsonb not null default '{}'::jsonb,
  order_number_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calculations add column if not exists order_number_key text;
alter table public.calculations add column if not exists updated_at timestamptz not null default now();

alter table public.calculations drop constraint if exists calculations_mode_check;
alter table public.calculations add constraint calculations_mode_check
  check (mode in ('quick','detail','machine','material'));

create index if not exists calculations_user_created_idx
  on public.calculations (user_id, created_at desc);
create index if not exists calculations_user_mode_created_idx
  on public.calculations (user_id, mode, created_at desc);

-- Заполняем ключ номера заказа только там, где исторически номер уникален.
-- Старые дубли не блокируют выполнение миграции.
with normalized as (
  select
    id,
    user_id,
    nullif(lower(btrim(coalesce(calculation_data->>'order_number',''))),'') as k,
    count(*) over (partition by user_id, nullif(lower(btrim(coalesce(calculation_data->>'order_number',''))),'')) as cnt
  from public.calculations
  where mode in ('quick','detail')
), unique_rows as (
  select id, k from normalized where k is not null and cnt = 1
)
update public.calculations c
set order_number_key = u.k
from unique_rows u
where c.id = u.id
  and (c.order_number_key is null or c.order_number_key <> u.k);

create unique index if not exists calculations_user_order_number_key_uidx
  on public.calculations (user_id, order_number_key)
  where order_number_key is not null and order_number_key <> '';

create or replace function public.printora_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_printora_calculations_updated_at on public.calculations;
create trigger trg_printora_calculations_updated_at
before update on public.calculations
for each row execute function public.printora_set_updated_at();

alter table public.calculations enable row level security;

drop policy if exists "Users read own calculations" on public.calculations;
create policy "Users read own calculations" on public.calculations
for select using (auth.uid() = user_id);

drop policy if exists "Users insert own calculations" on public.calculations;
create policy "Users insert own calculations" on public.calculations
for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own calculations" on public.calculations;
create policy "Users update own calculations" on public.calculations
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own calculations" on public.calculations;
create policy "Users delete own calculations" on public.calculations
for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
