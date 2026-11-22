// Everything known about a link (url), one row per url in the table "link":
// the last automatic check (util/linkCheck.js) and an editor's answer.
//
// - check: { state, status, checkedAt }; state ok / broken / blocked /
//   unreachable. Valid for LinkCheck.recheck…, then checked again.
// - answer: { exists, by, timestamp }, only from a full editor; valid for
//   LinkCheck.confirmationValidMonths. While valid it wins over
//   the check, in both directions (a 404 that works in the browser, a page
//   that answers 200 but is gone).
// Without a valid answer the check decides: ok = exists, broken = missing,
// blocked and unreachable stay open. Answer and undo go to the change log.

import _debug from "debug";
import { eachLimit, eachSeries } from "async";
import { BAD_REQUEST, FORBIDDEN, NOT_FOUND } from "http-status-codes";

import config from "../config.js";
import db from "../model/db.js";
import messageCenter from "../notification/messageCenter.js";
import linkCheck from "../util/linkCheck.js";

const debug = _debug("OSMBC:model:link");

const TABLE = "link";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const PARALLEL_CHECKS = 5;
const SEARCH_LIMIT = 200;

// LinkCheck in the editorial config (docs/config.md "Link check"); a
// missing or invalid value (not a number > 0) takes the default
const DEFAULTS = {
  confirmationValidMonths: 6,
  recheckOkDays: 90,
  recheckBrokenDays: 1,
  recheckBlockedDays: 1,
  recheckUnreachableHours: 1,
  cleanupAfterDays: 180
};

/**
 * The link check settings with defaults filled in.
 * @param {object} [linkCheck] the LinkCheck config block (default: from config)
 * @returns {object} every key of DEFAULTS with a number > 0
 */
function settings(linkCheck = config.getValue("LinkCheck", { default: {} })) {
  const result = {};
  for (const key in DEFAULTS) {
    const value = (linkCheck || {})[key];
    result[key] = (typeof value === "number" && value > 0) ? value : DEFAULTS[key];
  }
  return result;
}

/**
 * Problems of a LinkCheck config block, as texts for the log at start.
 * @param {object} [linkCheck] the LinkCheck config block (default: from config)
 * @returns {string[]} unknown keys, values that are no number > 0, a cleanup
 *   shorter than the ok recheck (would delete rows still in use)
 */
function settingsProblems(linkCheck = config.getValue("LinkCheck", { default: {} })) {
  const problems = [];
  for (const key in (linkCheck || {})) {
    if (!Object.hasOwn(DEFAULTS, key)) problems.push(`LinkCheck.${key} is unknown`);
    else if (!(typeof linkCheck[key] === "number" && linkCheck[key] > 0)) problems.push(`LinkCheck.${key} must be a number > 0, using ${DEFAULTS[key]}`);
  }
  const s = settings(linkCheck);
  if (s.cleanupAfterDays < s.recheckOkDays) problems.push("LinkCheck.cleanupAfterDays is shorter than recheckOkDays");
  return problems;
}

// how long an automatic check result is used before the link is checked again
function recheckAfterMs(state) {
  const s = settings();
  return {
    ok: s.recheckOkDays * DAY,
    broken: s.recheckBrokenDays * DAY,
    blocked: s.recheckBlockedDays * DAY,
    unreachable: s.recheckUnreachableHours * HOUR
  }[state];
}

/**
 * One url with its last check and an editor's answer, see the top of the file.
 */
class Link {
  constructor(row) {
    this.id = row.id;
    Object.assign(this, row.data);
  }

  /**
   * Whether the automatic check is recent enough to be used without a new request.
   * @param {Date} now the current time
   * @returns {boolean} false when there is no check or it ran out
   */
  isCheckFresh(now) {
    const validMs = this.check ? recheckAfterMs(this.check.state) : undefined;
    if (!validMs) return false;
    return now - new Date(this.check.checkedAt) < validMs;
  }

  /**
   * End of the editor's answer, from its date and the current configuration.
   * @returns {Date|null} null without an answer
   */
  answerValidUntil() {
    if (!this.answer) return null;
    const d = new Date(this.answer.timestamp);
    d.setUTCMonth(d.getUTCMonth() + settings().confirmationValidMonths);
    return d;
  }

