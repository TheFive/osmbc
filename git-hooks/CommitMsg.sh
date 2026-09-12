#!/bin/sh

# to install this hook call it from .git/hooks/commit-msg
# (commit-msg hooks receive the path to the commit message file as $1)

npx --no-install commitlint --edit "$1"
