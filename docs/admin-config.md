# Admin configurations

The admin page of OSMBC (menu *Admin*) lists configurations that are kept
in the database and edited in the browser, by every full user. They are
different from the configuration file on the server
([config.md](config.md)), which only the server admin changes.

Each configuration page has a text field (YAML or plain text), *OK* to
save, the parsed result below (or the YAML error), and the history of
changes. Each page also shows its section of this document under
*Help for this configuration*.

On the first start, each configuration is filled with the default from
`data/<name>.yaml` (or `.txt`). After that only the database counts; a
changed default file does not change an existing installation.

YAML in short: `key: value`, lists with `- `, indentation with spaces
(never tabs). Text with `:` or `#` needs quotes. A save with a YAML error
is refused, the old value stays.

## `slacknotification` — Configuration of IM Channel (Slack, MM)

Which Mattermost (or Slack) channel gets which notifications. A list, one
entry per channel ("connection"). Several entries may use the same
channel or the same team.

| Key | Values | Meaning |
|---|---|---|
| `slack` | a key of `slacktool` in the server config | The team (incoming webhook) to post through. |
| `channel` | `"#name"` | The channel. Entries without `#` are ignored. |
| `notifyNewCollection` | `true`, `editor`, `guest`, `false` | New submissions: an article gets its first collection. `guest`: only submissions of guest users, `editor`: only those of the other users. |
| `notifyCollectionChange` | `true`, `editor`, `guest`, `false` | An existing collection is changed. Missing = same as `notifyNewCollection`, which covered both before issue #1170. |
| `notifyGuestTextChange` | `true`, `false` | A guest wrote or changed an article text in any language. |
| `notifyAllComment` | `true`, `false` | Every new or changed comment. |
| `notifyComment` | list of user names and languages | Comments that mention one of them (`@TheFive`, `@DE`). |
| `notifyBlogStatusChange` | `true`, `false` | A blog changes its status (open, edit, closed). |
| `notifyBlogLanguageStatusChange` | list of languages, or `all` | Review started, review comments, export, close and reopen of these languages, and the message that Auto Close could not close a language. |
| `notifyBlogLanguageClosed` | list of languages, or `all` | Only close / reopen (and "could not close") of these languages. |

Example: one channel to look after the guests, one for the editors, one
per language team.

```yaml
- slack: theweeklyosm
  channel: "#osmbc-guests"
  notifyNewCollection: guest
  notifyCollectionChange: guest
  notifyGuestTextChange: true
- slack: theweeklyosm
  channel: "#osmbc-editors"
  notifyNewCollection: editor
  notifyCollectionChange: editor
  notifyComment: [EN]
- slack: theweeklyosm
  channel: "#osmbc-de"
  notifyBlogLanguageStatusChange: [DE]
```

