

import _debug from "debug";
import express from "express";
import userModule from "../model/user.js";
import async from "async";
import htmlTitle from "../model/htmltitle.js";
import util from "../util/util.js";
import articleModule from "../model/article.js";
import config from "../config.js";
import language from "../model/language.js";
import blogModule from "../model/blog.js";
import { ZipArchive } from "archiver";

const debug = _debug("OSMBC:routes:api");
const publicApiRouter  = express.Router();



const apiKeys = config.getValue("apiKeys", { mustExist: true });

function checkApiKey(req, res, next) {
  debug("checkApiKey");
  const apiKey = req.params.apiKey;

  if (apiKeys[apiKey]) {
    req.apiKey = apiKeys[apiKey];
    return next();
  }

  userModule.findOne({ apiKey: req.params.apiKey }, function(err, user) {
    if (err || !user) {
      const err = new Error("Not Authorised");
      err.status = 401;
      err.type = "API";
      return next(err);
    }
    req.user = user;
    return next();
  });
}

// If function is called just return OK
function isServerUp(req, res) {
  debug("isServerUp");
  res.end("OK");
}

// If function is called query a postgres user,
// and check, wether there is a postgres error
function isPostgresUp(req, res) {
  debug("isPostgresUp");
  userModule.find({ OSMUser: "test" }, function(err) {
    if (err) return res.end("Postgres Error");
    res.end("OK");
  });
}

function collectArticle(req, res, next) {
  debug("collectArticle");
  const changes = {};
  changes.categoryEN = "-- no category yet --";
  if (req.body.categoryEN) {
    changes.categoryEN = req.body.categoryEN;
  }
  changes.blog = "TBC";
  let user = "";

  for (const lang in language.getLanguages()) {
    if (req.body["markdown" + lang]) {
      changes["markdown" + lang] = req.body["markdown" + lang];
    }
  }

  async.series([
    function getTitle(cb) {
      if (req.body.title) {
        changes.title = req.body.title;
        return cb();
      } else {
        let url = [];
        if (typeof req.body.collection === "string") url = util.getAllURL(req.body.collection);
        if (url.length === 0) {
          changes.title = "NOT GIVEN";
          return cb();
        }
        htmlTitle.getTitle(url[0]).then(function(title) {
          changes.title = title;
          return cb();
        }).catch((err) => { return cb(err); });
      }
    },
    function getCollection(cb) {
      if (req.body.collection) {
        changes.collection = req.body.collection;
        return cb();
      } else {
        const error = new Error("Missing Collection");
        error.status = 422;
        error.type = "API";
        return cb(error);
      }
    },
    function getOSMuser(cb) {
      const query = {};
      if (req.body.OSMUser) {
        query.OSMUser = req.body.OSMUser;
      } else {
        if (!req.body.email) {
          const err = new Error("No OSMUser && EMail given");
          err.type = "API";
          err.status = 422;
          return cb(err);
        }
        query.email = req.body.email;
      }
      userModule.findOne(query, function(err, userFound) {
        if (err || !userFound) {
          const err = new Error("No OSMUser given, could not resolve email address");
          err.type = "API";
          err.status = 422;
          return cb(err);
        }
        user = userFound;
        changes.firstCollector = user.OSMUser;
        return cb();
      });
    }
  ], function(err) {
    if (err) return next(err);

    // check on existence of markdown in body

    if (req.body.markdown && typeof user === "object" && user.language) {
      changes["markdown" + user.language] = req.body.markdown;
    }
    articleModule.createNewArticle(function(err, result) {
      if (err) return next(err);
      changes.version = result.version;

      result.setAndSave(user, changes, function(err) {
        if (err) return next(err);
        res.send("Article Collected in TBC.");
      });
    });
  });
}

function collectArticleLink(req, res, next) {
  debug("collectArticleLink");
  const changes = {};
  changes.categoryEN = "-- no category yet --";
  changes.blog = "TBC";
  const collection = encodeURI(req.query.collection);
  if (!req.user) return next(new Error("for collect not defined"));
  changes.firstCollector = req.user.OSMUser;
  async.series([
    function getTitle(cb) {
      if (req.query.title) {
        changes.title = req.query.title;
        return cb();
      } else {
        let url = [];
        if (typeof collection === "string") url = util.getAllURL(collection);
        if (url.length === 0) {
          changes.title = "NOT GIVEN";
          return cb();
        }
        htmlTitle.getTitle(url[0]).then(function(title) {
          changes.title = title;
          return cb();
        }).catch(function(err) {
          return cb(err);
        });
      }
    },
    function getCollection(cb) {
      if (req.query.collection) {
        changes.collection = collection;
        return cb();
      } else {
        const error = new Error("Missing Collection");
        error.status = 422;
        error.type = "API";
        return cb(error);
      }
    }
  ], function(err) {
    if (err) return next(err);

    // check on existence of markdown in body
    articleModule.createNewArticle(function(err, result) {
      if (err) return next(err);
      changes.version = result.version;

      result.setAndSave(req.user, changes, function(err) {
        if (err) return next(err);
        res.set("Access-Control-Allow-Origin", "*");
        res.send(config.getValue("url") + config.htmlRoot() + "/article/" + result.id);
      });
    });
  });
}

