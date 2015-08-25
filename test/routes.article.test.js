var sinon = require('sinon');
var should = require('should');
var async  = require('async');
var path   = require('path');
var fs     = require('fs');


var articleModule = require('../model/article.js');
var articleRouter = require('../routes/article.js');

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
            should.not.exist(err);
            console.log(next.called);
            console.log(res.render.called);
            should(next.called).be.true();
            should(res.render.called).be.false();
            bddone();            
          }
        )
      })
    })
    describe('Do file base tests',function() {
      beforeEach(function (bddone) {
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
              articleModule.findOne({title:data.testArticleName},function(err,result) {
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

              article.textHtml = data.result.articleText;
              should(renderData.article).eql(article);
              if(typeof(renderData.params.edit)=='undefined') renderData.params.edit = null;
              should(renderData.params).eql(data.result.params);
              should(renderData.user).eql(req.user);
              should(renderData.changes).eql(data.result.changes);
              should(renderData.listofOpenBlogs).eql(data.result.listOfOpenBlogs)
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
})