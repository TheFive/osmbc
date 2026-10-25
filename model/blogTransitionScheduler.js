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

function normaliseCloseAt(closeAtConfig) {
  if (!closeAtConfig || typeof closeAtConfig !== "object") return null;

  const weekdayMap = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6
  };

  let weekday = closeAtConfig.weekday;
  if (typeof weekday === "string") {
    weekday = weekdayMap[weekday.trim().toUpperCase()];
  }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;

  const hour = parseNumber(closeAtConfig.hour, 12);
  const minute = parseNumber(closeAtConfig.minute, 0);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  return {
    weekday: weekday,
    hour: hour,
    minute: minute
  };
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

function getTransitionConfig() {
  const raw = config.getValue("Transition", { default: {} }) || {};
  const rawAutoLanguageClose = raw.AutoLanguageClose || {};
  const rawAutoEditMode = raw.AutoEditMode || {};
  const rawAutoTranslate = raw.AutoTranslate || {};

  let blogStatusFilter = rawAutoLanguageClose.blogStatusFilter;
  if (!Array.isArray(blogStatusFilter) || blogStatusFilter.length === 0) {
    blogStatusFilter = ["edit"];
  }

  let translateStatusFilter = rawAutoTranslate.blogStatusFilter;
  if (!Array.isArray(translateStatusFilter) || translateStatusFilter.length === 0) {
    translateStatusFilter = ["edit"];
  }

  // no default for the source language, it has to be one of the configured languages
  let sourceLanguage = null;
  if (typeof rawAutoTranslate.sourceLanguage === "string") {
    const candidate = rawAutoTranslate.sourceLanguage.trim().toUpperCase();
    if (language.getLid().indexOf(candidate) >= 0) sourceLanguage = candidate;
  }

  return {
    enabled: parseBoolean(raw.enabled, true),
    scheduleCron: raw.scheduleCron || "*/1 * * * *",
    runOnStart: parseBoolean(raw.runOnStart, true),
    autoEditMode: {
      enabled: parseBoolean(rawAutoEditMode.enabled, true)
    },
    autoLanguageClose: {
      enabled: parseBoolean(rawAutoLanguageClose.enabled, false),
      delayDays: parseNumber(rawAutoLanguageClose.delayDays, 3),
      minReviews: parseNumber(rawAutoLanguageClose.minReviews, 2),
      blogStatusFilter: blogStatusFilter,
      onlyIfNotExported: parseBoolean(rawAutoLanguageClose.onlyIfNotExported, true),
      languages: normaliseLanguageList(rawAutoLanguageClose.languages),
      closeAt: normaliseCloseAt(rawAutoLanguageClose.closeAt),
      actorUser: (typeof rawAutoLanguageClose.actorUser === "string" && rawAutoLanguageClose.actorUser.trim() !== "")
        ? rawAutoLanguageClose.actorUser.trim()
        : "autoclose-review"
    },
    autoTranslate: {
      enabled: parseBoolean(rawAutoTranslate.enabled, false),
      sourceLanguage: sourceLanguage,
      service: (typeof rawAutoTranslate.service === "string" && rawAutoTranslate.service.trim() !== "")
        ? rawAutoTranslate.service.trim()
        : "deeplPro",
      languages: normaliseLanguageList(rawAutoTranslate.languages).filter((lang) => lang !== sourceLanguage),
      previousBlogs: parseNumber(rawAutoTranslate.previousBlogs, 2),
      blogStatusFilter: translateStatusFilter,
      delayDays: parseNumber(rawAutoTranslate.delayDays, 3),
      translateAt: normaliseCloseAt(rawAutoTranslate.translateAt),
      actorUser: (typeof rawAutoTranslate.actorUser === "string" && rawAutoTranslate.actorUser.trim() !== "")
        ? rawAutoTranslate.actorUser.trim()
        : "autotranslate"
    }
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

function runLanguageAutoCloseRule(callback) {
  const transitionConfig = getTransitionConfig();
  const ruleConfig = transitionConfig.autoLanguageClose;

  if (ruleConfig.enabled !== true) return callback();

  const now = Date.now();
  const statusFilter = "IN(" + ruleConfig.blogStatusFilter.join(",") + ")";

  blogModule.find({ status: statusFilter }, { column: "endDate", desc: false }, function(err, blogs) {
    if (err) return callback(err);
    if (!blogs || blogs.length === 0) return callback();

    eachSeries(blogs, function(blog, cbBlog) {
      if (!isInRuleWindow(ruleDueTs(blog, ruleConfig.delayDays, ruleConfig.closeAt), now)) return cbBlog();

      eachSeries(planLanguageClose(blog, ruleConfig).close, function(lang, cbLanguage) {
        debug("Auto close language %s for blog %s", lang, blog.name);
        blog.closeBlog({ user: { OSMUser: ruleConfig.actorUser }, lang: lang, status: true }, cbLanguage);
      }, cbBlog);
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
  const statusFilter = "IN(" + ruleConfig.blogStatusFilter.join(",") + ")";

  blogModule.find({ status: statusFilter }, { column: "endDate", desc: false }, function(err, blogs) {
    if (err) return callback(err);
    if (!blogs || blogs.length === 0) return callback();

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

// getUpcomingActions(callback)
// read only preview of what the next sweeps will do, for the admin page.
// Uses the same decisions as the rules above, but changes nothing.
export function getUpcomingActions(callback) {
  debug("getUpcomingActions");
  const transitionConfig = getTransitionConfig();
  const result = {
    enabled: transitionConfig.enabled,
    // closeAt / translateAt are calculated in the timezone of the server process
    timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone
  };
  if (transitionConfig.enabled !== true) return callback(null, result);

  const now = Date.now();
  const autoEditEnabled = transitionConfig.autoEditMode.enabled === true;
  const translateConfig = transitionConfig.autoTranslate;
  const closeConfig = transitionConfig.autoLanguageClose;
  const statusList = ["open"].concat(translateConfig.blogStatusFilter, closeConfig.blogStatusFilter)
    .filter((status, index, list) => list.indexOf(status) === index);

  // open blogs will be in status edit when a later rule is due
  function isCandidate(blog, statusFilter) {
    if (statusFilter.indexOf(blog.status) >= 0) return true;
    return blog.status === "open" && autoEditEnabled && statusFilter.indexOf("edit") >= 0;
  }
  function byTs(a, b) { return a.ts - b.ts; }

  blogModule.find({ status: "IN(" + statusList.join(",") + ")" }, { column: "endDate", desc: false }, function(err, blogs) {
    if (err) return callback(err);
    blogs = blogs || [];

    result.autoEdit = { enabled: autoEditEnabled, blogs: [] };
    if (autoEditEnabled) {
      blogs.forEach(function(blog) {
        if (blog.status !== "open") return;
        const ts = ruleDueTs(blog, 0, null);
        if (ts === null) return;
        result.autoEdit.blogs.push({ name: blog.name, ts: ts, overdue: ts < now });
      });
      result.autoEdit.blogs.sort(byTs);
    }

    result.autoLanguageClose = { enabled: closeConfig.enabled === true, minReviews: closeConfig.minReviews, blogs: [] };
    if (result.autoLanguageClose.enabled) {
      blogs.forEach(function(blog) {
        if (!isCandidate(blog, closeConfig.blogStatusFilter)) return;
        const ts = ruleDueTs(blog, closeConfig.delayDays, closeConfig.closeAt);
        if (ts === null || now > ts + RULE_WINDOW_MS) return;
        result.autoLanguageClose.blogs.push(Object.assign({ name: blog.name, ts: ts }, planLanguageClose(blog, closeConfig)));
      });
      result.autoLanguageClose.blogs.sort(byTs);
    }

    result.autoTranslate = {
      enabled: translateConfig.enabled === true,
      sourceLanguage: translateConfig.sourceLanguage,
      previousBlogs: translateConfig.previousBlogs,
      blogs: []
    };
    if (!result.autoTranslate.enabled) return callback(null, result);
    result.autoTranslate.problem = autoTranslateProblem(translateConfig);
    if (result.autoTranslate.problem) return callback(null, result);

    eachSeries(blogs, function(blog, cbBlog) {
      if (!isCandidate(blog, translateConfig.blogStatusFilter)) return cbBlog();
      const ts = ruleDueTs(blog, translateConfig.delayDays, translateConfig.translateAt);
      if (ts === null || now > ts + RULE_WINDOW_MS) return cbBlog();
      blogModule.findPreviousBlogs(blog, translateConfig.previousBlogs, function(err, previousBlogs) {
        if (err) return cbBlog(err);
        result.autoTranslate.blogs.push(Object.assign({ name: blog.name, ts: ts }, planTranslate(blog, previousBlogs, translateConfig)));
        cbBlog();
      });
    }, function(err) {
      if (err) return callback(err);
      result.autoTranslate.blogs.sort(byTs);
      callback(null, result);
    });
  });
}

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
    function runLanguageAutoClose(cb) {
      runLanguageAutoCloseRule(cb);
    }
  ], function(err) {
    _transitionSweepRunning -= 1;
    if (callback) callback(err);
  });
}

export function stopTransitionScheduler(callback) {
  debug("stopTransitionScheduler");
  if (_transitionJob) {
    _transitionJob.cancel();
    _transitionJob = null;
  }
  if (callback) callback();
}

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
