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
        userModule.createNewUser({id:2,name:"me again"},function (){
        });
      }).should.throw();
      bddone();
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
      testutil.clearDB(bddone);
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

    describe('trigger welcome email',function() {
      beforeEach(function (bddone){

        testutil.importData({user:[{OSMUser:"WelcomeMe",email:"none"},
                                   {OSMUser:"InviteYou",email:"invite@mail.org"}]},bddone);
      });
      it('should send out an email when changing email',function (bddone){
        userModule.findOne({OSMUser:"WelcomeMe"},function(err,user){
          // First set a new EMail Adress for the WecomeMe user, by InviteYou.
          user.setAndSave("InviteYou",{email:"WelcomeMe@newemail.org"}, function (err){
            should.not.exist(err);
            setTimeout(function (){
              should(typeof(mailReceiver.for_test_only.transporter.sendMail)).eql("function");
              should(mailReceiver.for_test_only.transporter.sendMail.called).be.True();
              var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
              var code = user.emailValidationKey;
              var expectedMail = "<h2>Welcome </h2><p>InviteYou has invited you to OSMBC. (May be he just changed your EMail adress in OSMBC)\nYou can login to OSMBC with your OpenStreetMap credentials via OAuth.</p><p><a href=\"https://testosm.bc/osmbc.html\">OSMBC</a> is the tool for the international WeeklyOSM and the German Wochennotiz Team to collaborate writing and translating the weekly news.\nSomeone has invited you to join. You can login with your OpenStreetMap credentials, and the above link.</p><p>If you would like to use this email address for OSMBC click on this link: <a href=\"https://testosm.bc/usert/1?validation="+code+"\">Link To Click On.</a></p><p>If you would like to check your User Settings go to<a href=\"https://testosm.bc/usert/1\">User Settings </a>.</p><p>Thanks for supporting Weekly & Wochennotiz.</p><p>Have fun with OSMBC. </p><p>Christoph (TheFive).</p>";
              var expectedText = 'WELCOME\nInviteYou has invited you to OSMBC. (May be he just changed your EMail adress in\nOSMBC) You can login to OSMBC with your OpenStreetMap credentials via OAuth.\n\nOSMBC [https://testosm.bc/osmbc.html] is the tool for the international WeeklyOSM and the German Wochennotiz Team to\ncollaborate writing and translating the weekly news. Someone has invited you to\njoin. You can login with your OpenStreetMap credentials, and the above link.\n\nIf you would like to use this email address for OSMBC click on this link: Link To Click On.\n[https://testosm.bc/usert/1?validation='+code+']\n\nIf you would like to check your User Settings go to User Settings [https://testosm.bc/usert/1] .\n\nThanks for supporting Weekly & Wochennotiz.\n\nHave fun with OSMBC.\n\nChristoph (TheFive).';

              should(result.html).eql(expectedMail);
              should(result.text).eql(expectedText);
              should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
                {from:"noreply@gmail.com",
                to:"WelcomeMe@newemail.org",
                subject:"Welcome to OSMBC",
                html:expectedMail,
                text:expectedText});

              // Email is send out, now check email Verification first with wrong code
              user.validateEmail({OSMUser:"WelcomeMe"},"wrong code",function(err){
                should(err).eql(new Error("Wrong Validation Code for EMail for user >WelcomeMe<"));

                user.validateEmail({OSMUser:"Not Me"},code,function(err){
                  should(err).eql(new Error("Wrong User: expected >WelcomeMe< given >Not Me<"));
                  // and now with correct code
                  user.validateEmail({OSMUser:"WelcomeMe"},code,function(err){
                    should.not.exist(err);
                    should(user.email).eql("WelcomeMe@newemail.org");
                    should.not.exist(user.emailValidationKey);
                    bddone();
                  });

                });

              });              
            },500);

          });
        });
      });
    });   
  });
});

