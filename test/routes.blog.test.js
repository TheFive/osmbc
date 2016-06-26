"use strict";

var async = require('async');
var sinon = require('sinon');
var nock  = require('nock');
var should = require('should');
var request = require('request');
var config = require('../config');
var jade = require("jade");


var testutil = require('../test/testutil.js');
var blogModule = require('../model/blog.js');
var userModule = require('../model/user.js');
var mockdate = require('mockdate');

require('jstransformer-verbatim');





describe('routes/blog',function() {
  var user = null;
  var baseLink;
  var jadeSpy;
  beforeEach(function(bddone){


    async.series([
      testutil.clearDB,
      function cu(cb) {
        userModule.createNewUser({OSMUser:"TestUser",displayName:"TestUser",access:"full"},function (err,result){
          if (err) cb(err);
          user = result;
          cb();
        });
      }
    ],bddone);  });
  before(function(bddone){
    jadeSpy = sinon.spy(jade,"__express");

    nock('https://hooks.slack.com/')
            .post(/\/services\/.*/) 
            .times(999) 
            .reply(200,"ok");
    baseLink = 'http://localhost:' + config.getServerPort() + config.getValue("htmlroot");
    testutil.startServer("TestUser",bddone);
  });
  after(function(bddone){
    jade.__express.restore();
    nock.cleanAll();
    testutil.stopServer();
    bddone();
  });

  describe('status functions',function() {
    before(function(){
      mockdate.set(new Date("2016-05-25T20:00"));
    });
    after(function(){
      mockdate.reset();
    });

    it('should a start a review process', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err) {
        should.not.exist(err);
        request({
          method: "POST",
          url: baseLink + "/blog/WN333/setLangStatus",
          json: true,
          body: {lang: "DE", action: "startreview"}
        }, function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
          blogModule.findOne({name: "WN333"}, function (err, blog) {
            should.not.exist(err);
            should(blog.reviewCommentDE).eql([]);
            bddone();
          });
        });
      });
    });
    it('should mark as exported', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err) {
        should.not.exist(err);
        request({
          method: "POST",
          url: baseLink + "/blog/WN333/setLangStatus",
          json: true,
          body: {lang: "EN", action: "markexported"}
        }, function (err, res) {
          should.not.exist(err);
          should(res.statusCode).eql(302);
          blogModule.findOne({name: "WN333"}, function (err, blog) {
            should.not.exist(err);
            should(blog.exportedEN).eql(true);
            bddone();
          });
        });
      });
    });
    it('should not clear review when starting a review process', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"},
        {name: "WN333", reviewCommentDE: [{user: "hallo", text: "test"}]},
        function (err) {
          should.not.exist(err);
          request({
            method: "POST",
            url: baseLink + "/blog/WN333/setLangStatus",
            json: true,
            body: {lang: "DE", action: "startreview"}
          }, function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(302);
            blogModule.findOne({name: "WN333"}, function (err, blog) {
                should.not.exist(err);
                should(blog.reviewCommentDE).eql([{user: "hallo", text: "test"}]);
                bddone();
              }
            );
          }
        );
      });
    });
    it('should close a language', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"},
        {name: "WN333", reviewCommentDE: [{user: "hallo", text: "test"}]},
        function (err) {
          should.not.exist(err);
          request({
              method: "POST",
              url: baseLink + "/blog/WN333/setLangStatus",
              json: true,
              body: {lang: "DE", action: "closelang"}
            }, function (err, res) {
              should.not.exist(err);
              should(res.statusCode).eql(302);
              blogModule.findOne({name: "WN333"}, function (err, blog) {
                  should.not.exist(err);
                  should(blog.closeDE).eql(true);
                  bddone();
                }
              );
            }
          );
        });
    });
    it('should reopen a language', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"},
        {name: "WN333", reviewCommentDE: [{user: "hallo", text: "test"}]},
        function (err) {
          should.not.exist(err);
          request({
              method: "POST",
              url: baseLink + "/blog/WN333/setLangStatus",
              json: true,
              body: {lang: "DE", action: "editlang"}
            }, function (err, res) {
              should.not.exist(err);
              should(res.statusCode).eql(302);
              blogModule.findOne({name: "WN333"}, function (err, blog) {
                  should.not.exist(err);
                  should(blog.closeDE).eql(false);
                  should(blog.exportedDE).eql(false);
                  bddone();
                }
              );
            }
          );
        });
    });
    it('should set a review comment', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"},
        {name: "WN333", reviewCommentEN: [{user: "hallo", text: "test"}]},
        function (err) {
          should.not.exist(err);
          request({
            method: "POST",
            url: baseLink + "/blog/WN333/setReviewComment",
            json: true,
            body: {lang: "EN", text: "Everything is fine"}
          }, function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(302);
            blogModule.findOne({name: "WN333"}, function (err, blog) {
                should.not.exist(err);
                should(blog.reviewCommentEN).eql([
                  {user: "hallo", text: "test"},
                  {
                    text: 'Everything is fine',
                    timestamp: '2016-05-25T20:00:00.000Z',
                    user: 'TestUser'
                  }
                ]);
                bddone();
              }
            );
          });
        });
    });
  });
  describe('renderBlogPreview',function() {
    it('should call next if blog id not exist', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {title: "WN333"}, function (err, blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = blog.id + 1;
        request.get(baseLink + "/blog/" + newId + "/preview?lang=DE", function (err, res) {
          should(res.statusCode).eql(404);
          bddone();

        });
      });
    });
    it('should call next if blog name not exist', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {title: "WN333"}, function (err, blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN332";
        request.get(baseLink + "/blog/" + newId + "/preview?lang=DE", function (err, res) {
          should(res.statusCode).eql(404);
          bddone();
        });
      });
    });
    it('should call next if blog exists twice', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err, blog) {
        should.not.exist(err);
        blogModule.createNewBlog({OSMUser: "test"}, {name: "WN333"}, function (err, blog2) {
          should.not.exist(err);
          should.exist(blog2);
          should(blog.id).not.equal(0);
          request.get(baseLink + "/blog/WN333/preview?lang=DE", function (err, res) {
            should(res.statusCode).eql(500);
            bddone();
          });
        });
      });
    });
    it('should render a blog Preview', function (bddone) {
      blogModule.createNewBlog({OSMUser: "test"}, {
        name: "WN333",
        startDate: "2015-12-12T00:00:00",
        endDate: "2015-12-13T00:00:00"
      }, function (err, blog) {
        should.not.exist(err);
        should.exist(blog);
        should(blog.id).not.equal(0);
        request.get(baseLink + "/blog/WN333/preview?lang=DE", function (err, res) {
          should(res.statusCode).eql(200);
          var call = jadeSpy.lastCall;
          var v = call.args[1];
          should(v.blog.id).equal(blog.id);
          //should(v.articles.length).equal(0);
          should(v.lang).equal("DE");
          should(v.returnToUrl).equal("/blog/WN333/preview?lang=DE");
          should(v.preview).equal('<p>12.12.2015-13.12.2015</p>\n<!--         place picture here              -->\n<ul>\n<div style=\"width: ##width##px\" class=\"wp-caption alignnone\"> \nWN333 Picture\n</div>\n</ul>\n<h2 id=\"wn333_wochenvorschau\">Wochenvorschau</h2>\n<ul>\n<p>WN333 Upcoming Events\n</p>\n<p>Hinweis:<br />Wer seinen Termin hier in der Liste sehen möchte, <a href=\"https://wiki.openstreetmap.org/wiki/Template:Calendar\">trage</a> ihn in den <a href=\"https://wiki.openstreetmap.org/wiki/Current_events\">Kalender</a> ein. Nur Termine, die dort stehen, werden in die Wochennotiz übernommen.</p>\n</ul>\n<p align=\"right\"><i>Diese Wochennotiz wurde erstellt von .</i></p>\n');

          bddone();
        });

      });
    });
  });
  describe('renderBlogTab',function() {
    it('should call next if blog id not exist',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{title:"WN333"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = blog.id +1;

        request.get(baseLink+"/blog/"+newId+"/preview?lang=DE", function (err, res) {
          should(res.statusCode).eql(404);
          bddone();

        });
      });
    });
    it('should call next if blog name not exist',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{title:"WN333"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN332";
        request.get(baseLink+"/blog/"+newId+"/preview?lang=DE", function (err, res) {
          should(res.statusCode).eql(404);
          bddone();

        });
      });
    });
    it('should call next if blog exists twice',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{name:"WN333"},function(err,blog) {
        should.not.exist(err);
        blogModule.createNewBlog({OSMUser:"test"},{name:"WN333"},function(err,blog2) {
          should.not.exist(err);
          should.exist(blog2);
          should(blog.id).not.equal(0);
          var newId = "WN333";
          request.get(baseLink+"/blog/"+newId+"/preview?lang=DE", function (err, res) {
            should(res.statusCode).eql(500);
            bddone();

          });
        });
      });
    });
  });
});