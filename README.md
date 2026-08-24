# SC Emmen 3 – Tippspiel

Internes Tippspiel für die 5. Liga III Truppe. Jeder tippt vor Anpfiff das Resultat
(+ optionale Zusatzfragen), nach dem Spiel wird ausgewertet, es gibt eine Rangliste.

## Status

Aktuell ist `index.html` eine **einzelne, in sich geschlossene Datei** (HTML + CSS + JS,
kein Build-Step). Sie wurde ursprünglich als Claude.ai Artifact gebaut und nutzt dafür
die `window.storage` API, die Claude.ai bereitstellt (Key-Value-Speicher, shared zwischen
allen Nutzern des Artifacts).

## ⚠️ Wichtig, bevor ihr weiterbaut

`window.storage` existiert **nur innerhalb von Claude.ai Artifacts**. Öffnet ihr `index.html`
einfach lokal im Browser oder hostet sie irgendwo als normale Website, gibt's diese API nicht —
Tippen/Speichern/Rangliste funktioniert dann nicht.

Zwei Wege, wie's weitergehen kann:

1. **Als Claude.ai Artifact bleiben** — dann bleibt alles wie es ist, einfach den Artifact-Link
   mit den Kollegen teilen. Kein Hosting, kein Backend nötig, läuft aber nur über Claude.ai.
2. **Echtes eigenständiges Web-Projekt daraus machen** — dann braucht's einen Ersatz für die
   Storage-Schicht, z.B.:
   - Kleines Backend (Node/Express + SQLite/Postgres)
   - Supabase / Firebase (schnell startklar, kostenlos für kleine Gruppen)
   - Oder simpel: ein kleiner JSON-Server / Google Sheet als "Datenbank"

   In dem Fall müssten alle `window.storage.get/set/list`-Aufrufe in `index.html` (bzw. dann
   ausgelagert in ein `app.js`) durch echte API-Calls ersetzt werden. Die Datenstruktur
   (siehe unten) kann dabei gleich bleiben.

## Datenmodell (aktuell im Storage)

```
matches (shared key, JSON array)
  { id, opponent, homeAway: "heim"|"auswaerts", kickoff: ISO-string,
    specials: [{ id, frage, typ: "text"|"janein" }],
    status: "offen"|"beendet",
    ergebnis: { heim, gast } | null,
    specialAntworten: { [specialId]: antwort } | null }

tip:<matchId>:<username-slug> (shared key, JSON object, ein Key pro Person+Match)
  { name, heim, gast, spezial: { [specialId]: antwort }, submittedAt }

username (personal key, pro Browser/Person)
```

## Punktesystem (aktuell hartcodiert in `computePoints()`)

- Exaktes Resultat: 5 Punkte
- Richtige Tendenz (Sieg/Unentschieden/Niederlage): 2 Punkte
- Jede richtig beantwortete Zusatzfrage: 3 Punkte

## Bekannte Einschränkungen / offene TODOs

- [ ] Kein Login/Auth — jeder mit Zugriff kann auch im Admin-Tab Resultate eintragen
- [ ] Tipps sind vor Anpfiff nur UI-seitig versteckt, nicht wirklich serverseitig geschützt
- [ ] Spielplan muss manuell eingetragen werden (automatisches Auslesen von
      matchcenter.al-la.ch ist an der JS-lastigen Seite gescheitert — evtl. mit
      Playwright/Puppeteer lösbar, wenn gewünscht)
- [ ] Punkteregeln sind hartcodiert, nicht konfigurierbar
- [ ] Keine Spielerliste / feste Namen — jeder tippt unter selbstgewähltem Namen

## Struktur

```
sc-emmen-tippspiel/
├── index.html      # gesamte App (HTML/CSS/JS, keine Dependencies)
└── README.md        # diese Datei
```
