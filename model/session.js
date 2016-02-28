"use strict";




var pgObject = {};

pgObject.createString = 'CREATE TABLE "session" ( \
            "sid" varchar NOT NULL COLLATE "default", \
            "sess" json NOT NULL, \
            "expire" timestamp(6) NOT NULL \
          ) \
          WITH (OIDS=FALSE); \
          ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;';

pgObject.indexDefinition = {
};

pgObject.viewDefinition = {};
pgObject.table="session";

module.exports.pg = pgObject;



