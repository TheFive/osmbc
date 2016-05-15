"use strict";



var async  = require('async');
var should = require('should');
var nock   = require('nock');
var debug  = require('debug')('OSMBC:test:article.test');
var sinon  = require('sinon');


var testutil = require('./testutil.js');

var articleModule = require('../model/article.js');
var logModule     = require('../model/logModule.js');
var blogModule    = require('../model/blog.js');
var messageCenter = require('../notification/messageCenter.js');










describe('model/article', function() {
  var testUser = {displayName:"user",OSMUser:"user"};
  var slackNock;
  before(function (bddone) {
   //nock all slack messages
   slackNock = nock('https://hooks.slack.com/')
                .post(/\/services\/.*/) 
                .times(999) 
                .reply(200,"ok");
    messageCenter.initialise();

    testutil.clearDB(bddone);
  }); 
  after(function (bddone){
    nock.cleanAll();
    bddone();
  });
  context('Article Constructor',function(){
    it('should create an Article object',function(){
      var article = articleModule.create({oid:"Test"});
      should(article.oid).eql("Test");
      should(typeof(article)).eql('object');
      should(article instanceof articleModule.Class).be.True();
    });
  });
  describe('getCommentMention',function() {
    function createArticleWithComment(comment1,comment2){
      var article = articleModule.create({markdown:"test"});
      article.commentList = [];
      article.commentList.push({user:"User",timestamp:new Date(),text:comment1});
      if(comment2) article.commentList.push({user:"User",timestamp:new Date(),text:comment2});
      return article;
    }
    it('should select language in correct case',function(){
      let a= createArticleWithComment("@DE should to something","Comment for @ES");
      should(a.getCommentMention("User","DE")).eql("language");
      should(a.getCommentMention("User","ES")).eql("language");
      should(a.getCommentMention("User","AT","ES")).eql("language");
      should(a.getCommentMention("User","AT","DE")).eql("language");
    });
    it('should select language in different case',function(){
      let a= createArticleWithComment("should to something @de","Comment for @es or What");
      should(a.getCommentMention("User","DE")).eql("language");
      should(a.getCommentMention("User","ES")).eql("language");
      should(a.getCommentMention("User","AT","ES")).eql("language");
      should(a.getCommentMention("User","AT","DE")).eql("language");
    });
    it('should select user in different case',function(){
      let a= createArticleWithComment("should to something @user","Comment for @es or What");
      should(a.getCommentMention("User","DE")).eql("user");
      should(a.getCommentMention("User","ES")).eql("user");
      should(a.getCommentMention("User","AT","ES")).eql("user");
      should(a.getCommentMention("User","AT","DE")).eql("user");

    });
    it('should not select language if its part of user name',function(){
      let a= createArticleWithComment("should to something @escadoni","Test more");
      should(a.getCommentMention("escadoni","ES")).eql("user");
      should(a.getCommentMention("User","ES")).eql("other");

    });
    it('should not select language if user is at the end',function(){
      let a= createArticleWithComment("should to something @user");
      should(a.getCommentMention("user","DE")).eql("user");

    });
  });
  describe('createNewArticle',function() {
    it('should createNewArticle with prototype',function(bddone) {
      articleModule.createNewArticle({blog:"test",markdownDE:"**"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("article",id,function(err,result){
          should.not.exist(err);
          should(result.blog).equal('test');
          should(result.markdownDE).equal('**');
          bddone();
        });
      });
    });
    it('should createNewArticle without prototype',function(bddone) {
      articleModule.createNewArticle(function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("article",id,function(err){
          should.not.exist(err);
          bddone();
        });
      });
    });
    it('should create no New Article with ID',function(bddone){
      (function() {
        articleModule.createNewArticle({id:2,blog:"test",markdownDE:"**"},function (){
        });
      }).should.throw();
      bddone();
    });
  });
  describe('save',function(){
    it('should report a conflict, if version number differs', function (bddone){
      // Generate an article for test
      var newArticle;
      articleModule.createNewArticle({markdownDE:"markdown",blog:"TEST"},function(err,result){
        should.not.exist(err);
        newArticle = result;
        var id =result.id;

        // get a second copy of the article (use Database for Copy)
        articleModule.findById(id,function(err,result){
          var alternativeArticle = result;
          newArticle.blog="TESTNEW";


          newArticle.save(function(err){
            should.not.exist(err);
            alternativeArticle.blog = "TESTALTERNATIVE";

            alternativeArticle.save(function(err){
              //debug(err);
              should.exist(err);
              should(err).eql(Error("Version Number Differs"));
              bddone();
            });
          });
        });
      });
    });
  });
  describe('setAndSave',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    it('should set only the one Value in the database', function (bddone){
      var newArticle;
      articleModule.createNewArticle({markdownDE:"markdown",blog:"TEST"},function(err,result){
        should.not.exist(err);
        newArticle = result;
        var id =result.id;
        newArticle.markdownDE = "This Value will not be logged";
        newArticle.setAndSave(testUser,{version:1,blog:"Reference",collection:"text",categoryEN:"Imports"},function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("article",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,markdownDE:"This Value will not be logged",blog:"Reference",collection:"text",categoryEN:"Imports",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(3);
              var r0id = result[0].id;
              var r1id = result[1].id;
              var r2id = result[2].id;
             // var r3id = result[3].id;
              var t0 = result[0].timestamp;
              var t1 = result[1].timestamp;
              var t2 = result[2].timestamp;
             // var t3 = result[3].timestamp;
              var now = new Date();
              var t0diff = ((new Date(t0)).getTime()-now.getTime());
              var t1diff = ((new Date(t1)).getTime()-now.getTime());
              var t2diff = ((new Date(t2)).getTime()-now.getTime());
           //   var t3diff = ((new Date(t3)).getTime()-now.getTime());

              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(t1diff).be.below(10);
              should(t2diff).be.below(10);
            //  should(t3diff).be.below(10);
              should(result[0]).eql({id:r0id,timestamp:t0,blog:"Reference",oid:id,user:"user",table:"article",property:"blog",from:"TEST",to:"Reference"});
              should(result[1]).eql({id:r1id,timestamp:t1,blog:"Reference",oid:id,user:"user",table:"article",property:"categoryEN",to:"Imports"});
              should(result[2]).eql({id:r2id,timestamp:t2,blog:"Reference",oid:id,user:"user",table:"article",property:"collection",to:"text"});
           //   should(result[3]).eql({id:r3id,timestamp:t3,oid:id,user:"user",table:"article",property:"collection",to:"text"});
              bddone();
            });
          });
        });
      });
    });
    it('should trim markdown Values', function (bddone){
      var newArticle;
      articleModule.createNewArticle({markdownDE:"markdown"},function(err,result){
        should.not.exist(err); 
        newArticle = result;
        var id =result.id;
        newArticle.setAndSave(testUser,{version:"1",markdownDE:"  to be trimmed "},function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("article",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,markdownDE:"to be trimmed",version:2});
            bddone();
          });
        });
      });
    });
    it('should ignore unchanged Values', function (bddone){
      var newArticle;
      articleModule.createNewArticle({markdownDE:"markdown",blog:"TEST"},function(err,result){
        should.not.exist(err);
        newArticle = result;
        var id =result.id;
        var empty;
        var changeValues = {};
        changeValues.markdownDE = newArticle.markdownDE;
        changeValues.blog = empty;
        changeValues.version = "1";
        newArticle.setAndSave(testUser,changeValues,function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("article",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,markdownDE:"markdown",blog:"TEST",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(0);
              bddone();
            });
          });
        });
      });
    });
    it('should delete markdown with spaces', function (bddone){
      var newArticle;
      articleModule.createNewArticle({markdownDE:"markdown",blog:"TEST"},function(err,result){
        should.not.exist(err);
        newArticle = result;
        var id =result.id;
        var empty;
        var changeValues = {};
        changeValues.markdownDE = " ";
        changeValues.blog = empty;
        changeValues.version = "1";
        newArticle.setAndSave(testUser,changeValues,function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("article",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,markdownDE:"",blog:"TEST",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(1);
              bddone();
            });
          });
        });
      });
    });
    it('should report a conflict, if version number differs', function (bddone){
      // Generate an article for test
      var newArticle;
      debug('Create a new Article');
      articleModule.createNewArticle({markdownDE:"markdown",blog:"TEST"},function testSetAndSaveCreateNewArticleCB(err,result){
        should.not.exist(err);
        newArticle = result;
        var id =result.id;

        // get a second copy of the article (use Database for Copy)
        debug('Search for article to have two versions of it');
        articleModule.findById(id,function testSetAndSaveFindByIDCB(err,result){
          var alternativeArticle = result;

          debug('save New Article with blogname TESTNEW');

          newArticle.setAndSave({displayName:"TEST"},{version:"1",blog:"TESTNEW"},function(err){
            should.not.exist(err);
            debug('save alternative Article with blogname TESTNEW');
            alternativeArticle.setAndSave({displayName:"TEST"},{version:"1",blog:"TESTALTERNATIVE"},function(err){
              //debug(err);
              //should.exist(err);
              should(err).eql(Error("Version Number Differs"));
              debug('Count log Entries');
              logModule.find({},function(err,result) {
                should.not.exist(err);
                should(result.length).equal(2);
                articleModule.findById(id,function(err,result){
                  should.not.exist(err);
                  should(result.blog).equal("TESTNEW");
                  bddone();
                });
              });
            });
          });
        });
      });
    });
    it('should report a conflict, no version or olddata is given', function (bddone){
      // Generate an article for test
      var newArticle;
      debug('Create a new Article');
      articleModule.createNewArticle({markdownDE:"markdown",blog:"TEST"},function testSetAndSaveCreateNewArticleCB(err,result){
        should.not.exist(err);
        newArticle = result;
        newArticle.setAndSave({OSMUser:"test"},{markdownDE:"Hallo"},function(err){
          should(err.message).eql("No Version and no History Value given");
          bddone();
        });
      });
    });
    it('should set a Value with comparing history Value', function (bddone){
      // Generate an article for test
      var newArticle;
      debug('Create a new Article');
      articleModule.createNewArticle({markdownDE:"markdown",blog:"TEST"},function testSetAndSaveCreateNewArticleCB(err,result){
        should.not.exist(err);
        newArticle = result;
        newArticle.setAndSave({OSMUser:"test"},{markdownDE:"Hallo",old:{markdownDE:"markdown"}},function(err){
          should.not.exist(err);
          articleModule.findById(newArticle.id,function(err,result){
            should.not.exist(err);
            should(result).eql({markdownDE:"Hallo",version:2,blog:"TEST",id:newArticle.id});
            bddone();
          });
        });
      });
    });
    it('should report error when old value wrong', function (bddone){
      // Generate an article for test
      var newArticle;
      articleModule.createNewArticle({markdownDE:"markdown",blog:"TEST"},function testSetAndSaveCreateNewArticleCB(err,result){
        should.not.exist(err);
        newArticle = result;
        articleModule.findById(newArticle.id,function(err,result) {
          should.not.exist(err);
          result.setAndSave({OSMUser: "test"}, {markdownDE: "test", version: 1}, function (err) {
            should.not.exist(err);
            articleModule.findById(newArticle.id,function(err,result) {
              should.not.exist(err);
              result.setAndSave({OSMUser:"test"},{markdownDE:"Hallo",old:{markdownDE:"markdown"}},function(err) {
                should(err.message).eql("Field markdownDE already changed in DB");
                bddone();
              });
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
        function c1(cb) {articleModule.createNewArticle({blog:"WN1's",markdownDE:"test1",collection:"col1",category:"catA"},cb);},
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdownDE:"test1",collection:"col1",category:"catA"},cb);},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdownDE:"test2",collection:"col2",category:"catB"},cb);},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdownDE:"test3",collection:"col3",category:"catA"},
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
        articleModule.find({blog:"WN1"},{column:"collection"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].id;
          delete result[1]._meta;
          delete result[1].id;
          should(result[0]).eql({blog:"WN1",markdownDE:"test1",collection:"col1",category:"catA",version:1});
          should(result[1]).eql({blog:"WN1",markdownDE:"test2",collection:"col2",category:"catB",version:1});
          bddone();
        });
      });
    });
    describe('findOne',function() {
      it('should findOne object with sort',function(bddone){
        articleModule.findOne({blog:"WN1"},{column:"collection"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({blog:"WN1",markdownDE:"test1",collection:"col1",category:"catA",version:1});
          bddone();
        });
      });
      it('should findOne object with an apostrophe',function(bddone){
        articleModule.findOne({blog:"WN1's"},{column:"collection"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({blog:"WN1's",markdownDE:"test1",collection:"col1",category:"catA",version:1});
          bddone();
        });
      });
    });
    describe('findById',function() {
      it('should find saved Object',function(bddone){
        articleModule.findById(idToFindLater,function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({blog:"WN2",markdownDE:"test3",collection:"col3",category:"catA",version:1});
          bddone();
        });
      });
    });
  });
  describe('findEmptyUserCollectedArticles',function(){
    before(function (bddone) {
      testutil.importData({clear:true,
                           blog:[{name:"WN1",exportedDE:true,status:"edit"},
                                 {name:"WNclosed",status:"closed"},
                                 {name:"WN2",status:"open"},
                                 {name:"WrongBlog",status:"open"}],
                           article:[{blog:"WN1",title:"first"},
                                    {blog:"WN2",title:"second",categoryEN:"cat",markdownEN:"Hallole"},
                                    {blog:"WNclosed",title:"third"},
                                    {blog:"WN1",title:"forth"},
                                    {blog:"WrongBlog",title:"fifth",categoryEN:"cat"}],
                          change:[{blog:"WN1",property:"collection",user:"test",oid:1,table:"article"},
                                  {blog:"WN2",property:"collection",user:"test",oid:2,table:"article"},
                                  {blog:"WN2",property:"collection",user:"test",oid:2,table:"article"},
                                  {blog:"WN2",property:"collection",user:"test",oid:2,table:"article"},
                                  {blog:"WNclosed",property:"collection",user:"test",oid:3,table:"article"},
                                  {blog:"WN2",property:"collection",user:"test2",oid:4,table:"article"},
                                  {blog:"WrongBlog",property:"markdownDE",user:"test",oid:5,table:"article"}]},bddone);
    });
    it('should find all empty article for a user',function(bddone){
      articleModule.findEmptyUserCollectedArticles("DE","test",function(err,result){
        should.not.exist(err);
        should(result.length).eql(1);
        should(result[0].title).eql("second");
        bddone();
      });
    });
    it('should find all empty article for a user',function(bddone){
      articleModule.findEmptyUserCollectedArticles("EN","test",function(err,result){
        should.not.exist(err);
        should(result.length).eql(0);
        bddone();
      });
    });

  });
  describe('displayTitle',function() {
    var article;
    it('should return title first',function(bddone){
      article = articleModule.create({title:"Titel",markdownDE:"markdown"});
      should(article.displayTitle()).equal("Titel");

      article = articleModule.create({title:"Very Long Title",markdownDE:"markdown"});
      should(article.displayTitle(10)).equal("Very Long ...");
      bddone();
    });
    it('should return markdown second',function(bddone){
      article = articleModule.create({markdownDE:"markdown",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("col");

      article = articleModule.create({title:"",markdownDE:"markdown",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("col");

      article = articleModule.create({title:"",markdownDE:"* This is more markdown text to test the default limit of charachter",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("col");
      bddone();
    });
    it('should return collection third',function(bddone){
      article = articleModule.create({markdownDE:"",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("col");

      article = articleModule.create({title:"",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("col");

      article = articleModule.create({collection:"Extrem shortening",category:"CAT"});
      should(article.displayTitle(2)).equal("Ex...");
      bddone();

    });
  });
  describe('calculateLinks',function(){
    var article;
    var link;
    it('should collect one link from collection', function(){
      article = articleModule.create({collection:"https://www.google.de"});
      link = article.calculateLinks();
      should(link).eql(["https://www.google.de"]);

      article = articleModule.create({collection:"Forum Article is good: http://forum.openstreetmap.org/thisIsALink?id=200"});
      link = article.calculateLinks();
      should(link).eql(["http://forum.openstreetmap.org/thisIsALink?id=200"]);

    });
    it('should collect Multiple Links from markdown and collection without doubling', function(){
      article = articleModule.create(
          {collection:"Forum Article is good: http://forum.openstreetmap.org/thisIsALink?id=200 \
              but be aware of http://bing.de/subpage/relation and of ftp://test.de",
           markdownDE:"The [Forum Article](https://forum.openstreetmap.org/thisIsALink?id=200) \
                     reads nice, but have a look to [this](https://bing.de/subpage/relation) \
                     and [that](ftp://test.de)"});
      link = article.calculateLinks();
      should(link).eql(["http://forum.openstreetmap.org/thisIsALink?id=200",
                         "http://bing.de/subpage/relation",
                         "https://forum.openstreetmap.org/thisIsALink?id=200",
                         "https://bing.de/subpage/relation"
                         ]);

    });
  });
  describe('getListOfOrphanBlog',function() {
    beforeEach(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdownDE:"test1",collection:"col1",category:"catA"},cb);},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdownDE:"test2",collection:"col2",category:"catB"},cb);},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdownDE:"test3",collection:"col3",category:"catA"},cb);},
        function b1(cb) {blogModule.createNewBlog({OSMUser:"test"},{name:"WN2",status:"open"},cb);}

        ],function(err) {
          should.not.exist(err);
          bddone();
        });
    });
    it('should return orphanBlogs',function(bddone) {
      articleModule.getListOfOrphanBlog(function(err,result){
        should.not.exist(err);
        should.exist(result);
        should(result).eql(["WN1"]);
        blogModule.findOne({name:"WN2"},{column:"name"},function(err,blog){
          should.not.exist(err);
          should.exist(blog);
          blog.setAndSave(testUser,{status:"published"},function (){
            articleModule.getListOfOrphanBlog(function(err,result){
              should.not.exist(err);
              should.exist(result);
              should(result).eql(["WN1"]);
              bddone();
            });
          });

        });
      });
    });
  });
  describe('remove',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdownDE:"test1",collection:"col1",category:"catA"},cb);},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdownDE:"test2",collection:"col2",category:"catB"},cb);},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdownDE:"test3",collection:"col3",category:"catA"},
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
    it('should remove one article',function(bddone){
      articleModule.findById(idToFindLater,function(err,article){
        should.not.exist(err);
        should.exist(article);
        article.remove(function(err) {
          should.not.exist(err);
          articleModule.find({},function(err,result){
            should.not.exist(err);
            should.exist(result);
            should(result.length).equal(2);
            bddone();
          });
        });
      });
    });
  });
  describe('lock', function() {
    before(function(bddone){
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",title:"1",markdownDE:"test1 some [ping](https://link.to/hallo)",collection:"col1 http://link.to/hallo",category:"catA"},cb);},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",blogEN:"EN1",title:"2",markdownDE:"test1 some [ping](https://link.to/hallo) http://www.osm.de/12345",collection:"http://www.osm.de/12345",category:"catB"},cb);},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",blogEN:"EN1",title:"3",markdownDE:"test1 some [ping](https://link.to/hallo)",collection:"col3 http://www.google.de",category:"catA"},cb);},
        function a1(cb) {blogModule.createNewBlog({OSMUser:"test"},{title:"WN1",status:"closed"},cb);},
        function a2(cb) {blogModule.createNewBlog({OSMUser:"test"},{title:"WN2",status:"open"},cb);},
        function a2(cb) {blogModule.createNewBlog({OSMUser:"test"},{title:"EN1",status:"closed"},cb);}
                      
        ],function(err) {
          should.not.exist(err);
          bddone();
        }
      );
    });
    it('should lock articles in open blogs',function(bddone){
      articleModule.findOne({title:"3"},function(err,article){
        should.not.exist(err);
        should.exist(article);
        article.doLock("TEST",function(err){
          should.not.exist(err);
          should(article.lock.user).equal("TEST");
          // Hope that 30ms are enough to come from locking to this code on
          // the test machine.
          should(new Date() - new Date(article.lock.timestamp)).lessThan(30);
          bddone();
        });
      });
    });
    it('should not lock articles in closed blogs',function(bddone){
      articleModule.findOne({title:"2"},function(err,article){
        should.not.exist(err);
        should.exist(article);
        article.doLock("TEST",function(err){
          should.not.exist(err);
          should.not.exist(article.lock);
          bddone();
        });
      });
    });
  });


  describe('calculateUsedLinks',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdownDE:"test1 some [ping](https://link.to/hallo)",collection:"col1 http://link.to/hallo",category:"catA"},cb);},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdownDE:"test1 some [ping](https://link.to/hallo) http://www.osm.de/12345",collection:"http://www.osm.de/12345",category:"catB"},cb);},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdownDE:"test1 some [ping](https://link.to/hallo)",collection:"col3 http://www.google.de",category:"catA"},
                         function(err,result){
                          should.not.exist(err);
                          idToFindLater = result.id;
                          cb(err);
                         });}

        ],function(err) {
          should.not.exist(err);
          bddone();
        }
      );
    });
    it('should display the other Articles Links',function(bddone){
      articleModule.findById(idToFindLater,function(err,article){
        should.not.exist(err);
        article.calculateUsedLinks(function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.count).equal(2);
          should(result["https://link.to/hallo"].length).equal(2);
          should(result["http://www.google.de"].length).equal(0);

          bddone();

        });
      });
    });
  });
  describe('fullTextSearch',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"1",markdownDE:"test1",collection:"Try this link https://www.test.at/link ?",category:"catA"},cb);},
        function c1(cb) {articleModule.createNewArticle({blog:"2",markdownEN:"See more special [here](https://www.test.at/link)",collection:"col1",category:"catA"},cb);},
        function c2(cb) {articleModule.createNewArticle({blog:"3",markdownDE:"test2",collection:"http://www.test.at/link",category:"catB"},cb);},
        function c3(cb) {articleModule.createNewArticle({blog:"4",markdownDE:"test3",collection:"https://simple.link/where",category:"catA"},
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
    it('should find the simple link',function(bddone){
      articleModule.fullTextSearch("https://simple.link/where",{column:"blog"},function(err,result) {
        should.not.exist(err);
        should.exist(result);
        should(result.length).equal(1);
        should(result[0].blog).equal("4");
        bddone();
      });
    });
    it('should find the other link 3 times',function(bddone){
      articleModule.fullTextSearch("https://www.test.at/link",{column:"blog"},function(err,result) {
        should.not.exist(err);
        should.exist(result);
        should(result.length).equal(3);
        should(result[0].blog).equal("1");
        should(result[1].blog).equal("2");
        should(result[2].blog).equal("3");
        bddone();
      });
    });
  });
  describe("comments",function(){
    var clock;
    before(function (bddone){
      this.clock = sinon.useFakeTimers();
      clock = this.clock;

      bddone();
    }); 
    after(function(bddone){
      this.clock.restore();
      bddone();
    });
    it('should add a comment',function(bddone){
    
      var timestamp = new Date();
      var timestampIso = timestamp.toISOString();
      var dataBefore = {
            clear:true,
            article:[{blog:"WN1",collection:"something",title:"test"}]};
      var dataAfter = { 
            article:[{blog:"WN1",collection:"something",title:"test",id:'1',version:2,
                      commentList:[{user:"Test",timestamp:timestampIso,text:"a comment"}],
                      commentStatus:"open",
                      commentRead:{Test:0}}],
            change:[{blog:"WN1",oid:1,table:"article",from:"",to:"a comment",user:"Test",timestamp:timestampIso}]};
      var testFunction = function testFunction(cb) {
        articleModule.findById(1,function(err,article){
          should.not.exist(err);
          should.exist(article);
          article.addComment({OSMUser:"Test"},"a comment",cb);
        });
      };        
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    });
    it('should not add a empty comment',function(bddone){

      var dataBefore = {
        clear:true,
        article:[{blog:"WN1",collection:"something",title:"test"}]};
      var dataAfter = {
        article:[{blog:"WN1",collection:"something",title:"test"}],
        change:[]};
      var testFunction = function testFunction(cb) {
        articleModule.findById(1,function(err,article){
          should.not.exist(err);
          should.exist(article);
          article.addComment({OSMUser:""},"",function checkErr(err){
            should.exist(err);
            should(err).eql(new Error("Empty Comment Added"));
            cb();
          });
        });
      };
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    });
    it('should add a second comment',function(bddone){
    
      var timestamp = new Date();
      var timestampIso = new Date().toISOString();
      var dataBefore = {
            clear:true,
            article:[{blog:"WN1",collection:"something",title:"test",
                     commentList:[{user:"Test",timestamp:timestamp,text:"a comment"}],
                     commentRead:{Test:0}}]};
      var dataAfter = { 
            article:[{blog:"WN1",collection:"something",title:"test",
                      commentList:[{user:"Test",timestamp:timestampIso,text:"a comment"},
                                   {user:"Test2",timestamp:timestampIso,text:"a second comment"}],
                      commentRead:{Test:0,Test2:1}}
                    ],
            change:[{blog:"WN1",oid:1,table:"article",from:"",to:"a second comment",user:"Test2",timestamp:timestampIso}]};
      var testFunction = function testFunction(cb) {
        articleModule.findById(1,function(err,article){
          should.not.exist(err);
          article.addComment({OSMUser:"Test2"},"a second comment",cb);
        });
      };        
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    });
    it('should edit a comment',function(bddone){
    
      var timestamp = new Date();
      var timestamp2 = new Date();
      timestamp2.setTime(timestamp2.getTime()+200);
      var dataBefore = {
            clear:true,
            article:[{blog:"WN1",collection:"something",title:"test",
                     commentList:[{user:"Test",timestamp:timestamp,text:"a comment"}]}]};
      var dataAfter = { 
            article:[{blog:"WN1",collection:"something",title:"test",
                      commentList:[{user:"Test",
                                    timestamp:timestamp.toISOString(),
                                    editstamp:timestamp2.toISOString(),
                                    text:"a changed comment"}]}],
            change:[{blog:"WN1",oid:1,table:"article",property:"comment0",from:"a comment",to:"a changed comment",user:"Test",timestamp:timestamp2.toISOString()}]};
      var testFunction = function testFunction(cb) {
        articleModule.findById(1,function(err,article){
          clock.tick(200);

          should.not.exist(err);
          article.editComment({OSMUser:"Test"},0,"a changed comment",cb);
        });
      };        
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    });
    it('should mark a comment as read',function(bddone){

      var timestamp = new Date();
      var timestamp2 = new Date();
      timestamp2.setTime(timestamp2.getTime()+200);
      var dataBefore = {
        clear:true,
        article:[{blog:"WN1",collection:"something",title:"test",
          commentList:[{user:"Test",timestamp:timestamp,text:"a comment"},{user:"Test",timestamp:timestamp,text:"a second comment"}]}]};
      var dataAfter = {
        article:[{blog:"WN1",collection:"something",title:"test",
          commentList:[{user:"Test",
            timestamp:timestamp.toISOString(),
            text:"a comment"},{user:"Test",
            timestamp:timestamp.toISOString(),
            text:"a second comment"}],
          commentRead:{Test:1}}],
        };
      var testFunction = function testFunction(cb) {
        articleModule.findById(1,function(err,article){
          clock.tick(200);

          should.not.exist(err);
          article.markCommentRead({OSMUser:"Test"},1,cb);
        });
      };
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    });    it('should not edit a comment with blank',function(bddone){

      var timestamp = new Date();
      var timestamp2 = new Date();
      timestamp2.setTime(timestamp2.getTime()+200);
      var dataBefore = {
        clear:true,
        article:[{blog:"WN1",collection:"something",title:"test",
          commentList:[{user:"Test",timestamp:timestamp,text:"a comment"}]}]};
      var dataAfter = {
        article:[{blog:"WN1",collection:"something",title:"test",
          commentList:[{user:"Test",
            timestamp:timestamp.toISOString(),
            text:"a comment"}]}],
        change:[]};
      var testFunction = function testFunction(cb) {
        articleModule.findById(1,function(err,article){
          clock.tick(200);

          should.not.exist(err);
          article.editComment({OSMUser:"Test"},0," ",function checkErr(err){
            should.exist(err);
            should(err).eql(new Error("Empty Comment Added"));
            cb();
          }
          );
        });
      };
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    });
    it('should allow only user wrote a comment to edit a comment',function(bddone){
    
      var timestamp = new Date();
      var timestampIso = timestamp.toISOString();
      var dataBefore = {
            clear:true,
            article:[{blog:"WN1",collection:"something",title:"test",
                     commentList:[{user:"Test",timestamp:timestamp,text:"a comment"}]}]};
      var dataAfter = { 
            article:[{blog:"WN1",collection:"something",title:"test",
                      commentList:[{user:"Test",timestamp:timestampIso,text:"a comment"}]}]};
      var testFunction = function testFunction(cb) {
        articleModule.findById(1,function(err,article){
          clock.tick();

          should.not.exist(err);
          article.editComment({OSMUser:"Test2"},0,"a changed comment",function (err){
            should(err).eql(new Error("Only Writer is allowed to change a commment"));
            return cb();
          });
        });
      };        
      testutil.doATest(dataBefore,testFunction,dataAfter,bddone);

    });
  });
});
