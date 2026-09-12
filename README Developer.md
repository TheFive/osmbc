# Readme for Developer

If you are interested in do some bugfixing, develop some enhancements or just get a local copy
running for your own multi language blog project, this readme should give you some usefull advise.


## Tooling

Following development tools are required

* Postgres (>= 9.3, could be an actual version)
* node js and npm (node version 14.x or higher)
* main developer is using VS Code with some plugins to develop

More info in the [Installation Guide](Install_Guide.md).

## Commit messages

Please follow the Conventional Commits format described in
[CONTRIBUTING.md](CONTRIBUTING.md) — the project is moving its changelog
generation to read directly from commit history.

To check your commit messages locally before pushing, install the
commit-msg hook once per clone/worktree:

```
cp git-hooks/CommitMsg.sh .git/hooks/commit-msg
```

(requires `npm install` to have run, so `commitlint` is available).