  /**
   * The editor's answer while it counts.
   * @param {Date} now the current time
   * @returns {object|null} { exists, by, timestamp } or null
   */
  validAnswer(now) {
    if (!this.answer || this.answerValidUntil() <= now) return null;
    return this.answer;
  }

  /**
   * What the browser gets for this link (routes/article.js urlExist).
   * @param {Date} now the current time
   * @returns {object} { state, status, exists, by } plus timestamp and
   *   validUntil for an editor's answer; exists is true, false or null (open)
   */
  toResult(now) {
    const result = { state: this.check ? this.check.state : "unknown", status: this.check ? this.check.status : null };
    const answer = this.validAnswer(now);
    if (answer) {
      return Object.assign(result, { exists: answer.exists, by: answer.by, timestamp: answer.timestamp, validUntil: this.answerValidUntil().toISOString() });
    }
    if (result.state === "ok") return Object.assign(result, { exists: true, by: "auto" });
    if (result.state === "broken") return Object.assign(result, { exists: false, by: "auto" });
    return Object.assign(result, { exists: null });
  }
}

const pgObject = {};
pgObject.table = TABLE;
pgObject.createString = "CREATE TABLE IF NOT EXISTS link (  id bigserial NOT NULL,  data jsonb,  \
                  CONSTRAINT link_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
// written as Postgres stores them (pg_indexes), so createdb.js --verbose finds them OK
pgObject.indexDefinition = {
  // lookup of a page's urls (url = any($1)) and conflict target of the upsert
  link_url_idx: "CREATE UNIQUE INDEX link_url_idx ON link USING btree (((data ->> 'url'::text)))",
  // daily cleanup of old automatic rows (rows without an editor's answer)
  link_check_date_idx: "CREATE INDEX link_check_date_idx ON link USING btree ((((data -> 'check'::text) ->> 'checkedAt'::text))) WHERE ((data -> 'answer'::text) IS NULL)"
};
pgObject.viewDefinition = {};

function toLinks(result) {
  return (result && result.rows) ? result.rows.map(row => new Link(row)) : [];
}

/**
 * Removes automatic rows without an editor's answer whose check is older
 * than LinkCheck.cleanupAfterDays; they are checked again when a page
 * shows the link.
 * @param {function(Error=)} callback
 */
function cleanup(callback) {
  const before = new Date(Date.now() - settings().cleanupAfterDays * DAY).toISOString();
  db.query("DELETE FROM link WHERE data->'answer' IS NULL AND data->'check'->>'checkedAt' < $1", [before], function(err) {
    return callback(err);
  });
}

/**
 * Creates the table and its index if they are missing (so an existing
 * installation needs no extra database step) and removes old automatic
 * rows. Called at server start.
 * @param {function(Error=)} callback
 */
