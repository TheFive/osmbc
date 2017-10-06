"use strict";

const config       = require("../config.js");

const pg           = require("pg");




module.exports = function(session) {
  let sessionStore = null;
  if (config.getValue("sessionStore", {mustExist: true}) === "session-file-store") {
    var FileStore    = require("session-file-store")(session);
    sessionStore = new FileStore();
  } else if (config.getValue("sessionStore", {mustExist: true}) === "connect-pg-simple") {
    var PgSession = require("connect-pg-simple")(session);

    sessionStore = new PgSession({
      pg: pg, // Use global pg-module
      conString: config.pgstring // Connect using something else than default DATABASE_URL env variable
    });
  }
  return sessionStore;
};
