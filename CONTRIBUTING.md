# Contributing

## Commit messages (Conventional Commits)

OSMBC is moving its changelog generation from GitHub-API-based tooling to
one that reads directly from `git log` ([git-cliff](https://git-cliff.org/)).
For that to produce a useful changelog, commit messages need to follow the
[Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

A commit-msg hook enforcing this is planned but not yet installed — please
follow the format voluntarily starting now, so the commit history is usable
once the changelog tool switches over. See `RELEASE_PROCESS_CHECKLIST.md`
for the full rollout plan.

### Type

One of:

| Type | Use for |
|---|---|
| `feat` | a new user-visible feature |
| `fix` | a bug fix |
| `docs` | documentation only |
| `style` | formatting, no code meaning change |
| `refactor` | code change that's neither a fix nor a feature |
| `perf` | a performance improvement |
| `test` | adding or fixing tests |
| `build` | build process, dependencies |
| `ci` | CI configuration |
| `chore` | everything else (maintenance, tooling, config) |
| `revert` | reverts a previous commit |

### Scope

Optional, but encouraged — name the area of the repo the commit touches,
e.g. the top-level directory: `model`, `routes`, `render`, `export`,
`notification`, `wp-reconcile`, `import`, `views`, `test`, `docs`. For
changes to one specific feature area that spans directories, a short
feature name is fine too, e.g. `hugo-export`, `blog-sync-merger`.

### Subject

Short, imperative, lowercase, no trailing period:

```
fix(render): handle null flag value in calendarflags preview
feat(export): emit weeklyosm.eu archive aliases in TOML front matter
```

### Referencing issues

Add a footer to link and optionally close an issue. This works unchanged
on GitHub and (once the repo moves) on GitLab, since both autolink `#123`
and recognize the same closing keywords:

```
fix(model): exclude wp-reconcile users from teamString

Closes #1141
```

Use `Refs #123` instead of `Closes #123` when the commit relates to an
issue without resolving it.

### Breaking changes

Not currently expected in this project (no external API consumers), but if
one ever occurs, mark it with a `BREAKING CHANGE:` footer describing the
impact.

## Everything else

See `README Developer.md` for local setup and general development
tooling.
