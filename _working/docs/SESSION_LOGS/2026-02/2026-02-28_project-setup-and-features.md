# Session Log: Rezepti - Projekt-Setup, Features & Docker-Deployment

**Date**: 2026-02-28
**Duration**: ~4 Stunden
**Status**: In Progress (Docker-Build laeuft auf NAS)
**Participants**: Tobi, Claude Code

---

## SESSION SUMMARY

Rezepti-Projekt von Grund auf eingerichtet: Notion-Integration konfiguriert (API-Key, Database, Connection), erster erfolgreicher Import (Chefkoch Kartoffelsalat). Dann 4 Features implementiert: Token-Logging, Vorschau mit Bearbeitung vor Export, Foto-Upload via Claude Vision, Freitext-Import. Portionen-Dropdown (2-10 Personen) mit client-seitiger Mengenumrechnung hinzugefuegt. Docker-Deployment fuer Synology DS918+ vorbereitet — Container baut gerade auf dem NAS.

---

## COMPLETED WORK

### Notion Setup
- Integration "Rezepti" (Internal) erstellt auf notion.so/profile/integrations
- Datenbank mit allen Properties angelegt (Name, Link, Foto, Kochdauer, Tags, Ausprobiert, Kalorien, Quelle)
- Connection zwischen Integration und Datenbank hergestellt
- .env konfiguriert: ANTHROPIC_API_KEY, NOTION_TOKEN, NOTION_DATABASE_ID
- Erster erfolgreicher Import: Omas Berliner Kartoffelsalat von Chefkoch

### Features Implementiert
1. **Token-Logging** (recipe-analyzer.ts, server.ts, app.js)
   - Claude API response.usage wird geloggt (Terminal + UI)
   - Kosten in Cent berechnet (Sonnet 4 Pricing)
   - Commit: 9ce6b1c

2. **Vorschau + Bearbeiten vor Export** (server.ts, app.js, index.html, style.css)
   - Pipeline pausiert nach Claude-Analyse im "preview" Step
   - Neuer /api/confirm/:jobId Endpoint fuer Bestaetigung
   - Editierbare Felder: Name, Kochdauer, Kalorien, Tags, Zutaten, Zubereitung

3. **Portionen-Dropdown** (app.js, index.html, recipe-analyzer.ts, types.ts)
   - Dropdown 2-10 Personen, Default 4
   - Client-seitige Mengenumrechnung (kein extra API-Call)
   - Claude liefert immer fuer 4 Portionen (80kg/180cm Referenz)

4. **Anmerkungen/Notizen** (notion-exporter.ts, app.js, index.html)
   - Freitext-Feld im Vorschau-Screen
   - Landen als "Anmerkungen" Abschnitt in Notion-Seite

5. **Foto-Upload** (recipe-analyzer.ts, server.ts, app.js, index.html, style.css)
   - Drag & Drop oder Klick
   - Base64 an /api/import-photo
   - Claude Vision analysiert Bild

6. **Freitext-Import** (server.ts, app.js, index.html, style.css)
   - Textarea fuer eigene Rezepte / Verfeinerungstipps
   - /api/import-text Endpoint

### Docker-Deployment vorbereitet
- Dockerfile: node:22-bookworm + Playwright + yt-dlp + ffmpeg + Whisper
- docker-compose.yml mit env_file und restart policy
- .dockerignore

### Synology-Infrastruktur
- DDNS: extraplus.synology.me (bereits konfiguriert, Status Normal)
- Let's Encrypt Zertifikat vorhanden
- Reverse Proxy: HTTPS extraplus.synology.me:8443 -> HTTP localhost:3000
- Port-Weiterleitung 8443 im Speedport eingerichtet
- Firewall konfiguriert (lokal + extern + deny-all)
- Docker-Gruppe fuer admin_tobi eingerichtet
- Projekt via tar + scp -O auf NAS kopiert

---

## DECISIONS MADE

### Decision 1: Port 8443 statt 443 fuer Reverse Proxy
**Context**: DSM reserviert Port 443 fuer sich
**Decision**: Externer Port 8443 via Reverse Proxy
**Result**: https://extraplus.synology.me:8443

### Decision 2: Client-seitige Portionen-Umrechnung
**Context**: Mengenangaben skalieren bei Portionenaenderung
**Decision**: JavaScript-basiert im Browser statt extra Claude API-Call
**Rationale**: Guenstiger, schneller, kein Token-Verbrauch

### Decision 3: Mit Whisper im Docker-Image
**Context**: Whisper macht Image ~2GB groesser
**Decision**: User will es dabei haben fuer Videos ohne Untertitel

