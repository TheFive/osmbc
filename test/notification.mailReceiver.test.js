"use strict";



var should = require('should');
var sinon  = require('sinon');
var nock   = require('nock');


var testutil = require('./testutil.js');

var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');
var userModule    = require('../model/user.js');

var mailReceiver  = require('../notification/mailReceiver.js');

var messageCenter = require('../notification/messageCenter.js');




messageCenter.initialise();


describe('notification/mailReceiver', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
    nock('https://hooks.slack.com/')
            .post(/\/services\/.*/) 
            .times(999) 
            .reply(200,"ok");
  }); 

  after(function (bddone){
    nock.cleanAll();
    bddone();
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
      testutil.importData({clear:true,
                           user:[{OSMUser:"User1",email:"user1@mail.bc",access:"full",mailNewCollection:"true"},
                                 {OSMUser:"User2",email:"user2@mail.bc",access:"full",mailAllComment:"true"},
                                 {OSMUser:"User3",email:"user3@mail.bc",access:"full",mailComment:["DE","User3"]},
                                 {OSMUser:"User4",email:"user4@mail.bc",access:"full"},
                                 {OSMUser:"User5",                     access:"full",mailAllComment:"true"},
                                 {OSMUser:"User6",                     access:"full",mailBlogStatusChange:"true"}]},bddone);
    });
    it('should send out mail, when collecting article',function (bddone){
      articleModule.createNewArticle(function(err,article){
        article.setAndSave({OSMUser:"testuser"},{blog:"WN789",collection:"newtext",title:"Test Title"},function(err) {
          setTimeout(function (){
            should.not.exist(err);
            should(mailReceiver.for_test_only.transporter.sendMail.callCount).eql(1);
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
    it('should send out mail, when adding comment. (old Format)',function (bddone){
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
    it('should send out mail, when changing comment (old format)',function (bddone){
      articleModule.createNewArticle(function(err,article){
        should.not.exist(err);
        article.setAndSave({OSMUser:"testuser"},{blog:"WN789",comment:"Information for none"},function(err) {
          should.not.exist(err);
          article.setAndSave({OSMUser:"testuser"},{comment:"Information for none and for @User3"},function(err) {
            should.not.exist(err);
            should(mailReceiver.for_test_only.transporter.sendMail.calledThrice).be.True();

            // First Mail Check
            var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
            var expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">NO TITLE</a> was changed by testuser </p><h3>blog was added</h3><p>WN789</p><h3>comment was added</h3><p>Information for none</p><h3>commentStatus was added</h3><p>open</p>';
            var expectedText = 'CHANGE IN ARTICLE OF WN789\nArticle NO TITLE [https://testosm.bc/article/1] was changed by testuser\n\nBLOG WAS ADDED\nWN789\n\nCOMMENT WAS ADDED\nInformation for none\n\nCOMMENTSTATUS WAS ADDED\nopen';
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
            expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">NO TITLE</a> was changed by testuser </p><h3>comment was changed</h3><p>Information for none and for @User3</p>';
            expectedText = 'CHANGE IN ARTICLE OF WN789\nArticle NO TITLE [https://testosm.bc/article/1] was changed by testuser\n\nCOMMENT WAS CHANGED\nInformation for none and for @User3';
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
            expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">NO TITLE</a> was changed by testuser </p><h3>comment was changed</h3><p>Information for none and for @User3</p>';
            expectedText = 'CHANGE IN ARTICLE OF WN789\nArticle NO TITLE [https://testosm.bc/article/1] was changed by testuser\n\nCOMMENT WAS CHANGED\nInformation for none and for @User3';

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
    it('should send out mail, when adding a comment',function (bddone){
      articleModule.createNewArticle({blog:"WN278",title:"To Add A Comment"},function(err,article){
        should.not.exist(err);
        article.addComment({OSMUser:"testuser"},"Information for none",function(err) {
          should.not.exist(err);

          should(mailReceiver.for_test_only.transporter.sendMail.calledOnce).be.True();

          // First Mail Check
          var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
          var expectedMail = '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for none</p>';
          var expectedText = 'CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser\n\nCOMMENT WAS ADDED\nInformation for none';
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(result).eql(
            {from:"noreply@gmail.com",
              to:"user2@mail.bc",
              subject:"[TESTBC] WN278 comment: To Add A Comment",
              html:expectedMail,
              text:expectedText});
          bddone();
        });
      });
    });
    it('should send out mail, when changing a comment',function (bddone){
      articleModule.createNewArticle({blog:"WN278",title:"To Add A Comment"},function(err,article){
        should.not.exist(err);
        article.addComment({OSMUser:"testuser"},"Information for none",function(err) {
          should.not.exist(err);
          article.editComment({OSMUser:"testuser"},0,"Information for @user3",function(err) {
            should.not.exist(err);

            should(mailReceiver.for_test_only.transporter.sendMail.calledThrice).be.True();

            // First Mail Check
            var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
            var expectedMail = '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for none</p>';
            var expectedText = 'CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser\n\nCOMMENT WAS ADDED\nInformation for none';
            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
            should(result).eql(
              {
                from: "noreply@gmail.com",
                to: "user2@mail.bc",
                subject: "[TESTBC] WN278 comment: To Add A Comment",
                html: expectedMail,
                text: expectedText
              });
            // Second Mail Check
            result = mailReceiver.for_test_only.transporter.sendMail.getCall(1).args[0];
            expectedMail = '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was changed</h3><p>Information for @user3</p>';
            expectedText = 'CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser\n\nCOMMENT WAS CHANGED\nInformation for @user3';
            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
            should(result).eql(
              {
                from: "noreply@gmail.com",
                to: "user2@mail.bc",
                subject: "[TESTBC] WN278 comment: To Add A Comment",
                html: expectedMail,
                text: expectedText
              });
            // Third Mail Check
            result = mailReceiver.for_test_only.transporter.sendMail.getCall(2).args[0];
            expectedMail = '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was changed</h3><p>Information for @user3</p>';
            expectedText = 'CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser\n\nCOMMENT WAS CHANGED\nInformation for @user3';
            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
            should(result).eql(
              {
                from: "noreply@gmail.com",
                to: "user3@mail.bc",
                subject: "[TESTBC] WN278 comment: To Add A Comment",
                html: expectedMail,
                text: expectedText
              });

            bddone();
          });
        });
      });
    });
  });
  describe('blogs',function() {
    var oldtransporter;
    afterEach(function (bddone){
      mailReceiver.for_test_only.transporter.sendMail = oldtransporter;
      this.clock.restore();
      bddone();
    });

    beforeEach(function (bddone){
      this.clock = sinon.useFakeTimers();
      oldtransporter = mailReceiver.for_test_only.transporter.sendMail;
      mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"});});
      testutil.importData({clear:true,
        user:[{OSMUser:"User1",email:"user1@mail.bc",access:"full",mailBlogStatusChange:"true"},
          {OSMUser:"User2",email:"user2@mail.bc",access:"full",mailBlogStatusChange:"true"},
          {OSMUser:"User3",email:"user3@mail.bc",access:"full",mailBlogLanguageStatusChange:["EN","ES"]},
          {OSMUser:"User4",email:"user4@mail.bc",access:"full"},
          {OSMUser:"User5",                     access:"full",mailBlogStatusChange:"true"}]},bddone);
    });
    it('should send out mail when creating a blog',function (bddone){
      blogModule.createNewBlog({OSMUser:"testuser"},function(err){
        should.not.exist(err);
        var call = mailReceiver.for_test_only.transporter.sendMail;

        should(call.calledTwice).be.True();
        var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
        var expectedMail = '<h2>Blog WN251 changed.</h2><p>Blog <a href="https://testosm.bc/blog/WN251">WN251</a> was changed by testuser</p><table><tr><th>Key</th><th>Value</th></tr><tr><td>name</td><td>WN251</td></tr><tr><td>status</td><td>open</td></tr><tr><td>startDate</td><td>1970-01-02T00:00:00.000Z</td></tr><tr><td>endDate</td><td>1970-01-08T00:00:00.000Z</td></tr></table>';
        var expectedText = 'BLOG WN251 CHANGED.\nBlog WN251 [https://testosm.bc/blog/WN251] was changed by testuser\n\nKey Value name WN251 status open startDate 1970-01-02T00:00:00.000Z endDate 1970-01-08T00:00:00.000Z';

        //result is not sorted, so have a preview, which argument is the right one.
        var mailList = {};
        mailList[call.getCall(0).args[0].to]="-";
        mailList[call.getCall(1).args[0].to]="-";
        should(mailList).eql({"user1@mail.bc":"-","user2@mail.bc":"-"});
        delete call.getCall(0).args[0].to;
        delete call.getCall(1).args[0].to;




        should(result.html).eql(expectedMail);
        should(result.text).eql(expectedText);
        should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
          {from:"noreply@gmail.com",
            subject:"[TESTBC] WN251 was created",
            html:expectedMail,
            text:expectedText});
        should(mailReceiver.for_test_only.transporter.sendMail.getCall(1).args[0]).eql(
          {from:"noreply@gmail.com",
            subject:"[TESTBC] WN251 was created",
            html:expectedMail,
            text:expectedText});
        bddone();
      });
    });
    it('should send out mail when change blog status',function (bddone){
      blogModule.createNewBlog({OSMUser:"testuser"},function(err,blog){
        should.not.exist(err);
        // reset sinon spy:
        mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"});});
        blog.setAndSave({OSMUser:"testuser"},{status:"edit"},function(err){
          should.not.exist(err);
          var call = mailReceiver.for_test_only.transporter.sendMail;
          should(call.calledTwice).be.True();
          var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
          var expectedMail = '<h2>Blog WN251 changed.</h2><p>Blog <a href="https://testosm.bc/blog/WN251">WN251</a> was changed by testuser</p><table><tr><th>Key</th><th>Value</th></tr><tr><td>status</td><td>edit</td></tr></table>';
          var expectedText ='BLOG WN251 CHANGED.\nBlog WN251 [https://testosm.bc/blog/WN251] was changed by testuser\n\nKey Value status edit';
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          //result is not sorted, so have a preview, which argument is the right one.
          var mailList = {};
          mailList[call.getCall(0).args[0].to]="-";
          mailList[call.getCall(1).args[0].to]="-";
          should(mailList).eql({"user1@mail.bc":"-","user2@mail.bc":"-"});
          delete call.getCall(0).args[0].to;
          delete call.getCall(1).args[0].to;
          should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
            {from:"noreply@gmail.com",
              subject:"[TESTBC] WN251 changed status to edit",
              html:expectedMail,
              text:expectedText});
          should(mailReceiver.for_test_only.transporter.sendMail.getCall(1).args[0]).eql(
            {from:"noreply@gmail.com",
              subject:"[TESTBC] WN251 changed status to edit",
              html:expectedMail,
              text:expectedText});
          bddone();
        });
      });
    });
    it('should send out mail when review status is set',function (bddone){
      blogModule.createNewBlog({OSMUser:"testuser"},{name:"blog",status:"edit"},function(err,blog){
        should.not.exist(err);
        // reset sinon spy:
        mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"});});
        blog.setReviewComment("ES",{OSMUser:"testuser"},"I have reviewed",function(err){
          should.not.exist(err);

          should(mailReceiver.for_test_only.transporter.sendMail.calledOnce).be.True();
          var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
          var expectedMail = '<h2>Blog blog changed status for ES.</h2><p>Blog <a href="https://testosm.bc/blog/blog">blog</a> was changed by testuser</p><p>Review status was set to I have reviewed</p>';
          var expectedText = 'BLOG BLOG CHANGED STATUS FOR ES.\nBlog blog [https://testosm.bc/blog/blog] was changed by testuser\n\nReview status was set to I have reviewed';
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
            {from:"noreply@gmail.com",
              to:"user3@mail.bc",
              subject:"[TESTBC] blog(ES) has been reviewed by user testuser",
              html:expectedMail,
              text:expectedText});
          bddone();
        });
      });
    });
    it('should send out mail when review is marked as exported',function (bddone){
      blogModule.createNewBlog({OSMUser:"testuser"},{name:"blog",status:"edit"},function(err,blog){
        should.not.exist(err);
        // reset sinon spy:
        mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"});});
        blog.setReviewComment("ES",{OSMUser:"testuser"},"markexported",function(err){
          should.not.exist(err);

          should(mailReceiver.for_test_only.transporter.sendMail.calledOnce).be.True();
          var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
          var expectedMail = '<h2>Blog blog changed status for ES.</h2><p>Blog <a href="https://testosm.bc/blog/blog">blog</a> was changed by testuser</p><p>Review status was set to exported.</p>';
          var expectedText = 'BLOG BLOG CHANGED STATUS FOR ES.\nBlog blog [https://testosm.bc/blog/blog] was changed by testuser\n\nReview status was set to exported.';

          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
            {from:"noreply@gmail.com",
              to:"user3@mail.bc",
              subject:"[TESTBC] blog(ES) is exported to WordPress",
              html:expectedMail,
              text:expectedText});
          bddone();
        });
      });
    });
    it('should send out mail when blog is closed',function (bddone){
      blogModule.createNewBlog({OSMUser:"testuser"},{name:"blog",status:"edit"},function(err,blog){
        should.not.exist(err);
        // reset sinon spy:
        mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"});});
        blog.closeBlog("ES",{OSMUser:"testuser"},"true",function(err){
          should.not.exist(err);
          should(mailReceiver.for_test_only.transporter.sendMail.calledOnce).be.True();
          var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
          var expectedMail = '<h2>Blog blog was closed for ES.</h2><p>Blog <a href=\"https://testosm.bc/blog/blog\">blog</a>(ES) was closed by testuser.</p>';
          var expectedText = 'BLOG BLOG WAS CLOSED FOR ES.\nBlog blog [https://testosm.bc/blog/blog] (ES) was closed by testuser.';
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
            {from:"noreply@gmail.com",
              to:"user3@mail.bc",
              subject:"[TESTBC] blog(ES) has been closed by user testuser",
              html:expectedMail,
              text:expectedText});
          bddone();
        });
      });
    });
  });
  describe('users',function() {
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
    it('should send out an email when changing email',function (bddone){
      mailReceiver.for_test_only.transporter.sendMail = sinon.spy(function(obj,doit){ return doit(null,{response:"t"});});

      userModule.findOne({OSMUser:"WelcomeMe"},function(err,user){
        // First set a new EMail Adress for the WecomeMe user, by InviteYou.
        user.setAndSave("WelcomeMe",{email:"WelcomeMe@newemail.org"}, function (err){
          should.not.exist(err);
          setTimeout(function (){
            should(typeof(mailReceiver.for_test_only.transporter.sendMail)).eql("function");
            should(mailReceiver.for_test_only.transporter.sendMail.called).be.True();
            var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
            var code = user.emailValidationKey;
            var expectedMail = '<h2>Welcome </h2><p>You have entered your email adress in OSMBC.</p><p>If you would like to use this email address for OSMBC click on this link: <a href="https://testosm.bc/usert/1?validation='+code+'">LINK TO VALIDATE YOUR EMAIL</a>. This will lead you to your user settings.</p><p>If you would like to check your User Settings without accepting the new email go to <a href="https://testosm.bc/usert/1">User Settings </a>.</p><p>OSMBC has a wide range of email settings, read the description carefully, not to overfill your mail box.</p><p>Thanks for supporting weeklyOSM & Wochennotiz.</p><p>Have fun with OSMBC. </p><p>Christoph (TheFive).</p>';
            var expectedText = 'WELCOME\nYou have entered your email adress in OSMBC.\n\nIf you would like to use this email address for OSMBC click on this link: LINK TO VALIDATE YOUR EMAIL\n[https://testosm.bc/usert/1?validation='+code+'] . This will lead you to your user settings.\n\nIf you would like to check your User Settings without accepting the new email go\nto User Settings [https://testosm.bc/usert/1] .\n\nOSMBC has a wide range of email settings, read the description carefully, not to\noverfill your mail box.\n\nThanks for supporting weeklyOSM & Wochennotiz.\n\nHave fun with OSMBC.\n\nChristoph (TheFive).';

            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
            should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
              {from:"noreply@gmail.com",
                to:"WelcomeMe@newemail.org",
                subject:"[TESTBC] Welcome to OSMBC",
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
