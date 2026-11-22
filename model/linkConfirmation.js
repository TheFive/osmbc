// Links the link check can't verify (bot protection, login wall, geo
// blocking, certificate error) can be confirmed by a full editor who opened
// them in the browser. A confirmation belongs to the url, not to an
// article, and is valid for LinkCheck.confirmationValidMonths (default 6).
// Confirm and undo are written to the change log (table "linkconfirmation").

import _debug from "debug";
import { BAD_REQUEST, CONFLICT, FORBIDDEN, NOT_FOUND } from "http-status-codes";

import config from "../config.js";
import db from "../model/db.js";
import pgMap from "../model/pgMap.js";
import messageCenter from "../notification/messageCenter.js";
import linkCheck from "../util/linkCheck.js";

const debug = _debug("OSMBC:model:linkConfirmation");

const TABLE = "linkconfirmation";
const DEFAULT_VALID_MONTHS = 6;

function validMonths() {
  const months = (config.getValue("LinkCheck", { default: {} }) || {}).confirmationValidMonths;
  if (typeof months === "number" && months > 0) return months;
  return DEFAULT_VALID_MONTHS;
}

/** One confirmed url: `url`, `user` (OSMUser), `timestamp`, `status` (check result at confirmation). */
class LinkConfirmation {
  constructor(proto) {
    this.id = 0;
    for (const k in proto) this[k] = proto[k];
  }

  /**
   * Table name for pgMap.save/remove.
   * @returns {string} "linkconfirmation"
   */
  getTable() {
    return TABLE;
  }

  /**
   * End of the validity, computed from the confirmation date and the
   * current configuration (a changed setting applies to old entries too).
   * @returns {Date} the moment the confirmation runs out
   */
  validUntil() {
    const d = new Date(this.timestamp);
    d.setUTCMonth(d.getUTCMonth() + validMonths());
    return d;
  }

  /**
   * Whether the confirmation still counts.
   * @param {Date} [now] defaults to the current time
   * @returns {boolean} false once validUntil has passed
   */
  isValid(now = new Date()) {
    return this.validUntil() > now;
  }

  /**
   * The link check result for a confirmed link, as sent to the browser.
   * @param {(number|string)} status the current result of the link check
   * @returns {object} state "confirmed" plus who confirmed it, when and until when
   */
  toCheckResult(status) {
    return {
      state: "confirmed",
      status: status,
      user: this.user,
      timestamp: this.timestamp,
      validUntil: this.validUntil().toISOString()
    };
  }
}

LinkConfirmation.prototype.save = pgMap.save;
LinkConfirmation.prototype.remove = pgMap.remove;

/**
 * New, not yet saved confirmation.
 * @param {object} proto initial fields (url, user, timestamp, status)
 * @returns {LinkConfirmation} the object, id 0 until saved
 */
function create(proto) {
  return new LinkConfirmation(proto);
}

const pgObject = {};
pgObject.table = TABLE;
pgObject.createString = "CREATE TABLE IF NOT EXISTS linkconfirmation (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT linkconfirmation_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
pgObject.indexDefinition = {
  linkconfirmation_url_idx: "CREATE UNIQUE INDEX IF NOT EXISTS linkconfirmation_url_idx ON linkconfirmation USING btree (((data ->> 'url'::text)))"
};
pgObject.viewDefinition = {};

const linkConfirmationModule = { table: TABLE, create: create };

/**
 * Creates the table and its index if they are missing, so an existing
 * installation needs no extra database step. Called at server start.
 * @param {function(Error=)} callback
 */
