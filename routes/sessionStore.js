"use strict";

const assert = require("assert").strict;
const config = require("../config.js");

const db     = require("../model/db.js");


config.getValue("sessionStore", { deprecated: true });



module.exports = function(session) {
  let sessionStore = null;
  let psi = 180;
  if (process.env.NODE_ENV === "test") {
    psi = 180;
  }
  const PgSession = require("connect-pg-simple")(session);

  const pool = db.getPool();
  assert(pool);
  sessionStore = new PgSession({
    pool: pool, // Use global pg-module
    pruneSessionInterval: psi
  });
  return sessionStore;
};
