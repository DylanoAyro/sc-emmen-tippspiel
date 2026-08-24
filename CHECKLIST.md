# Checkliste: Tippspiel hosten (mit Claude Code durcharbeiten)

Ziel: Aus dem Claude.ai-Artifact eine eigenständige Website machen, die unter einer
eigenen URL läuft und die alle Kollegen gemeinsam nutzen können.

Am besten Punkt für Punkt mit Claude Code abarbeiten, nicht alles auf einmal.

---

## Phase 1 — Supabase Projekt aufsetzen (Datenbank statt `window.storage`)

- [x] Account auf supabase.com erstellen (kostenloser Free-Tier reicht)
- [x] Neues Projekt anlegen (Name z.B. `sc-emmen-tippspiel`, Region Europa wählen)
- [x] Im SQL-Editor die Tabellen anlegen (siehe `supabase/schema.sql`):
  - [x] `matches` (id, opponent, home_away, kickoff, specials jsonb, status,
        ergebnis_heim, ergebnis_gast, special_antworten jsonb)
  - [x] `tips` (id, match_id → FK auf matches, name, heim, gast, spezial jsonb,
        submitted_at) — Unique-Constraint auf (match_id, name), damit ein Update
        statt Duplikat entsteht
- [x] Row Level Security (RLS) für beide Tabellen aktivieren
- [x] Policy anlegen: **Lesen** für alle erlaubt (anon)
- [x] Policy anlegen: **Schreiben/Update/Löschen** für alle erlaubt (anon) — bewusst
      offen, da kein Login-System geplant ist (siehe Phase 4 für Absicherung)
- [x] `Project URL` und `anon public key` (heute: "Publishable key") aus den
      Projekteinstellungen kopiert (Settings → Data API / API Keys)

## Phase 2 — Code umbauen (mit Claude Code)

- [x] Claude Code im `sc-emmen-tippspiel`-Ordner starten
- [x] Supabase JS-Client einbinden (per CDN-Script-Tag reicht, kein Build-Step nötig:
      `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`)
- [x] `index.html` in `index.html` + `app.js` + `config.js` aufgeteilt
- [x] In `config.js` Supabase URL + anon key eingetragen (Hinweis: anon key ist dafür
      gedacht, öffentlich im Frontend zu stehen — ist kein Geheimnis, RLS regelt den
      Zugriff)
- [x] Alle `storageGet`/`storageSet`/`storageList`-Aufrufe durch Supabase-Client-Calls
      ersetzt:
  - [x] `loadMatches()` → `supabase.from('matches').select('*').order('kickoff')`
  - [x] Matches: `insertMatch`/`updateMatchResult`/`deleteMatchRow` statt ganzes Array
        überschreiben (sauberer als der Artifact-Ansatz)
  - [x] `loadTipsForMatch()` → `supabase.from('tips').select('*').eq('match_id', id)`
  - [x] `saveTip()` → `supabase.from('tips').upsert(..., { onConflict: 'match_id,name' })`
  - [x] `username` läuft jetzt über `localStorage` (normale Website, kein
        Claude-Artifact mehr)
- [x] Lokal getestet (Playwright-Smoke-Test via `npx serve`): Tippen/Speichern/
      Resultat erfassen/Rangliste/Löschen funktionieren fehlerfrei gegen Supabase
- [ ] Mit zwei Browser-Tabs/-Profilen testen, ob Tipps von "zwei Personen" beide
      korrekt ankommen (Konfliktfall aus dem Artifact-Ansatz ist jetzt gelöst)

## Phase 3 — Deployment

- [x] Netlify-Account erstellt (Login via GitHub)
- [x] Repo auf GitHub gepusht (`DylanoAyro/sc-emmen-tippspiel`)
- [x] Bei Netlify: "Import an existing project" → Repo ausgewählt
- [x] Build-Settings: kein Build-Command nötig (statisches HTML), Publish-Directory
      Projekt-Root
- [x] Deploy ausgelöst, URL getestet (Playwright-Smoke-Test gegen Live-Seite:
      Tippen/Speichern funktioniert fehlerfrei)
- [x] Subdomain-Name eingestellt: **auratippspiel.netlify.app**

## Phase 4 — Absicherung (optional, aber empfohlen)

- [x] Entschieden: simpler Schutz gewünscht, nicht nur Ehrensystem
- [x] Admin-Tab-Passwort (client-seitig, `ADMIN_PASSWORD` in `config.js`) — kein
      echter Sicherheitsmechanismus, hält aber Zufalls-Klicker fern
- [x] Zusätzlich (über Checkliste hinaus): einfaches Name+Passwort-"Login" für alle
      Tippenden via neuer `players`-Tabelle (Login-Overlay beim Start) — schützt
      Namen davor, dass jemand anders versehentlich/mutwillig unter fremdem Namen
      tippt. Passwörter liegen im Klartext in einer via RLS offen lesbaren Tabelle
      (kein echtes Auth-System, gleiche Einschränkung wie beim Admin-Passwort)
- [ ] Für "richtigen" Schutz später: Supabase Auth (Magic Link per E-Mail) einbauen,
      dann RLS-Policies auf eingeloggte User statt komplett offen umstellen — nicht
      nötig für den Start, nice-to-have später

## Phase 5 — Feinschliff

- [ ] Spielplan für die aktuelle Saison eintragen (manuell, siehe README)
- [ ] Testrunde mit 1-2 Kollegen machen, bevor der Link an alle geht
- [ ] Link in der Team-Gruppe teilen 🎉

---

**Tipp für die Arbeit mit Claude Code:** nicht die ganze Checkliste als einen Prompt
reingeben. Pro Sitzung 1-2 Punkte, dann testen, dann weiter — sonst wird der Diff riesig
und schwer zu debuggen.
