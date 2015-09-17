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

c) Installation of Database

to be described and implemented...

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

}

c) To use a config.prod.json please change the package.json.  


# Global Node Modules needed

Please install the following node modules global, 

npm "istanbul" -g  (used for Codecoverage during npm test)
npm "mocha"    -g  (used for tests during npm test)

# Install local Modules

After checkout of OSMBC please call 
npm install 
in the OSMBC directory, to install all necessary modules. 
Depending on machine configuration you may be have to do that as administrator


# Importing data

There is a script to import all weekly news down from blog.openstreetmap.de

.. to be described ..
