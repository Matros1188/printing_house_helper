create extension if not exists pgcrypto;

create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('quick','detail','machine','material')),
  calculation_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists calculations_user_created_idx
on public.calculations (user_id, created_at desc);

create index if not exists calculations_user_mode_created_idx
on public.calculations (user_id, mode, created_at desc);

alter table public.calculations enable row level security;

drop policy if exists "Users read own calculations" on public.calculations;
create policy "Users read own calculations"
on public.calculations for select
using (auth.uid() = user_id);

drop policy if exists "Users insert own calculations" on public.calculations;
create policy "Users insert own calculations"
on public.calculations for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own calculations" on public.calculations;
create policy "Users update own calculations"
on public.calculations for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own calculations" on public.calculations;
create policy "Users delete own calculations"
on public.calculations for delete
using (auth.uid() = user_id);
