# Wiki

OSMBC has a built-in wiki for the editorial team: process descriptions,
help pages, meeting notes. Pages are Markdown files in a git repository of
their own, so every change is a commit with the editor's OSM user name as
author, and the whole wiki can be copied, backed up or synchronised with
plain git.

The wiki is off until `wiki.directory` is set in the configuration.

  1. [Switching it on](#1-switching-it-on)
  2. [The data directory](#2-the-data-directory)
  3. [Access](#3-access)
  4. [Pages](#4-pages)
  5. [Working with the wiki](#5-working-with-the-wiki)
  6. [Mattermost messages](#6-mattermost-messages)
  7. [Migrating from DokuWiki](#7-migrating-from-dokuwiki)

## 1. Switching it on

```yaml
wiki:
  directory: /srv/osmbc/wiki     # required: absolute path outside the app directory
  readAccess: [full]             # who may read (default [full])
  writeAccess: [full]            # who may create, edit, move, delete, upload (default [full])
  autoPush: false                # git push after every change (default false)
  maxUploadBytes: 5242880        # largest image upload (default 5 MB)
  mattermost:                    # optional, see section 6
    team: osmbcteam              # name of a webhook in slacktool
    channel: "#wiki"
    mode: each                   # each | off
```

OSMBC checks the block at start and stops with an error for a relative
directory, a directory inside the app directory, or an invalid access list.

With the [split configuration](config.md#optional-second-file-for-the-editorial-settings),
`directory`, `autoPush` and `maxUploadBytes` belong to the technical file,
`readAccess`, `writeAccess` and `mattermost` to the editorial file.

The help menu links to the wiki with the entry `[Wiki, ~/wiki]`
(Admin → Configure Help Menu; `~/` stands for this OSMBC's own path).
Links into the wiki are only shown to users who may read it.

## 2. The data directory

- If the directory is empty or missing, OSMBC creates it and runs
  `git init`. If it holds files but is not a git repository, OSMBC does
  not touch it: the log names the problem and the wiki pages show an
  error.
- `git` must be installed on the server.
- OSMBC commits every change itself (author = the OSM user, committer =
  OSMBC). It expects to be the only writer: if you change pages with git
  directly, commit them and leave the working tree clean.
- A remote is the operator's business: add one with `git remote add` and
  set an upstream branch, then `autoPush: true` pushes after every change.
  A failing push is only logged, it never fails the save.
- The directory holds the content of your instance (and possibly personal
  data, e.g. names on meeting pages). Keep it out of the OSMBC repository,
  and back it up like the database (see [install.md](install.md#8-backup)).

## 3. Access

`readAccess` and `writeAccess` are lists. `full` and `guest` stand for
the access levels of the OSMBC users; every other entry is an OSM user
name (case ignored). That allows a small rollout first:

```yaml
wiki:
  readAccess: [alice, bob]       # only these two
  writeAccess: [alice]
```

and later `readAccess: [full, guest]`. Users with access `denied` never
get in.

A single page can be restricted further with front matter at its top:

```markdown
---
access: full
---
# Internal list
```

Such a page is hidden from everyone without full access (also in the page
list, the search and old versions), whatever `readAccess` says.

## 4. Pages

- **Names:** a page is a file `<name>.md`, folders group pages
  (`process/review.md` is the page `process/review`). Names use `a-z`,
  `0-9`, `_` and `-`; input is turned into this form (`My Page` →
  `my_page`). `media` and names starting with `_` are reserved.
- **Special pages:** `sidebar` is shown next to every page;
  `<folder>/start` is the target of a folder in the breadcrumbs.
- **Title:** `title:` in the front matter, else the first heading, else
  the page name.
- **Links:** `[text](/wiki/process/review)` (independent of where OSMBC is
  mounted) or relative to the current folder: `[text](review)`,
  `[text](../start)`. Link targets ignore case and turn spaces into `_`,
  like the page names. Links to pages that do not exist yet are marked;
  following one offers to create the page.
- **Headings** get anchors, `[text](/wiki/process/review#checklist)`; a
  table of contents appears on pages with more than two headings.
- **Images:** uploaded from the editor into `media/<folder of the page>/`
  and inserted as `![](/wiki/_media/<path>)`. Allowed: png, jpg, gif,
  webp, svg (without scripts). A size can be given as
  `![](/wiki/_media/logo.png =200x)`.
- The Markdown is rendered like article texts (HTML switched off).

## 5. Working with the wiki

- **New page:** on the wiki index choose a folder and type a name;
  `new_folder/name` creates a new folder. Or follow a link to a missing
  page.
- **Edit:** text field with a live preview; leaving with unsaved changes
  asks first. If someone else saved the page in between, the save is
  refused and both texts are shown.
- **History:** every page lists its changes with author and date, shows
  the difference of each change and any old version, and can restore one
  (the restore is a new change).
- **More → Move / rename:** choose the target folder and name. Links to the
  old name are not changed.
- **More → Delete:** the page disappears, its history stays and it can be
  restored from there.
- **Search:** in page names and texts.

## 6. Mattermost messages

With `mattermost.mode: each` every change (create, edit, restore, move,
delete, upload) is posted to `mattermost.channel` right away, with a link
to the page (and for edits to the difference). `mattermost.team` names the incoming
webhook in `slacktool`; without a matching webhook, or with `mode: off`,
nothing is sent.

## 7. Migrating from DokuWiki

`tools/dokuwiki-to-md.mjs` turns a DokuWiki that keeps its data in git
(plugin `gitbacked`) into a wiki repository for OSMBC, with the full
history. It needs [pandoc](https://pandoc.org/) (tested with 3.14).

```sh
node tools/dokuwiki-to-md.mjs <dokuwiki git dir> <target dir> \
  [--authors authors.yaml] [--restricted <page>]... [--replace]
```

Then set `wiki.directory` to the target directory.

- Every DokuWiki commit becomes a commit with the same author name, date
  and message (plus `Migrated-From: <hash>`). E-mail addresses are
  replaced by `<name>@osmbc`, so no private addresses end up in the wiki
  repository.
- `--authors`: a YAML file `name or e-mail: OSM user name` for history
  entries whose name is not the OSM user name (commits made directly with
  git, different spelling).
- `--restricted`: pages that get `access: full` (may be given several
  times).
- Pages are converted with pandoc; links and images get the wiki's form
  (`/wiki/...`, `/wiki/_media/...`), names are cleaned like DokuWiki does
  (lower case, `ä` → `ae`, dots → `-`). Lines starting with `* ` without
  the two leading spaces DokuWiki needs become list items. A link to a
  page that does not exist is changed to the one existing page with the
  same name, if there is exactly one.
- If the DokuWiki history starts with a [jingo](https://github.com/claudioc/jingo)
  wiki (Markdown files in the repository root), those pages keep their
  history in the file of the DokuWiki page they became.
- At the end the tool lists the links to pages that still do not exist.
- The run is repeatable: the same input gives the same commits. To run
  it again, use `--replace`, which only deletes a target created by an
  earlier run.

The DokuWiki data and the authors file belong to your instance: keep them
outside the OSMBC directory.
