

import { strict as assert } from "assert";
import db from "../model/db.js";
import pgSessionCreator from "connect-pg-simple";



export function createSessionStore(session) {
  let sessionStore = null;
  let psi = 180;
  if (process.env.NODE_ENV === "test") {
    psi = 180;
  }
  const PgSession = pgSessionCreator(session);

  const pool = db.getPool();
  assert(pool);
  sessionStore = new PgSession({
    pool: pool, // Use global pg-module
    pruneSessionInterval: psi
  });
  return sessionStore;
};

