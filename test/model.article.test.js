// Article createNewArticle
// create article with prototyp
// create Article without prototyp
// create article with ID (non existing in db, existing in DB)


var async  = require('async');
var should = require('should');
var debug  = require('debug')('OSMBC:test:article.test');


var testutil = require('./testutil.js');

var articleModule = require('../model/article.js');
var logModule     = require('../model/logModule.js');
var blogModule    = require('../model/blog.js');







describe('model/article', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  }); 
  context('Article Constructor',function(){
    it('should create an Article object',function(){
      var article = articleModule.create({oid:"Test"});
      should(article.oid).eql("Test");
      should(typeof(article)).eql('object');
      should(article instanceof articleModule.Class).be.True();
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
        newArticle.setAndSave("user",{version:"1",blog:"Reference",collection:"text",categoryEN:"Imports"},function(err) {
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
        newArticle.setAndSave("user",{version:"1",markdownDE:"  to be trimmed "},function(err) {
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
        newArticle.setAndSave("user",changeValues,function(err) {
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
          newArticle.setAndSave("TEST",{version:"1",blog:"TESTNEW"},function(err){
            should.not.exist(err);
            debug('save alternative Article with blogname TESTNEW');
            alternativeArticle.setAndSave("TEST",{version:"1",blog:"TESTALTERNATIVE"},function(err){
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
                         "ftp://test.de",
                         "https://forum.openstreetmap.org/thisIsALink?id=200",
                         "https://bing.de/subpage/relation",
                         "ftp://test.de"
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
        function b1(cb) {blogModule.createNewBlog({name:"WN2",status:"open"},cb);}

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
          blog.setAndSave("user",{status:"published"},function (){
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
        function a1(cb) {blogModule.createNewBlog({title:"WN1",status:"closed"},cb);},
        function a2(cb) {blogModule.createNewBlog({title:"WN2",status:"open"},cb);},
        function a2(cb) {blogModule.createNewBlog({title:"EN1",status:"closed"},cb);}
                      
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


  describe('getPreview',function() {
    it('should generate a preview when no markdown is specified (no Edit Link)',function (bddone) {
      var article = articleModule.create({title:"Test Title"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_test_title">\n<mark>Test Title <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a>\n</mark></li>');
      bddone();
    });
    it('should generate a preview when no markdown2 is specified (no Edit Link)',function (bddone) {
      var article = articleModule.create({collection:"Test Collection"});
      var result = article.getPreview("fullfinalDE","TheFive");
      should(result).equal('<li id="undefined_0">\nTest Collection <a href="/article/0?style=fullfinalDE&edit=true">…</a>\n</li>');
      bddone();
    });
    it('should generate a preview when no markdown2 is specified (Edit Link)',function (bddone) {
      var article = articleModule.create({collection:"Test Collection"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0">\n<mark>Test Collection <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a>\n</mark></li>');
      bddone();
    });
    it('should generate a preview when markdown is specified (Edit Link)',function (bddone) {
      var article = articleModule.create({markdownDE:"[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0">\n<p><a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>. <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview when markdown is specified (Translate Link Required)',function (bddone) {
      var article = articleModule.create({markdownDE:"[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = article.getPreview("fullfinalDE(EN)","TheFive");
      should(result).equal('<li id="undefined_0">\n<p><a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>. <a href="/article/0?style=fullfinalDE(EN)&edit=true">…</a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview when markdown is specified (with Star)',function (bddone) {
      var article = articleModule.create({markdownDE:"* [Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = article.getPreview("fullfinalDE","TheFive");
      should(result).equal('<li id="undefined_0">\n<p><a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>. <a href="/article/0?style=fullfinalDE&edit=true">…</a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview with a comment and no status',function (bddone) {
      var article = articleModule.create({markdownDE:"small markdown",comment:"Hallo"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0" style=" border-left-style: solid; border-color: blue;">\n<p>small markdown <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview with a comment and open status',function (bddone) {
      var article = articleModule.create({markdownDE:"small markdown",comment:"Hallo",commentStatus:"open"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0" style=" border-left-style: solid; border-color: blue;">\n<p>small markdown <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview with a comment and open status checking Marktext',function (bddone) {
      var article = articleModule.create({markdownDE:"small markdown",comment:"Hallo",commentStatus:"open"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0" style=" border-left-style: solid; border-color: blue;">\n<p>small markdown <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview (no markdown) with a comment and open status',function (bddone) {
      var article = articleModule.create({collection:"small collection",comment:"Hallo @EN",commentStatus:"open"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0" style=" border-left-style: solid; border-color: blue;">\n<mark>small collection <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a>\n</mark></li>');
      bddone();
    });
    it('should generate a preview with a comment and open status and reference for all user',function (bddone) {
      var article = articleModule.create({markdownDE:"small markdown",comment:"Hallo @all",commentStatus:"open"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0" style=" border-left-style: solid; border-color: orange;">\n<p>small markdown <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview with a comment and open status and reference for a specific user',function (bddone) {
      var article = articleModule.create({markdownDE:"small markdown",comment:"Hallo @user",commentStatus:"open"});
      var result = article.getPreview("fullDE","user");
      should(result).equal('<li id="undefined_0" style=" border-left-style: solid; border-color: red;">\n<p>small markdown <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview with a comment and open status and reference for a specific language',function (bddone) {
      var article = articleModule.create({markdownDE:"small markdown",comment:"Hallo @DE",commentStatus:"open"});
      var result = article.getPreview("fullDE","user");
      should(result).equal('<li id="undefined_0" style=" border-left-style: solid; border-color: orange;">\n<p>small markdown <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview with a comment and solved status',function (bddone) {
      var article = articleModule.create({markdownDE:"small markdown",comment:"Hallo",commentStatus:"solved"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0">\n<p>small markdown <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a></p>\n\n</li>');
      bddone();
    });
    it('should generate a preview Github Error #102 in german',function (bddone) {
      var article = articleModule.create({markdownDE:"Howto place an issue in OSMBC? \n\n1. open OSMBC, \n1. click Collect,\n1. choose a category from the pop up window\n1. write a Titel: example: Lidar,\n1. write at text or put a link\n1. click OK\n--- reday --- \n\nIf you like to write the news directly, do as follows:\n\n1. click Edit\n2. write your news in English (you can see it in \n3. click OK and ...\n... that's it.",comment:"Hallo",commentStatus:"solved"});
      var result = article.getPreview("fullDE","TheFive");
      should(result).equal('<li id="undefined_0">\n<p>Howto place an issue in OSMBC?</p>\n<ol>\n<li>open OSMBC,</li>\n<li>click Collect,</li>\n<li>choose a category from the pop up window</li>\n<li>write a Titel: example: Lidar,</li>\n<li>write at text or put a link</li>\n<li>click OK\n--- reday ---</li>\n</ol>\n<p>If you like to write the news directly, do as follows:</p>\n<ol>\n<li>click Edit</li>\n<li>write your news in English (you can see it in</li>\n<li>click OK and ...\n... that\'s it.</li>\n</ol>\n <a href="/article/0?style=fullDE"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullDE&edit=true"><span class="glyphicon glyphicon-edit"></span></a>\n</li>');
      bddone();
    });
    it('should generate a preview Github Error #102 in english',function (bddone) {
      var article = articleModule.create({markdownEN:"Howto place an issue in OSMBC? \n\n1. open OSMBC, \n1. click Collect,\n1. choose a category from the pop up window\n1. write a Titel: example: Lidar,\n1. write at text or put a link\n1. click OK\n--- reday --- \n\nIf you like to write the news directly, do as follows:\n\n1. click Edit\n2. write your news in English (you can see it in \n3. click OK and ...\n... that's it.",comment:"Hallo",commentStatus:"solved"});
      var result = article.getPreview("fullEN","TheFive");
      should(result).equal('<li id="undefined_0">\n<p>Howto place an issue in OSMBC?</p>\n<ol>\n<li>open OSMBC,</li>\n<li>click Collect,</li>\n<li>choose a category from the pop up window</li>\n<li>write a Titel: example: Lidar,</li>\n<li>write at text or put a link</li>\n<li>click OK\n--- reday ---</li>\n</ol>\n<p>If you like to write the news directly, do as follows:</p>\n<ol>\n<li>click Edit</li>\n<li>write your news in English (you can see it in</li>\n<li>click OK and ...\n... that\'s it.</li>\n</ol>\n <a href="/article/0?style=fullEN"><span class="glyphicon glyphicon-eye-open"></span></a> <a href="/article/0?style=fullEN&edit=true"><span class="glyphicon glyphicon-edit"></span></a>\n</li>');
      bddone();
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
          should(result.count).equal(4);
          should(result["https://link.to/hallo"].length).equal(3);
          should(result["http://www.google.de"].length).equal(1);

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
});