---

## KNOWN ISSUES

### Active
1. **Docker-Build laeuft noch auf NAS** — Ergebnis in naechster Session pruefen
2. **NAT Loopback** — Speedport Smart 4 kann externe URL nicht von innen erreichen. Nur von ausserhalb testen.
3. **Kochdauer/Quelle Spaltentypen** — User sagt "Select" (Pfeil-Icon), aber im Screenshot sah es anders aus. Bei Fehlern pruefen.

### Potentielle Issues
- Playwright im Docker auf Synology (ARM/Intel Kompatibilitaet) — DS918+ ist Intel, sollte OK sein
- Whisper Memory-Verbrauch auf DS918+ (4GB RAM) — koennte eng werden bei langen Videos

---

## METRICS

### Git
- Branch: main
- Commits: ff91868 (initial) → 9ce6b1c (features + docker)
- Files changed: 11
- Lines: +680, -28

### API Keys konfiguriert
- ANTHROPIC_API_KEY: sk-ant-api03-... (Claude Platform)
- NOTION_TOKEN: ntn_498081... (Internal Integration)
- NOTION_DATABASE_ID: 315b98cc851f808cb78af12847b8f619

---

## NEXT STEPS (Priority Order)

### Immediate (Naechste Session)
1. **Docker-Build Status pruefen** auf NAS
   ```bash
   ssh -i ~/.ssh/synology_key admin_tobi@extraplus.local "/usr/local/bin/docker ps"
   ssh -i ~/.ssh/synology_key admin_tobi@extraplus.local "/usr/local/bin/docker logs rezepti-rezepti-1"
   ```
2. **Externen Zugang testen**: `curl -k https://extraplus.synology.me:8443`
3. **Rezept von unterwegs importieren** (Mobilnetz)

### Falls Docker-Build fehlschlaegt
- Logs pruefen: `/usr/local/bin/docker compose logs`
- Haeufigster Fehler: Playwright install braucht spezielle Deps
- Alternative: Playwright aus Dockerfile entfernen, nur Freitext/Foto-Import nutzen

### Spaeter
- Verfeinerter Kartoffelsalat per Freitext-Import testen
- iOS Shortcut zum schnellen Import von URLs
- Sicherheit: Basic Auth oder Token-Schutz fuer externen Zugang

---

## LEARNINGS & INSIGHTS

### Synology Docker Deployment
- Docker nicht im PATH → `/usr/local/bin/docker`
- rsync + 2FA = kaputt → tar + `scp -O` nutzen
- Docker-Socket Permissions: User in docker-Gruppe + neu einloggen
- Alles dokumentiert in: `~/.claude/skills/synology-docker-deploy/SKILL.md`

### Notion API
- SDK v5.11.0 nutzt automatisch API-Version 2025-09-03
- Internal Integration reicht (kein OAuth noetig)
- Connection muss auf der Datenbank-Seite hergestellt werden (nicht in Settings)

### Speedport Smart 4
- Kein NAT Loopback — externe URLs nur von aussen testbar
- Port 443 Weiterleitung funktioniert (trotz bekannter Probleme)
- Echte oeffentliche IPv4 (kein CGNAT bei diesem Anschluss)

---

## CONTEXT RESTORATION GUIDE

### Quick Start (2 min)
1. Docker-Status pruefen: `ssh -i ~/.ssh/synology_key admin_tobi@extraplus.local "/usr/local/bin/docker ps"`
2. Falls laeuft: `curl -k https://extraplus.synology.me:8443`
3. Falls nicht: Logs checken und Dockerfile fixen

### Dev-Server lokal starten
```bash
cd "/Users/tobi/Documents/CLAUDE_CODE/[17] REZEPTI"
npm run dev
# -> http://localhost:3000
```

### Dateien aufs NAS updaten
```bash
cd "/Users/tobi/Documents/CLAUDE_CODE/[17] REZEPTI"
tar czf /tmp/rezepti.tar.gz --exclude node_modules --exclude dist --exclude _working --exclude _archive --exclude .git .
scp -O -i ~/.ssh/synology_key /tmp/rezepti.tar.gz admin_tobi@extraplus.local:/volume1/docker/rezepti/
ssh -i ~/.ssh/synology_key admin_tobi@extraplus.local "cd /volume1/docker/rezepti && tar xzf rezepti.tar.gz && rm rezepti.tar.gz && /usr/local/bin/docker compose up -d --build"
```

---

**Session End**: 2026-02-28 19:00
**Next Session**: Docker-Build pruefen + externen Zugang testen
