// Transition rule "Auto Blog Close" (issue #1134): close a whole blog once
// every active language is either closed or abandoned. Wired into the sweep
// by model/blogTransitionScheduler.js.
//
// - The `keepOpenBlogs` newest blogs that went to edit stay open for late
//   teams; only older blogs are candidates.
// - A language is active in a blog if it has text there or was closed in
//   one of the `previousBlogs` blogs before.
// - An active language that is not closed is abandoned when nobody (no
//   translation service, no automatic rule) changed its texts, reviews or
//   close state for `idleDays`, counted from the blog end at the earliest.

import { eachSeries } from "async";
import _debug from "debug";

import config from "../config.js";
import language from "./language.js";
import blogModule from "./blog.js";
import logModule from "./logModule.js";
import translator from "./translator.js";
import { getKnownMigrationUserNames } from "../notification/migrationFilter.js";

const debug = _debug("OSMBC:model:autoBlogClose");

const DAY_MS = 24 * 60 * 60 * 1000;
// users of automatic steps that are not translators or rule actors
const SYSTEM_USERS = ["OSMCAL", "autoclose", "autocreate"];

let _lastRunTs = null;

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseLanguages(value) {
  const configured = language.getLid();
  if (!Array.isArray(value)) return configured;
  const filtered = value.map((lang) => String(lang).trim()).filter((lang) => configured.indexOf(lang) >= 0);
  return filtered.length > 0 ? filtered : configured;
}

/**
 * Read `Transition.AutoBlogClose` with its defaults.
 * @param {object} [raw] the config block
 * @returns {object} enabled, keepOpenBlogs, idleDays, previousBlogs,
 *   everyMinutes, languages, actorUser
 */
export function parseAutoBlogClose(raw) {
  raw = raw || {};
  return {
    enabled: raw.enabled === true || raw.enabled === "true",
    keepOpenBlogs: Math.max(0, parseNumber(raw.keepOpenBlogs, 2)),
    idleDays: parseNumber(raw.idleDays, 14),
    previousBlogs: parseNumber(raw.previousBlogs, 2),
    everyMinutes: Math.max(1, parseNumber(raw.everyMinutes, 60)),
    languages: parseLanguages(raw.languages),
    actorUser: (typeof raw.actorUser === "string" && raw.actorUser.trim() !== "") ? raw.actorUser.trim() : "autoclose-blog"
  };
}

/**
 * Users whose changes are no sign of a working team: translation services,
 * copy users, the actors of the automatic rules and migration users.
 * @param {string[]} ruleActors actorUser of every transition rule
 * @returns {string[]} OSMUser names
 */
export function ignoredUsersForActivity(ruleActors) {
  const users = new Set(SYSTEM_USERS.concat(ruleActors));
  for (const service in translator) {
    if (translator[service] && translator[service].user) users.add(translator[service].user);
  }
  getKnownMigrationUserNames().forEach((user) => users.add(user));
  return Array.from(users);
}

// language id of a logged property, e.g. markdownDE -> DE, reviewCommentPT-PT -> PT-PT
function languageOfProperty(property) {
  for (const prefix of ["markdown", "reviewComment", "close"]) {
    if (property.startsWith(prefix)) return property.substring(prefix.length);
  }
  return null;
}

function lastActivityByLanguage(rows) {
  const result = {};
  rows.forEach(function(row) {
    const lang = languageOfProperty(row.property || "");
    if (!lang) return;
    const ts = new Date(row.last).getTime();
    if (!Number.isNaN(ts) && (!result[lang] || ts > result[lang])) result[lang] = ts;
  });
  return result;
}

// blogs in edit that have at least keepOpenBlogs newer blogs already past collecting
function findCandidates(blogs, keepOpenBlogs) {
  const numberOf = (blog) => {
    const match = (typeof blog.name === "string") ? blog.name.match(/^WN(\d+)$/i) : null;
    return match ? Number.parseInt(match[1], 10) : null;
  };
  const numbers = blogs.map(numberOf).filter((n) => n !== null);
  return blogs.filter(function(blog) {
    const number = numberOf(blog);
    if (blog.status !== "edit" || number === null) return false;
    return numbers.filter((n) => n > number).length >= keepOpenBlogs;
  });
}

/**
 * Decide for one candidate blog. Needs blog.calculateDerived to have run.
 * @param {object} blog candidate blog
 * @param {object[]} previousBlogs from blogModule.findPreviousBlogs
 * @param {object} lastActivity language -> timestamp (ms) of the last human change
 * @param {object} ruleConfig from parseAutoBlogClose
 * @param {number} now current time in ms
 * @returns {{close: boolean, closed: string[], abandoned: object[], waiting: object[]}}
 *   abandoned/waiting entries: `{ lang, lastTs }`, waiting also `idleFromTs`
 *   (when the language counts as abandoned)
 */
