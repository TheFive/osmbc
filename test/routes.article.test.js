var sinon = require('sinon');
var should = require('should');
var async  = require('async');
var path   = require('path');
var fs     = require('fs');

var blogModule    = require('../model/blog.js');
var articleModule = require('../model/article.js');

var articleRouter = require('../routes/article.js');
var util = require('../util.js');

var testutil = require('./testutil.js');


describe('router/article',function() {
  
  beforeEach(function (bddone) {
    // Clear DB Contents for each test
    testutil.clearDB(bddone);
  }) 
  describe('renderArticleId',function() {
    it('should call next if article not exist',function(bddone) {
      articleModule.createNewArticle({titel:"Hallo"},function(err,article) {
        should.not.exist(err);
        should(article.id).not.equal(0);
        var newId = article.id +1;
        var req = {};
        req.params = {};
        req.params.id = newId;
        var res = {};

        async.series([
          function(callback) {
            res.render = sinon.spy(callback)
            next = sinon.spy(callback);
            articleRouter.renderArticleId(req,res,next);
          }],
          function(err) {
            should.exist(err);
            should(next.called).be.true();
            should(res.render.called).be.false();
            bddone();            
          }
        )
      })
    })
    describe('Do file base tests',function() {
      beforeEach(function (bddone) {
        articleModule.removeOpenBlogCache();
        testutil.clearDB(bddone);
      })
      function doATest(filename) {
       
        it('should test: '+filename,function (bddone) {
          var file =  path.resolve(__dirname,'data', filename);

          var data =  JSON.parse(fs.readFileSync(file));
         
          var md;
          var html;
          var article;
          var res = {};
          var req = {};
          req.params ={};
          req.query = {};
          req.user = "TestUser";
          var next;
          res.render = null;

          async.series([
            function(done) {
              testutil.importData(data,done);
            },
            function(done) {
              // search for the test Article
              articleModule.findOne({title:data.testArticleTitle},function(err,result) {
                should.not.exist(err);
                article = result;
                req.params.article_id = result.id;
                done();
              })         
            } ,
            function(done) {
              // do the test
              res.render = sinon.spy(function(){done()});
              next = sinon.spy(function(){done()});

              articleRouter.renderArticleId(req,res,next);
            }

            ],
            function (err) {
              should.not.exist(err);
              should(next.called).be.false();

              var call = res.render.firstCall;
              should(call.calledWith("article")).be.true();
              var renderData = call.args[1];


              // clean up test data for comparison, Database IDs are random
              for (var i =0;i<renderData.changes.length; i++) delete renderData.changes[i].id;
              for (i=0;i<data.result.changes.length;i++) data.result.changes[i].oid = req.params.article_id;
              article.textHtml = data.result.articleText;
              should(renderData.article).eql(article);
              if(typeof(renderData.params.edit)=='undefined') renderData.params.edit = null;
              should(renderData.params).eql(data.result.params);
              should(renderData.user).eql(req.user);
              should(renderData.changes).eql(data.result.changes);
              should.exist(renderData.listOfOrphanBlog);
              should(renderData.listOfOrphanBlog).eql(data.result.listOfOrphanBlog);
              should.exist(renderData.listOfOpenBlog);
              should(renderData.listOfOpenBlog).eql(data.result.listOfOpenBlog);
              // Reduce article Refererences for comparison
              for (var k in renderData.articleReferences) {
                if (k=="count") continue;
                var a= renderData.articleReferences[k];
                for (var i=0;i<a.length;i++) {
                  delete a[i]._meta;
                  delete a[i].id;
                }
              }
              should(renderData.articleReferences).eql(data.result.articleReferences);
              should(renderData.usedLinks).eql(data.result.usedLinks);
              should(renderData.categories).eql(data.result.categories);

 
              bddone();
            }
          )   
        })
      }
      testutil.generateTests("data",/^router.article.renderArticleId.+json/,doATest);
    })     
  })
  describe('list',function() {
    describe('Do file base tests',function() {
      beforeEach(function (bddone) {
        testutil.clearDB(bddone);
      })
      function doATest(filename) {
       
        it('should test: '+filename,function (bddone) {
          var file =  path.resolve(__dirname,'data', filename);

          var data =  JSON.parse(fs.readFileSync(file));
         
          var articles;
          var res = {};
          var req = {};
          req.params ={};
          req.query = {};
          req.user = "TestUser";
          var next;
          res.render = null;

          var query = {};
          if (data.listBlog) {
            query.blog = data.listBlog;
            req.query.blog=data.listBlog;
          }

          async.series([
            function(done) {
              testutil.importData(data,done);
            },

            function(done) {
              // do the test
              res.render = sinon.spy(function(){done()});
              next = sinon.spy(function(){done()});

              articleRouter.renderList(req,res,next);
            }

            ],
            function (err) {
              should.not.exist(err);
              should(next.called).be.false();



              var call = res.render.firstCall;
              should(call.calledWith("articlelist")).be.true();
              var renderData = call.args[1];


              should(renderData.articles.length).equal(data.result.articles.length);
              for (var i=0;i<renderData.articles.length;i++) {
                delete renderData.articles[i]._meta;
                delete renderData.articles[i].id;
              }
              should(renderData.articles).eql(data.result.articles);

              should(renderData.listofOrphanBlogs).eql(data.result.listOfOrphanBlogs);
              should(renderData.util).equal(util);
              should(renderData.user).eql(req.user);

 
              bddone();
            }
          )   
        })
      }
      testutil.generateTests("data",/^router.article.list.+json/,doATest);
    })     
  })
  describe('postArticleID',function() {
    it('should call next if article not exist',function(bddone) {
      articleModule.createNewArticle({titel:"Hallo"},function(err,article) {
        should.not.exist(err);
        should(article.id).not.equal(0);
        var newId = article.id +1;
        var req = {};
        req.params = {};
        req.params.article_id = newId;
        req.user = {displayName:"test"};
        req.body = {};
        var res = {};

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            res.redirect = sinon.spy(callback);
            articleRouter.postArticle(req,res,next);
          }],
          function(err) {
            should.exist(err);
            should(res.render.called).be.false();
            should(res.redirect.called).be.false();
            should(next.called).be.true();
            bddone();            
          }
        )
      })
    })
    it('should post All Values',function(bddone) {
      articleModule.createNewArticle({title:"Hallo"},function(err,article) {
        should.not.exist(err);
        should(article.id).not.equal(0);
        var req = {};
        req.params = {};
        req.params.article_id = article.id;
        req.body = {markdown:"MARKDOWN",
                   markdownEN:"MARKDOWNEN",
                   blog:"BLOG",
                   blogEN:"BLOGEN",
                   collection:"COLLECTION",
                   comment:"COMMENT",
                   category:"CATEGORY",
                   categoryEN:"CATEGORYEN",
                   version:"1",
                   title:"TITLE"}
        req.user = {displayName:"TESTUSER"};
        var res = {};
        var next;


        async.series([
          function(callback) {
            res.redirect = sinon.spy(function (value) {callback();})
            next = sinon.spy(callback);
            articleRouter.postArticle(req,res,next);
          },
          function(callback) {
            articleModule.findById(article.id,function(err,result){
              should.not.exist(err);
              article = result;
              callback();
            })
          }
          ],
          function(err) {
            should.not.exist(err);
            should(res.redirect.calledOnce).be.true();
            should(next.called).be.false();
            should(res.redirect.firstCall.calledWith("/article/"+article.id)).be.true();
            delete article._meta;
            delete article.id;
            should(article).eql({markdown:"MARKDOWN",
                   markdownEN:"MARKDOWNEN",
                   blog:"BLOG",
                   blogEN:"BLOGEN",
                   collection:"COLLECTION",
                   comment:"COMMENT",
                   category:"CATEGORY",
                   categoryEN:"CATEGORYEN",
                   title:"TITLE",version:2})
            bddone();            
          }
        )
      })
    })
  })
  describe('createArticle ',function() {
    it('should call create an article whith given blog and category',function(bddone) {
      var req = {};
      req.query = {blog:"WN234",category:"TEST"};

      var res = {};
      var next;
      var article_id;




      async.series([
        function(callback) {
          res.redirect = sinon.spy(function (value) {callback();})
          res.render = sinon.spy(function (value) {callback();})
          next = sinon.spy(callback);
          articleRouter.createArticle(req,res,next);
        }
        ],
        function(err) {
          should.not.exist(err);
          should(res.render.calledOnce).be.true();
          should(res.render.firstCall.calledWith("collect"));
          should(next.called).be.false();
          should(res.redirect.called).be.false();
          bddone();            
        }
      )
    })
  })
})