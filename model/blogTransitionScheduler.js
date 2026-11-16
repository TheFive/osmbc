import { eachSeries, series } from "async";
import { scheduleJob } from "node-schedule";

import config from "../config.js";
import language from "./language.js";
import blogModule from "./blog.js";
import translator from "./translator.js";
import _debug from "debug";

const debug = _debug("OSMBC:model:blogTransitionScheduler");

let _transitionJob = null;
let _transitionSweepRunning = 0;
const _warnedOnce = new Set();
// rule + blog id -> last recheck slot that ran, so a slot runs only once
// although the sweep runs every minute. Lost on restart: then the current
// slot runs once more, which is harmless because every rule action is
// idempotent (language already closed / review already started).
const _lastSlot = new Map();

// the sweep runs every minute, so a configuration problem is logged only once
function warnOnce(message) {
  if (_warnedOnce.has(message)) return;
  _warnedOnce.add(message);
  config.logger.warn(message);
}

function parseBoolean(value, fallback) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return fallback;
}

function parseActor(value, fallback) {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return fallback;
}

function parseStatusFilter(value) {
  if (!Array.isArray(value) || value.length === 0) return ["edit"];
  return value;
}

const WEEKDAYS = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

// allowHour24: only for the end of a recheck, "MON 24:00" is stored as "TUE 0:00"
function normaliseCloseAt(closeAtConfig, allowHour24) {
  if (!closeAtConfig || typeof closeAtConfig !== "object") return null;

  let weekday = closeAtConfig.weekday;
  if (typeof weekday === "string") {
    weekday = WEEKDAYS[weekday.trim().toUpperCase()];
  }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;

  const hour = parseNumber(closeAtConfig.hour, 12);
  const minute = parseNumber(closeAtConfig.minute, 0);

  if (allowHour24 && hour === 24 && minute === 0) {
    return { weekday: (weekday + 1) % 7, hour: 0, minute: 0 };
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  return {
    weekday: weekday,
    hour: hour,
    minute: minute
  };
}

// recheck: { everyMinutes, until }, until is a weekday/time or (only for
// rules running before the close) the string "AutoLanguageClose".
// Returns null (rule runs only once at its due time) if it is missing or invalid.
function normaliseRecheck(raw, ruleName, allowCloseRule) {
  if (raw === undefined || raw === null) return null;
  const prefix = "Transition." + ruleName + ".recheck: ";
  const everyMinutes = parseNumber(raw.everyMinutes, NaN);
  if (!(everyMinutes >= 1)) {
    warnOnce(prefix + "everyMinutes must be a number >= 1, recheck ignored");
    return null;
  }
  if (allowCloseRule && raw.until === "AutoLanguageClose") {
    return { everyMinutes: everyMinutes, everyMs: everyMinutes * 60 * 1000, untilClose: true };
  }
  const untilAt = normaliseCloseAt(raw.until, true);
  if (!untilAt) {
    warnOnce(prefix + "until missing or invalid, recheck ignored");
    return null;
  }
  return { everyMinutes: everyMinutes, everyMs: everyMinutes * 60 * 1000, untilAt: untilAt };
}

function nextWeeklyCloseTimeAtOrAfter(referenceTs, closeAt) {
  const result = new Date(referenceTs);
  const targetWeekday = closeAt.weekday;

  result.setHours(closeAt.hour, closeAt.minute, 0, 0);
  const dayDiff = (targetWeekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + dayDiff);

  if (result.getTime() < referenceTs) {
    result.setDate(result.getDate() + 7);
  }

  return result.getTime();
}

function normaliseLanguageList(languagesConfig) {
  const configuredLanguages = language.getLid();
  if (languagesConfig === "ALL" || typeof languagesConfig === "undefined" || languagesConfig === null) {
    return configuredLanguages;
  }
  if (!Array.isArray(languagesConfig)) {
    return configuredLanguages;
  }
  const filtered = languagesConfig
    .map((lang) => String(lang).trim())
    .filter((lang) => configuredLanguages.indexOf(lang) >= 0);
  if (filtered.length === 0) return configuredLanguages;
  return filtered;
}

function parseAutoLanguageClose(raw) {
  raw = raw || {};
  return {
    enabled: parseBoolean(raw.enabled, false),
    delayDays: parseNumber(raw.delayDays, 3),
    minReviews: parseNumber(raw.minReviews, 2),
    blogStatusFilter: parseStatusFilter(raw.blogStatusFilter),
    onlyIfNotExported: parseBoolean(raw.onlyIfNotExported, true),
    languages: normaliseLanguageList(raw.languages),
    closeAt: normaliseCloseAt(raw.closeAt),
    recheck: normaliseRecheck(raw.recheck, "AutoLanguageClose", false),
    actorUser: parseActor(raw.actorUser, "autoclose-review")
  };
}

function parseAutoTranslate(raw) {
  raw = raw || {};
  // no default for the source language, it has to be one of the configured languages
  let sourceLanguage = null;
  if (typeof raw.sourceLanguage === "string") {
    const candidate = raw.sourceLanguage.trim().toUpperCase();
    if (language.getLid().indexOf(candidate) >= 0) sourceLanguage = candidate;
  }
  return {
    enabled: parseBoolean(raw.enabled, false),
    sourceLanguage: sourceLanguage,
    service: parseActor(raw.service, "deeplPro"),
    languages: normaliseLanguageList(raw.languages).filter((lang) => lang !== sourceLanguage),
    previousBlogs: parseNumber(raw.previousBlogs, 2),
    blogStatusFilter: parseStatusFilter(raw.blogStatusFilter),
    delayDays: parseNumber(raw.delayDays, 3),
    translateAt: normaliseCloseAt(raw.translateAt),
    actorUser: parseActor(raw.actorUser, "autotranslate")
  };
}

function parseAutoReviewStart(raw, closeConfig) {
  raw = raw || {};
  const enabled = parseBoolean(raw.enabled, false);
  let recheck = normaliseRecheck(raw.recheck, "AutoReviewStart", true);
  if (enabled && recheck && recheck.untilClose && closeConfig.enabled !== true) {
    warnOnce("Transition.AutoReviewStart.recheck: until AutoLanguageClose, but AutoLanguageClose is off, recheck ignored");
    recheck = null;
  }
  return {
    enabled: enabled,
    languages: normaliseLanguageList(raw.languages),
    blogStatusFilter: parseStatusFilter(raw.blogStatusFilter),
    delayDays: parseNumber(raw.delayDays, 3),
    reviewStartAt: normaliseCloseAt(raw.reviewStartAt),
    recheck: recheck,
    acceptAutoTranslated: parseBoolean(raw.acceptAutoTranslated, true),
    actorUser: parseActor(raw.actorUser, "autoreview-start")
  };
}

function getTransitionConfig() {
  const raw = config.getValue("Transition", { default: {} }) || {};
  const rawAutoEditMode = raw.AutoEditMode || {};
  const autoLanguageClose = parseAutoLanguageClose(raw.AutoLanguageClose);

  return {
    enabled: parseBoolean(raw.enabled, true),
    scheduleCron: raw.scheduleCron || "*/1 * * * *",
    runOnStart: parseBoolean(raw.runOnStart, true),
    autoEditMode: {
      enabled: parseBoolean(rawAutoEditMode.enabled, true)
    },
    autoLanguageClose: autoLanguageClose,
    autoTranslate: parseAutoTranslate(raw.AutoTranslate),
    autoReviewStart: parseAutoReviewStart(raw.AutoReviewStart, autoLanguageClose)
  };
}

const RULE_WINDOW_MS = 1 * 60 * 60 * 1000;

// time from which a rule acts on a blog, null if the blog has no usable endDate
function ruleDueTs(blog, delayDays, at) {
  if (!blog || !blog.endDate) return null;
  const endDateTs = new Date(blog.endDate).getTime();
  if (Number.isNaN(endDateTs)) return null;
  if (at) return nextWeeklyCloseTimeAtOrAfter(endDateTs, at);
  return endDateTs + (delayDays * 24 * 60 * 60 * 1000);
}

// rules act only within one hour after the due time, so they run once without a marker
function isInRuleWindow(dueTs, now) {
  return dueTs !== null && now >= dueTs && now <= dueTs + RULE_WINDOW_MS;
}

// timing of a rule for one blog: due time, and with a recheck its end and slot length.
// A recheck that would end at or before the due time is ignored.
function ruleTiming(blog, ruleConfig, at, closeConfig) {
  const timing = { dueTs: ruleDueTs(blog, ruleConfig.delayDays, at), recheck: null, untilTs: null };
  const recheck = ruleConfig.recheck;
  if (timing.dueTs === null || !recheck) return timing;
  const untilTs = recheck.untilClose
    ? ruleDueTs(blog, closeConfig.delayDays, closeConfig.closeAt)
    : nextWeeklyCloseTimeAtOrAfter(timing.dueTs, recheck.untilAt);
  if (untilTs === null || untilTs <= timing.dueTs) return timing;
  timing.recheck = recheck;
  timing.untilTs = untilTs;
  return timing;
}

// index of the recheck slot "now" falls in (slot 0 starts at the due time),
// null before the due time and from the end of the recheck on
function recheckSlot(timing, now) {
  if (now < timing.dueTs || now >= timing.untilTs) return null;
  return Math.floor((now - timing.dueTs) / timing.recheck.everyMs);
}

// true if a rule should act on a blog in this sweep.
// Without a recheck: every sweep within one hour after the due time.
// With a recheck: once per slot from the due time until its end.
function shouldRun(ruleName, blog, timing, now) {
  if (timing.dueTs === null) return false;
  if (!timing.recheck) return isInRuleWindow(timing.dueTs, now);
  const slot = recheckSlot(timing, now);
  if (slot === null) return false;
  const key = ruleName + ":" + blog.id;
  if (_lastSlot.get(key) === slot) return false;
  _lastSlot.set(key, slot);
  return true;
}

// true if the preview should still show the blog for this rule
function isUpcoming(timing, now) {
  if (timing.dueTs === null) return false;
  if (timing.recheck) return now < timing.untilTs;
  return now <= timing.dueTs + RULE_WINDOW_MS;
}

// preview fields of a recheck: next slot start (null if no slot is left) and the end
function recheckPreview(timing, now) {
  if (!timing.recheck) return {};
  let nextTs = timing.dueTs;
  if (now >= timing.dueTs) {
    nextTs = timing.dueTs + (Math.floor((now - timing.dueTs) / timing.recheck.everyMs) + 1) * timing.recheck.everyMs;
  }
  return { nextTs: (nextTs < timing.untilTs) ? nextTs : null, untilTs: timing.untilTs };
}

function planLanguageClose(blog, ruleConfig) {
  const plan = { close: [], waiting: [], done: [] };
  ruleConfig.languages.forEach(function(lang) {
    if (blog["close" + lang] === true) return plan.done.push(lang);
    if (ruleConfig.onlyIfNotExported && blog["exported" + lang] === true) return plan.done.push(lang);
    const reviews = blog.getClosedReviewCount(lang);
    if (reviews < ruleConfig.minReviews) return plan.waiting.push({ lang: lang, reviews: reviews });
    plan.close.push(lang);
  });
  return plan;
}

// translate only languages with an active team, that closed one of the previous blogs,
// and only once per blog and language (marker autoTranslated)
function planTranslate(blog, previousBlogs, ruleConfig) {
  const plan = { translate: [], inactive: [], translated: [], done: [] };
  ruleConfig.languages.forEach(function(lang) {
    if (blog.autoTranslated && blog.autoTranslated[lang]) return plan.translated.push(lang);
    if (!blog.isEditable(lang)) return plan.done.push(lang);
    if (previousBlogs.some((previous) => previous["close" + lang] === true)) return plan.translate.push(lang);
    plan.inactive.push(lang);
  });
  return plan;
}

// start the review of a language when every article is written: it has a text
// or "no translation" (--unpublished-- articles do not count). A machine
// translation counts as written unless acceptAutoTranslated is false. A
// language with only "no translation" articles has no active team and waits.
// Needs blog.calculateDerived to have run.
function planReviewStart(blog, ruleConfig) {
  const plan = { start: [], waiting: [], done: [] };
  ruleConfig.languages.forEach(function(lang) {
    if (!blog.isEditable(lang) || blog.isReviewStarted(lang)) return plan.done.push(lang);
    const unedited = blog.getUnEdited(lang);
    const autoTranslated = ruleConfig.acceptAutoTranslated ? 0 : blog.getAutoTranslate(lang);
    const written = blog.getWritten(lang);
    if (unedited > 0 || autoTranslated > 0 || written === 0) {
      return plan.waiting.push({ lang: lang, unedited: unedited, autoTranslated: autoTranslated, written: written });
    }
    plan.start.push(lang);
  });
  return plan;
}

function autoTranslateProblem(ruleConfig) {
  if (!ruleConfig.sourceLanguage) {
    return "Transition.AutoTranslate: sourceLanguage missing or not a configured language, rule skipped";
  }
  const service = translator[ruleConfig.service];
  if (!service || typeof service.active !== "function" || !service.active()) {
    return "Transition.AutoTranslate: translation service " + ruleConfig.service + " not available, rule skipped";
  }
  return null;
}

function findBlogsWithStatus(statusList, callback) {
  blogModule.find({ status: "IN(" + statusList.join(",") + ")" }, { column: "endDate", desc: false }, function(err, blogs) {
    if (err) return callback(err);
    callback(null, blogs || []);
  });
}

function runLanguageAutoCloseRule(callback) {
  const transitionConfig = getTransitionConfig();
  const ruleConfig = transitionConfig.autoLanguageClose;

  if (ruleConfig.enabled !== true) return callback();

  const now = Date.now();

  findBlogsWithStatus(ruleConfig.blogStatusFilter, function(err, blogs) {
    if (err) return callback(err);

    eachSeries(blogs, function(blog, cbBlog) {
      const timing = ruleTiming(blog, ruleConfig, ruleConfig.closeAt);
      if (!shouldRun("AutoLanguageClose", blog, timing, now)) return cbBlog();

      eachSeries(planLanguageClose(blog, ruleConfig).close, function(lang, cbLanguage) {
        debug("Auto close language %s for blog %s", lang, blog.name);
        blog.closeBlog({ user: { OSMUser: ruleConfig.actorUser }, lang: lang, status: true }, cbLanguage);
      }, cbBlog);
    }, callback);
  });
}

function runAutoReviewStartRule(callback) {
  const transitionConfig = getTransitionConfig();
  const ruleConfig = transitionConfig.autoReviewStart;

  if (ruleConfig.enabled !== true) return callback();

  const now = Date.now();
  const actor = { OSMUser: ruleConfig.actorUser };

  findBlogsWithStatus(ruleConfig.blogStatusFilter, function(err, blogs) {
    if (err) return callback(err);

    eachSeries(blogs, function(blog, cbBlog) {
      const timing = ruleTiming(blog, ruleConfig, ruleConfig.reviewStartAt, transitionConfig.autoLanguageClose);
      if (!shouldRun("AutoReviewStart", blog, timing, now)) return cbBlog();

      blog.calculateDerived(actor, function(err) {
        if (err) return cbBlog(err);
        eachSeries(planReviewStart(blog, ruleConfig).start, function(lang, cbLanguage) {
          debug("Auto review start language %s for blog %s", lang, blog.name);
          blog.setReviewComment(lang, actor, "startreview", function(err) {
            // a problem in one language should not stop the others
            if (err) config.logger.error(err);
            cbLanguage();
          });
        }, cbBlog);
      });
    }, callback);
  });
}

function runAutoTranslateRule(callback) {
  const transitionConfig = getTransitionConfig();
  const ruleConfig = transitionConfig.autoTranslate;

  if (ruleConfig.enabled !== true) return callback();
  const problem = autoTranslateProblem(ruleConfig);
  if (problem) {
    warnOnce(problem);
    return callback();
  }

  const now = Date.now();

  findBlogsWithStatus(ruleConfig.blogStatusFilter, function(err, blogs) {
    if (err) return callback(err);

    eachSeries(blogs, function(blog, cbBlog) {
      if (!isInRuleWindow(ruleDueTs(blog, ruleConfig.delayDays, ruleConfig.translateAt), now)) return cbBlog();

      blogModule.findPreviousBlogs(blog, ruleConfig.previousBlogs, function(err, previousBlogs) {
        if (err) return cbBlog(err);

        eachSeries(planTranslate(blog, previousBlogs, ruleConfig).translate, function(lang, cbLanguage) {
          debug("Auto translate language %s for blog %s", lang, blog.name);
          const actor = { OSMUser: ruleConfig.actorUser };
          blog.translateAllArticles(actor, ruleConfig.sourceLanguage, lang, ruleConfig.service, function(err) {
            // a problem in one language should not stop the others
            if (err) {
              config.logger.error(err);
              return cbLanguage();
            }
            // the sweep runs every minute within the window, translate only once
            blog.markAsAutoTranslated(actor, lang, function(err) {
              if (err) config.logger.error(err);
              cbLanguage();
            });
          });
        }, cbBlog);
      });
    }, callback);
  });
}

function byTs(a, b) { return a.ts - b.ts; }

// preview helper: open blogs will be in status edit when a later rule is due
function isPreviewCandidate(blog, statusFilter, autoEditEnabled) {
  if (statusFilter.indexOf(blog.status) >= 0) return true;
  return blog.status === "open" && autoEditEnabled && statusFilter.indexOf("edit") >= 0;
}

function previewAutoEdit(blogs, enabled, now) {
  const result = { enabled: enabled, blogs: [] };
  if (!enabled) return result;
  blogs.forEach(function(blog) {
    if (blog.status !== "open") return;
    const ts = ruleDueTs(blog, 0, null);
    if (ts === null) return;
    result.blogs.push({ name: blog.name, ts: ts, overdue: ts < now });
  });
  result.blogs.sort(byTs);
  return result;
}

function previewLanguageClose(blogs, transitionConfig, now) {
  const closeConfig = transitionConfig.autoLanguageClose;
  const result = { enabled: closeConfig.enabled === true, minReviews: closeConfig.minReviews, blogs: [] };
  if (!result.enabled) return result;
  if (closeConfig.recheck) result.everyMinutes = closeConfig.recheck.everyMinutes;
  blogs.forEach(function(blog) {
    if (!isPreviewCandidate(blog, closeConfig.blogStatusFilter, transitionConfig.autoEditMode.enabled === true)) return;
    const timing = ruleTiming(blog, closeConfig, closeConfig.closeAt);
    if (!isUpcoming(timing, now)) return;
    result.blogs.push(Object.assign({ name: blog.name, ts: timing.dueTs }, recheckPreview(timing, now), planLanguageClose(blog, closeConfig)));
  });
  result.blogs.sort(byTs);
  return result;
}

function previewAutoTranslate(blogs, transitionConfig, now, callback) {
  const translateConfig = transitionConfig.autoTranslate;
  const result = {
    enabled: translateConfig.enabled === true,
    sourceLanguage: translateConfig.sourceLanguage,
    previousBlogs: translateConfig.previousBlogs,
    blogs: []
  };
  if (!result.enabled) return callback(null, result);
  result.problem = autoTranslateProblem(translateConfig);
  if (result.problem) return callback(null, result);

  eachSeries(blogs, function(blog, cbBlog) {
    if (!isPreviewCandidate(blog, translateConfig.blogStatusFilter, transitionConfig.autoEditMode.enabled === true)) return cbBlog();
    const ts = ruleDueTs(blog, translateConfig.delayDays, translateConfig.translateAt);
    if (ts === null || now > ts + RULE_WINDOW_MS) return cbBlog();
    blogModule.findPreviousBlogs(blog, translateConfig.previousBlogs, function(err, previousBlogs) {
      if (err) return cbBlog(err);
      result.blogs.push(Object.assign({ name: blog.name, ts: ts }, planTranslate(blog, previousBlogs, translateConfig)));
      cbBlog();
    });
  }, function(err) {
    if (err) return callback(err);
    result.blogs.sort(byTs);
    callback(null, result);
  });
}

function previewAutoReviewStart(blogs, transitionConfig, now, callback) {
  const reviewConfig = transitionConfig.autoReviewStart;
  const result = {
    enabled: reviewConfig.enabled === true,
    acceptAutoTranslated: reviewConfig.acceptAutoTranslated,
    blogs: []
  };
  if (!result.enabled) return callback(null, result);
  if (reviewConfig.recheck) result.everyMinutes = reviewConfig.recheck.everyMinutes;
  const actor = { OSMUser: reviewConfig.actorUser };

  eachSeries(blogs, function(blog, cbBlog) {
    if (!isPreviewCandidate(blog, reviewConfig.blogStatusFilter, transitionConfig.autoEditMode.enabled === true)) return cbBlog();
    const timing = ruleTiming(blog, reviewConfig, reviewConfig.reviewStartAt, transitionConfig.autoLanguageClose);
    if (!isUpcoming(timing, now)) return cbBlog();
    blog.calculateDerived(actor, function(err) {
      if (err) return cbBlog(err);
      result.blogs.push(Object.assign({ name: blog.name, ts: timing.dueTs }, recheckPreview(timing, now), planReviewStart(blog, reviewConfig)));
      cbBlog();
    });
  }, function(err) {
    if (err) return callback(err);
    result.blogs.sort(byTs);
    callback(null, result);
  });
}

/**
 * Read only preview of what the next sweeps will do, for the admin page.
 * Uses the same decisions as the rules, but changes nothing. Due times are
 * calculated in the timezone of the server process (`timezone` in the result).
 * With transitions off the result holds only `enabled` and `timezone`.
 * @param {function(Error|null, object=)} callback gets the preview per rule
 *   (`autoEdit`, `autoTranslate`, `autoReviewStart`, `autoLanguageClose`)
 */
export function getUpcomingActions(callback) {
  debug("getUpcomingActions");
  const transitionConfig = getTransitionConfig();
  const result = {
    enabled: transitionConfig.enabled,
    timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone
  };
  if (transitionConfig.enabled !== true) return callback(null, result);

  const now = Date.now();
  const statusList = ["open"].concat(
    transitionConfig.autoTranslate.blogStatusFilter,
    transitionConfig.autoReviewStart.blogStatusFilter,
    transitionConfig.autoLanguageClose.blogStatusFilter
  ).filter((status, index, list) => list.indexOf(status) === index);

  findBlogsWithStatus(statusList, function(err, blogs) {
    if (err) return callback(err);

    result.autoEdit = previewAutoEdit(blogs, transitionConfig.autoEditMode.enabled === true, now);
    result.autoLanguageClose = previewLanguageClose(blogs, transitionConfig, now);
    previewAutoTranslate(blogs, transitionConfig, now, function(err, translatePreview) {
      if (err) return callback(err);
      result.autoTranslate = translatePreview;
      previewAutoReviewStart(blogs, transitionConfig, now, function(err, reviewPreview) {
        if (err) return callback(err);
        result.autoReviewStart = reviewPreview;
        callback(null, result);
      });
    });
  });
}

/**
 * Run all transition rules once, in the order Auto Edit, Auto Translate,
 * Auto Review Start, Auto Language Close. A sweep that starts while another
 * one is still running returns at once without doing anything.
 * @param {function(Error=)} [callback] called when the sweep is done
 */
export function runTransitionSweep(callback) {
  debug("runTransitionSweep");
  if (_transitionSweepRunning > 0) {
    if (callback) callback();
    return;
  }

  const transitionConfig = getTransitionConfig();

  _transitionSweepRunning += 1;
  series([
    function runOpenToEditAndCreate(cb) {
      if (transitionConfig.autoEditMode.enabled !== true) return cb();
      blogModule.autoCloseBlog(cb);
    },
    function runAutoTranslate(cb) {
      // before the language close, a closed language can not be edited any more
      runAutoTranslateRule(cb);
    },
    function runAutoReviewStart(cb) {
      // after the translation, so its texts count as written
      runAutoReviewStartRule(cb);
    },
    function runLanguageAutoClose(cb) {
      runLanguageAutoCloseRule(cb);
    }
  ], function(err) {
    _transitionSweepRunning -= 1;
    if (callback) callback(err);
  });
}

/**
 * Stop the cron job of the scheduler and forget which recheck slots ran.
 * @param {function()} [callback] called when stopped
 */
export function stopTransitionScheduler(callback) {
  debug("stopTransitionScheduler");
  if (_transitionJob) {
    _transitionJob.cancel();
    _transitionJob = null;
  }
  _lastSlot.clear();
  if (callback) callback();
}

/**
 * Start the cron job (`Transition.scheduleCron`) that runs the sweep, and
 * with `runOnStart` one sweep at once. Does nothing if `Transition.enabled`
 * is false or the job is already running.
 * @param {function(Error=)} [callback] called after start (and the first sweep)
 */
export function startTransitionScheduler(callback) {
  debug("startTransitionScheduler");
  const transitionConfig = getTransitionConfig();

  if (transitionConfig.enabled === false) {
    if (callback) callback();
    return;
  }

  if (_transitionJob) {
    if (callback) callback();
    return;
  }

  _transitionJob = scheduleJob(transitionConfig.scheduleCron, function () {
    runTransitionSweep(function(err) {
      if (err) config.logger.error(err);
    });
  });

  if (transitionConfig.runOnStart) {
    runTransitionSweep(callback);
    return;
  }

  if (callback) callback();
}

const blogTransitionScheduler = {
  start: startTransitionScheduler,
  stop: stopTransitionScheduler,
  runSweep: runTransitionSweep,
  getUpcomingActions: getUpcomingActions
};

export default blogTransitionScheduler;