export function planBlogClose(blog, previousBlogs, lastActivity, ruleConfig, now) {
  const plan = { close: false, closed: [], abandoned: [], waiting: [] };
  const endTs = new Date(blog.endDate).getTime() || 0;
  const used = blog._usedLanguages || {};
  ruleConfig.languages.forEach(function(lang) {
    const active = used[lang] || previousBlogs.some((previous) => previous["close" + lang] === true);
    if (!active) return;
    if (blog["close" + lang] === true) return plan.closed.push(lang);
    const lastTs = Math.max(lastActivity[lang] || 0, endTs);
    const idleFromTs = lastTs + ruleConfig.idleDays * DAY_MS;
    if (now >= idleFromTs) return plan.abandoned.push({ lang: lang, lastTs: lastTs });
    plan.waiting.push({ lang: lang, lastTs: lastTs, idleFromTs: idleFromTs });
  });
  plan.close = plan.waiting.length === 0;
  return plan;
}

// plan for every candidate blog, calls back with [{ blog, plan }]
function planCandidates(ruleConfig, ignoredUsers, now, callback) {
  blogModule.find({ status: "IN(edit,closed)" }, { column: "endDate", desc: false }, function(err, blogs) {
    if (err) return callback(err);
    const result = [];
    const actor = { OSMUser: ruleConfig.actorUser };
    eachSeries(findCandidates(blogs || [], ruleConfig.keepOpenBlogs), function(blog, cbBlog) {
      blog.calculateDerived(actor, function(err) {
        if (err) return cbBlog(err);
        blogModule.findPreviousBlogs(blog, ruleConfig.previousBlogs, function(err, previousBlogs) {
          if (err) return cbBlog(err);
          logModule.findLastChangesForBlog(blog.name, ignoredUsers, function(err, rows) {
            if (err) return cbBlog(err);
            result.push({ blog: blog, plan: planBlogClose(blog, previousBlogs, lastActivityByLanguage(rows), ruleConfig, now) });
            cbBlog();
          });
        });
      });
    }, function(err) {
      callback(err, result);
    });
  });
}

/**
 * Run the rule: close every candidate blog whose active languages are all
 * closed or abandoned. Runs at most every `everyMinutes`, the sweep itself
 * runs every minute.
 * @param {object} ruleConfig from parseAutoBlogClose
 * @param {string[]} ignoredUsers from ignoredUsersForActivity
 * @param {function(Error=)} callback called when done
 */
export function runAutoBlogCloseRule(ruleConfig, ignoredUsers, callback) {
  if (ruleConfig.enabled !== true) return callback();
  const now = Date.now();
  if (_lastRunTs !== null && now - _lastRunTs < ruleConfig.everyMinutes * 60 * 1000) return callback();
  _lastRunTs = now;
  planCandidates(ruleConfig, ignoredUsers, now, function(err, candidates) {
    if (err) return callback(err);
    eachSeries(candidates, function(candidate, cb) {
      if (!candidate.plan.close) return cb();
      debug("Auto close blog %s", candidate.blog.name);
      candidate.blog.setAndSave({ OSMUser: ruleConfig.actorUser }, { status: "closed" }, function(err) {
        // a problem with one blog should not stop the others
        if (err) config.logger.error(err);
        cb();
      });
    }, callback);
  });
}

/**
 * Read only preview for the admin page: every candidate blog with its plan.
 * @param {object} ruleConfig from parseAutoBlogClose
 * @param {string[]} ignoredUsers from ignoredUsersForActivity
 * @param {function(Error|null, object=)} callback gets `{ enabled, keepOpenBlogs,
 *   idleDays, blogs: [{ name, close, closed, abandoned, waiting }] }`
 */
export function previewAutoBlogClose(ruleConfig, ignoredUsers, callback) {
  const result = {
    enabled: ruleConfig.enabled === true,
    keepOpenBlogs: ruleConfig.keepOpenBlogs,
    idleDays: ruleConfig.idleDays,
    blogs: []
  };
  if (!result.enabled) return callback(null, result);
  planCandidates(ruleConfig, ignoredUsers, Date.now(), function(err, candidates) {
    if (err) return callback(err);
    result.blogs = candidates.map((c) => Object.assign({ name: c.blog.name }, c.plan));
    callback(null, result);
  });
}

/**
 * Forget when the rule ran last (scheduler stop, tests).
 */
export function resetAutoBlogClose() {
  _lastRunTs = null;
}
