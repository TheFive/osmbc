"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var nock = require("nock");
var should  = require('should');
var request   = require('request');
var path = require('path');
var fs = require('fs');

var config = require('../config.js');

var configModule = require('../model/config.js');
var blogModule   = require('../model/blog.js');
var userModule   = require('../model/user.js');





describe('views/blog', function() {
  let baseLink;
  var data;
  describe('export',function(){
    before(function(bddone) {
      var file =  path.resolve(__dirname,'data', "views.blog.export.1.json");
      data =  JSON.parse(fs.readFileSync(file));
      baseLink = 'http://localhost:' + config.getServerPort() + config.getValue("htmlroot");
      nock('https://hooks.slack.com/')
        .post(/\/services\/.*/)
        .times(999)
        .reply(200,"ok");

      process.env.TZ = 'Europe/Amsterdam';
      async.series([
        testutil.importData.bind(null,data),
        testutil.startServer.bind(null,"USER1"),
        configModule.initialise
      ],bddone);


    });
    after(function(){
      nock.cleanAll();
      testutil.stopServer();
    });
    it('should generate preview as html',function(bddone){

      async.series([

        function(cb){
          var opts = {
            url: baseLink+"/blog/"+data.blogName+"/preview?lang=DE&download=true", method: 'get'
          };
          request(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            let file =  path.resolve(__dirname,'data', "views.blog.export.1.html");
            let expectation =  fs.readFileSync(file,"UTF8");

            var result = testutil.domcompare(body,expectation);



            if (result.getDifferences().length>0) {
              console.log("---------Result:----------");
              console.log(body);
              console.log("---------expected Result:----------");
              console.log(expectation);

              should.not.exist(result.getDifferences());
            }
            cb();
          });
        }
      ],bddone);
    });
    it('should generate preview as markdown',function(bddone){

      async.series([

        function(cb){
          var opts = {
            url: baseLink+"/blog/"+data.blogName+"/preview?lang=DE&markdown=true&download=true", method: 'get'
          };
          request(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            let file =  path.resolve(__dirname,'data', "views.blog.export.1.md");
            let expectation =  fs.readFileSync(file,"UTF8");

            should(body).eql(expectation);
            cb();
          });
        }
      ],bddone);
    });
  });
  describe('status Functions',function(){
    beforeEach(function(bddone) {
      baseLink = 'http://localhost:' + config.getServerPort() + config.getValue("htmlroot");
      nock('https://hooks.slack.com/')
        .post(/\/services\/.*/)
        .times(999)
        .reply(200,"ok");

      process.env.TZ = 'Europe/Amsterdam';
      async.series([
        testutil.importData.bind(null,{clear:true,blog:[{name:"blog"}],user:[{OSMUser:"TheFive",access:"full",mainLang:"DE"}]}),
        testutil.startServer.bind(null,"TheFive"),
        configModule.initialise
      ],bddone);


    });
    afterEach(function(){
      nock.cleanAll();
      testutil.stopServer();
    });
    it('should close a blog',function(bddone){

      async.series([

        function(cb){
          var opts = {
            url: baseLink+"/blog/blog?setStatus=closed",
            method: 'get',
            headers:{
              Referer: baseLink+"/blog/blog"
            }
          };
          request(opts, function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            blogModule.findOne({name:"blog"},function(err,blog){
              should.not.exist(err);
              should(blog.status).eql("closed");
              cb();
            });
          });
        }
      ],bddone);
    });
    it('should start a review',function(bddone){

      async.series([

        function(cb){
          var opts = {
            url: baseLink+"/blog/blog?reviewComment=startreview",
            method: 'get',
            headers:{
              Referer: baseLink+"/blog/blog"
            }
          };
          request(opts, function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            blogModule.findOne({name:"blog"},function(err,blog){
              should.not.exist(err);
              should(blog.reviewCommentDE).eql([]);
              // in test mode review is done in WP in DE Language, so the export is set too
              should(blog.exportedDE).be.True();
              cb();
            });
          });
        }
      ],bddone);
    });
  });
  describe('browser tests',function(){
    var browser;
    before(function(bddone) {
      nock('https://hooks.slack.com/')
        .post(/\/services\/.*/)
        .times(999)
        .reply(200,"ok");
      async.series([
        testutil.importData.bind(null,JSON.parse(fs.readFileSync(path.join(__dirname,"data","DataWN280.json"),"UTF8"))),
        function createUser(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full"},cb); },
        testutil.startServer.bind(null,"TheFive")
      ], function(err) {
        browser=testutil.getBrowser();
        bddone(err);
      });
    });
    after(function(){
      testutil.stopServer();
    });
    describe("Admin Homepage",function() {
      it('should show it' ,function(bddone) {
        this.timeout(6000);
        async.series([
          browser.visit.bind(browser,"/blog/WN280"),
          browser.assert.expectHtml.bind(browser,"blog_wn280_overview.html"),
          browser.visit.bind(browser,"/blog/WN280?tab=full"),
          browser.assert.expectHtml.bind(browser,"blog_wn280_full.html"),
          browser.visit.bind(browser,"/blog/WN280?tab=review"),
          browser.assert.expectHtml.bind(browser,"blog_wn280_review.html")
        ],bddone);
      });
    });
  });
});