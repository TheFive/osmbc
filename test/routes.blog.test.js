"use strict";

var async = require('async');
var sinon = require('sinon');
var nock  = require('nock');
var should = require('should');

var testutil = require('../test/testutil.js');
var blogModule = require('../model/blog.js');

var blogRouter = require('../routes/blog.js');




describe('routes/blog',function() {
  beforeEach(function(bddone){
    testutil.clearDB(bddone);
  });
  before(function(bddone){
    nock('https://hooks.slack.com/')
            .post(/\/services\/.*/) 
            .times(999) 
            .reply(200,"ok");
    bddone();
  });
  after(function(bddone){
    nock.cleanAll();
    bddone();
  });

  describe('renderBlogPreview',function() {
    it('should call next if blog id not exist',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{title:"WN333"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = blog.id +1;
        var req = {};
        req.params = {};
        req.params.blog_id = newId;

        var res = {};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            blogRouter.renderBlogPreview(req,res,next);
          }],
          function(err) {
            should.exist(err);
            should(next.called).be.true();
            should(res.render.called).be.false();
            bddone();            
          }
        );
      });
    });
    it('should call next if blog name not exist',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{title:"WN333"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN332";
        var req = {};
        req.params = {};
        req.params.blog_id = newId;
        var res = {};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            blogRouter.renderBlogPreview(req,res,next);
          }],
          function(err) {
            should.exist(err);
            should(next.called).be.true();
            should(res.render.called).be.false();
            bddone();            
          }
        );
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
          var req = {};
          req.params = {};
          req.params.blog_id = newId;
          var res = {};
          var next;

          async.series([
            function(callback) {
              res.render = sinon.spy(callback);
              next = sinon.spy(callback);
              blogRouter.renderBlogPreview(req,res,next);
            }],
            function(err) {
              should.exist(err);
              should(next.called).be.true();

              should(res.render.called).be.false();
              var call = next.firstCall;
              should(call.args[0].message).equal("Blog >WN333< exists twice, internal id of first: 1");

              bddone();            
            }
          );
        });
      });
    });
    it('should render a blog Preview',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{name:"WN333",startDate:"2015-12-12T00:00:00",endDate:"2015-12-13T00:00:00"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN333";
        var req = {};
        req.params = {};
        req.params.blog_id = newId;
        req.query = {};
        req.session = {articleReturnTo:"returnToUrlXX"};
        var next;
        var res = {rendervar:{layout:"calculated layout"}};

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            blogRouter.renderBlogPreview(req,res,next);
          }],
          function(result) {
            should(result).equal('blogpreview');
            should(next.called).be.False();

            should(res.render.called).be.True();
            var call = res.render.firstCall;
            var v = call.args[1];


            should(v.preview).equal('<p>12.12.2015-13.12.2015</p>\n<p align="right"><i>Diese Wochennotiz wurde erstellt von .</i></p>');
            should(v.blog.id).equal(blog.id);
            should(v.layout).equal("calculated layout");
            //should(v.articles.length).equal(0);
            should(v.lang).equal("DE");
            should(v.returnToUrl).equal("returnToUrlXX");

      
            bddone();            
          }
        );
      },true); // do not create additional articles
    });
  });
  describe('renderBlogId',function() {
    it('should call next if blog id not exist',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{title:"WN333"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = blog.id +1;
        var req = {};
        req.params = {};
        req.params.blog_id = newId;
        req.session = {};
        req.user = {};
        req.query = {};

        var res = {};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            blogRouter.renderBlogId(req,res,next);
          }],
          function(err) {
            should.exist(err);
            should(next.called).be.true();
            should(res.render.called).be.false();
            bddone();            
          }
        );
      });
    });
    it('should call next if blog name not exist',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{title:"WN333"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN332";
        var req = {};
        req.params = {};
        req.params.blog_id = newId;
        req.session = {};
        req.user = {};
        req.query = {};
        var res = {};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            blogRouter.renderBlogId(req,res,next);
          }],
          function(err) {
            should.exist(err);
            should(next.called).be.true();
            should(res.render.called).be.false();
            bddone();            
          }
        );
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
          var req = {};
          req.params = {};
          req.params.blog_id = newId;
          req.session = {};
          req.query = {};
          req.user = {};
          var res = {};
          var next;

          async.series([
            function(callback) {
              res.render = sinon.spy(callback);
              next = sinon.spy(callback);
              blogRouter.renderBlogId(req,res,next);
            }],
            function(err) {
              should.exist(err);
              should(next.called).be.true();

              should(res.render.called).be.false();
              var call = next.firstCall;
              should(call.args[0].message).equal("Blog >WN333< exists twice, internal id of first: 1");

              bddone();            
            }
          );
        });
      });
    });
    it('should render a blog for TRANSLATION',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{name:"WN333",startDate:"2015-12-12T00:00:00",endDate:"2015-12-13T00:00:00"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN333";
        var req = {};
        req.params = {};
        req.params.blog_id = newId;
        req.query = {style:"TRANSLATE"};
        req.user = {};
        req.session = {articleReturnTo:"returnToUrlXX"};

        var res = {rendervar:{layout:"calculated layout"}};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            blogRouter.renderBlogId(req,res,next);
          }],
          function(result) {
            should(result).eql("blog");
            should(next.called).be.False();

            should(res.render.called).be.True();
            var call = res.render.firstCall;
            var v = call.args[1];

            should(v.blog.id).equal(blog.id);
            should(v.layout).equal("calculated layout");
            should(v.main_text).equal("<p>12.12.2015-13.12.2015</p>\n<!--         place picture here              -->\n<ul>\n<div style=\"width: ##width##px\" class=\"wp-caption alignnone\"> \n<mark>No Title <a href=\"/article/2?style=TRANSLATE\"><span class=\"glyphicon glyphicon-eye-open\"></span></a> <a href=\"/article/2?style=TRANSLATE&edit=true\"><span class=\"glyphicon glyphicon-edit\"></span></a>\n</mark></div>\n</ul>\n<h2 id=\"wn333_wochenvorschau\">Wochenvorschau</h2>\n<ul>\n<p><mark>No Title <a href=\"/article/1?style=TRANSLATE\"><span class=\"glyphicon glyphicon-eye-open\"></span></a> <a href=\"/article/1?style=TRANSLATE&edit=true\"><span class=\"glyphicon glyphicon-edit\"></span></a>\n</mark></p>\n<p>Hinweis:<br />\nWer seinen Termin hier in der Liste sehen möchte, <a href=\"https://wiki.openstreetmap.org/wiki/Template:Calendar\">trage</a> ihn in den <a href=\"https://wiki.openstreetmap.org/wiki/Current_events\">Kalender</a> ein. Nur Termine, die dort stehen, werden in die Wochennotiz übernommen.</p></ul>\n");


      
            bddone();            
          }
        );
      });
    });
  });
 /*describe('Render Blog ID File Based',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    function doATest(filename) {
     
      it('should handle testfile '+filename,function (bddone) {
        var file =  path.resolve(__dirname,'data', filename);
        var data =  JSON.parse(fs.readFileSync(file));
       
        var blog;
        var md;
        var html;
        var articles;

        var res;

        async.series([
          function(done) {
            testutil.importData(data,done);
          },
          function callRenderBlogId(callback) {
            var req = {};
            req.params = {};
            req.params.blog_id = data.testBlogName;
            req.query = {};
            if (data.style) req.query.style = data.style;
            req.user = {};
            req.session = {articleReturnTo:"returnToUrlXX"};

            res = {rendervar:{layout:"calculated layout"}};
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            blogRouter.renderBlogId(req,res,next);
          }
          ],
          function (call) {
            should(call).equal("blog");
            should(res.render.called).be.True();
            var call = res.render.firstCall;
            var v = call.args[1];


            should(v.blog.name).equal(data.testBlogName);
            should(v.layout).equal("calculated layout");
            should(v.main_text).equal(data.result.main_text);
            for (var i = 0;i<data.result.changes.length;i++) {
              should(v.change[i].user)=data.result.changes[i].user;
              should(v.change[i].from)=data.result.changes[i].from;
              should(v.change[i].to)=data.result.changes[i].to;
            }
           
            should(v.style).equal(data.result.style);
            should(v.left_lang).equal(data.result.left_lang);
            should(v.right_lang).equal(data.result.right_lang);


   
            bddone();
          }
        )   
      })
    }
    testutil.generateTests("data",/^router.blog.renderBlogId.+json/,doATest);
  })*/  
});