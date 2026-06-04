import should from "should";
import nock from "nock";

import testutil from "./testutil.js";

import config from "../config.js";
import blogModule from "../model/blog.js";
import { runTransitionSweep } from "../model/blogTransitionScheduler.js";

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

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 3);
    oldDate.setMinutes(oldDate.getMinutes() - 30);

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
});
