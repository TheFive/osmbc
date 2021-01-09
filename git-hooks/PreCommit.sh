#!/bin/sh

# to install this hook call it from .git/hooks/precommit

if git-rev-parse --verify HEAD >/dev/null 2>&1; then
    against=HEAD
else
    against=4b825dc642cb6eb9a060e54bf8d69288fbee4904
fi

for FILE in `git diff-index  --name-status $against -- | cut -c3-` ; do
    # Check if the file contains '.only'
    if   grep -q it.only $FILE ;
    then
        echo $FILE ' contains it.only!'
        exit 1
    fi
    if  grep -q describe.only $FILE ;
    then
        echo $FILE ' contains describe.only!'
        exit 1
    fi
    if grep -q console.log $FILE ;
    then
       echo $FILE ' contains console.log!'
       exit 1
    fi
    if grep -q console.dir $FILE ;
    then
      echo $FILE ' contains console.dir!'
      exit 1
    fi
done
exit
