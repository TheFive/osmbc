#!/usr/bin/env bash

NOW=$(date +"%F-%T")


echo "All parameters:"
echo $@

echo "Script is called parameter 1 $1"

sleep 2

echo "Script is working... parameter 2 $2"

sleep 2

echo "Still something to do, BTW, scriped called by $OSMUSER"
echo "Script Path is: $SCRIPT_PATH"
echo "Log Path is: $LOG_PATH"

sleep 2

echo "Script is ready"

