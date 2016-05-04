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


describe('router/slack',function(){
  var link;
  var server;
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
      var opts = {url: link, method: 'post', json: {token: "testtoken", user_name: "NotThere", user_id: "33"}};
      request(opts, function (err, res, body) {
        should.not.exist(err);
        should(res.body.token).eql("testtoken");
        should(res.body.user_id).eql("33");
        should(res.body.user_name).eql("NotThere");
        should(res.body.username).eql("testbc");
        should(res.body.text).eql("<@33> I never heard from you. Please enter your Slack Name in <https://testosm.bc/usert/self|OSMBC>");

        should(res.statusCode).eql(200);
        // if server returns an actual error
        bddone()
      });
    });
    it("should ignore give a hint if user is not unique", function (bddone) {
      var opts = {url: link, method: 'post', json: {token: "testtoken", user_name: "ExistsTwice", user_id: "33"}};
      request(opts, function (err, res, body) {
        should.not.exist(err);
        should(res.body.token).eql("testtoken");
        should(res.body.user_id).eql("33");
        should(res.body.user_name).eql("ExistsTwice");
        should(res.body.username).eql("testbc");
        should(res.body.text).eql("<@33> is registered more than once in <https://testosm.bc/usert/self|OSMBC>");

        should(res.statusCode).eql(200);
        // if server returns an actual error
        bddone()
      });
    });
  });
  describe("interactive mode",function(){
    it("should ask for a Url if not given",function(bddone){
      var opts = {url: link, method: 'post',
        json:{token:"testtoken",user_name:"TestSlackInteractive",user_id:"33",text:"Hello OSMBC Bot"}};
      request(opts, function (err, res, body) {
        should.not.exist(err);
        should(res.body.token).eql("testtoken");
        should(res.body.user_id).eql("33");
        should(res.body.user_name).eql("TestSlackInteractive");
        should(res.body.username).eql("testbc");
        should(res.body.text).eql("<@33> Please start with an url\n");

        should(res.statusCode).eql(200);
        // if server returns an actual error
        bddone()
      });
    });
    it("should ask for a title and create an article",function(bddone){
      async.series([
        function firstTalk(cb) {
          var opts = {url: link, method: 'post',
            json:{token:"testtoken",user_name:"TestSlackInteractive",user_id:"33",text:"<https://www.osmbc.org/article>"}};
          request(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.body.token).eql("testtoken");
            should(res.body.user_id).eql("33");
            should(res.body.user_name).eql("TestSlackInteractive");
            should(res.body.username).eql("testbc");
            should(res.body.text).eql("<@33> Please enter a title:\n");

            should(res.statusCode).eql(200);
            cb()
          });
        },
        function answerTalk(cb) {
          var opts = {url: link, method: 'post',
            json:{token:"testtoken",user_name:"TestSlackInteractive",user_id:"33",text:"A article title"}};
          request(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.body.token).eql("testtoken");
            should(res.body.user_id).eql("33");
            should(res.body.user_name).eql("TestSlackInteractive");
            should(res.body.username).eql("testbc");
            should(res.body.text).eql("<@33> <https://testosm.bc/article/1|A article title> created.\n");

            should(res.statusCode).eql(200);
            cb()
          });
        }

      ],bddone);
    });

  });
});