function ensureTable(callback) {
  debug("ensureTable");
  db.query(pgObject.createString, function(err) {
    if (err) return callback(err);
    db.query(pgObject.indexDefinition.linkconfirmation_url_idx, function(err) {
      return callback(err);
    });
  });
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Input checks shared by confirm and revoke; calls back with an error or nothing.
function checkRequest(user, url) {
  if (!user || user.access !== "full") return httpError(FORBIDDEN, "Only full editors can confirm links");
  if (typeof url !== "string" || !/^https?:\/\/\S+$/i.test(url)) return httpError(BAD_REQUEST, "Expected an http(s) url");
  return null;
}

// explicit SQL: pgMap's object form reads "%" or a leading "<" in a value as an operator
function findByUrl(url, callback) {
  pgMap.findOne(linkConfirmationModule, { sql: "where data->>'url' = $1", params: [url] }, callback);
}

// change: {property, from, to} of the change log entry
function logChange(user, entry, change, callback) {
  messageCenter.global.sendInfo(Object.assign({ oid: entry.id, user: user.OSMUser, table: TABLE }, change), callback);
}

/**
 * A full editor confirms that a link works. The link is checked again
 * first: only a "blocked" result (401, 403, 451, certificate error) can be
 * confirmed, a link that is ok or broken (404, 410 ...) gets a 409.
 * An existing confirmation of the url is renewed.
 * @param {object} user the logged in user
 * @param {string} url the link
 * @param {function(Error|null, object=)} callback the new check result
 *   (state "confirmed"); errors carry `status` 400/403/409
 */
function confirm(user, url, callback) {
  debug("confirm %s", url);
  const inputError = checkRequest(user, url);
  if (inputError) return callback(inputError);
  linkCheck.checkLink(url, function(err, result) {
    if (err) return callback(err);
    if (result.state !== "blocked") {
      return callback(httpError(CONFLICT, `Link can't be confirmed, link check says ${result.status}`));
    }
    findByUrl(url, function(err, existing) {
      if (err) return callback(err);
      const entry = existing || create({ url: url });
      const before = existing ? existing.user + " " + existing.timestamp : null;
      entry.user = user.OSMUser;
      entry.timestamp = new Date().toISOString();
      entry.status = result.status;
      entry.save(function(err) {
        if (err) return callback(err);
        logChange(user, entry, { property: "confirm", from: before, to: url }, function(err) {
          if (err) return callback(err);
          return callback(null, entry.toCheckResult(result.status));
        });
      });
    });
  });
}

/**
 * A full editor takes back the confirmation of a link (also an expired one).
 * @param {object} user the logged in user
 * @param {string} url the link
 * @param {function(Error=)} callback errors carry `status` 400/403/404
 */
function revoke(user, url, callback) {
  debug("revoke %s", url);
  const inputError = checkRequest(user, url);
  if (inputError) return callback(inputError);
  findByUrl(url, function(err, entry) {
    if (err) return callback(err);
    if (!entry) return callback(httpError(NOT_FOUND, "Link is not confirmed"));
    entry.remove(function(err) {
      if (err) return callback(err);
      logChange(user, entry, { property: "revoke", from: url, to: null }, callback);
    });
  });
}

/**
 * Replaces the "blocked" results of a link check by "confirmed" where a
 * valid confirmation exists. Other results stay as they are, so a confirmed
 * link that later answers 404 is shown as broken again.
 * @param {object} results url -> check result, changed in place
 * @param {function(Error=)} callback
 */
function applyConfirmations(results, callback) {
  const blocked = Object.keys(results).filter(url => results[url] && results[url].state === "blocked");
  if (blocked.length === 0) return callback();
  pgMap.find(linkConfirmationModule, { sql: "where data->>'url' = any($1)", params: [blocked] }, function(err, entries) {
    if (err) return callback(err);
    const now = new Date();
    entries.forEach(function(entry) {
      if (!entry.isValid(now)) return;
      results[entry.url] = entry.toCheckResult(results[entry.url].status);
    });
    return callback();
  });
}

/**
 * All confirmations, newest first, expired ones included.
 * @param {function(Error|null, LinkConfirmation[]=)} callback
 */
function findAll(callback) {
  pgMap.find(linkConfirmationModule, null, { column: "timestamp", desc: true }, callback);
}

export default {
  table: TABLE,
  pg: pgObject,
  create: create,
  ensureTable: ensureTable,
  confirm: confirm,
  revoke: revoke,
  applyConfirmations: applyConfirmations,
  findAll: findAll,
  Class: LinkConfirmation
};
