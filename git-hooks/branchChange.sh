#!/bin/bash

# Install this file in your .git/hooks files by calling this scripts
# from a script in the folders
# .git/hooks/post-merge
# .git/hooks/post-checkout

changedFiles="$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)"

echo $1
echo $2
echo $3

runOnChange() {
	echo "$changedFiles" | grep -q "$1" && eval "$2"
}

runOnChange package-lock.json "npm install"
