import translator from "./translator.js";
import { getKnownMigrationUserNames } from "../notification/migrationFilter.js";

// Service users: names under which OSMBC itself writes changes, not a
// person. Evaluations (credits of an issue, statistics) use this mapping
// to tell them apart from editors. Issue #1186 moves the remaining
// evaluations onto it.

/** The user that saves First Draft texts (Claude) into articles. */
export const CLAUDE_AI = "ClaudeAI";

// fixed names; translator and migration users are added when asked, because
// the migration users come from the configuration
const fixedUsers = {
  [CLAUDE_AI]: "draft",
  // the one-time pre-OSMBC bulk import
  "wp-oldimport": "import"
};

function mapping() {
  const result = { ...fixedUsers };
  for (const t of Object.values(translator)) {
    if (typeof t.user === "string") result[t.user] = "translation";
  }
  for (const name of getKnownMigrationUserNames()) result[name] = "migration";
  return result;
}

/**
 * The function of a service user ("draft", "translation", "migration",
 * "import"), or null for a person.
 * @param {string} name OSM user name as stored in the change log
 * @returns {string|null} function of the service user, null for a person
 */
export function serviceFunction(name) {
  return mapping()[name] ?? null;
}

/**
 * Whether a change log user name is a service user and not a person.
 * @param {string} name OSM user name as stored in the change log
 * @returns {boolean} true for a service user
 */
export function isServiceUser(name) {
  return serviceFunction(name) !== null;
}
