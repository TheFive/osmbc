

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

function findBlogByRouteId(id, callback) {
  debug("findBlogByRouteId(%s)", id);
  blogModule.findById(id, function(err, blog) {
    if (err) return callback(err);
    if (blog) return callback(null, blog);

    blogModule.find({ name: id }, function(err, result) {
      if (err) return callback(err);
      if (result.length === 0) return callback(null, null);
      if (result.length > 1) return callback(new Error("Blog >" + id + "< exists twice, internal id of first: " + result[0].id));
      return callback(null, result[0]);
    });
  });
}

function checkBlogId(req, res, next, id) {
  debug("checkBlogId");
  findBlogByRouteId(id, function(err, blog) {
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

function getBlogPreviewDownload(req, res, next) {
  debug("getBlogPreviewDownload");
  const asMarkdown = (req.query.markdown === "true");

  req.blog.buildPreviewExport({
      lang: req.query.lang,
      markdown: asMarkdown,
      forceDownload: true },
    function(err, result) {
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
publicApiRouter.get("/blogPreviewDownload/:apiKey/:blog_id", getBlogPreviewDownload);

export default publicApiRouter;
