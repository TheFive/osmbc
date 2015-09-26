## Installation Guide OSMBC

# Requirenments

Before you install OSMBC the following Software has to be installed.

a) Postgres 9.3 or higher

The System is tested and developed under 9.3, as far as i know all features
used should work with 9.4.

b) Node.JS

You should install node 10.* or higher
OSMBC runs with 0.12.4 on the development machine and with 0.10.36 on the 
production server.



d) Configuration

There has to exist two config files.

a) config.test.json, this is used for automated testing on travis-ci and 
therefore can be found in the git repository

b) config.development.json 
Please copy config.test.json to config.development.json and put the needed values to.

    "serverport": 3000 (Port, where the node server is listening to)
    "database" : "localhost:5432/osmbc", (access String for Postgres DB)
    "username" : "TheFive", (User Name for Postgres DB)
    "password" : "thefive", (Password for Postgres DB)
    "connectstr" : "psql://test:test@localhost:5432/testdb"
                  (Access String for Postgres, overwrites database,user and pwd)
    "callbackUrl":"http://localhost:3000/auth/openstreetmap/callback",
          (callbackUrl for the OAUTH mechanism, change the serverpart of the URL)
    "OPENSTREETMAP_CONSUMER_KEY" : "######",
          (OAUTH Key, generate it from your user properties in OSM)
    "OPENSTREETMAP_CONSUMER_SECRET" : "#####"
           (OAUTH Secret, generate it from your user properties in OSM)
    "htmlroot":"" (Root for HTML Path to use handle multiple instances on one server, e.g. MYSERVER/htmlroot/osmbc.html)


c) To use a config.prod.json please change the package.json.  

The config module uses development as default configuration (if it is not set
via NODE_ENV variable).

npm start sets NODE_ENV=development
npm test  sets NODE_ENV=test
=======


# Global Node Modules needed

Please install the following node modules global, 

npm "istanbul" -g  (used for Codecoverage during npm test)
npm "mocha"    -g  (used for tests during npm test)

# Install local Modules

After checkout of OSMBC please call 
npm install 
in the OSMBC directory, to install all necessary modules. 
Depending on machine configuration you may be have to do that as administrator

# Installation of Database

The database can be installed with the two javascript files in the folder import.

## Creating the Table and Views

->> See chapter configuration for database access

    NODE_ENV=???? node download.js

Where ??? is the configuration you want to use (e.g. development) 

## Import Files from 


There is a script to import all weekly news down from blog.openstreetmap.de.
You can find it in import.

call 

    NODE_ENV=???? node createdb.js

to import the first 268 Blog.


