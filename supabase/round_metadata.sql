-- round_metadata — off-chain, cosmetic-only decorations for a round: an optional display
-- name and the greenhouse background theme. The round itself lives on Solana; nothing here
-- affects scoring, entries, or winners. Run once in the Supabase SQL editor.
--
-- Read by:    src/hooks/useRoundMetadata.ts (anon key, like round_winners / round_results)
-- Written by: the set-round-metadata edge function ONLY, with the service role key.
--
-- Re-running this file is safe, and it is also the fix-up script for projects provisioned
-- before the edge function existed: the drops below remove the old browser-writable policies.

create table if not exists public.round_metadata (
  round_number integer primary key,
  name         text,
  background   text not null default 'classic',
  created_at   timestamptz not null default now()
);

alter table public.round_metadata enable row level security;

-- Public read: every player needs the active round's name and background.
drop policy if exists "round_metadata is publicly readable" on public.round_metadata;
create policy "round_metadata is publicly readable"
  on public.round_metadata for select
  to anon, authenticated
  using (true);

-- Writes are authority-gated in the application layer and deliberately have NO policy here.
--
-- supabase/functions/set-round-metadata verifies an ed25519 signature from the connected
-- wallet over "secret-garden:open-round:<round>:<background>:<name>:<ts>", checks that wallet
-- against GameConfig.authority + its active operators read live from the chain, and only then
-- upserts with the service role key — which bypasses RLS. So "no write policy" is the point:
-- anything holding just the anon key (i.e. every browser) cannot write this table at all.
--
-- These two dropped policies are the superseded version, where any anon caller could set any
-- round's name and background. Keep the drops: they are what repairs an existing project.
drop policy if exists "round_metadata is anon-writable (cosmetic only)" on public.round_metadata;
drop policy if exists "round_metadata is anon-updatable (cosmetic only)" on public.round_metadata;

-- The value constraints the old policies carried, kept as table constraints so they hold for
-- every writer — including the service role.
do $$
begin
  alter table public.round_metadata
    add constraint round_metadata_background_valid check (background in ('classic', 'event'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.round_metadata
    add constraint round_metadata_name_len check (name is null or length(name) <= 60);
exception
  when duplicate_object then null;
end $$;
