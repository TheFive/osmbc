# Automatic steps in the editorial week

OSMBC can do some steps of the editorial week by itself. This page tells
editors what these steps do, when they happen and how to undo them. Which
steps are switched on and their times are set by the admins of each OSMBC
instance (configuration `Transition`, see [config.md](config.md#automatic-transitions-transition)).
All times below are **examples**; ask your admins for the times of your
instance. Every full user can see the planned steps on the admin page
(menu *Admin*, table "Upcoming automatic actions").

Each automatic step writes its own name into the blog log and the review
list, so you can always see that it was not a person:

| Step | Name in the log |
|---|---|
| Auto Edit | `autoclose` |
| Auto Translate | `autotranslate` (articles: `deeplPro API Call`) |
| Auto Review Start | `autoreview-start` |
| Auto Close | `autoclose-review` |

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

**Undo:** click *Reopen* for your language in the blog's language table.
After the last check of the day nothing is closed automatically any more.
