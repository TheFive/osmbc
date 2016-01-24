

var pg     = require('pg');
var async  = require('async');
var should = require('should');
var path   = require('path');
var debug  = require('debug')('OSMBC:test:user.test');

var config = require('../config.js');
var sinon  = require('sinon');

var testutil = require('./testutil.js');

var userModule = require('../model/user.js');
var logModule = require('../model/logModule.js');
var mailReceiver= require('../notification/mailReceiver.js');






describe('model/user', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  }) 

  describe('createNewUser',function() {
    it('should createNewUser with prototype',function(bddone) {
      var newUser = userModule.createNewUser({name:"user"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("usert",id,function(err,result){
          should.not.exist(err);
          should(result.name).equal('user');
          bddone();
        })
      })
    });
    it('should createNewUser without prototype',function(bddone) {
      var newUser = userModule.createNewUser(function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("usert",id,function(err,result){
          should.not.exist(err);
          bddone();
        })
      });
    })
    it('should create no New User with ID',function(bddone){
      (function() {
        var newUser = userModule.createNewUser({id:2,name:"me again"},function (err,result){
        })
      }).should.throw();
      bddone();
    })
  })
  describe('findFunctions',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full"},cb)},
        function c2(cb) {userModule.createNewUser({OSMUser:"Test",access:"denied"},cb)},
        function c3(cb) {userModule.createNewUser({OSMUser:"Test2",access:"full"},
                         function(err,result){
                          should.not.exist(err);
                          idToFindLater = result.id;
                          cb(err);
                         })}

        ],function(err) {
          should.not.exist(err);
          bddone();
        });
    })
    describe('find',function() {
      it('should find multiple objects with sort',function(bddone){
        userModule.find({access:"full"},{column:"OSMUser"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].id;
          delete result[1]._meta;
          delete result[1].id;
          should(result[0]).eql({OSMUser:"Test2",access:"full",version:1});
          should(result[1]).eql({OSMUser:"TheFive",access:"full",version:1});
          bddone();
        })
      })
    })
    describe('findOne',function() {
      it('should findOne object with sort',function(bddone){
        userModule.findOne({OSMUser:"Test"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({OSMUser:"Test",access:"denied",version:1});
          bddone();
        })
      })
    })
    describe('findById',function() {
      it('should find saved Object',function(bddone){
        userModule.findById(idToFindLater,function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({OSMUser:"Test2",access:"full",version:1});
          bddone();
        })
      })
    })
  })
  describe('setAndSave',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    }) 
    it('should set only the one Value in the database', function (bddone){
      var newUser;
      userModule.createNewUser({OSMUser:"Test",access:"full"},function(err,result){
        should.not.exist(err);
        newUser = result;
        var id =result.id;
        newUser.access = "not logged";
        newUser.setAndSave("user",{version:"1",OSMUser:"Test2",access:"not logged"},function(err,result) {
          should.not.exist(err);
          testutil.getJsonWithId("usert",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,access:"not logged",OSMUser:"Test2",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(1);
              var r0id = result[0].id;
              var t0 = result[0].timestamp;
              var now = new Date();
              var t0diff = ((new Date(t0)).getTime()-now.getTime());
         
              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(result[0]).eql({id:r0id,timestamp:t0,oid:id,user:"user",table:"usert",property:"OSMUser",from:"Test",to:"Test2"});
              bddone();
            })
          })
        })
      })
    })    
    it('should ignore unchanged Values', function (bddone){
      var newUser;
      userModule.createNewUser({OSMUser:"Test",access:"full"},function(err,result){
        should.not.exist(err);
        newUser = result;
        var id =result.id;
        var empty;
        var changeValues = {}
        changeValues.OSMUser = newUser.OSMUser;
        changeValues.access = newUser.access;
        changeValues.version = "1";
        newUser.setAndSave("user",changeValues,function(err,result) {
          should.not.exist(err);
          testutil.getJsonWithId("usert",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,OSMUser:"Test",access:"full",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(0);
              bddone();
            })
          })
        })
      })
    }) 
    describe('trigger welcome email',function() {
      var oldtransporter;
      beforeEach(function (bddone){
        var oldtransporter = mailReceiver.for_test_only.transporter.sendMail;
        mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"})});

        testutil.importData({user:[{OSMUser:"WelcomeMe",email:"none"},
                                   {OSMUser:"InviteYou",email:"invite@mail.org"}]},bddone);
      });
      afterEach(function (bddone){
        mailReceiver.for_test_only.transporter.sendMail = oldtransporter;
        bddone();
      });
      it('should send out an email when changing email',function (bddone){
        userModule.findOne({OSMUser:"WelcomeMe"},function(err,user){
          user.setAndSave("InviteYou",{email:"WelcomeMe@newemail.org"},function (err){
            should.not.exist(err);
            should(typeof(mailReceiver.for_test_only.transporter.sendMail)).eql("function");
            should(mailReceiver.for_test_only.transporter.sendMail.called).be.True();
            bddone();
          })
        });
      });
    });   
  })
})
