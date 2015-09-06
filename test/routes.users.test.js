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
  describe('postUserId',function() {
    it('should call save changed Values',function(bddone) {
      var req = {body:{OSMUser:"testNew",access:"full"},params:{},user:{displayName:"test"}};

      var res = {};
      var next;
      var user_id;
      var newUser;

      async.series([
        function createUser(callback) {
          userModule.createNewUser({},function(err,user){
            if (err) return callback(err);
            user_id = user.id;
            req.params.user_id = user_id;
            callback();
          })
        },
        function(callback) {
          res.redirect = sinon.spy(function (value) {callback();})
          next = sinon.spy(callback);
          userRouter.postUserId(req,res,next);
        },
        function searchArticle(callback) {
          userModule.findById(user_id,function(err,result){
            should.not.exist(err);
            should.exist(result);
            newUser = result;
            callback();
          })
        }

        ],
        function(err) {
          should.not.exist(err);
          should(newUser.OSMUser).equal("testNew");
          should(newUser.access).equal("full");
          should(next.called).be.false();
          should(res.redirect.called).be.true();
          should(res.redirect.firstCall.calledWith("/users/"+user_id)).be.true();
          bddone();            
        }
      )
    })
  })
})