

import async from "async";
import should from "should";

import sinon from "sinon";

import testutil from "./testutil.js";

import userModule, { getAvatar, avatarTest, resetNewUsersIndexCheck } from "../model/user.js";
import db from "../model/db.js";
import nock from "nock";
import fs from "fs";
import path from "path";
import config from "../config.js";
import logModule from "../model/logModule.js";
import { MailReceiverForTestOnly } from "../notification/mailReceiver.js";






describe("model/user", function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  });
  describe("createNewUser", function() {
    it("should createNewUser with prototype", function(bddone) {
      userModule.createNewUser({ name: "user" }, function (err, result) {
        should.not.exist(err);
        const id = result.id;
        testutil.getJsonWithId("usert", id, function(err, result) {
          should.not.exist(err);
          should(result.name).equal("user");
          bddone();
        });
      });
    });
    it("should createNewUser without prototype", function(bddone) {
      userModule.createNewUser(function (err, result) {
        should.not.exist(err);
        const id = result.id;
        testutil.getJsonWithId("usert", id, function(err) {
          should.not.exist(err);
          bddone();
        });
      });
    });
    it("should create no New User with ID", function(bddone) {
      userModule.createNewUser({ id: 2, OSMUser: "me again" }, function (err) {
        should.exist(err);
        should(err.message).eql("user id exists");
        bddone();
      });
    });
    it("should create no New User with existing name", function(bddone) {
      userModule.createNewUser({ OSMUser: "TestUser" }, function (err) {
        should.not.exist(err);
        userModule.createNewUser({ OSMUser: "TestUser" }, function(err) {
          should.exist(err);
          should(err.message).eql("User >TestUser< already exists.");
          bddone();
        });
      });
    });
  });
  describe("findFunctions", function() {
    let idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) { userModule.createNewUser({ OSMUser: "TheFive", access: "full" }, cb); },
        function c2(cb) { userModule.createNewUser({ OSMUser: "Test", access: "denied" }, cb); },
        function c3(cb) {
          userModule.createNewUser({ OSMUser: "Test2", access: "full" },
            function(err, result) {
              should.not.exist(err);
              idToFindLater = result.id;
              cb(err);
            });
        }

      ], function(err) {
        should.not.exist(err);
        bddone();
      });
    });
    describe("find", function() {
      it("should find multiple objects with sort", function(bddone) {
        userModule.find({ access: "full" }, { column: "OSMUser" }, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].id;
          delete result[1]._meta;
          delete result[1].id;
          should(result[0]).eql({ OSMUser: "Test2", access: "full", version: 1 });
          should(result[1]).eql({ OSMUser: "TheFive", access: "full", version: 1 });
          bddone();
        });
      });
    });
    describe("findOne", function() {
      it("should findOne object with sort", function(bddone) {
        userModule.findOne({ OSMUser: "Test" }, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({ OSMUser: "Test", access: "denied", version: 1 });
          bddone();
        });
      });
    });
    describe("findExact", function() {
      it("should find a user by the exact name", async function() {
        const result = await userModule.findExact("OSMUser", "Test");
        should(result.map((u) => u.OSMUser)).eql(["Test"]);
      });
      it("should never read the value as an operator (#1188)", async function() {
        for (const name of ["<U", ">A", "!=Test", "GE:A", "IN(TheFive)", "INGO", "%", "Test%"]) {
          should(await userModule.findExact("OSMUser", name)).eql([], name);
        }
      });
      it("should keep the value out of the slow-query log", async function() {
        const spy = sinon.spy(db, "query");
        try {
          await userModule.findExact("apiKey", "secret");
          should(spy.firstCall.args[1].hideInLog).be.true();
        } finally {
          spy.restore();
        }
      });
      it("should reject a value that is not a text", async function() {
        await should(userModule.findExact("OSMUser", ["Test"])).be.rejectedWith({ status: 400 });
      });
      it("should create a user whose name starts with an operator", async function() {
        await userModule.createNewUser({ OSMUser: "IN(TheFive)", access: "guest" });
        should((await userModule.findExact("OSMUser", "IN(TheFive)")).length).eql(1);
      });
    });
    describe("search", function() {
      function search(query, text) {
        return new Promise((resolve, reject) => userModule.search(query, { column: "OSMUser" }, text,
          (err, users) => err ? reject(err) : resolve(users.map(u => u.OSMUser))));
      }
      before(async function() {
        await userModule.createNewUser({ OSMUser: "NewMapper", access: "guest", SlackUser: "nm-chat" });
        await userModule.createNewUser({ OSMUser: "OldHand", access: "full", mdWeeklyAuthor: "[Mapper Max](https://example.org)" });
        await userModule.createNewUser({ OSMUser: "50%Mapper", access: "denied" });
      });
      it("should find a part of the OSM name, ignoring case", async function() {
        should(await search({}, "newmap")).eql(["NewMapper"]);
      });
      it("should find the blog author name and the Mattermost name", async function() {
        should(await search({}, " MAPPER ")).eql(["50%Mapper", "NewMapper", "OldHand"]);
        should(await search({}, "nm-chat")).eql(["NewMapper"]);
      });
      it("should combine the search with the filter", async function() {
        should(await search({ access: "full" }, "mapper")).eql(["OldHand"]);
        should(await search({ access: "guest" }, "mapper")).eql(["NewMapper"]);
      });
      it("should keep all users for an empty or missing text", async function() {
        const all = await search({});
        should(all.length).be.above(4);
        should(await search({}, "  ")).eql(all);
      });
      it("should read the text as plain text, not as an operator (#1188)", async function() {
        should(await search({}, "%")).eql(["50%Mapper"]);
        should(await search({}, "<")).eql([]);
        should(await search({}, "!=x")).eql([]);
      });
      it("should reject a text that is not a string or too long", async function() {
        await should(search({}, ["a", "b"])).be.rejectedWith({ status: 400 });
        await should(search({}, "x".repeat(101))).be.rejectedWith({ status: 400 });
      });
    });
    describe("findById", function() {
      it("should find saved Object", function(bddone) {
        userModule.findById(idToFindLater, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({ OSMUser: "Test2", access: "full", version: 1 });
          bddone();
        });
      });
    });
  });
  describe("setAndSave", function() {
    let oldtransporter;
    beforeEach(function (bddone) {
      oldtransporter = MailReceiverForTestOnly.transporter.sendMail;
      MailReceiverForTestOnly.transporter.sendMail = sinon.spy(function(obj, doit) { return doit(null, { response: "t" }); });
      testutil.importData({
        clear: true,
        user: [{ OSMUser: "WelcomeMe", email: "none", lastAccess: (new Date()).toISOString() },
          { OSMUser: "InviteYou", email: "invite@mail.org" },
          { OSMUser: "DeniedUser", access: "denied", email: "this.is@mymail" }]
      }, bddone);
    });
    afterEach(function (bddone) {
      MailReceiverForTestOnly.transporter.sendMail = oldtransporter;
      bddone();
    });
    it("should set only the one Value in the database", function (bddone) {
      let newUser;
      userModule.createNewUser({ OSMUser: "Test", access: "full" }, function(err, result) {
        should.not.exist(err);
        newUser = result;
        const id = result.id;
        newUser.access = "not logged";
        newUser.setAndSave({ OSMUser: "user" }, { version: 1, OSMUser: "Test2", access: "not logged" }, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("usert", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            should(result).eql({ id: id, access: "not logged", OSMUser: "Test2", version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(1);
              const r0id = result[0].id;
              const t0 = result[0].timestamp;
              const now = new Date();
              const t0diff = ((new Date(t0)).getTime() - now.getTime());

              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(result[0]).eql({ id: r0id, timestamp: t0, oid: id, user: "user", table: "usert", property: "OSMUser", from: "Test", to: "Test2" });

              // There should be no mail
              should(MailReceiverForTestOnly.transporter.sendMail.called).be.False();
              bddone();
            });
          });
        });
      });
    });
    it("should ignore unchanged Values", function (bddone) {
      let newUser;
      userModule.createNewUser({ OSMUser: "Test", access: "full" }, function(err, result) {
        should.not.exist(err);
        newUser = result;
        const id = result.id;
        const changeValues = {};
        changeValues.OSMUser = newUser.OSMUser;
        changeValues.access = newUser.access;
        changeValues.version = 1;
        newUser.setAndSave({ OSMUser: "user" }, changeValues, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("usert", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            should(result).eql({ id: id, OSMUser: "Test", access: "full", version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(0);

              // There should be no mail
              should(MailReceiverForTestOnly.transporter.sendMail.called).be.False();
              bddone();
            });
          });
        });
      });
    });
    it("should trim OSM User Name", function (bddone) {
      let newUser;
      userModule.createNewUser({ OSMUser: "Test", access: "full" }, function(err, result) {
        should.not.exist(err);
        newUser = result;
        const id = result.id;
        const changeValues = {};
        changeValues.OSMUser = " Untrimmed Username ";
        changeValues.access = newUser.access;
        changeValues.version = 1;
        newUser.setAndSave({ OSMUser: "user" }, changeValues, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("usert", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            should(result).eql({ id: id, OSMUser: "Untrimmed Username", access: "full", version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(1);

              // There should be no mail
              should(MailReceiverForTestOnly.transporter.sendMail.called).be.False();
              bddone();
            });
          });
        });
      });
    });
    it("should fail when change email by another user", function (bddone) {
      userModule.findOne({ OSMUser: "WelcomeMe" }, function(err, user) {
        should.not.exist(err);
        // First set a new EMail Address for the WelcomeMe user, by InviteYou.
        user.setAndSave({ OSMUser: "InviteYou" }, { email: "WelcomeMe@newemail.org" }, function (err) {
          const expectedErr = new Error("EMail address can only be changed by the user himself, after he has logged in.");
          expectedErr.status = 401;
          should(err).eql(expectedErr);
          bddone();
        });
      });
    });
    it("should fail when change email for denied user (no delete)", function (bddone) {
      userModule.findOne({ OSMUser: "DeniedUser" }, function(err, user) {
        should.not.exist(err);
        // First set a new EMail Address for the WelcomeMe user, by InviteYou.
        user.setAndSave({ OSMUser: "InviteYou" }, { email: "WelcomeMe@newemail.org" }, function (err) {
          const expectedErr = new Error("EMail address can only be changed by the user himself, after he has logged in.");
          expectedErr.status = 401;
          should(err).eql(expectedErr);
          bddone();
        });
      });
    });
    it("should allow maildelete for denied users", function (bddone) {
      userModule.findOne({ OSMUser: "DeniedUser" }, function(err, user) {
        should.not.exist(err);
        // First set a new EMail Address for the WelcomeMe user, by InviteYou.
        user.setAndSave({ OSMUser: "InviteYou" }, { email: "none" }, function (err) {
          should.not.exist(err);
          userModule.findOne({ OSMUser: "DeniedUser" }, function(err, user) {
            should.not.exist(err);
            should(user.email).eql(undefined);
            bddone();
          });
        });
      });
    });
    it("should trim an email adress", function (bddone) {
      userModule.findOne({ OSMUser: "WelcomeMe" }, function(err, user) {
        should.not.exist(err);
        // First set a new EMail Address for the WelcomeMe user, by InviteYou.
        user.setAndSave({ OSMUser: "WelcomeMe" }, { email: " NewEmail@newemail.org ", OSMUser: "WelcomeMe" }, function (err) {
          should.not.exist(err);
          testutil.getJsonWithId("usert", user.id, function(err, result) {
            should.not.exist(err);
            should(result.emailInvalidation).eql("NewEmail@newemail.org");
            bddone();
          });
        });
      });
    });
    it("should fail when username is changed and user once logged in", function (bddone) {
      userModule.findOne({ OSMUser: "WelcomeMe" }, function(err, user) {
        should.not.exist(err);
        // First set a new EMail Address for the WelcomeMe user, by InviteYou.
        user.setAndSave({ OSMUser: "InviteYou" }, { OSMUser: "NameChange" }, function (err) {
          const expectedErr = new Error(">" + user.OSMUser + "< already has logged in, change in name not possible.");
          expectedErr.status = 403;
          should(err).eql(expectedErr);
          bddone();
        });
      });
    });
  });
  describe("getAvatar", function() {
    const profile = (src) => `<html><head><title>U | OpenStreetMap</title></head><body><img class="user_image" src="${src}"></body></html>`;
    // the lookup runs in the background, wait until OSM was asked
    async function lookedUp(scope) {
      for (let i = 0; i < 100 && !scope.isDone(); i++) await new Promise(resolve => setTimeout(resolve, 10));
      should(scope.isDone()).be.True();
      await new Promise(resolve => setImmediate(resolve));
    }
    beforeEach(function() {
      avatarTest.enableLookup(true);
      avatarTest.flush();
    });
    afterEach(function() {
      avatarTest.enableLookup(false);
      avatarTest.flush();
      nock.cleanAll();
    });
    it("should show the placeholder until the avatar is known, then the avatar", async function() {
      const scope = nock("https://www.openstreetmap.org").get("/user/Mapper").reply(200, profile("/avatars/mapper.png"));
      should(getAvatar("Mapper")).eql(avatarTest.placeholder);
      await lookedUp(scope);
      should(getAvatar("Mapper")).eql("https://www.openstreetmap.org/avatars/mapper.png");
    });
    it("should show a stale avatar and look it up again", async function() {
      avatarTest.setEntry("Mapper", { url: "https://example.com/old.png", fetchedAt: Date.now() - avatarTest.refreshAfter - 1000 });
      const scope = nock("https://www.openstreetmap.org").get("/user/Mapper").reply(200, profile("https://example.com/new.png"));
      should(getAvatar("Mapper")).eql("https://example.com/old.png");
      await lookedUp(scope);
      should(getAvatar("Mapper")).eql("https://example.com/new.png");
    });
    it("should not ask OSM again for a fresh entry", function() {
      avatarTest.setEntry("Mapper", { url: "https://example.com/a.png", fetchedAt: Date.now() });
      // nock without interceptor: any request would fail the test with an error log, check isDone instead
      const scope = nock("https://www.openstreetmap.org").get("/user/Mapper").reply(200, profile("https://example.com/b.png"));
      should(getAvatar("Mapper")).eql("https://example.com/a.png");
      should(scope.isDone()).be.False();
    });
    it("should keep the avatars on disk", async function() {
      avatarTest.setEntry("Mapper", { url: "https://example.com/a.png", fetchedAt: 1 });
      // InternalCache writes a second after the change
      await new Promise(resolve => setTimeout(resolve, 1500));
      const file = JSON.parse(fs.readFileSync(path.join(config.getDirName(), "cache", "avatar.test.cache"), "utf8"));
      should(file.Mapper).eql({ url: "https://example.com/a.png", fetchedAt: 1 });
    });
    it("should remember an unknown user and show the placeholder", async function() {
      const scope = nock("https://www.openstreetmap.org").get("/user/Nobody").reply(404);
      should(getAvatar("Nobody")).eql(avatarTest.placeholder);
      await lookedUp(scope);
      const again = nock("https://www.openstreetmap.org").get("/user/Nobody").reply(404);
      should(getAvatar("Nobody")).eql(avatarTest.placeholder);
      should(again.isDone()).be.False();
    });
  });
  describe("getNewUsers", function() {
    const daysAgo = (d) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString();
    const query = (sql) => new Promise((resolve, reject) => db.query(sql, (err) => err ? reject(err) : resolve()));
    const newUsers = () => new Promise((resolve, reject) => userModule.getNewUsers((err, r) => err ? reject(err) : resolve(r)));
    let newbieFirst;
    beforeEach(async function() {
      await testutil.clearDB();
      resetNewUsersIndexCheck();
      await userModule.createNewUser({ OSMUser: "OldHand", access: "full" });
      await userModule.createNewUser({ OSMUser: "Newbie", access: "full" });
      await userModule.createNewUser({ OSMUser: "NewGuest", access: "guest" });
      await userModule.createNewUser({ OSMUser: "LastMonth", access: "full" });
      const log = (user, days) => logModule.log({ table: "article", oid: "1", property: "markdownDE", user: user, timestamp: daysAgo(days) });
      await log("OldHand", 400);
      await log("OldHand", 1);
      newbieFirst = daysAgo(3);
      await logModule.log({ table: "article", oid: "1", property: "markdownDE", user: "Newbie", timestamp: newbieFirst });
      await log("Newbie", 2);
      await log("NewGuest", 10);
      await log("LastMonth", 40);
      await log("LastMonth", 5);
      await log("NotAUser", 4);
    });
    function check(result) {
      const rows = result.map((r) => r.osmuser + "/" + r.access).sort();
      should(rows).eql(["NewGuest/guest", "Newbie/full"]);
      should(result.find((r) => r.osmuser === "Newbie").first).eql(newbieFirst);
    }
    it("should find users with their first change in the interval (with index)", async function() {
      check(await newUsers());
    });
    it("should find the same users without the index and warn once", async function() {
      await query("drop index changes_user_timestamp_idx");
      const warn = sinon.spy(config.logger, "warn");
      try {
        check(await newUsers());
        check(await newUsers());
        should(warn.withArgs(sinon.match(/changes_user_timestamp_idx is missing/)).callCount).eql(1);
      } finally {
        warn.restore();
      }
    });
  });
});
