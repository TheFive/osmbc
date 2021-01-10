#!/bin/bash

# Install this file in your .git/hooks files by calling this scripts
# from a script in the folders
# .git/hooks/post-merge
# .git/hooks/post-checkout

changedFiles="$(git diff-tree -r --name-only --no-commit-id $1 $2)"

runOnChange() {
	echo "$changedFiles" | grep -q "$1" && eval "$2"
}

runOnChange package-lock.json "npm install"
