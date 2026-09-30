-- PRINTORA V38
-- Выполнить один раз в Supabase SQL Editor.
alter table public.calculations drop constraint if exists calculations_mode_check;
alter table public.calculations add constraint calculations_mode_check check (mode in ('quick','detail','machine','material'));
create index if not exists calculations_user_mode_created_idx on public.calculations (user_id, mode, created_at desc);
drop policy if exists "Users read own calculations" on public.calculations;
create policy "Users read own calculations" on public.calculations for select using (auth.uid() = user_id);
drop policy if exists "Users insert own calculations" on public.calculations;
create policy "Users insert own calculations" on public.calculations for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own calculations" on public.calculations;
create policy "Users update own calculations" on public.calculations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own calculations" on public.calculations;
create policy "Users delete own calculations" on public.calculations for delete using (auth.uid() = user_id);
