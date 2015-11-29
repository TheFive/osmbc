var async = require('async');
var sinon = require('sinon');
var should = require('should');
var testutil = require('../test/testutil.js');
var blogModule = require('../model/blog.js');

var blogRouter = require('../routes/blog.js');




describe('routes/blog',function() {
  beforeEach(function(bddone){
    testutil.clearDB(bddone);
  })

  describe('renderBlogPreview',function() {
    it('should call next if blog id not exist',function(bddone) {
      blogModule.createNewBlog({title:"WN333"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = blog.id +1;
        var req = {};
        req.params = {};
        req.params.blog_id = newId;

        var res = {};

        async.series([
          function(callback) {
            res.render = sinon.spy(callback)
            next = sinon.spy(callback);
            blogRouter.renderBlogPreview(req,res,next);
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
    it('should call next if blog name not exist',function(bddone) {
      blogModule.createNewBlog({title:"WN333"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN332";
        var req = {};
        req.params = {};
        req.params.blog_id = newId;
        var res = {};

        async.series([
          function(callback) {
            res.render = sinon.spy(callback)
            next = sinon.spy(callback);
            blogRouter.renderBlogPreview(req,res,next);
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
    it('should call next if blog exists twice',function(bddone) {
      blogModule.createNewBlog({name:"WN333"},function(err,blog) {
        should.not.exist(err);
        blogModule.createNewBlog({name:"WN333"},function(err,blog2) {
          should.not.exist(err);
          should(blog.id).not.equal(0);
          var newId = "WN333";
          var req = {};
          req.params = {};
          req.params.blog_id = newId;
          var res = {};

          async.series([
            function(callback) {
              res.render = sinon.spy(callback)
              next = sinon.spy(callback);
              blogRouter.renderBlogPreview(req,res,next);
            }],
            function(err) {
              should.exist(err);
              should(next.called).be.true();

              should(res.render.called).be.false();
              var call = next.firstCall;
              should(call.args[0].message).equal("Blog >WN333< exists twice");

              bddone();            
            }
          )
        })
      })
    }) 
    it('should render a blog Preview',function(bddone) {
      blogModule.createNewBlog({name:"WN333",startDate:"2015-12-12T00:00:00",endDate:"2015-12-13T00:00:00"},function(err,blog) {
        should.not.exist(err);
        should(blog.id).not.equal(0);
        var newId = "WN333";
        var req = {};
        req.params = {};
        req.params.blog_id = newId;
        req.query = {};
        req.session = {articleReturnTo:"returnToUrlXX"};

        var res = {rendervar:{layout:"calculated layout"}};

        async.series([
          function(callback) {
            res.render = sinon.spy(callback)
            next = sinon.spy(callback);
            blogRouter.renderBlogPreview(req,res,next);
          }],
          function(result) {
            should(result).equal('blogpreview');
            should(next.called).be.False();

            should(res.render.called).be.True();
            var call = res.render.firstCall;
            var v = call.args[1];

            should(v.preview).equal('<p>12.12.2015-13.12.2015</p>\n<!--         place picture here              -->\n');
            should(v.blog.id).equal(blog.id);
            should(v.layout).equal("calculated layout");
            //should(v.articles.length).equal(0);
            should(v.lang).equal("DE");
            should(v.returnToUrl).equal("returnToUrlXX");

      
            bddone();            
          }
        )
      })
    })       
  })
})