"use strict";

var async  = require('async');
var should = require('should');

var sinon  = require('sinon');

var testutil = require('./testutil.js');

var userModule = require('../model/user.js');
var logModule = require('../model/logModule.js');
var mailReceiver= require('../notification/mailReceiver.js');






describe('model/user', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  }); 
  describe('createNewUser',function() {
    it('should createNewUser with prototype',function(bddone) {
      userModule.createNewUser({name:"user"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("usert",id,function(err,result){
          should.not.exist(err);
          should(result.name).equal('user');
          bddone();
        });
      });
    });
    it('should createNewUser without prototype',function(bddone) {
      userModule.createNewUser(function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("usert",id,function(err){
          should.not.exist(err);
          bddone();
        });
      });
    });
    it('should create no New User with ID',function(bddone){
      (function() {
        userModule.createNewUser({id:2,OSMUser:"me again"},function (){
        });
      }).should.throw();
      bddone();
    });
    it('should create no New User with existing name',function(bddone){
      userModule.createNewUser({OSMUser:"TestUser"},function (err){
        should.not.exist(err);
        userModule.createNewUser({OSMUser:"TestUser"},function(err){
          should.exist(err);
          should(err.message).eql("User >TestUser< already exists.");
          bddone();
        });
      });
    });
  });
  describe('findFunctions',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full"},cb);},
        function c2(cb) {userModule.createNewUser({OSMUser:"Test",access:"denied"},cb);},
        function c3(cb) {userModule.createNewUser({OSMUser:"Test2",access:"full"},
                         function(err,result){
                          should.not.exist(err);
                          idToFindLater = result.id;
                          cb(err);
                         });}

        ],function(err) {
          should.not.exist(err);
          bddone();
        });
    });
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
        });
      });
    });
    describe('findOne',function() {
      it('should findOne object with sort',function(bddone){
        userModule.findOne({OSMUser:"Test"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({OSMUser:"Test",access:"denied",version:1});
          bddone();
        });
      });
    });
    describe('findById',function() {
      it('should find saved Object',function(bddone){
        userModule.findById(idToFindLater,function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({OSMUser:"Test2",access:"full",version:1});
          bddone();
        });
      });
    });
  });
  describe('setAndSave',function() {
    var oldtransporter;
    beforeEach(function (bddone) {
      oldtransporter = mailReceiver.for_test_only.transporter.sendMail;
      mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"});});
      testutil.importData({clear:true,
                            user:[{OSMUser:"WelcomeMe",email:"none"},
                                  {OSMUser:"InviteYou",email:"invite@mail.org"}]},bddone);
    }) ;
    afterEach(function (bddone){
      mailReceiver.for_test_only.transporter.sendMail = oldtransporter;
      bddone();
    });
    it('should set only the one Value in the database', function (bddone){
      var newUser;
      userModule.createNewUser({OSMUser:"Test",access:"full"},function(err,result){
        should.not.exist(err);
        newUser = result;
        var id =result.id;
        newUser.access = "not logged";
        newUser.setAndSave("user",{version:1,OSMUser:"Test2",access:"not logged"},function(err) {
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

              // There should be no mail
              should(mailReceiver.for_test_only.transporter.sendMail.called).be.False();
              bddone();
            });
          });
        });
      });
    }); 
    it('should ignore unchanged Values', function (bddone){
      var newUser;
      userModule.createNewUser({OSMUser:"Test",access:"full"},function(err,result){
        should.not.exist(err);
        newUser = result;
        var id =result.id;
        var changeValues = {};
        changeValues.OSMUser = newUser.OSMUser;
        changeValues.access = newUser.access;
        changeValues.version = 1;
        newUser.setAndSave("user",changeValues,function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("usert",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,OSMUser:"Test",access:"full",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(0);

              // There should be no mail
              should(mailReceiver.for_test_only.transporter.sendMail.called).be.False();
              bddone();
            });
          });
        });
      });
    }); 
    it('should fail when change email by another user',function (bddone){
      userModule.findOne({OSMUser:"WelcomeMe"},function(err,user){
        // First set a new EMail Address for the WelcomeMe user, by InviteYou.
        user.setAndSave("InviteYou",{email:"WelcomeMe@newemail.org"}, function (err){
          should(err).eql(new Error("EMail address can only be changed by the user himself."));
          bddone();
        });
      });
    });
  });
});

