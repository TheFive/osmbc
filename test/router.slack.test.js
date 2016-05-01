"use strict";

var should = require('should');
var slackRouter = require('../routes/slack.js');

describe('router/slack',function(){
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
  describe("undefined",function(){
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
});


