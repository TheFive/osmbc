// Links the link check can't verify (bot protection, login wall, geo
// blocking, certificate error) get an answer from a full editor who opened
// them in the browser: the link exists, or it is missing (then it is shown
// as broken). An answer belongs to the url, not to an article, and is valid
// for LinkCheck.confirmationValidMonths (default 6). Answer and undo are
// written to the change log (table "linkconfirmation").

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

/**
 * One answered url: `url`, `exists` (true/false), `user` (OSMUser),
 * `timestamp`, `status` (link check result when answered).
 */
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
   * Whether the editor said the link exists (entries from before the
   * yes/no answer only knew "exists").
   * @returns {boolean} false for a link marked missing
   */
  linkExists() {
    return this.exists !== false;
  }

  /**
   * The link check result for an answered link, as sent to the browser.
   * @param {(number|string)} status the current result of the link check
   * @returns {object} state "confirmed", `exists`, who answered, when and until when
   */
  toCheckResult(status) {
    return {
      state: "confirmed",
      exists: this.linkExists(),
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
  messageCenter.global.sendInfo(Object.assign({ oid: entry.id, user: user.OSMUser, table: TABLE, url: entry.url }, change), callback);
}

/**
 * A full editor answers whether a link exists. The link is checked again
 * first: only a "blocked" result (401, 403, 451, certificate error) can be
 * answered, a link that is ok or broken (404, 410 ...) gets a 409.
 * An existing answer for the url is replaced.
 * @param {object} user the logged in user
 * @param {string} url the link
 * @param {boolean} exists true: the link works, false: it is missing
 * @param {function(Error|null, object=)} callback the new check result
 *   (state "confirmed"); errors carry `status` 400/403/409
 */
function confirm(user, url, exists, callback) {
  debug("confirm %s %s", url, exists);
  const inputError = checkRequest(user, url);
  if (inputError) return callback(inputError);
  if (typeof exists !== "boolean") return callback(httpError(BAD_REQUEST, "Expected exists true or false"));
  linkCheck.checkLink(url, function(err, result) {
    if (err) return callback(err);
    if (result.state !== "blocked") {
      return callback(httpError(CONFLICT, `Link can't be confirmed, link check says ${result.status}`));
    }
    findByUrl(url, function(err, existing) {
      if (err) return callback(err);
      const entry = existing || create({ url: url });
      const before = existing ? existing.linkExists() : null;
      entry.exists = exists;
      entry.user = user.OSMUser;
      entry.timestamp = new Date().toISOString();
      entry.status = result.status;
      entry.save(function(err) {
        if (err) return callback(err);
        logChange(user, entry, { property: "exists", from: before, to: exists }, function(err) {
          if (err) return callback(err);
          return callback(null, entry.toCheckResult(result.status));
        });
      });
    });
  });
}

/**
 * A full editor takes back the answer for a link (also an expired one).
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
      logChange(user, entry, { property: "exists", from: entry.linkExists(), to: null }, callback);
    });
  });
}

/**
 * Replaces the "blocked" results of a link check by "confirmed" (with
 * `exists`) where a valid answer exists. Other results stay as they are, so
 * a confirmed link that later answers 404 is shown as broken again.
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
 * All answers, newest first, expired ones included.
 * @param {function(Error|null, LinkConfirmation[]=)} callback
 */
function findAll(callback) {
  pgMap.find(linkConfirmationModule, null, { column: "timestamp", desc: true }, callback);
}

const ANSWER_FILTERS = {
  all: () => true,
  exists: (e, now) => e.linkExists() && e.isValid(now),
  missing: (e, now) => !e.linkExists() && e.isValid(now),
  expired: (e, now) => !e.isValid(now)
};

/**
 * Answers for the admin list, newest first.
 * @param {{text: string=, answer: string=}} filter `text` is searched in url
 *   and user (case ignored); `answer` is all (default), exists, missing
 *   (both only valid ones) or expired
 * @param {function(Error|null, LinkConfirmation[]=)} callback errors carry
 *   `status` 400 for an unknown `answer`
 */
function search(filter, callback) {
  const answer = filter.answer || "all";
  if (!Object.hasOwn(ANSWER_FILTERS, answer)) return callback(httpError(BAD_REQUEST, "Unknown answer filter " + answer));
  const text = (typeof filter.text === "string") ? filter.text.trim().toLowerCase() : "";
  findAll(function(err, entries) {
    if (err) return callback(err);
    const now = new Date();
    callback(null, entries.filter(function(e) {
      if (!ANSWER_FILTERS[answer](e, now)) return false;
      return text === "" || String(e.url).toLowerCase().includes(text) || String(e.user).toLowerCase().includes(text);
    }));
  });
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
  search: search,
  answerFilters: Object.keys(ANSWER_FILTERS),
  Class: LinkConfirmation
};