function ensureTable(callback) {
  debug("ensureTable");
  settingsProblems().forEach(p => config.logger.warn("Config: " + p));
  db.query(pgObject.createString, function(err) {
    if (err) return callback(err);
    const indexes = Object.values(pgObject.indexDefinition).map(sql => sql.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS "));
    eachSeries(indexes, (sql, cb) => db.query(sql, (err) => cb(err)), function(err) {
      if (err) return callback(err);
      cleanup(callback);
    });
  });
}

function findByUrls(urls, callback) {
  if (urls.length === 0) return callback(null, {});
  db.query("SELECT id, data FROM link WHERE data->>'url' = any($1)", [urls], function(err, result) {
    if (err) return callback(err);
    const byUrl = {};
    toLinks(result).forEach(l => { byUrl[l.url] = l; });
    return callback(null, byUrl);
  });
}

// insert or replace one part ("check" or "answer") of a url's row
function upsertPart(url, part, value, callback) {
  db.query(`INSERT INTO link (data) VALUES ($1)
    ON CONFLICT ((data->>'url')) DO UPDATE SET data = jsonb_set(link.data, '{${part}}', EXCLUDED.data->'${part}')
    RETURNING id, data`, [{ url: url, [part]: value }], function(err, result) {
    if (err) return callback(err);
    return callback(null, toLinks(result)[0]);
  });
}

/**
 * The stored results for these urls, without any new request: only urls
 * whose check is still fresh (the browser asks for the others). Used to
 * send the known results with a page.
 * @param {string[]} urls absolute http(s) urls
 * @param {function(Error|null, object=)} callback url -> result (Link#toResult)
 */
function knownResults(urls, callback) {
  findByUrls([...new Set(urls)], function(err, byUrl) {
    if (err) return callback(err);
    const now = new Date();
    const results = {};
    for (const url in byUrl) {
      if (byUrl[url].isCheckFresh(now)) results[url] = byUrl[url].toResult(now);
    }
    return callback(null, results);
  });
}

/**
 * Results for these urls; a url without a fresh check is checked now
 * (at most 5 requests at a time) and the check stored.
 * @param {string[]} urls absolute http(s) urls
 * @param {function(Error|null, object=)} callback url -> result (Link#toResult)
 */
function checkUrls(urls, callback) {
  debug("checkUrls %d", urls.length);
  findByUrls([...new Set(urls)], function(err, byUrl) {
    if (err) return callback(err);
    const results = {};
    eachLimit([...new Set(urls)], PARALLEL_CHECKS, function(url, cb) {
      const known = byUrl[url];
      if (known && known.isCheckFresh(new Date())) {
        results[url] = known.toResult(new Date());
        return cb();
      }
      linkCheck.checkLink(url, function(err, check) {
        if (err) return cb(err);
        upsertPart(url, "check", { state: check.state, status: check.status, checkedAt: new Date().toISOString() }, function(err, link) {
          if (err) return cb(err);
          results[url] = link.toResult(new Date());
          return cb();
        });
      });
    }, function(err) {
      return callback(err, results);
    });
  });
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Input checks shared by answer and revoke; returns an error or null.
function checkRequest(user, url) {
  if (!user || user.access !== "full") return httpError(FORBIDDEN, "Only full editors can answer for links");
  if (typeof url !== "string" || !/^https?:\/\/\S+$/i.test(url)) return httpError(BAD_REQUEST, "Expected an http(s) url");
  return null;
}

function logChange(user, link, from, to, callback) {
  messageCenter.global.sendInfo({ oid: link.id, user: user.OSMUser, table: TABLE, property: "exists", from: from, to: to, url: link.url }, callback);
}

/**
 * A full editor says whether a link exists, for any check result: "exists"
 * for a 404 that works in the browser, "missing" for a page that is gone
 * although it answers. Replaces an earlier answer.
 * @param {object} user the logged in user
 * @param {string} url the link
 * @param {boolean} exists true: the link works, false: it is missing
 * @param {function(Error|null, object=)} callback the new result
 *   (Link#toResult); errors carry `status` 400/403
 */
function answer(user, url, exists, callback) {
  debug("answer %s %s", url, exists);
  const inputError = checkRequest(user, url);
  if (inputError) return callback(inputError);
  if (typeof exists !== "boolean") return callback(httpError(BAD_REQUEST, "Expected exists true or false"));
  findByUrls([url], function(err, byUrl) {
    if (err) return callback(err);
    const before = (byUrl[url] && byUrl[url].answer) ? byUrl[url].answer.exists : null;
    upsertPart(url, "answer", { exists: exists, by: user.OSMUser, timestamp: new Date().toISOString() }, function(err, link) {
      if (err) return callback(err);
      logChange(user, link, before, exists, function(err) {
        return callback(err, link.toResult(new Date()));
      });
    });
  });
}

/**
 * A full editor takes back the answer for a link (also an expired one);
 * the automatic check counts again.
 * @param {object} user the logged in user
 * @param {string} url the link
 * @param {function(Error|null, object=)} callback the new result
 *   (Link#toResult); errors carry `status` 400/403/404
 */
function revoke(user, url, callback) {
  debug("revoke %s", url);
  const inputError = checkRequest(user, url);
  if (inputError) return callback(inputError);
  findByUrls([url], function(err, byUrl) {
    if (err) return callback(err);
    const link = byUrl[url];
    if (!link || !link.answer) return callback(httpError(NOT_FOUND, "There is no answer for this link"));
    db.query("UPDATE link SET data = data - 'answer' WHERE id = $1 RETURNING id, data", [link.id], function(err, result) {
      if (err) return callback(err);
      const changed = toLinks(result)[0];
      logChange(user, changed, link.answer.exists, null, function(err) {
        return callback(err, changed.toResult(new Date()));
      });
    });
  });
}

// filters of the admin list, on Link#toResult and the stored answer
const FILTERS = {
  all: () => true,
  open: (r) => r.exists === null,
  missing: (r) => r.exists === false,
  exists: (r) => r.exists === true,
  answered: (r) => r.by !== "auto" && r.exists !== null,
  expired: (r, l, now) => !!l.answer && !l.validAnswer(now)
};

function lastChange(link) {
  const a = link.answer ? link.answer.timestamp : "";
  const c = link.check ? link.check.checkedAt : "";
  return (a > c) ? a : c;
}

/**
 * Links for the admin list, last change first, at most 200.
 * @param {{text: string=, filter: string=}} options `text` is searched in
 *   url and answering user (case ignored); `filter` is one of `filters`
 *   (default all)
 * @param {function(Error|null, {links: object[], total: number}=)} callback
 *   links as { url, result, answer, answerValidUntil, expired }; errors
 *   carry `status` 400 for an unknown filter
 */
function search(options, callback) {
  const filter = options.filter || "all";
  if (!Object.hasOwn(FILTERS, filter)) return callback(httpError(BAD_REQUEST, "Unknown filter " + filter));
  const text = (typeof options.text === "string") ? options.text.trim().toLowerCase() : "";
  db.query("SELECT id, data FROM link", [], function(err, result) {
    if (err) return callback(err);
    const now = new Date();
    const links = toLinks(result).filter(function(l) {
      if (!FILTERS[filter](l.toResult(now), l, now)) return false;
      const user = l.answer ? String(l.answer.by).toLowerCase() : "";
      return text === "" || String(l.url).toLowerCase().includes(text) || user.includes(text);
    }).sort((a, b) => (lastChange(a) < lastChange(b) ? 1 : -1));
    return callback(null, {
      total: links.length,
      links: links.slice(0, SEARCH_LIMIT).map(l => ({
        url: l.url,
        result: l.toResult(now),
        answer: l.answer || null,
        answerValidUntil: l.answerValidUntil(),
        expired: !!l.answer && !l.validAnswer(now)
      }))
    });
  });
}

const MARKDOWN_LINK = /\]\((https?:\/\/[^)\s]+)\)/g;
const BARE_URL = /https?:\/\/[^\s)\]>"'<]+/g;

