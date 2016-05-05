"use strict";

var should    = require('should');
var http      = require('http');
var request   = require('request');
var async     = require('async');
var nock      = require('nock');

var testutil  = require('./testutil.js');

var config    = require('../config.js');
var app       = require('../app.js');

var slackRouter = require('../routes/slack.js');
var articleModule = require('../model/article.js');
var logModule = require('../model/logModule.js');


describe('router/slack',function(){
  var link;
  var server;
  var user_name;
  var user_id;

  function talk(query,answer,cb) {
    should.exist(user_name);
    should.exist(user_id);
    var opts = {
      url: link, method: 'post',
      json: {token: "testtoken", user_name: user_name, user_id: user_id, text: query}
    };
    request(opts, function (err, res, body) {
      should.not.exist(err);
      should(res.body.token).eql("testtoken");
      should(res.body.user_id).eql(user_id);
      should(res.body.user_name).eql(user_name);
      should(res.body.username).eql("testbc");
      should(res.body.text).eql(answer);

      should(res.statusCode).eql(200);
      cb()
    })
  }
  function findArticle(a,cb) {
    articleModule.find(a,function(err,result){
      should.not.exist(err);
      should.exist(result);
      should(result.length).eql(1);
      cb();
    });
  }
  function findLog(l,cb) {
    logModule.find(l,function(err,logs){
      console.dir(logs);
      should.not.exist(err);
      should.exist(logs);
      should(logs.length).eql(1);
      cb();
    });
  }


  before(function() {
    server = http.createServer(app).listen(config.getServerPort());
    link = 'http://localhost:' + config.getServerPort() + config.getValue("htmlroot") + "/slack/create/wn";

    nock('https://hooks.slack.com/')
      .post(/\/services\/.*/)
      .times(999)
      .reply(200,"ok");

    process.env.TZ = 'Europe/Amsterdam';
  });
  after(function(){
    server.close();
    nock.cleanAll();
  });
  beforeEach(function (bddone) {


    async.series([
      testutil.importData.bind(null, {
        clear: true,
        user: [{OSMUser: "TestInteractive", SlackUser: "TestSlackInteractive", slackMode: "interactive"},
          {OSMUser: "ExistsTwice1", SlackUser: "ExistsTwice", slackMode: "interactive"},
          {OSMUser: "ExistsTwice2", SlackUser: "ExistsTwice", slackMode: "interactive"}],
        blog:[{name:"blog",status:"open"}]
      })
    ], bddone);
  });
  describe("searchUrlInSlack",function(){
    it('should extract different urls',function(){
      let s = slackRouter.fortestonly.searchUrlInSlack;
      should(s("<https://www.google.de>")).eql("https://www.google.de");
      should(s("text before <https://www.google.de> after")).eql("https://www.google.de");
      should(s("<https://www.google.de> only text after")).eql("https://www.google.de");
      should(s("<https://twitter.com/pascal_n/status/726503865298894849>")).eql("https://twitter.com/pascal_n/status/726503865298894849");
      should(s("<https://linkExists.org/already>")).eql("https://linkExists.org/already");
    });
  });
  describe("extractTextWithoutUrl",function(){
    it('should extract different texts',function(){
      let s = slackRouter.fortestonly.extractTextWithoutUrl;
      should(s("<https://www.google.de>")).eql("");
      should(s("text before <https://www.google.de> after")).eql("text before  after");
      should(s("<https://www.google.de> only text after")).eql(" only text after");
    });
  });
  describe("function undefined()",function(){
    it('should work for different values',function(){
      let u = slackRouter.fortestonly.undefined;
      var a;
      var obj={};
      should(u(null)).be.True();
      should(u(a)).be.True();
      should(u("")).be.True();
      should(u("text before <https://www.google.de> after")).be.False();
      should(u({a:1})).be.True();
      should(u(obj.prop)).be.True();
    });
  });
  describe("unauthorised access",function() {
    it("should ignore request with wrong API Key", function (bddone) {
      var opts = {url: link, method: 'post'};
      request(opts, function (err, res, body) {
        should.not.exist(err);
        should(res.statusCode).eql(401);
        // if server returns an actual error
        bddone()
      })
    })
    it("should ignore request without known user", function (bddone) {
      user_name = "NotThere";
      user_id = "33";
      talk("Hello Boy", "<@33> I never heard from you. Please enter your Slack Name in <https://testosm.bc/usert/self|OSMBC>", bddone);
    });
    it("should give a hint if user is not unique", function (bddone) {
      user_name = "ExistsTwice";
      user_id = "33";
      talk("Hello Boy", "<@33> is registered more than once in <https://testosm.bc/usert/self|OSMBC>", bddone);
    });
  });
  describe("interactive mode",function(){
    it("should ask for a Url if not given",function(bddone) {
      user_name = "TestSlackInteractive";
      user_id = "55";
      talk("Hello OSMBC Bot", "<@55> Please start with an url\n", bddone);
    });
    it("should ask for a title and create an article",function(bddone){
      user_id = "33";
      user_name = "TestSlackInteractive";
      async.series([
        talk.bind(null,"<https://www.osmbc.org/article>","<@33> Please enter a title:\n"),
        talk.bind(null,"An article title","<@33> <https://testosm.bc/article/1|An article title> created.\n"),
        findArticle.bind(null,{title:"An article title",collection:"https://www.osmbc.org/article",blog:"blog"}),
        findLog.bind(null,{table:"article",user:"TestInteractive",property:"collection",to:"https://www.osmbc.org/article"})
        ],bddone);
    });
    it("should ask because dublette  and create an article",function(bddone){
      user_id = "33";
      user_name = "TestSlackInteractive";
      async.series([
        function (cb) {
          articleModule.createNewArticle({title:"Article Exists",collection:"https://linkExists.org/already",blog:"test-blog"},cb);
        },
        talk.bind(null,"<https://linkExists.org/already>","<@33> Found: 1 article\ntest-blog <https://testosm.bc/article/1|Article Exists>\n\nPlease enter yes to proceed.\n"),
        talk.bind(null,"Yes","<@33> Please enter a title for the collection:\n"),
        talk.bind(null,"Another title","<@33> <https://testosm.bc/article/2|Another title> created.\n"),
        findArticle.bind(null,{title:"Another title",collection:"https://linkExists.org/already",blog:"blog"})
      ],bddone);
    });
    it("should ask for dublette and cancel creation",function(bddone){
      user_id = "33";
      user_name = "TestSlackInteractive";
      async.series([
        function (cb) {
          articleModule.createNewArticle({title:"Article Exists",collection:"https://linkExists.org/already",blog:"test-blog"},cb);
        },
        talk.bind(null,"<https://linkExists.org/already>","<@33> Found: 1 article\ntest-blog <https://testosm.bc/article/1|Article Exists>\n\nPlease enter yes to proceed.\n"),
        talk.bind(null,"No","<@33> You have cancelled your collection.\n"),
        // search for the already exists article, that only should exist ONCE
        findArticle.bind(null,{collection:"https://linkExists.org/already"})
      ],bddone);
    });

  });
});




