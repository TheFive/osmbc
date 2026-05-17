import { eachSeries, series } from "async";
import { scheduleJob } from "node-schedule";

import config from "../config.js";
import language from "./language.js";
import blogModule from "./blog.js";
import _debug from "debug";

const debug = _debug("OSMBC:model:blogTransitionScheduler");

let _transitionJob = null;
let _transitionSweepRunning = 0;

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

  let blogStatusFilter = rawAutoLanguageClose.blogStatusFilter;
  if (!Array.isArray(blogStatusFilter) || blogStatusFilter.length === 0) {
    blogStatusFilter = ["edit"];
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
    }
  };
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
      if (!blog || !blog.endDate) return cbBlog();

      const endDateTs = new Date(blog.endDate).getTime();
      if (Number.isNaN(endDateTs)) return cbBlog();

      let closeFromTs = endDateTs + (ruleConfig.delayDays * 24 * 60 * 60 * 1000);
      if (ruleConfig.closeAt) {
        closeFromTs = nextWeeklyCloseTimeAtOrAfter(endDateTs, ruleConfig.closeAt);
      }
      if (now < closeFromTs) return cbBlog();

      eachSeries(ruleConfig.languages, function(lang, cbLanguage) {
        const closeField = "close" + lang;
        const exportedField = "exported" + lang;

        if (blog[closeField] === true) return cbLanguage();
        if (ruleConfig.onlyIfNotExported && blog[exportedField] === true) return cbLanguage();
        if (blog.getClosedReviewCount(lang) < ruleConfig.minReviews) return cbLanguage();

        debug("Auto close language %s for blog %s", lang, blog.name);
        blog.closeBlog({ user: { OSMUser: ruleConfig.actorUser }, lang: lang, status: true }, cbLanguage);
      }, cbBlog);
    }, callback);
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
  runSweep: runTransitionSweep
};

export default blogTransitionScheduler;
