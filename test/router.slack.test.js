"use strict";

const should    = require("should");
const async     = require("async");
const nock      = require("nock");
const axios    = require("axios");

const testutil  = require("./testutil.js");

const config    = require("../config.js");
const initialise      = require("../util/initialise.js");

const articleModule = require("../model/article.js");


describe("router/slack", function() {
  let link;
  let userName;
  let userId;

  async function talk(query, answer) {
    should.exist(userName);
    should.exist(userId);
    const body = await axios.post(link, { token: "testtoken", user_name: userName, user_id: userId, text: query });

    should(body.status).eql(200);
    should(body.data.token).eql("testtoken");
    should(body.data.user_id).eql(userId);
    should(body.data.user_name).eql(userName);
    should(body.data.username).eql("testbc");
    should(body.data.text).eql(answer);
  }
  async function findArticle(a) {
    const articleList = await articleModule.find(a);
    should(articleList.length).eql(1);
    return articleList[0];
  }



  before(function(bddone) {
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
    testutil.nockHtmlPagesClear();
    nock.cleanAll();
    return bddone();
  });
  beforeEach(function (bddone) {
    testutil.startServerSync();
    async.series([
      testutil.importData.bind(null, {
        clear: true,
        user: [{ OSMUser: "TestInteractive", SlackUser: "TestSlackInteractive", slackMode: "interactive" },
          { OSMUser: "ExistsTwice1", SlackUser: "ExistsTwice", slackMode: "interactive" },
          { OSMUser: "ExistsTwice2", SlackUser: "ExistsTwice", slackMode: "interactive" },
          { OSMUser: "TestUseTBC", SlackUser: "TestSlackUseTBC", slackMode: "useTBC" }],
        blog: [{ name: "blog", status: "open" }]
      })
    ], bddone);
  });
  afterEach(function(bdone) {
    testutil.stopServer();
    bdone();
  });
  describe("unauthorised access", async function() {
    it("should ignore request with wrong API Key", async function () {
      const body = await axios.post(link, {}, { validateStatus: () => true });
      should(body.status).eql(401);
    });
    it("should ignore request without known user", async function () {
      userName = "NotThere";
      userId = "33";
      await talk("Hello Boy", "<@33> I never heard from you. Please enter your Slack Name in <http://localhost:35043/usert/self|OSMBC>");
    });
    it("should give a hint if user is not unique", async function () {
      userName = "ExistsTwice";
      userId = "33";
      await talk("Hello Boy", "<@33> is registered more than once in <http://localhost:35043/usert/self|OSMBC>");
    });
  });
  describe("useTBC Mode", function() {
    it("should store an URL variant 1", async function() {
      userName = "TestSlackUseTBC";
      userId = "55";
      await talk("http://forum.openstreetmap.org/viewtopic.php?id=53173", "Article: [Internationale Admingrenzen 2016 / users: Germany](http://localhost:35043/article/1) created in your TBC Folder.\n");
      // search for the already exists article, that only should exist ONCE
      const article = await findArticle({ title: "Internationale Admingrenzen 2016 / users: Germany", collection: "http://forum.openstreetmap.org/viewtopic.php?id=53173", blog: "TBC" });
      should(article).eql({
        id: "1",
        _blog: null,
        version: 2,
        title: "Internationale Admingrenzen 2016 / users: Germany",
        collection: "http://forum.openstreetmap.org/viewtopic.php?id=53173",
        firstCollector: "TestUseTBC",
        categoryEN: "-- no category yet --",
        blog: "TBC"
      });
    });
    it("should store an URL variant 2", async function() {
      userName = "TestSlackUseTBC";
      userId = "55";
      await talk.bind(null, "mixed http://forum.openstreetmap.org/viewtopic.php?id=53173", "@TestSlackUseTBC Please enter an url.");
    });
    it("should store only store urls", async function() {
      userName = "TestSlackUseTBC";
      userId = "55";
      await talk("Text without a title", "@TestSlackUseTBC Please enter an url.");
    });
  });
});




