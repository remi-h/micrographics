-- Saved canvases and uploaded symbols, one owner each.
--
-- The app talks to these tables straight from the browser with the public
-- key, so row-level security is the whole of the access control: every policy
-- below limits a signed-in user to the rows carrying their own id.

create table public.canvases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- The editor's saved state, as lib/persistence.ts writes it.
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index canvases_owner_recent on public.canvases (user_id, updated_at desc);

create table public.symbols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- Sanitized SVG text; see lib/customSymbols.ts for the limit.
  svg text not null check (char_length(svg) between 1 and 200000),
  created_at timestamptz not null default now()
);

create index symbols_owner_recent on public.symbols (user_id, created_at desc);

alter table public.canvases enable row level security;
alter table public.symbols enable row level security;

create policy "Owners manage their canvases" on public.canvases
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners manage their symbols" on public.symbols
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger canvases_touch_updated_at
  before update on public.canvases
  for each row execute function public.touch_updated_at();
