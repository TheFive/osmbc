# Automatic steps in the editorial week

OSMBC can do some steps of the editorial week by itself. This page tells
editors what these steps do, when they happen and how to undo them. Which
steps are switched on and their times are set by the admins of each OSMBC
instance (configuration `Transition`, see [config.md](config.md#automatic-transitions-transition)).
All times below are **examples**; ask your admins for the times of your
instance. Every full user can see the planned steps on the admin page
(menu *Admin*, table "Upcoming automatic actions"); the start page shows
only the next step ("Next Automatic Action").

Each automatic step writes its own name into the blog log and the review
list, so you can always see that it was not a person:

| Step | Name in the log |
|---|---|
| Auto Edit | `autoclose` |
| Auto Translate | `autotranslate` (articles: `deeplPro API Call`) |
| Auto Review Start | `autoreview-start` |
| Auto Close | `autoclose-review` |
| Auto Blog Close | `autoclose-blog` |

## 1. Auto Edit — the blog goes into edit mode

When the collection period of a blog ends (example: Wednesday 23:59), the
blog switches from *open* to *edit*, and the next blog is created for
collecting (example: Thursday 00:00 to next Wednesday 23:59). If the end
of a blog was moved by hand, the next blog is made shorter or longer so
that the weekly rhythm is kept. So there are always two blogs: one collecting, one being
edited. A blog lives about ten days: one week of collecting, then a few
days of editing until it is published.

## 2. Auto Translate — empty articles get a machine translation

Example: Thursday 20:00, the evening after collecting ended. Every article that is still empty in your language
gets a machine translation (DeepL) from the source language. This happens
only for languages whose team closed one of the last blogs, only once per
blog and language, and never overwrites a text. Articles with
`no translation` in the source language, *Upcoming Events* and
`--unpublished--` are skipped. A badge on the blog page counts
the machine translated articles nobody has edited yet.

## 3. Auto Review Start — the review starts when everything is written

Example: Saturday 12:00, then every hour until Auto Close. OSMBC checks for
every language whether **every article is written**:

- an article is written when it has a text in your language, or
  `no translation`;
- `--unpublished--` articles don't count;
- an article in `-- no category yet --` counts as not written;
- a machine translation counts as written (an instance can switch this
  off, then a machine translation nobody has edited blocks the start);
- a language where every article is `no translation` is left alone.

If everything is written, the review of that language starts: exactly as
if someone had clicked *Set WN…(XX) ready for review*. The review box
shows "enabled by autoreview-start", and reviewers can begin. If an
article is still missing, nothing happens; with the hourly recheck the
review starts at the next check after the last article is written.
Languages whose review has already started, or that are closed or
exported, are left alone. You can always start the review yourself
earlier.

**Undo:** click *Delete Review* for your language in the blog's language
table. If your language is still complete at the next hourly check, the
review starts again, so put the article you are not done with back to
empty, or ask your admins to switch the step off for your language.

## 4. Auto Close — the language is closed after enough reviews

Example: Sunday 18:00, then every hour until 24:00. Every language with
enough reviews by different people (example: 2) is closed. Languages
without enough reviews stay open; with the hourly recheck they are closed
at the next check after the last needed review. Languages that are
already exported are left alone.

**Only complete languages are closed** — automatically and by hand. The
*Close* button is greyed out and lists what is missing, and Auto Close
skips your language, as long as

- an article in your language has no text (and is not `no translation`)
  or has no category yet: write the text, set `no translation`, give the
  article a category, or move it to `--unpublished--`;
- a footnote link like `[[1](#wn851_12345)]` (lead picture caption) points
  to another issue or to an article that is missing or unpublished — often
  a caption copied from last week: correct the number.

If Auto Close is due and your reviewed language is blocked, the blog page
shows a yellow box "Auto Close could not close …" with the reasons, and
your language channel gets one message with the same reasons. Fix them,
and the next hourly check (or the *Close* button) closes the language.

An article added after your language was closed (or copied or moved into
such a blog) gets `no translation` in your language automatically, so it
doesn't show up as missing in your preview.

**Undo:** click *Reopen* for your language in the blog's language table.
After the last check of the day nothing is closed automatically any more.

## 5. Auto Blog Close — the whole blog is closed

A blog stays open for late teams until two newer blogs are in edit mode
(example values; about two weeks after the blog end). After that it is
closed as a whole when every *active* language is done:

- a language is active if it has text in this blog, or if its team closed
  one of the last two blogs;
- an active language is done when it is closed, **or** when nobody has
  worked on it for 14 days — no text change, no review, no close. Machine
  translations and other automatic steps don't count as work.

So a team that is only late keeps the blog open as long as it works on
it, and a language nobody looks after any more does not keep the blog
open forever. A closed blog can't be edited in any language. Admins see
on the admin page which languages a blog still waits for, and from when
a language counts as abandoned.

**Undo:** set the blog status back to *edit* in the blog details.
