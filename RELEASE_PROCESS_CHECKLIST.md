# Release-Prozess-Umbau: Conventional Commits + git-basierter Changelog + Branch-Modell

Arbeitsdokument, wird gemeinsam abgearbeitet. Nach Abschluss auflösen:
Endzustand geht in `CONTRIBUTING.md` / `README Developer.md`, diese Datei
kann dann gelöscht werden.

## Entscheidungen (Phase 0, fix)

- **Changelog-Tool:** [git-cliff](https://git-cliff.org/) (kein npm-Paket,
  aber `gcl`/`github_changelog_generator` war es ohnehin nicht — Ruby
  fällt damit ganz weg). Reiner Git-Log-Reader, Issue-Link-Presets für
  GitHub und GitLab vorhanden.
- **Hook-Strenge:** Standard (feste Type-Enum, Subject-Case/Length-Regeln
  via `@commitlint/config-conventional`, ungekürzt). Begründung: kleines
  Projekt, keine API-Konsumenten, keine Breaking-Change-Pflicht nötig.
- **CI-Check für PRs:** ja, von Anfang an mitbauen (gleicher Aufwand wie
  ohne), damit externe Beiträge (z. B. von Fork-PRs) nicht nur am
  lokalen Hook vorbeikommen.
- **Zeitpunkt:** vor dem GitLab-Umzug. Grund: Changelog-Tool-Swap braucht
  ohnehin ein paar Releases mit echten Conventional Commits zum Testen,
  das erzwingt Vorlauf unabhängig vom Umzugstermin. Weniger gleichzeitige
  Variablen.

## Phase 1 — Konvention einführen (kein Zwang)

- [x] `CONTRIBUTING.md` angelegt: Conventional-Commits-Format dokumentiert
      (`type(scope): subject`, Types aus `@commitlint/config-conventional`),
      `Closes #123`/`Refs #123` als Footer-Konvention.
- [x] Verweis dazu in `README Developer.md` ergänzt.
- [ ] Externe Mitwirkende informieren.

## Phase 2 — Hook + CI (Standard-Strenge)

- [x] `commitlint` + `@commitlint/config-conventional` (21.2.2, exakt
      gepinnt) als `devDependency`; `commitlint.config.js` (ESM, Projekt
      ist `"type": "module"`) extends `@commitlint/config-conventional`
      ungekürzt.
- [x] `commit-msg`-Hook nach bestehender `git-hooks/`-Konvention
      (`git-hooks/CommitMsg.sh`, ruft `npx --no-install commitlint --edit`
      auf), manuell zu installieren wie `PreCommit.sh`/`branchChange.sh`
      (Anleitung in `README Developer.md`), kein Husky nötig.
- [ ] Merge-Strategie: PRs von externen/nicht-eingespielten Mitwirkenden
      (teils nur "Programmiervorschläge" ohne vollständige Dev-Umgebung)
      per **Squash-Merge** zusammenführen — bereits im Repo erlaubt
      (`squashMergeAllowed: true`). Rohe Zwischen-Commits müssen dann
      nicht konventionskonform sein, nur die finale (vom Mergenden
      geschriebene) Squash-Commit-Message zählt fürs Changelog. (Reiner
      Prozess-/Gewohnheits-Punkt, keine Repo-Einstellung nötig — beim
      Mergen jeweils "Squash and merge" statt "Merge" wählen.)
- [~] PR-Titel-Lint als CI-Check **zurückgestellt** (2026-09-12, User-
      Entscheidung): erst nach dem GitLab-Umzug direkt als GitLab-CI
      aufbauen, nicht mehr vorher als GitHub-Actions-Workflow (der wäre
      nur Wegwerf-Aufwand). Bis dahin: PR-Titel manuell beim Squash-Merge
      auf Konvention prüfen. Siehe Phase 7.
- [x] Kurztest: Fehlformat (`fixed the thing`) lokal gegen den installierten
      Hook geprüft → exit 1, zwei Fehler (`subject-empty`, `type-empty`).
      Korrektes Format (`fix(render): handle null flag value`) → exit 0.
- [ ] Hinweis: git-cliff bricht bei nicht-konventionellen Commits nicht
      ab — sie werden nur nicht kategorisiert bzw. gefiltert. Squash-Merge
      ist trotzdem die sauberere Lösung, weil sonst Änderungen still im
      Changelog fehlen würden.

## Phase 3 — Beobachtungszeitraum

- [ ] Ein paar Releases (Richtwert: 3–5) unter der neuen Konvention
      sammeln, bevor Phase 4 startet — reales Testmaterial für git-cliff.
- [ ] Stichprobe: reichen die Commit-Messages, um daraus einen brauchbaren
      Changelog-Eintrag zu bauen (Type/Scope sinnvoll genutzt)?

## Phase 4 — Changelog-Tool tauschen

- [ ] `cliff.toml` konfigurieren, Issue-Link-Pattern erstmal auf GitHub.
- [ ] Testlauf: Changelog für die letzten 2–3 Releases parallel generieren,
      mit bestehender `CHANGELOG.md` vergleichen.
- [ ] `.github_changelog_generator` und `github-changelog-http-cache`
      entfernen.
- [ ] `package.json`: `"changelog"`-Script auf git-cliff umstellen.
- [ ] Alte `CHANGELOG.md`-Einträge (vor Cutover) unangetastet als
      statischer Block belassen, ab Cutover-Tag automatisch generieren.

## Phase 5 — develop-Branch auflösen

- [ ] `git log master..origin/develop --oneline` prüfen: welche Commits
      sind noch nicht nach `master` zurückgeflossen (Stand 2026-09-12: 19
      Commits, siehe Session-Notiz).
- [ ] Diese final per Cherry-Pick nach `master` backporten (in Abstimmung
      mit laufenden Fixes in `osmbc-develop`, nicht mittendrin abreißen).
- [ ] `develop` als eingefroren markieren, danach lokal + remote löschen.
- [ ] Worktree `osmbc-develop` aufräumen/umwidmen.
- [ ] Feature-Branches künftig von `master` abzweigen, PR zurück nach
      `master` (GitHub-Flow statt Gitflow).
- [ ] Doku/Memory nachziehen: `README Developer.md`,
      `project_develop_master_backport_pattern`-Memory als "erledigt"
      markieren, betroffene Worktree-Memories
      (`project_second_worktree_hugo_export`,
      `project_blog_sync_merger_task`) auf neuen Zuschnitt prüfen.

## Phase 6 — Cutover / Abschluss

- [ ] Migrations-Tag setzen (z. B. `4.5.0`), Changelog-Eintrag dazu.
- [ ] Ruby-Erwähnungen in Doku/Install-Guide entfernen, falls vorhanden.
- [ ] Diese Datei (`RELEASE_PROCESS_CHECKLIST.md`) auflösen, Endzustand in
      `CONTRIBUTING.md`/`README Developer.md` überführt.

## Phase 7 — GitLab-Umzug (separat, eigener Termin)

- [ ] Issue-Link-Pattern in `cliff.toml` auf GitLab-Muster umstellen
      (einzige nötige Änderung dank plattformneutraler Commit-Footer).
- [ ] PR-Titel-Lint als GitLab-CI-Job neu aufbauen (aus Phase 2
      zurückgestellt, siehe dort) — Merge-Request-Titel gegen
      Conventional-Commits-Format prüfen, analog zur vorher geplanten
      GitHub-Action, aber nativ für GitLab statt portiert.