function checkBlogId(req, res, next, id) {
  debug("checkBlogId");
  blogModule.findBlogByRouteId(id, function(err, blog) {
    if (err) return next(err);
    if (!blog) {
      const notFound = new Error("Blog not found");
      notFound.status = 404;
      notFound.type = "API";
      return next(notFound);
    }
    req.blog = blog;
    return next();
  });
}

// Exclusive-per-profile guard so two concurrent outstanding-export requests
// for the SAME exportProfile cannot pick up and re-deliver the same blogs
// before either has had a chance to mark them as exported.
// NOTE: this is an in-process guard only (a Set kept in memory). It does not
// protect a multi-instance/cluster deployment - that would need a Postgres
// advisory lock or similar. Requests for different exportProfiles, or plain
// dry-run requests, are never blocked by it.
const outstandingExportLocks = new Set();

// Resolves the identity to attribute the exportedBy change-log entry to.
// checkApiKey sets req.user for a per-user apiKey, or req.apiKey to the
// label configured under `apiKeys` for a shared key.
function getOutstandingExportUser(req) {
  if (req.user && req.user.OSMUser) return { OSMUser: req.user.OSMUser };
  return { OSMUser: "apikey:" + (req.apiKey || "unknown") };
}

/**
 * Download a combined ZIP of all blogs with outstanding (not yet delivered) export,
 * or (with `dryRun=true`) just list what that download would currently contain.
 *
 * Route params:
 * - apiKey {string} API key used by middleware `checkApiKey`
 *
 * Query params:
 * - exportProfile {string} required profile name from config key `ExportProfiles`
 * - lang {string} optional language code or `ALL` (defaults to all configured languages)
 * - dryRun {string} optional, "true" returns a JSON preview instead of building/marking anything
 *
 * Behavior:
 * - Finds all WeeklyNote blogs that are closed for the requested lang(s) and not yet exported
 * - Returns a combined ZIP with one file per blog+lang
 * - A rendering failure for one blog/lang is skipped and reported via the
 *   `X-Outstanding-Export-Warnings` response header, it does not abort the whole batch
 * - Sets exportedBy markers (with a change-log entry) after the response is fully sent
 * - If no eligible blogs: respects `noContentBehavior` in the ExportProfile config
 *   ("404" = default, "emptyZip" = return empty ZIP with HTTP 200)
 * - Rejects with 409 if another outstanding export for the same exportProfile is in flight
 */
