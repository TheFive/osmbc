import should from "should";
import { suppressMigrationNotifications, SYNTHETIC_MIGRATION_USER_NAME } from "../notification/migrationFilter.js";

function makeSpyReceiver() {
  const calls = [];
  return {
    calls,
    sendInfo(object, cb) { calls.push(["sendInfo"]); cb(); },
    updateArticle(user, article, change, cb) { calls.push(["updateArticle", user]); cb(); },
    updateBlog(user, blog, change, cb) { calls.push(["updateBlog", user]); cb(); },
    sendReviewStatus(user, blog, lang, status, cb) { calls.push(["sendReviewStatus", user]); cb(); },
    sendCloseStatus(user, blog, lang, status, cb) { calls.push(["sendCloseStatus", user]); cb(); },
    addComment(user, article, comment, cb) { calls.push(["addComment", user]); cb(); },
    editComment(user, article, index, comment, cb) { calls.push(["editComment", user]); cb(); }
  };
}

describe("notification/migrationFilter", function() {
  it("should suppress updateArticle for the migration user", function(done) {
    const spy = makeSpyReceiver();
    const filtered = suppressMigrationNotifications(spy);
    filtered.updateArticle({ OSMUser: SYNTHETIC_MIGRATION_USER_NAME }, {}, {}, function() {
      should(spy.calls).eql([]);
      done();
    });
  });

  it("should forward updateArticle for a real editor", function(done) {
    const spy = makeSpyReceiver();
    const filtered = suppressMigrationNotifications(spy);
    filtered.updateArticle({ OSMUser: "TheFive" }, {}, {}, function() {
      should(spy.calls).eql([["updateArticle", { OSMUser: "TheFive" }]]);
      done();
    });
  });

  it("should suppress updateBlog for the migration user but forward it for a real editor", function(done) {
    const spy = makeSpyReceiver();
    const filtered = suppressMigrationNotifications(spy);
    filtered.updateBlog({ OSMUser: SYNTHETIC_MIGRATION_USER_NAME }, {}, {}, function() {
      filtered.updateBlog({ OSMUser: "TheFive" }, {}, {}, function() {
        should(spy.calls).eql([["updateBlog", { OSMUser: "TheFive" }]]);
        done();
      });
    });
  });

  it("should not filter methods outside its scope (sendInfo, comments, review/close status)", function(done) {
    const spy = makeSpyReceiver();
    const filtered = suppressMigrationNotifications(spy);
    const migrationUser = { OSMUser: SYNTHETIC_MIGRATION_USER_NAME };
    filtered.sendInfo({}, function() {
      filtered.sendReviewStatus(migrationUser, {}, "DE", "ready", function() {
        filtered.sendCloseStatus(migrationUser, {}, "DE", true, function() {
          filtered.addComment(migrationUser, {}, "text", function() {
            filtered.editComment(migrationUser, {}, 0, "text", function() {
              should(spy.calls).eql([
                ["sendInfo"],
                ["sendReviewStatus", migrationUser],
                ["sendCloseStatus", migrationUser],
                ["addComment", migrationUser],
                ["editComment", migrationUser]
              ]);
              done();
            });
          });
        });
      });
    });
  });

  it("should treat a missing/anonymous user as not the migration user", function(done) {
    const spy = makeSpyReceiver();
    const filtered = suppressMigrationNotifications(spy);
    filtered.updateArticle(null, {}, {}, function() {
      should(spy.calls).eql([["updateArticle", null]]);
      done();
    });
  });

  // config.test.yaml defines apiKeys["testapikey.dataadmin"] =
  // "dataAdmin-TestUser" - a per-data-admin identity (routes/api.js
  // getBlogSyncUser) distinct from SYNTHETIC_MIGRATION_USER_NAME, see
  // CLAUDE.local.md 2026-09-05.
  it("should also suppress updateArticle/updateBlog for a name configured under apiKeys, not just the hardcoded fallback", function(done) {
    const spy = makeSpyReceiver();
    const filtered = suppressMigrationNotifications(spy);
    const dataAdmin = { OSMUser: "dataAdmin-TestUser" };
    filtered.updateArticle(dataAdmin, {}, {}, function() {
      filtered.updateBlog(dataAdmin, {}, {}, function() {
        should(spy.calls).eql([]);
        done();
      });
    });
  });

  it("should still forward a real editor's name that merely resembles a configured apiKeys value", function(done) {
    const spy = makeSpyReceiver();
    const filtered = suppressMigrationNotifications(spy);
    filtered.updateArticle({ OSMUser: "dataAdmin-TestUser-but-not-quite" }, {}, {}, function() {
      should(spy.calls).eql([["updateArticle", { OSMUser: "dataAdmin-TestUser-but-not-quite" }]]);
      done();
    });
  });
});
