"use strict";

const should = require("should");
const config       = require("../config.js");

const db           = require("../model/db.js");




module.exports = function(session) {
  let sessionStore = null;
  if (config.getValue("sessionStore", {mustExist: true}) === "session-file-store") {
    var FileStore    = require("session-file-store")(session);
    sessionStore = new FileStore();
  } else if (config.getValue("sessionStore", {mustExist: true}) === "connect-pg-simple") {
    var PgSession = require("connect-pg-simple")(session);

    let pool = db.getPool();
    should.exist(pool);
    sessionStore = new PgSession({
      pool: pool, // Use global pg-module
      conString: config.pgstring // Connect using something else than default DATABASE_URL env variable
    });
  }
  return sessionStore;
};