The table below the field shows how OSMBC reads each entry; a red channel
is not used. Users choose their own notifications on their user page
(mail and/or Mattermost direct message), see
[config.md](config.md#notifications).

## `votes` — Votes For Articles

The vote buttons of an article (e.g. "pro", "unpublish"). A list:

| Key | Meaning |
|---|---|
| `name` | Name of the vote, also stored in the article. Don't rename a vote in use: the old votes stay under the old name. |
| `icon` | Font Awesome icon, e.g. `fa-thumbs-up`. |
| `displayAtTop` | `true`: the button sits at the top of the article, else only in the "Votes & Tags" list at the bottom. |
| `description` | Explanation in the vote list. |

The order of the list is the order of the buttons.

## `categorytranslation` — Category Translation

The categories of a new blog and their name in each language. A list; each
entry has `EN` (the internal name, used everywhere) and one name per
language. The first entry is the category of a new article
("-- no category yet --"). The entry whose `EN` is the server setting
`Blog Title For Export` is not a category: it holds the blog title per
language for the export.

Changes apply to blogs created afterwards; an existing blog keeps its
categories (edit them on the blog page). Don't change an `EN` name that
articles use.

## `categorydescription` — Descriptions for Categories

A short explanation per category (key: the `EN` name), shown when an
editor picks the category (collect page, article).

## `newArticles` — Empty Articles To Create

Articles created in every new blog, e.g. the lead picture and the
calendar. One entry per article with its fields; `#BlogName#` is replaced
by the blog name:

```yaml
Picture:
  categoryEN: "Picture"
  title: "#BlogName# Picture"
```

## `editorstrings` — Author Documentation

The line with the team below an exported issue, per language. `##Team##`
is replaced by the names of the editors of that language.

## `automatictranslatetext` — Text for Translate Links

The note added to a machine translated text, per language. `##link##` is
replaced by the link to the translation service.

## `formulation_tipEN`, `formulation_tipDE` — Formulation Hints

Plain text shown as placeholder in an empty text field of an article:
`formulation_tipDE` for German, `formulation_tipEN` for all other
languages.

## `languageflags` — Language Indicator Icons

Pictures and emojis editors can put into a text, and the flag strip in
the article view.

- `<name>: <url>` — a flag in the strip (click copies it as markdown).
- `emoji:` — `<name>: <character or image path>`, written as `:name:` in a
  text.
- `shortcut:` — `<emoji name>: <text>`, e.g. `smiley: ":-)"` turns `:-)`
  into that emoji.

## `calendarflags` — Flags for calendar

Flags in the "Upcoming Events" table: `<country code>: <url or
character>`. The code is the one OSMCAL delivers (e.g. `de`, `jp`). The
key `online` gives the picture for online events.

## `calendartranslation` — Calendar Translation Texts

The column titles of the "Upcoming Events" table per language (`town`,
`title`, `date`, `country`, `venue`, `online`), and
`locationNoTranslation`: venue names that mean "online".

## `eventsfilter` — Filter for calendar

Which OSMCAL events the "Upcoming Events" article shows, per language:

| Key | Meaning |
|---|---|
| `daysAfterBlogStart` | Days added to the blog start; events must end after that date. |
| `duration` | Length of the time frame in days after that date; events must start in it. |
| `big_duration` | Longer time frame for big events (conferences). |
| `excludeCountries` / `includeCountries` | Country codes to leave out / to show only. |
| `enableCountryFlags` | `true`: country flags from `calendarflags` in the table. |

## `firstdraftprompt` — First Draft Prompt (Claude)

*First Draft* lets Claude write a first draft of an item from a collected
link. The text is a starting point: an editor always reads, corrects and
completes it. The server admin switches the function on in the
configuration file (`FirstDraftConfig` with an API key, `visibleFor`:
`full` = all full users, `guest` = full users and guests, or a list of
OSM user names; see [config.md](config.md)). Only these users see the
First Draft buttons and this configuration.

Where it appears:

- **Collect page** — after entering a link, the draft is written in the
  user's language (on a phone: the phone language). For a new link it
  starts by itself; if the search found the link in other articles, only
  after a click on *First Draft*, so duplicates are checked first.
  Claude also proposes a short title and a category; they replace the
  page title and "-- no category yet --" unless the user changed them.
  *Save with draft* stores the (edited) draft, *Save link only* stores
  the link without text. There is no personal switch: everybody in
  `visibleFor` gets it.
- **Article page** — menu *First Draft* (on a phone: a button below the
  empty text field), one entry per empty language and collected link. The
  draft is saved into the article at once; to discard it, delete the text
  and save.

Every draft is saved as user `ClaudeAI`, the editor's changes on top of it
as the editor. So the history shows what Claude wrote and what the
editors changed; `ClaudeAI` does not appear in the credits. For full users
Claude also sees the current state of the issue in that language, so that
the wording of the items varies; guests' drafts are made without it (they
may not see other editors' texts).

This configuration is the instruction for Claude (system prompt), plain
text: how an item looks (length, first sentence, tense, where the link
goes), tone and typography. Improve it when the drafts repeat the same
mistake, and compare the drafts with the editors' changes in the history.
Not needed here: the target language, the URL, the page text, the issue
context and the list of categories, which OSMBC adds to each request
itself (categories with their description from `categorydescription`; a
category without a description is never proposed).

## `helpmenu` — Configure Help Menu

The entries of the help menu (question mark in the navigation bar). A
list:

- `[label, url]` — a link; `~/path` is a path inside this OSMBC, e.g.
  `~/wiki` (shown only when the wiki is on and the user may read it) or
  `~/help/admin-config` for this document (shown to full users only):
  `- [Admin configurations, ~/help/admin-config]`.
- `[label, header]` — a heading.
- `"---"` — a divider.

## `ignoreforsearch` — Not a Doublette Link

Links that are not checked for duplicates when collecting (e.g. the
OpenStreetMap start page), one per line as a YAML list.

## `licenses` — Picture Licensing

Licence texts per licence and language, with `##author##`. Kept for the
picture workflow; no part of OSMBC reads it at the moment.
