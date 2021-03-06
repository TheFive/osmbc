"use strict";

var should    = require("should");
var http      = require("http");
var request   = require("request");
var async     = require("async");
var nock      = require("nock");

var testutil  = require("./testutil.js");

var config    = require("../config.js");
var app       = require("../app.js");
var initialise      = require("../util/initialise.js");

var articleModule = require("../model/article.js");
var logModule = require("../model/logModule.js");


describe("router/slack", function() {
  var link;
  var server;
  var userName;
  var userId;

  function talk(query, answer, cb) {
    should.exist(userName);
    should.exist(userId);
    var opts = {
      url: link,
      method: "post",
      json: {token: "testtoken", user_name: userName, user_id: userId, text: query}
    };
    request(opts, function (err, res) {
      should.not.exist(err);


      should(res.statusCode).eql(200);
      should(res.body.token).eql("testtoken");
      should(res.body.user_id).eql(userId);
      should(res.body.user_name).eql(userName);
      should(res.body.username).eql("testbc");
      should(res.body.text).eql(answer);
      cb();
    });
  }
  function findArticle(a, cb) {
    articleModule.find(a, function(err, result) {
      should.not.exist(err);
      should.exist(result);
      should(result.length).eql(1);
      cb();
    });
  }
  function findLog(l, cb) {
    logModule.find(l, function(err, logs) {
      should.not.exist(err);
      if (logs.length !== 1) {
        should(l).eql("NOT FOUND IN LOGS");
      }
      cb();
    });
  }


  before(function(bddone) {
    server = http.createServer(app).listen(config.getServerPort());
    link = "http://localhost:" + config.getServerPort() + config.htmlRoot() + "/slack/create/wn";

    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.nockHtmlPages();

    process.env.TZ = "Europe/Amsterdam";
    initialise.initialiseModules(bddone);
  });
  after(function(bddone) {
    server.close();
    testutil.nockHtmlPagesClear();
    nock.cleanAll();
    return bddone();
  });
  beforeEach(function (bddone) {
    async.series([
      testutil.importData.bind(null, {
        clear: true,
        user: [{OSMUser: "TestInteractive", SlackUser: "TestSlackInteractive", slackMode: "interactive"},
          {OSMUser: "ExistsTwice1", SlackUser: "ExistsTwice", slackMode: "interactive"},
          {OSMUser: "ExistsTwice2", SlackUser: "ExistsTwice", slackMode: "interactive"},
          {OSMUser: "TestUseTBC", SlackUser: "TestSlackUseTBC", slackMode: "useTBC"}],
        blog: [{name: "blog", status: "open"}]
      })
    ], bddone);
  });
  describe("unauthorised access", function() {
    it("should ignore request with wrong API Key", function (bddone) {
      var opts = {url: link, method: "post"};
      request(opts, function (err, res) {
        should.not.exist(err);
        should(res.statusCode).eql(401);
        // if server returns an actual error
        bddone();
      });
    });
    it("should ignore request without known user", function (bddone) {
      userName = "NotThere";
      userId = "33";
      talk("Hello Boy", "<@33> I never heard from you. Please enter your Slack Name in <https://testosm.bc/usert/self|OSMBC>", bddone);
    });
    it("should give a hint if user is not unique", function (bddone) {
      userName = "ExistsTwice";
      userId = "33";
      talk("Hello Boy", "<@33> is registered more than once in <https://testosm.bc/usert/self|OSMBC>", bddone);
    });
  });
  describe("useTBC Mode", function() {
    it("should store an URL variant 1", function(bddone) {
      userName = "TestSlackUseTBC";
      userId = "55";
      async.series([
        talk.bind(null, "http://forum.openstreetmap.org/viewtopic.php?id=53173", "Article: [Internationale Admingrenzen 2016 / users: Germany](https://testosm.bc/article/1) created in your TBC Folder.\n"),

        // search for the already exists article, that only should exist ONCE
        findArticle.bind(null, {title: "Internationale Admingrenzen 2016 / users: Germany", collection: "http://forum.openstreetmap.org/viewtopic.php?id=53173", blog: "TBC"})
      ], bddone);
    });
    it("should store an URL variant 2", function(bddone) {
      userName = "TestSlackUseTBC";
      userId = "55";
      async.series([
        talk.bind(null, "mixed http://forum.openstreetmap.org/viewtopic.php?id=53173", "@TestSlackUseTBC Please enter an url.")
      ], bddone);
    });
    it("should store only store urls", function(bddone) {
      userName = "TestSlackUseTBC";
      userId = "55";
      async.series([
        talk.bind(null, "Text without a title", "@TestSlackUseTBC Please enter an url.")
      ], bddone);
    });
  });
});




