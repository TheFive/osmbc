"use strict";

var async  = require('async');
var should = require('should');
var path   = require('path');
var fs     = require('fs');
var sinon  = require('sinon');


var testutil = require('./testutil.js');

var logModule     = require('../model/logModule.js');
var blogModule    = require('../model/blog.js');
var mailReceiver  = require('../notification/mailReceiver.js'); 







describe('model/blog', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
    process.env.TZ = 'Europe/Amsterdam';
  });

  describe('createNewBlog',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    }) ;
    it('should createNewArticle with prototype',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},{name:"test",status:"open"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("blog",id,function(err,result){
          should.not.exist(err);
          should(result.name).equal('test');
          should(result.status).equal('open');
          var start = new Date();
          var end = new Date();
          start.setDate(start.getDate()+1);
          end.setDate(end.getDate()+7);


          should(new Date(result.startDate).toLocaleDateString()).equal(start.toLocaleDateString());
          should(new Date(result.endDate).toLocaleDateString()).equal(end.toLocaleDateString());
          bddone();
        });
      });
    });
    it('should createNewArticle without prototype',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("blog",id,function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.name).equal('WN251');
          bddone();
        });
      });
    });
    it('should createNewArticle with existing WN',function(bddone) {
      blogModule.createNewBlog({OSMUser:"test"},
                               {name:"WN100",endDate:new Date("1.1.2000")},
                               function(err,result){

        should.not.exist(err);
        should.exist(result);
        result.save(function(err) {
          should.not.exist(err);
          blogModule.createNewBlog({OSMUser:"test"},function (err,result){
            should.not.exist(err);
            var id = result.id;
            testutil.getJsonWithId("blog",id,function(err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.name).equal('WN101');
              should(new Date(result.startDate).toLocaleDateString()).eql(new Date("2000-01-02").toLocaleDateString());
              should(new Date(result.endDate).toLocaleDateString()).eql(new Date("2000-01-08").toLocaleDateString());
              bddone();
            });
          });       

        });
      });
    });
    it('should create no New Article with ID',function(bddone){
      (function() {
        blogModule.createNewBlog({OSMUser:"test"},{id:2,name:"test",status:"**"},function (){

        });
      }).should.throw();
      bddone();
    });
  });
  describe('isEditable',function(){
    it('should be editable if no review or closed state',function(){
      var newBlog = blogModule.create({id:2,name:"test",status:"**"});
      should(newBlog.isEditable("DE")).be.True();
    });
    it('should be editable if review state (exported Set)',function(){
      var newBlog = blogModule.create({id:2,name:"test",status:"**",reviewCommentDE:["comment"],exportedDE:true});
      should(newBlog.isEditable("DE")).be.False();
    });
    it('should be editable if no review and closed state',function(){
      var newBlog = blogModule.create({id:2,name:"test",status:"**",reviewCommentEN:["comment"],closeEN:true});
      should(newBlog.isEditable("EN")).be.False();
    });
    it('should be editable if reopened',function(){
      var newBlog = blogModule.create({id:2,name:"test",status:"**",reviewCommentDE:["comment"],closeDE:false});
      should(newBlog.isEditable("DE")).be.True();
    });
    it('should handle an review by error with reopening (with review in WP)',function(cb){
      // Please ensure, that "DE" is in ReviewInWP in config
      var newBlog = blogModule.create({name:"test",status:"**"});
      async.series([
          function (cb1) {newBlog.save(cb1);},
          function (cb1) {
            blogModule.findOne({name:"test"},function(err,result){newBlog = result;cb1(err);});},
          function (cb1) {
            should(newBlog.isEditable("DE")).be.True();
            newBlog.setReviewComment("DE",{OSMUser:"Test"},"startreview",cb1);},
          function (cb1) {
            blogModule.find({name:"test"},function(err,result){
              should(result.length).eql(1);
              newBlog = result[0];
              cb1(err);
            });
          },
          function (cb2) {
            should(newBlog.isEditable("DE")).be.False();
            newBlog.closeBlog("DE","Test",true,cb2);},
          function (cb1) {
            should(newBlog.isEditable("DE")).be.False();
            blogModule.findOne({name:"test"},function(err,result){newBlog = result;cb1(err);});},
          function (cb3) {newBlog.closeBlog("DE","Test",false,cb3);},
          function (cb1) {
            blogModule.findOne({name:"test"},function(err,result){newBlog = result;cb1(err);});}
        ],function final(err){
          should.not.exist(err);
          should(newBlog.isEditable("DE")).be.True();
          should.not.exist(newBlog.reviewCommentDE);
          cb();
        }
      );
    });
    it('should handle an review by error with reopening (without review in WP)',function(cb){
      // Please ensure, that "EN" is not in ReviewInWP in config
      var newBlog = blogModule.create({name:"test",status:"**"});
      async.series([
          function (cb1) {newBlog.save(cb1);},
          function (cb1) {blogModule.findOne({name:"test"},function(err,result){newBlog = result;cb1(err);});},
          function (cb1) {
            should(newBlog.isEditable("EN")).be.True();
            newBlog.setReviewComment("EN",{OSMUser:"Test"},"startreview",cb1);},
          function (cb1) {blogModule.findOne({name:"test"},function(err,result){newBlog = result;cb1(err);});},
          function (cb2) {
            should(newBlog.isEditable("EN")).be.True();
            newBlog.setReviewComment("EN",{OSMUser:"Test"},"markexported",cb2);},
          function (cb1) {
            should(newBlog.isEditable("EN")).be.False();
            blogModule.findOne({name:"test"},function(err,result){newBlog = result;cb1(err);});},
          function (cb1) {
            should(newBlog.isEditable("EN")).be.False();
            blogModule.findOne({name:"test"},function(err,result){newBlog = result;cb1(err);});},
          function (cb3) {newBlog.closeBlog("EN","Test",false,cb3);},
          function (cb1) {
            blogModule.findOne({name:"test"},function(err,result){newBlog = result;cb1(err);});}
        ],function final(err){
          should.not.exist(err);
          should(newBlog.isEditable("EN")).be.True();
          should.not.exist(newBlog.reviewCommentDE);
          cb();
        }
      );
    });
  });
  describe('setAndSave',function() {
    before(function (bddone) {
      testutil.clearDB(bddone);
    }); 
    it('should set only the one Value in the database', function (bddone){
      blogModule.createNewBlog({OSMUser:"test"},{name:"Title",status:"TEST"},function(err,newBlog){
        should.not.exist(err);
        should.exist(newBlog);
        var id =newBlog.id;
        newBlog.name = "New Title";
        newBlog.setAndSave({OSMUser:"user"},{status:"published",field:"test"},function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("blog",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            delete result.categories;
            delete result.startDate;
            delete result.endDate;
            should(result).eql({id:id,name:"New Title",status:"published",field:"test",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(6);
              delete result[1].id;
              delete result[5].id;
              var t0 = result[2].timestamp;
              var t1 = result[5].timestamp;
              var now = new Date();
              var t0diff = ((new Date(t0)).getTime()-now.getTime());
              var t1diff = ((new Date(t1)).getTime()-now.getTime());

              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(t1diff).be.below(10);
              delete result[1].timestamp;
              delete result[5].timestamp;

              should(result).containEql(logModule.create({oid:id,blog:"New Title",user:"user",table:"blog",property:"status",from:"TEST",to:"published"}));
              should(result).containEql(logModule.create({oid:id,blog:"New Title",user:"user",table:"blog",property:"field",to:"test"}));
              bddone();
            });
          });
        });
      });
    });
    describe('trigger info email',function() {
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
          should(call.calledThrice).be.True();
          var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
          var expectedMail = '<h2>Blog WN251 changed.</h2><p>Blog <a href="https://testosm.bc/blog/WN251">WN251</a> was changed by testuser</p><table><tr><th>Key</th><th>Value</th></tr><tr><td>name</td><td>WN251</td></tr><tr><td>status</td><td>open</td></tr><tr><td>startDate</td><td>1970-01-02T00:00:00.000Z</td></tr><tr><td>endDate</td><td>1970-01-08T00:00:00.000Z</td></tr></table>';
          var expectedText = 'BLOG WN251 CHANGED.\nBlog WN251 [https://testosm.bc/blog/WN251] was changed by testuser\n\nKey Value name WN251 status open startDate 1970-01-02T00:00:00.000Z endDate 1970-01-08T00:00:00.000Z';

          //result is not sorted, so have a preview, which argument is the right one.
          var mailList = {};
          mailList[call.getCall(0).args[0].to]="-";
          mailList[call.getCall(1).args[0].to]="-";
          mailList[call.getCall(2).args[0].to]="-";
          should(mailList).eql({"user1@mail.bc":"-","user2@mail.bc":"-","user3@mail.bc":"-"});
          delete call.getCall(0).args[0].to;
          delete call.getCall(1).args[0].to;
          delete call.getCall(2).args[0].to;

  


          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
            {from:"noreply@gmail.com",
            subject:"WN251 was created",
            html:expectedMail,
            text:expectedText});
          should(mailReceiver.for_test_only.transporter.sendMail.getCall(1).args[0]).eql(
            {from:"noreply@gmail.com",
            subject:"WN251 was created",
            html:expectedMail,
            text:expectedText});
          should(mailReceiver.for_test_only.transporter.sendMail.getCall(2).args[0]).eql(
            {from:"noreply@gmail.com",
            subject:"WN251 was created",
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
            should(call.calledThrice).be.True();
            var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
            var expectedMail = '<h2>Blog WN251 changed.</h2><p>Blog <a href="https://testosm.bc/blog/WN251">WN251</a> was changed by testuser</p><table><tr><th>Key</th><th>Value</th></tr><tr><td>status</td><td>edit</td></tr></table>';
            var expectedText ='BLOG WN251 CHANGED.\nBlog WN251 [https://testosm.bc/blog/WN251] was changed by testuser\n\nKey Value status edit';
            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
           //result is not sorted, so have a preview, which argument is the right one.
            var mailList = {};
            mailList[call.getCall(0).args[0].to]="-";
            mailList[call.getCall(1).args[0].to]="-";
            mailList[call.getCall(2).args[0].to]="-";
            should(mailList).eql({"user1@mail.bc":"-","user2@mail.bc":"-","user3@mail.bc":"-"});
            delete call.getCall(0).args[0].to;
            delete call.getCall(1).args[0].to;
            delete call.getCall(2).args[0].to;
           should(mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0]).eql(
              {from:"noreply@gmail.com",
              subject:"WN251 changed status to edit",
              html:expectedMail,
              text:expectedText});
            should(mailReceiver.for_test_only.transporter.sendMail.getCall(1).args[0]).eql(
              {from:"noreply@gmail.com",
              subject:"WN251 changed status to edit",
              html:expectedMail,
              text:expectedText});
            should(mailReceiver.for_test_only.transporter.sendMail.getCall(2).args[0]).eql(
              {from:"noreply@gmail.com",
              subject:"WN251 changed status to edit",
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
                subject:"blog(ES) has been reviewed by user testuser",
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
                subject:"blog(ES) is exported to WordPress",
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
                subject:"blog(ES) is exported to WordPress",
                html:expectedMail,
                text:expectedText});
            bddone();
          });
        });
      });
    });
  });
  describe('closeBlog',function() {
    before(function (bddone) {
      testutil.clearDB(bddone);
      process.env.TZ = 'Europe/Amsterdam';
    }); 

    it('should close the Blog and write a log Message', function (bddone){
      blogModule.createNewBlog({OSMUser:"test"},{name:"Title",status:"TEST"},function(err,newBlog){
        should.not.exist(err);
        should.exist(newBlog);
        var id =newBlog.id;
        newBlog.closeBlog("DE","user",true,function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("blog",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            delete result.categories;
            delete result.startDate;
            delete result.endDate;
            should(result).eql({id:id,name:"Title",status:"TEST",closeDE:true,version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(5);
              delete result[0].id;
              var t0 = result[0].timestamp;
              var now = new Date();
              var t0diff = ((new Date(t0)).getTime()-now.getTime());
        
              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              delete result[0].timestamp;
        
              should(result).containEql(logModule.create({oid:id,blog:"Title",user:"user",table:"blog",property:"closeDE",to:true}));
              bddone();
            });
          });
        });
      });
    });
  });
  describe('reviewComment',function() {
    before(function (bddone) {
      testutil.clearDB(bddone);
      process.env.TZ = 'Europe/Amsterdam';
    }) ;
    it('should review the Blog and write a log Message', function (bddone){
      blogModule.createNewBlog({OSMUser:"test"},{name:"Title",status:"TEST"},function(err,newBlog){
        should.not.exist(err);
        should.exist(newBlog);
        var id =newBlog.id;
        newBlog.setReviewComment("DE",{OSMUser:"user"},"it is approved.",function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("blog",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            delete result.categories;
            delete result.startDate;
            delete result.endDate;
            var now = new Date();
            var t0 = result.reviewCommentDE[0].timestamp;
            var t0diff = ((new Date(t0)).getTime()-now.getTime());
            should(t0diff).be.below(10);

            should(result.reviewCommentDE[0].text).equal("it is approved.");
            should(result.reviewCommentDE[0].user).equal("user");
            delete result.reviewCommentDE;
            should(result).eql({id:id,name:"Title",status:"TEST",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(5);
              for (var i=0;i<result.length;i++) {
                delete result[i].id;
                delete result[i].timestamp;
              }

              should(result).containEql(logModule.create({oid:id,blog:"Title",user:"user",table:"blog",property:"reviewCommentDE",to:"it is approved.",from:"Add"}));
              bddone();
            });
          });
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
        function c1(cb) {blogModule.createNewBlog({OSMUser:"test"},{name:"WN1",status:"open",startDate:"2015-01-01",endDate:"2016-01-01"},cb);},
        function c2(cb) {blogModule.createNewBlog({OSMUser:"test"},{name:"WN2",status:"open",startDate:"2015-01-01",endDate:"2016-01-01"},cb);},
        function c3(cb) {blogModule.createNewBlog({OSMUser:"test"},{name:"WN3",status:"finished",startDate:"2015-01-01",endDate:"2016-01-01"},
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
        blogModule.find({status:"open"},{column:"name"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].categories;
          delete result[0].id;
          delete result[0].startDate;
          delete result[0].endDate;
          delete result[1]._meta;
          delete result[1].categories;
          delete result[1].id;
          delete result[1].startDate;
          delete result[1].endDate;
          should(result[0]).eql({name:"WN1",status:"open",version:1});
          should(result[1]).eql({name:"WN2",status:"open",version:1});
          bddone();
        });
      });
    });
    describe('findOne',function() {
      it('should findOne object with sort',function(bddone){
        blogModule.findOne({status:"open"},{column:"name"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.categories;
          delete result.id;
          should(result.name).eql("WN1");
          should(result.status).eql("open");
          should(result.version).eql(1);
          should(new Date(result.startDate).toLocaleDateString()).equal(new Date("2015-01-01").toLocaleDateString());
          should(new Date(result.endDate).toLocaleDateString()).equal(new Date("2016-01-01").toLocaleDateString());

          bddone();
        });
      });
    });
    describe('findById',function() {
      it('should find saved Object',function(bddone){
        blogModule.findById(idToFindLater,function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.categories;
          delete result.id;
          should(result).eql({name:"WN3",status:"finished",version:1,startDate:"2015-01-01",endDate:"2016-01-01"});
          bddone();
        });
      });
    });
  });
 
  describe('getPreview',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    function doATest(filename) {
     
      it('should handle testfile '+filename,function (bddone) {
        var file =  path.resolve(__dirname,'data', filename);
        var data =  JSON.parse(fs.readFileSync(file));
       
        var blog;
        var html;
        var articles;

        async.series([
          function(done) {
            testutil.importData(data,done);
          },
          function(done) {
            blogModule.findOne({name:data.testBlogName},function(err,result) {
              should.not.exist(err);
              blog = result;
              should.exist(blog);
              done();
            }) ;        
          } ,
          function(done) {
            blog.getPreview(data.style,"user",function(err,result){
              should.not.exist(err);
              html = result.preview;
              articles = result.articles;
              done();
            });
          }

          ],
          function (err) {
            should.not.exist(err);

            var htmlResult = data.testBlogResultHtml;

            try {
              // try to read file content,
              // if it fails, use the allready defined value
              var file =  path.resolve(__dirname,'data', htmlResult);
              htmlResult =  fs.readFileSync(file,"utf-8");
            }
            catch (err) {/* ignore the error */}
            var result = testutil.domcompare(html,htmlResult);



            if (result.getDifferences().length>0) {
              console.log("---------Result:----------");
              console.log(html);
              console.log("---------expected Result:----------");
              console.log(htmlResult);

              should.not.exist(result.getDifferences());
            }
            bddone();
          }
        );   
      });
    }
    testutil.generateTests("data",/^model.blog.getPreview.+json/,doATest);
  });  
  describe('autoCloseBlog',function(){

    it('should close a blog and create a new',function(bddone){
      var time = (new Date()).toISOString();
      var dataBefore = {blog:[
              {name:"WN1",status:"open",startDate:"2015-01-01",endDate:time},
              {name:"WN2",status:"edit",startDate:"2015-01-01",endDate:"2016-01-01"},
              {name:"WN3",status:"finished",startDate:"2015-01-01",endDate:"2016-01-01"}]};
      var dataAfter = {blog:[
              {name:"WN1",status:"edit",startDate:"2015-01-01",endDate:time},
              {name:"WN2",status:"edit",startDate:"2015-01-01",endDate:"2016-01-01"},
              {name:"WN3",status:"finished",startDate:"2015-01-01",endDate:"2016-01-01"},
              {name:"WN4",status:"open",startDate:(new Date("2016-01-02")).toISOString(),endDate:(new Date("2016-01-08")).toISOString()}]};
      var testFunction = function testFunction(cb) {
        blogModule.autoCloseBlog(cb);
      };        
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);
    });
    it('should close 2 blog and not create new if there is one open and should not be started twice',function(bddone){
      var time = (new Date()).toISOString();
      var dataBefore = {blog:[
              {name:"WN0",status:"open",startDate:"2015-01-01",endDate:time},
              {name:"WN1",status:"open",startDate:"2015-01-01",endDate:time},
              {name:"WN2",status:"open",startDate:"2015-01-01",endDate:"2099-01-01"},
              {name:"WN3",status:"finished",startDate:"2015-01-01",endDate:"2016-01-01"}]};
      var dataAfter = {blog:[
              {name:"WN0",status:"edit",startDate:"2015-01-01",endDate:time},
              {name:"WN1",status:"edit",startDate:"2015-01-01",endDate:time},
              {name:"WN2",status:"open",startDate:"2015-01-01",endDate:"2099-01-01"},
              {name:"WN3",status:"finished",startDate:"2015-01-01",endDate:"2016-01-01"}]};
      var testFunction = function testFunction(cb) {
        async.parallel([
          blogModule.autoCloseBlog,
          blogModule.autoCloseBlog,
          ], function (err){
            should.not.exist(err);
            cb();
          });
      };        
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    }); 
    it('should not close a blog if it is not time',function(bddone){
      var timein2sec = new Date();
      timein2sec.setTime(timein2sec.getTime()+2000);
      var time = timein2sec.toISOString();
      var dataBefore = {blog:[
              {name:"WN1",status:"open",startDate:"2015-01-01",endDate:time},
              {name:"WN2",status:"edit",startDate:"2015-01-01",endDate:"2016-01-01"},
              {name:"WN3",status:"finished",startDate:"2015-01-01",endDate:"2016-01-01"}]};
      var dataAfter = {blog:[
              {name:"WN1",status:"open",startDate:"2015-01-01",endDate:time},
              {name:"WN2",status:"edit",startDate:"2015-01-01",endDate:"2016-01-01"},
              {name:"WN3",status:"finished",startDate:"2015-01-01",endDate:"2016-01-01"}]};
      var testFunction = function testFunction(cb) {
        blogModule.autoCloseBlog(cb);
      };        
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    }); 
  });
});
