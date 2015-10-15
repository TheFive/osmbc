# Installation Guide for OSMBC

## 1 - Dependencies

Before you install OSMBC the following Software has to be installed.

**a)** Postgres 9.3 or higher

The system is tested and developed under `9.3`, as far as i know all features
used should work with `9.4`.

**b)** Node.JS 10.* or higher

OSMBC runs with `0.12.4` on the development machine and with `0.10.36` on the production server.

## 2 - Configuration files

There has to exist two config files: `config.test.json` and `config.development.json`

The first is used for automated testing on travis-ci and therefore can be found in the git repository. Please **copy** the `config.test.json` to `config.development.json` and put the needed values to:

```json
"serverport": 3000,
"database" : "localhost:5432/osmbc",
"username" : "TheFive",
"password" : "thefive",
"connectstr" : "psql://test:test@localhost:5432/testdb",
"callbackUrl": "http://localhost:3000/auth/openstreetmap/callback",
"OPENSTREETMAP_CONSUMER_KEY" : "****",
"OPENSTREETMAP_CONSUMER_SECRET" : "****",
"htmlroot": ""
```

Where:

- `serverport` is the port in that the node server is listening
- `database` is the string of accesse to Postgres
- `username` is the username on Postgres
- `password` is the password on Postgres
- `connectstr` is the string of access to Postgres
	- **Overwrites `database`, `username` and `password`**
- `callbackUrl` is the URL of callback for the OAuth mechanism
	- **You must change the serverpart**
- `OPENSTREETMAP_CONSUMER_KEY` is the OAuth Key
	- Generate it from your user properties in OSM
- `OPENSTREETMAP_CONSUMER_SECRET`is the OAuth Secret
	-  Generate it from your user properties in OSM
- `htmlroot`is the root for the HTML path to be used to handle multiple instances in a same server
	- e.g. `MYSERVER/<htmlroot>/osmbc.html`

To use a `config.prod.json` please change the `package.json`

### Examples of use (for after)

The config module uses development as default configuration (if it is not set via `NODE_ENV` variable).

```console
$ npm start  # sets NODE_ENV=development
```

```console
$ npm test  # sets NODE_ENV=test
```

## 3 - Node's global modules

Please install the following node modules global:

```console
$ npm "istanbul" -g  # used for Codecoverage during npm test
$ npm "mocha" -g  # used for tests during npm test
```

## 4 - Node's local modules

After checkout of OSMBC please install all necessary modules in its directory doing there:

```console
$ npm install
```

Depending on machine configuration, you may need doing this as root.

## 5 - Database

The database can be installed with the two javascript files in the folder import.

#### Creating tables and views

_→ See also: section about [Configuration files](#configuration-files), for database access_

```sh
NODE_ENV=???? node download.js
```

Where `???` is the configuration that you want to use (e.g. development).

#### Import files from

There is a script to import all the weekly news down from [blog.openstreetmap.de](http://blog.openstreetmap.de).

To import the first blog (the of number 168), call:

```sh
NODE_ENV=???? node createdb.js
```
.


