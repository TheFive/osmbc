var sinon = require('sinon');
var should = require('should');
var async  = require('async');

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
  })
})