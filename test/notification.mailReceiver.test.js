"use strict";
// Article createNewArticle
// create article with prototyp
// create Article without prototyp
// create article with ID (non existing in db, existing in DB)


var should = require('should');
var sinon  = require('sinon');


var testutil = require('./testutil.js');

var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');

var mailReceiver  = require('../notification/mailReceiver.js');







describe('notification/mailReceiver', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  }); 
  describe('articles',function() {
    var oldtransporter;
    afterEach(function (bddone){
      mailReceiver.for_test_only.transporter.sendMail = oldtransporter;
      bddone();
    });

    beforeEach(function (bddone){
      oldtransporter = mailReceiver.for_test_only.transporter.sendMail;
      mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"});});
      testutil.importData({user:[{OSMUser:"User1",email:"user1@mail.bc",access:"full",mailNewCollection:"true"},
                                 {OSMUser:"User2",email:"user2@mail.bc",access:"full",mailAllComment:"true"},
                                 {OSMUser:"User3",email:"user3@mail.bc",access:"full",mailComment:["DE","User3"]},
                                 {OSMUser:"User4",email:"user4@mail.bc",access:"full"},
                                 {OSMUser:"User5",                     access:"full",mailAllComment:"true"}]},bddone);
    });
    it('should send out mail, when collecting article',function (bddone){
      articleModule.createNewArticle(function(err,article){
        article.setAndSave({OSMUser:"testuser"},{blog:"WN789",collection:"newtext",title:"Test Title"},function(err) {
          setTimeout(function (){
            should.not.exist(err);
            should(mailReceiver.for_test_only.transporter.sendMail.calledOnce).be.True();
            var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
            var expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">Test Title</a> was changed by testuser </p><h3>blog was added</h3><p>WN789</p><h3>collection was added</h3><p>newtext</p><h3>title was added</h3><p>Test Title</p>';
            should(result.html).eql(expectedMail);
            should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
              {from:"noreply@gmail.com",
              to:"user1@mail.bc",
              subject:"[TESTBC] WN789 added: Test Title",
              html:expectedMail,
              text:"CHANGE IN ARTICLE OF WN789\nArticle Test Title [https://testosm.bc/article/1] was changed by testuser\n\nBLOG WAS ADDED\nWN789\n\nCOLLECTION WAS ADDED\nnewtext\n\nTITLE WAS ADDED\nTest Title"});


            bddone();

          },500);
        });
      });
    });
    it('should send out mail, when adding comment.',function (bddone){
      articleModule.createNewArticle(function(err,article){
        article.setAndSave({OSMUser:"testuser"},{blog:"WN789",comment:"Information for @User3"},function(err) {
          should.not.exist(err);
          should(mailReceiver.for_test_only.transporter.sendMail.calledTwice).be.True();

          // First Mail Check
          var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
          var expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">NO TITLE</a> was changed by testuser </p><h3>blog was added</h3><p>WN789</p><h3>comment was added</h3><p>Information for @User3</p><h3>commentStatus was added</h3><p>open</p>';
          should(result.html).eql(expectedMail);
          should(result).eql(
            {from:"noreply@gmail.com",
            to:"user2@mail.bc",
            subject:"[TESTBC] WN789 comment: undefined",
            html:expectedMail,
            text:"CHANGE IN ARTICLE OF WN789\nArticle NO TITLE [https://testosm.bc/article/1] was changed by testuser\n\nBLOG WAS ADDED\nWN789\n\nCOMMENT WAS ADDED\nInformation for @User3\n\nCOMMENTSTATUS WAS ADDED\nopen"});

          // Second Mail Check
          result = mailReceiver.for_test_only.transporter.sendMail.getCall(1).args[0];
          should(result.html).eql(expectedMail);
          should(result).eql(
            {from:"noreply@gmail.com",
            to:"user3@mail.bc",
            subject:"[TESTBC] WN789 comment: undefined",
            html:expectedMail,
            text:"CHANGE IN ARTICLE OF WN789\nArticle NO TITLE [https://testosm.bc/article/1] was changed by testuser\n\nBLOG WAS ADDED\nWN789\n\nCOMMENT WAS ADDED\nInformation for @User3\n\nCOMMENTSTATUS WAS ADDED\nopen"});


          bddone();
        });
      });
    });
    it('should send out mail, when changing comment.',function (bddone){
      articleModule.createNewArticle(function(err,article){
        should.not.exist(err);
        article.setAndSave({OSMUser:"testuser"},{blog:"WN789",comment:"Information for noone"},function(err) {
          should.not.exist(err);
          article.setAndSave({OSMUser:"testuser"},{comment:"Information for noone and for @User3"},function(err) {
            should.not.exist(err);
            should(mailReceiver.for_test_only.transporter.sendMail.calledThrice).be.True();

            // First Mail Check
            var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
            var expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">NO TITLE</a> was changed by testuser </p><h3>blog was added</h3><p>WN789</p><h3>comment was added</h3><p>Information for noone</p><h3>commentStatus was added</h3><p>open</p>';
            var expectedText = 'CHANGE IN ARTICLE OF WN789\nArticle NO TITLE [https://testosm.bc/article/1] was changed by testuser\n\nBLOG WAS ADDED\nWN789\n\nCOMMENT WAS ADDED\nInformation for noone\n\nCOMMENTSTATUS WAS ADDED\nopen';
            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
            should(result).eql(
              {from:"noreply@gmail.com",
              to:"user2@mail.bc",
              subject:"[TESTBC] WN789 comment: undefined",
              html:expectedMail,
              text:expectedText});
            // Second Mail Check
            result = mailReceiver.for_test_only.transporter.sendMail.getCall(1).args[0];
            expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">NO TITLE</a> was changed by testuser </p><h3>comment was changed</h3><p>Information for noone and for @User3</p>';
            expectedText = 'CHANGE IN ARTICLE OF WN789\nArticle NO TITLE [https://testosm.bc/article/1] was changed by testuser\n\nCOMMENT WAS CHANGED\nInformation for noone and for @User3';
            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
            should(result).eql(
              {from:"noreply@gmail.com",
              to:"user2@mail.bc",
              subject:"[TESTBC] WN789 comment: undefined",
              html:expectedMail,
              text:expectedText});

            // Third Mail Check
            
            result = mailReceiver.for_test_only.transporter.sendMail.getCall(2).args[0];
            expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">NO TITLE</a> was changed by testuser </p><h3>comment was changed</h3><p>Information for noone and for @User3</p>';
            expectedText = 'CHANGE IN ARTICLE OF WN789\nArticle NO TITLE [https://testosm.bc/article/1] was changed by testuser\n\nCOMMENT WAS CHANGED\nInformation for noone and for @User3';

            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
            should(result).eql(
              {from:"noreply@gmail.com",
              to:"user3@mail.bc",
              subject:"[TESTBC] WN789 comment: undefined",
              html:expectedMail,
              text:expectedText});


            bddone();
          });
        });
      });
    });
  }); 
});