/**
 * The urls in the texts and collection of articles, for knownResults.
 * Finds markdown link targets as written and bare urls; a url written
 * differently from the rendered link only costs the browser a request.
 * @param {object[]} articles articles (markdownXX, collection)
 * @returns {string[]} urls, each once
 */
function urlsOfArticles(articles) {
  const urls = new Set();
  for (const article of articles) {
    for (const key in article) {
      if (key !== "collection" && !key.startsWith("markdown")) continue;
      if (typeof article[key] !== "string") continue;
      for (const m of article[key].matchAll(MARKDOWN_LINK)) urls.add(m[1]);
      for (const m of article[key].matchAll(BARE_URL)) urls.add(m[0]);
    }
  }
  return [...urls];
}

/**
 * Known results for the links of these articles, to send with a page.
 * Guests get none (their link check answers "OK" for everything).
 * @param {object} user the logged in user
 * @param {object[]} articles articles shown on the page
 * @param {function(Error|null, object=)} callback url -> result, or null for guests
 */
function knownResultsForArticles(user, articles, callback) {
  if (!user || user.access !== "full") return callback(null, null);
  knownResults(urlsOfArticles(articles), callback);
}

export default {
  table: TABLE,
  pg: pgObject,
  ensureTable: ensureTable,
  settings: settings,
  settingsProblems: settingsProblems,
  cleanup: cleanup,
  knownResults: knownResults,
  checkUrls: checkUrls,
  answer: answer,
  revoke: revoke,
  search: search,
  filters: Object.keys(FILTERS),
  urlsOfArticles: urlsOfArticles,
  knownResultsForArticles: knownResultsForArticles,
  Class: Link
};
