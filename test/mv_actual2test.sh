#!/bin/sh
for file in *_actual.html; do
  if [ -e "$file" ]; then
    newname=`echo "$file" | sed 's/_actual.html/.html/'`
    mv "$file" "$newname"
  fi
done
