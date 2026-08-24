-- SC Emmen 3 Tippspiel — Phase 1: Supabase Schema
-- Im Supabase Dashboard unter "SQL Editor" ausführen.
-- Passend zum Datenmodell in README.md.

-- ============================================================
-- Tabelle: matches
-- ============================================================
create table matches (
  id                  text primary key,               -- z.B. 'm_1700000000000', vom Client erzeugt
  opponent            text not null,
  home_away           text not null check (home_away in ('heim', 'auswaerts')),
  kickoff             timestamptz not null,
  specials            jsonb not null default '[]',     -- [{ id, frage, typ: 'text'|'janein' }]
  status              text not null default 'offen' check (status in ('offen', 'beendet')),
  ergebnis_heim       integer,
  ergebnis_gast       integer,
  special_antworten   jsonb                             -- { [specialId]: antwort } | null
);

-- ============================================================
-- Tabelle: tips
-- ============================================================
create table tips (
  id             bigint generated always as identity primary key,
  match_id       text not null references matches(id) on delete cascade,
  name           text not null,
  heim           integer not null,
  gast           integer not null,
  spezial        jsonb not null default '{}',           -- { [specialId]: antwort }
  submitted_at   timestamptz not null default now(),
  unique (match_id, name)                                -- ein Tip pro Person+Match -> Upsert statt Duplikat
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table matches enable row level security;
alter table tips    enable row level security;

-- matches: anon darf alles (lesen, tippen ist kein Zugriff auf matches,
-- aber Admin-Tab legt/ändert/löscht Spiele -> braucht select/insert/update/delete)
create policy "matches_select_anon" on matches
  for select to anon using (true);

create policy "matches_insert_anon" on matches
  for insert to anon with check (true);

create policy "matches_update_anon" on matches
  for update to anon using (true) with check (true);

create policy "matches_delete_anon" on matches
  for delete to anon using (true);

-- tips: anon darf lesen, eigene Tipps schreiben/updaten (upsert),
-- delete offen gelassen (aktuell keine Lösch-Funktion für Tipps im Frontend,
-- aber konsistent mit "kein Login" Ansatz)
create policy "tips_select_anon" on tips
  for select to anon using (true);

create policy "tips_insert_anon" on tips
  for insert to anon with check (true);

create policy "tips_update_anon" on tips
  for update to anon using (true) with check (true);

create policy "tips_delete_anon" on tips
  for delete to anon using (true);
