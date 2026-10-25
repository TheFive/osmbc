import should from "should";
import nock from "nock";

import testutil from "./testutil.js";

import config from "../config.js";
import blogModule from "../model/blog.js";
import articleModule from "../model/article.js";
import logModule from "../model/logModule.js";
import { runTransitionSweep, getUpcomingActions } from "../model/blogTransitionScheduler.js";

describe("model/blogTransitionScheduler", function() {
  let originalGetValue;

  before(function(done) {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    done();
  });

  after(function(done) {
    nock.cleanAll();
    done();
  });

  beforeEach(function(done) {
    process.env.TZ = "Europe/Amsterdam";
    originalGetValue = null;
    testutil.clearDB(done);
  });

  afterEach(function(done) {
    if (originalGetValue) {
      config.getValue = originalGetValue;
      originalGetValue = null;
    }
    done();
  });

  it("closes a language after delay if two reviews exist", function(done) {
    originalGetValue = config.getValue;
    config.getValue = function(key, subkey, options) {
      if (key === "Transition") {
        return {
          enabled: true,
          scheduleCron: "*/1 * * * *",
          runOnStart: true,
          AutoEditMode: {
            enabled: false
          },
          AutoLanguageClose: {
            enabled: true,
            delayDays: 3,
            minReviews: 2,
            blogStatusFilter: ["edit"],
            onlyIfNotExported: true,
            languages: ["DE"],
            actorUser: "autoclose-review"
          }
        };
      }
      return originalGetValue.call(config, key, subkey, options);
    };

    // milliseconds like the rule, setDate() would be off by an hour across a DST change
    const oldDate = new Date(Date.now() - (3 * 24 * 60 + 30) * 60 * 1000);

    const blog = blogModule.create({
      name: "WN900",
      status: "edit",
      endDate: oldDate.toISOString(),
      reviewCommentDE: [
        { user: "reviewerA", text: "ok", timestamp: new Date() },
        { user: "reviewerB", text: "looks good", timestamp: new Date() }
      ]
    });

    blog.save(function(err) {
      should.not.exist(err);
      runTransitionSweep(function(err2) {
        config.getValue = originalGetValue;
        originalGetValue = null;
        should.not.exist(err2);

        blogModule.findOne({ name: "WN900" }, function(err3, updated) {
          should.not.exist(err3);
          should(updated.closeDE).equal(true);
          done();
        });
      });
    });
  });

  it("does not close a language if only one review exists", function(done) {
    originalGetValue = config.getValue;
    config.getValue = function(key, subkey, options) {
      if (key === "Transition") {
        return {
          enabled: true,
          scheduleCron: "*/1 * * * *",
          runOnStart: true,
          AutoEditMode: {
            enabled: false
          },
          AutoLanguageClose: {
            enabled: true,
            delayDays: 3,
            minReviews: 2,
            blogStatusFilter: ["edit"],
            onlyIfNotExported: true,
            languages: ["DE"],
            actorUser: "autoclose-review"
          }
        };
      }
      return originalGetValue.call(config, key, subkey, options);
    };

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 6);

    const blog = blogModule.create({
      name: "WN901",
      status: "edit",
      endDate: oldDate.toISOString(),
      reviewCommentDE: [
        { user: "reviewerA", text: "ok", timestamp: new Date() }
      ]
    });

    blog.save(function(err) {
      should.not.exist(err);
      runTransitionSweep(function(err2) {
        config.getValue = originalGetValue;
        originalGetValue = null;
        should.not.exist(err2);

        blogModule.findOne({ name: "WN901" }, function(err3, updated) {
          should.not.exist(err3);
          should(updated.closeDE).not.equal(true);
          done();
        });
      });
    });
  });

  it("respects delay in minutes and does not close too early", function(done) {
    originalGetValue = config.getValue;
    config.getValue = function(key, subkey, options) {
      if (key === "Transition") {
        return {
          enabled: true,
          scheduleCron: "*/1 * * * *",
          runOnStart: true,
          AutoEditMode: {
            enabled: false
          },
          AutoLanguageClose: {
            enabled: true,
            delayDays: 15 / 1440,
            minReviews: 2,
            blogStatusFilter: ["edit"],
            onlyIfNotExported: true,
            languages: ["DE"],
            actorUser: "autoclose-review"
          }
        };
      }
      return originalGetValue.call(config, key, subkey, options);
    };

    const oldDate = new Date();
    oldDate.setMinutes(oldDate.getMinutes() - 10);

    const blog = blogModule.create({
      name: "WN902",
      status: "edit",
      endDate: oldDate.toISOString(),
      reviewCommentDE: [
        { user: "reviewerA", text: "ok", timestamp: new Date() },
        { user: "reviewerB", text: "looks good", timestamp: new Date() }
      ]
    });

    blog.save(function(err) {
      should.not.exist(err);
      runTransitionSweep(function(err2) {
        config.getValue = originalGetValue;
        originalGetValue = null;
        should.not.exist(err2);

        blogModule.findOne({ name: "WN902" }, function(err3, updated) {
          should.not.exist(err3);
          should(updated.closeDE).not.equal(true);
          done();
        });
      });
    });
  });

  describe("AutoTranslate", function() {
    function useTransitionConfig(autoTranslate, autoLanguageClose, autoEditEnabled) {
      originalGetValue = config.getValue;
      config.getValue = function(key, subkey, options) {
        if (key === "Transition") {
          return {
            enabled: true,
            scheduleCron: "*/1 * * * *",
            runOnStart: true,
            AutoEditMode: { enabled: autoEditEnabled === true },
            AutoLanguageClose: autoLanguageClose || { enabled: false },
            AutoTranslate: Object.assign({
              enabled: true,
              sourceLanguage: "EN",
              service: "deeplPro",
              languages: "ALL",
              previousBlogs: 2,
              blogStatusFilter: ["edit"],
              delayDays: 3,
              actorUser: "autotranslate"
            }, autoTranslate)
          };
        }
        return originalGetValue.call(config, key, subkey, options);
      };
    }
    function dueEndDate() {
      // milliseconds like the rule, setDate() would be off by an hour across a DST change
      return new Date(Date.now() - (3 * 24 * 60 + 30) * 60 * 1000).toISOString();
    }
    function importBlogs(blogs, articles, cb) {
      testutil.importData({
        clear: true,
        blog: blogs,
        article: articles || [{ blog: "WN101", title: "a", markdownEN: "English *Text*" }]
      }, cb);
    }
    function nockDeepl(targetLang, times) {
      return nock("https://api.deepl.com")
        .post("/v2/translate", (body) => body.target_lang === targetLang && body.source_lang === "EN")
        .times(times || 1)
        .reply(200, { translations: [{ text: "<p>Translated</p>" }] });
    }
    function sweepAndFindArticles(cb) {
      runTransitionSweep(function(err) {
        should.not.exist(err);
        articleModule.find({}, { column: "id" }, cb);
      });
    }
    afterEach(function() {
      nock.abortPendingRequests();
      nock.cleanAll();
      nock("https://missingmattermost.example.com/")
        .post(/\/services\/.*/)
        .times(999)
        .reply(200, "ok");
    });

    it("translates a language closed in the previous blog and logs the actor user", function(done) {
      useTransitionConfig({});
      const deepl = nockDeepl("DE");
      importBlogs([
        { name: "WN100", status: "closed", closeDE: true },
        { name: "WN101", status: "edit", endDate: dueEndDate() }
      ], [
        { blog: "WN101", title: "a", markdownEN: "English *Text*" },
        { blog: "WN101", title: "b", markdownEN: "English", markdownDE: "Schon da" },
        { blog: "WN101", title: "c", markdownEN: "no translation" },
        { blog: "WN101", title: "d", markdownEN: "English", categoryEN: "--unpublished--" }
      ], function(err) {
        should.not.exist(err);
        sweepAndFindArticles(function(err, articles) {
          should.not.exist(err);
          should(deepl.isDone()).be.true();
          should(articles[0].markdownDE).eql("Translated");
          should(articles[1].markdownDE).eql("Schon da");
          should(articles[2].markdownDE).eql(undefined);
          should(articles[3].markdownDE).eql(undefined);
          // other languages were not closed in a previous blog
          should(articles[0].markdownFR).eql(undefined);
          should(articles[0].markdownES).eql(undefined);
          logModule.find({ table: "blog", property: "translation with deeplPro" }, function(err, logs) {
            should.not.exist(err);
            should(logs.length).eql(1);
            should(logs[0].user).eql("autotranslate");
            should(logs[0].to).eql("EN -> DE");
            done();
          });
        });
      });
    });

    it("looks two blogs back with previousBlogs 2", function(done) {
      useTransitionConfig({ previousBlogs: 2 });
      const deepl = nockDeepl("DE");
      importBlogs([
        { name: "WN99", status: "closed", closeDE: true },
        { name: "WN100", status: "closed" },
        { name: "WN101", status: "edit", endDate: dueEndDate() }
      ], null, function(err) {
        should.not.exist(err);
        sweepAndFindArticles(function(err, articles) {
          should.not.exist(err);
          should(deepl.isDone()).be.true();
          should(articles[0].markdownDE).eql("Translated");
          done();
        });
      });
    });

    it("looks only one blog back with previousBlogs 1", function(done) {
      useTransitionConfig({ previousBlogs: 1 });
      importBlogs([
        { name: "WN99", status: "closed", closeDE: true },
        { name: "WN100", status: "closed" },
        { name: "WN101", status: "edit", endDate: dueEndDate() }
      ], null, function(err) {
        should.not.exist(err);
        sweepAndFindArticles(function(err, articles) {
          should.not.exist(err);
          should(articles[0].markdownDE).eql(undefined);
          should(articles[0].version).eql(1);
          done();
        });
      });
    });

    it("skips a language that is already closed in the current blog", function(done) {
      useTransitionConfig({});
      importBlogs([
        { name: "WN100", status: "closed", closeDE: true },
        { name: "WN101", status: "edit", endDate: dueEndDate(), closeDE: true }
      ], null, function(err) {
        should.not.exist(err);
        sweepAndFindArticles(function(err, articles) {
          should.not.exist(err);
          should(articles[0].markdownDE).eql(undefined);
          should(articles[0].version).eql(1);
          done();
        });
      });
    });

    it("does nothing outside the time window", function(done) {
      useTransitionConfig({});
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 6);
      importBlogs([
        { name: "WN100", status: "closed", closeDE: true },
        { name: "WN101", status: "edit", endDate: oldDate.toISOString() }
      ], null, function(err) {
        should.not.exist(err);
        sweepAndFindArticles(function(err, articles) {
          should.not.exist(err);
          should(articles[0].markdownDE).eql(undefined);
          should(articles[0].version).eql(1);
          done();
        });
      });
    });

    it("does nothing without a valid source language", function(done) {
      useTransitionConfig({ sourceLanguage: "XX" });
      importBlogs([
        { name: "WN100", status: "closed", closeDE: true },
        { name: "WN101", status: "edit", endDate: dueEndDate() }
      ], null, function(err) {
        should.not.exist(err);
        sweepAndFindArticles(function(err, articles) {
          should.not.exist(err);
          should(articles[0].markdownDE).eql(undefined);
          should(articles[0].version).eql(1);
          done();
        });
      });
    });

    it("does nothing when disabled", function(done) {
      useTransitionConfig({ enabled: false });
      importBlogs([
        { name: "WN100", status: "closed", closeDE: true },
        { name: "WN101", status: "edit", endDate: dueEndDate() }
      ], null, function(err) {
        should.not.exist(err);
        sweepAndFindArticles(function(err, articles) {
          should.not.exist(err);
          should(articles[0].markdownDE).eql(undefined);
          done();
        });
      });
    });

    it("translates before the language close of the same sweep", function(done) {
      useTransitionConfig({}, {
        enabled: true,
        delayDays: 3,
        minReviews: 1,
        blogStatusFilter: ["edit"],
        onlyIfNotExported: true,
        languages: ["DE"],
        actorUser: "autoclose-review"
      });
      const deepl = nockDeepl("DE");
      importBlogs([
        { name: "WN100", status: "closed", closeDE: true },
        {
          name: "WN101",
          status: "edit",
          endDate: dueEndDate(),
          reviewCommentDE: [{ user: "reviewerA", text: "ok", timestamp: new Date() }]
        }
      ], null, function(err) {
        should.not.exist(err);
        sweepAndFindArticles(function(err, articles) {
          should.not.exist(err);
          should(deepl.isDone()).be.true();
          should(articles[0].markdownDE).eql("Translated");
          blogModule.findOne({ name: "WN101" }, function(err, blog) {
            should.not.exist(err);
            should(blog.closeDE).eql(true);
            done();
          });
        });
      });
    });

    describe("getUpcomingActions", function() {
      const closeConfig = {
        enabled: true,
        delayDays: 2,
        minReviews: 2,
        blogStatusFilter: ["edit"],
        onlyIfNotExported: true,
        languages: ["DE", "FR"]
      };
      function inDays(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString();
      }
      const reviews = [
        { user: "reviewerA", text: "ok", timestamp: new Date() },
        { user: "reviewerB", text: "ok", timestamp: new Date() }
      ];

      it("lists translate, skipped and done languages and close candidates without changing anything", function(done) {
        useTransitionConfig({}, closeConfig);
        const endDate = inDays(1);
        importBlogs([
          { name: "WN100", status: "closed", closeDE: true },
          { name: "WN101", status: "edit", endDate: endDate, "closePT-PT": true, reviewCommentDE: reviews }
        ], null, function(err) {
          should.not.exist(err);
          getUpcomingActions(function(err, upcoming) {
            should.not.exist(err);
            should(upcoming.enabled).be.true();
            should(upcoming.timezone).be.a.String();
            should(upcoming.autoEdit).eql({ enabled: false, blogs: [] });
            const endTs = new Date(endDate).getTime();
            should(upcoming.autoTranslate).eql({
              enabled: true,
              sourceLanguage: "EN",
              previousBlogs: 2,
              problem: null,
              blogs: [{ name: "WN101", ts: endTs + 3 * 86400000, translate: ["DE"], inactive: ["FR", "ES"], done: ["PT-PT"] }]
            });
            should(upcoming.autoLanguageClose).eql({
              enabled: true,
              minReviews: 2,
              blogs: [{ name: "WN101", ts: endTs + 2 * 86400000, close: ["DE"], waiting: [{ lang: "FR", reviews: 0 }], done: [] }]
            });
            blogModule.findOne({ name: "WN101" }, function(err, blog) {
              should.not.exist(err);
              should(blog.version).eql(1);
              should(blog.closeDE).not.equal(true);
              articleModule.find({}, function(err, articles) {
                should.not.exist(err);
                should(articles[0].version).eql(1);
                done();
              });
            });
          });
        });
      });

      it("predicts open blogs as edit blogs only when Auto Edit is on", function(done) {
        useTransitionConfig({}, null, true);
        const endDate = inDays(2);
        importBlogs([
          { name: "WN100", status: "closed", closeDE: true },
          { name: "WN101", status: "open", endDate: endDate }
        ], null, function(err) {
          should.not.exist(err);
          getUpcomingActions(function(err, upcoming) {
            should.not.exist(err);
            should(upcoming.autoEdit.blogs).eql([{ name: "WN101", ts: new Date(endDate).getTime(), overdue: false }]);
            should(upcoming.autoTranslate.blogs.map((b) => b.name)).eql(["WN101"]);
            should(upcoming.autoLanguageClose).eql({ enabled: false, minReviews: 2, blogs: [] });
            config.getValue = originalGetValue;
            useTransitionConfig({}, null, false);
            getUpcomingActions(function(err, upcoming) {
              should.not.exist(err);
              should(upcoming.autoEdit).eql({ enabled: false, blogs: [] });
              should(upcoming.autoTranslate.blogs).eql([]);
              done();
            });
          });
        });
      });

      it("leaves out blogs whose window has passed", function(done) {
        useTransitionConfig({}, closeConfig);
        importBlogs([
          { name: "WN100", status: "closed", closeDE: true },
          { name: "WN101", status: "edit", endDate: inDays(-6) }
        ], null, function(err) {
          should.not.exist(err);
          getUpcomingActions(function(err, upcoming) {
            should.not.exist(err);
            should(upcoming.autoTranslate.blogs).eql([]);
            should(upcoming.autoLanguageClose.blogs).eql([]);
            done();
          });
        });
      });

      it("reports a configuration problem of Auto Translate", function(done) {
        useTransitionConfig({ sourceLanguage: "XX" });
        importBlogs([{ name: "WN101", status: "edit", endDate: inDays(1) }], null, function(err) {
          should.not.exist(err);
          getUpcomingActions(function(err, upcoming) {
            should.not.exist(err);
            should(upcoming.autoTranslate.problem).match(/sourceLanguage/);
            should(upcoming.autoTranslate.blogs).eql([]);
            done();
          });
        });
      });

      it("returns only the switch when transitions are off", function(done) {
        originalGetValue = config.getValue;
        config.getValue = function(key, subkey, options) {
          if (key === "Transition") return { enabled: false };
          return originalGetValue.call(config, key, subkey, options);
        };
        getUpcomingActions(function(err, upcoming) {
          should.not.exist(err);
          should(upcoming.enabled).be.false();
          should(Object.keys(upcoming)).eql(["enabled", "timezone"]);
          done();
        });
      });
    });
  });
});
