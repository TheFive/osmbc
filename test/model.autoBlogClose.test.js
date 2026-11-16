import should from "should";
import nock from "nock";
import MockDate from "mockdate";

import testutil from "./testutil.js";

import config from "../config.js";
import blogModule from "../model/blog.js";
import logModule from "../model/logModule.js";
import { runTransitionSweep, getUpcomingActions, stopTransitionScheduler } from "../model/blogTransitionScheduler.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-20T12:00:00.000Z").getTime();

function daysAgo(days) {
  return new Date(NOW - days * DAY).toISOString();
}

describe("model/autoBlogClose", function() {
  let originalGetValue = null;

  function useConfig(autoBlogClose) {
    originalGetValue = config.getValue;
    config.getValue = function(key, subkey, options) {
      if (key === "Transition") {
        return {
          enabled: true,
          AutoEditMode: { enabled: false },
          AutoBlogClose: Object.assign({ enabled: true, languages: ["DE", "FR", "ES"] }, autoBlogClose)
        };
      }
      return originalGetValue.call(config, key, subkey, options);
    };
  }

  // WN100 closed DE and FR (so both are active teams), WN101 is the candidate,
  // WN102 and WN103 are the newer blogs kept open for late teams
  function importBlogs(wn101, articles, cb) {
    testutil.importData({
      clear: true,
      blog: [
        { name: "WN100", status: "closed", closeDE: true, closeFR: true },
        Object.assign({ name: "WN101", status: "edit", endDate: daysAgo(14) }, wn101),
        { name: "WN102", status: "edit", endDate: daysAgo(7) },
        { name: "WN103", status: "edit", endDate: daysAgo(0) },
        { name: "WN104", status: "open", endDate: daysAgo(-7) }
      ],
      article: articles || [{ blog: "WN101", title: "a", markdownDE: "Text", markdownFR: "Texte", categoryEN: "Mapping" }]
    }, cb);
  }

  function logChange(user, property, timestamp, cb) {
    logModule.log({ blog: "WN101", user: user, table: "article", property: property, timestamp: timestamp }, cb);
  }

  function sweepAndRead(cb) {
    runTransitionSweep(function(err) {
      should.not.exist(err);
      blogModule.findOne({ name: "WN101" }, cb);
    });
  }

  before(function(done) {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.clearDB(done);
  });
  after(function() {
    nock.cleanAll();
  });
  beforeEach(function(done) {
    process.env.TZ = "Europe/Amsterdam";
    MockDate.set(NOW);
    stopTransitionScheduler(done);
  });
  afterEach(function() {
    if (originalGetValue) config.getValue = originalGetValue;
    originalGetValue = null;
    MockDate.reset();
  });

  it("closes a blog when every active language is closed", function(done) {
    useConfig({});
    importBlogs({ closeDE: true, closeFR: true }, null, function(err) {
      should.not.exist(err);
      sweepAndRead(function(err, blog) {
        should.not.exist(err);
        should(blog.status).eql("closed");
        logModule.find({ blog: "WN101", table: "blog", property: "status", to: "closed" }, function(err, logs) {
          should.not.exist(err);
          should(logs.map((l) => l.user)).eql(["autoclose-blog"]);
          done();
        });
      });
    });
  });

  it("waits for an active language with a recent change by an editor", function(done) {
    useConfig({});
    importBlogs({ closeDE: true }, null, function(err) {
      should.not.exist(err);
      logChange("editor", "markdownFR", daysAgo(2), function(err) {
        should.not.exist(err);
        sweepAndRead(function(err, blog) {
          should.not.exist(err);
          should(blog.status).eql("edit");
          done();
        });
      });
    });
  });

  it("closes a blog when an open language had no change by an editor for idleDays", function(done) {
    useConfig({});
    importBlogs({ closeDE: true }, null, function(err) {
      should.not.exist(err);
      logChange("editor", "markdownFR", daysAgo(15), function(err) {
        should.not.exist(err);
        // machine translations and automatic steps are no sign of a working team
        logChange("deeplPro API Call", "markdownFR", daysAgo(1), function(err) {
          should.not.exist(err);
          sweepAndRead(function(err, blog) {
            should.not.exist(err);
            should(blog.status).eql("closed");
            done();
          });
        });
      });
    });
  });

  it("counts review comments as activity", function(done) {
    useConfig({});
    importBlogs({ closeDE: true }, null, function(err) {
      should.not.exist(err);
      logModule.log({ blog: "WN101", user: "reviewer", table: "blog", property: "reviewCommentFR", timestamp: daysAgo(3) }, function(err) {
        should.not.exist(err);
        sweepAndRead(function(err, blog) {
          should.not.exist(err);
          should(blog.status).eql("edit");
          done();
        });
      });
    });
  });

  it("treats a language closed in a previous blog as active even without text", function(done) {
    useConfig({ idleDays: 20 });
    // no French text in WN101, but FR closed WN100: the team may still come
    importBlogs({ closeDE: true }, [{ blog: "WN101", title: "a", markdownDE: "Text", categoryEN: "Mapping" }], function(err) {
      should.not.exist(err);
      sweepAndRead(function(err, blog) {
        should.not.exist(err);
        should(blog.status).eql("edit");
        done();
      });
    });
  });

  it("ignores a language that is neither used nor closed before", function(done) {
    useConfig({});
    // ES has no text and was not closed in WN100
    importBlogs({ closeDE: true, closeFR: true }, null, function(err) {
      should.not.exist(err);
      sweepAndRead(function(err, blog) {
        should.not.exist(err);
        should(blog.status).eql("closed");
        done();
      });
    });
  });

  it("keeps the keepOpenBlogs newest edit blogs open", function(done) {
    useConfig({ keepOpenBlogs: 3 });
    importBlogs({ closeDE: true, closeFR: true }, null, function(err) {
      should.not.exist(err);
      sweepAndRead(function(err, blog) {
        should.not.exist(err);
        should(blog.status).eql("edit");
        done();
      });
    });
  });

  it("runs at most every everyMinutes", function(done) {
    useConfig({});
    importBlogs({ closeDE: true }, null, function(err) {
      should.not.exist(err);
      logChange("editor", "markdownFR", daysAgo(13.99), function(err) {
        should.not.exist(err);
        sweepAndRead(function(err, blog) {
          should.not.exist(err);
          should(blog.status).eql("edit");
          // half an hour later FR is idle for 14 days, but the rule waits for its hour
          MockDate.set(NOW + 30 * 60 * 1000);
          sweepAndRead(function(err, blog) {
            should.not.exist(err);
            should(blog.status).eql("edit");
            MockDate.set(NOW + 60 * 60 * 1000);
            sweepAndRead(function(err, blog) {
              should.not.exist(err);
              should(blog.status).eql("closed");
              done();
            });
          });
        });
      });
    });
  });

  it("previews waiting, abandoned and closed languages without changing anything", function(done) {
    useConfig({ languages: ["DE", "FR", "ES"] });
    importBlogs({ closeDE: true }, [
      { blog: "WN101", title: "a", markdownDE: "Text", markdownFR: "Texte", markdownES: "Texto", categoryEN: "Mapping" }
    ], function(err) {
      should.not.exist(err);
      logChange("editor", "markdownFR", daysAgo(2), function(err) {
        should.not.exist(err);
        getUpcomingActions(function(err, upcoming) {
          should.not.exist(err);
          should(upcoming.autoBlogClose).eql({
            enabled: true,
            keepOpenBlogs: 2,
            idleDays: 14,
            blogs: [{
              name: "WN101",
              close: false,
              closed: ["DE"],
              // ES has text but no change by an editor since the blog end 14 days ago
              abandoned: [{ lang: "ES", lastTs: NOW - 14 * DAY }],
              waiting: [{ lang: "FR", lastTs: NOW - 2 * DAY, idleFromTs: NOW + 12 * DAY }]
            }]
          });
          blogModule.findOne({ name: "WN101" }, function(err, blog) {
            should.not.exist(err);
            should(blog.status).eql("edit");
            done();
          });
        });
      });
    });
  });
});