function getBlogPreviewDownloadOutstanding(req, res, next) {
  debug("getBlogPreviewDownloadOutstanding");

  const exportProfile = (typeof req.query.exportProfile === "string") ? req.query.exportProfile.trim() : "";
  if (!exportProfile) {
    const error = new Error("Missing exportProfile");
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  const profileConfig = config.getValue("ExportProfiles", exportProfile);
  if (!profileConfig) {
    const error = new Error("Unknown export profile: " + exportProfile);
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  if (!profileConfig.pathTemplate) {
    const error = new Error(`Export profile '${exportProfile}' has no pathTemplate and cannot be used for outstanding bundle export`);
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  let langs = req.query.lang;
  if (!langs || langs === "ALL") {
    langs = language.getLid();
  } else if (typeof langs === "string") {
    langs = [langs];
  } else if (!Array.isArray(langs)) {
    langs = language.getLid();
  }

  const dryRun = req.query.dryRun === "true";

  if (dryRun) {
    return blogModule.findBlogsForOutstandingExport(exportProfile, langs, function(err, blogs) {
      if (err) return next(err);
      const preview = blogs.map(function(blog) {
        return { name: blog.name, langs: blogModule.getOutstandingLangsForBlog(blog, exportProfile, langs) };
      });
      res.set("content-type", "application/json");
      res.end(JSON.stringify({ exportProfile: exportProfile, count: preview.length, blogs: preview }));
    });
  }

  if (outstandingExportLocks.has(exportProfile)) {
    const conflict = new Error(`Outstanding export for profile '${exportProfile}' is already in progress, please retry shortly`);
    conflict.status = 409;
    conflict.type = "API";
    return next(conflict);
  }
  outstandingExportLocks.add(exportProfile);
  let markingStarted = false;
  function releaseLock() { outstandingExportLocks.delete(exportProfile); }

  blogModule.buildOutstandingExportZip(exportProfile, langs, function(err, result) {
    if (err) {
      releaseLock();
      return next(err);
    }

    const { archive, toMark, failures } = result;

    if (failures && failures.length > 0) {
      const failureList = failures.map((f) => `${f.blog.name}:${f.lang}`).join(",");
      debug("Skipped %d blog/lang exports due to render errors: %s", failures.length, failureList);
      res.set("X-Outstanding-Export-Warnings", failureList);
    }

    if (!archive) {
      releaseLock();
      const noContentBehavior = profileConfig.noContentBehavior || "404";
      if (noContentBehavior === "emptyZip") {
        const emptyArchive = new ZipArchive("zip", { zlib: { level: 9 } });
        res.set("content-type", "application/zip");
        res.attachment("outstanding.zip");
        emptyArchive.pipe(res);
        emptyArchive.finalize();
        return;
      }
      const notFound = new Error("No blogs available for outstanding export");
      notFound.status = 404;
      notFound.type = "API";
      return next(notFound);
    }

    let zipFileName = "outstanding.zip";
    if (profileConfig.fileNameTemplate) {
      const templated = profileConfig.fileNameTemplate.replace(/##[^#]+##/g, "outstanding");
      if (templated && templated.trim()) {
        zipFileName = templated.toLowerCase().endsWith(".zip") ? templated : `${templated}.zip`;
      }
    }

    res.set("content-type", "application/zip");
    res.attachment(zipFileName);

    const user = getOutstandingExportUser(req);

    res.on("finish", function() {
      markingStarted = true;
      const markingFailures = [];
      async.eachSeries(toMark, function(item, cb) {
        item.blog.markAsExported(user, exportProfile, item.lang, function(err) {
          // A single blog's marker failing to save must not stop the rest
          // from being marked - the content for ALL of them was already
          // delivered in the response that just finished.
          if (err) markingFailures.push({ blog: item.blog.name, lang: item.lang, error: err.message });
          cb();
        });
      }, function() {
        if (markingFailures.length > 0) {
          debug("Some exportedBy markers could not be set (blog stays 'outstanding' and will be re-offered next time): %j", markingFailures);
        }
        releaseLock();
      });
    });
    // Safety net: if the client disconnects before "finish" fires, marking
    // never starts, so release the lock here instead of leaving it stuck.
    res.on("close", function() {
      if (!markingStarted) releaseLock();
    });

    archive.pipe(res);
  });
}

/**
 * Download a rendered blog preview using a configured export profile.
 *
 * Route params:
 * - apiKey {string} API key used by middleware `checkApiKey`
 * - blog_id {string} blog identifier (internal id or name), resolved by `checkBlogId`
 *
 * Query params:
 * - exportProfile {string} required profile name from config key `ExportProfiles`
 * - lang {string} optional language code or `ALL` (defaults are handled in model layer)
 *
 * Behavior:
 * - Always forces download semantics (`forceDownload: true`)
 * - Returns stream or string payload from `buildPreviewExport`
 * - Sets `content-type` according to renderer result
 * - On missing `exportProfile` returns API error 422
 */
function getBlogPreviewDownload(req, res, next) {
  debug("getBlogPreviewDownload");

  const exportProfile = (typeof req.query.exportProfile === "string") ? req.query.exportProfile.trim() : "";
  if (!exportProfile) {
    const error = new Error("Missing exportProfile");
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  req.blog.buildPreviewExport({
    lang: req.query.lang,
    exportProfile: exportProfile,
    forceDownload: true
  }, function(err, result) {
    if (err) return next(err);
    res.set("content-type", result.mimeType);
    if (result.bodyType === "string") {
      return res.attachment(result.fileName).end(result.body);
    }
    res.attachment(result.fileName);
    result.body.pipe(res);
  });
}

publicApiRouter.param("apiKey", checkApiKey);
publicApiRouter.param("blog_id", checkBlogId);

publicApiRouter.get("/monitor/:apiKey", isServerUp);
publicApiRouter.get("/monitorPostgres/:apiKey", isPostgresUp);

publicApiRouter.post("/collectArticle/:apiKey", collectArticle);
publicApiRouter.get("/collect/:apiKey", collectArticleLink);
publicApiRouter.get("/blogPreviewDownload/:apiKey/outstanding", getBlogPreviewDownloadOutstanding);
publicApiRouter.get("/blogPreviewDownload/:apiKey/:blog_id", getBlogPreviewDownload);

export default publicApiRouter;
