var async = require('async');
var sinon = require('sinon');
var should = require('should');
var userRouter = require('../routes/users.js');
var userModule = require('../model/user.js');
var testutil = require('./testutil.js');


describe('router/user',function() {
  describe('createUser ',function() {
    beforeEach(function(bddone){
      testutil.clearDB(bddone);
    });
    it('should call create an user',function(bddone) {
      var req = {};

      var res = {};
      var next;
      var article_id;

      async.series([
        function(callback) {
          res.redirect = sinon.spy(function (value) {callback();})
          next = sinon.spy(callback);
          userRouter.createUser(req,res,next);
        },
        function searchArticle(callback) {
          userModule.findOne({},{},function(err,result){
            should.not.exist(err);
            should.exist(result);
            user_id = result.id;
            callback();
          })
        }

        ],
        function(err) {
          should.not.exist(err);
          should(next.called).be.false();
          should(res.redirect.called).be.true();
          console.dir(res.redirect.firstCall.args[0]);
          should(res.redirect.firstCall.calledWith("/users/"+user_id+"?edit=true")).be.true();
          bddone();            
        }
      )
    })
  })
})