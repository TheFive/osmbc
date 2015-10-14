// Article createNewArticle
// create article with prototyp
// create Article without prototyp
// create article with ID (non existing in db, existing in DB)


var pg     = require('pg');
var async  = require('async');
var should = require('should');
var path   = require('path');
var debug  = require('debug')('OSMBC:test:article.test');

var config = require('../config.js');

var testutil = require('./testutil.js');

var articleModule = require('../model/article.js');
var logModule     = require('../model/logModule.js');
var blogModule    = require('../model/blog.js');







describe('model/article', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  }) 

  describe('createNewArticle',function() {
    it('should createNewArticle with prototype',function(bddone) {
      var newArticle = articleModule.createNewArticle({blog:"test",markdown:"**"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("article",id,function(err,result){
          should.not.exist(err);
          should(result.blog).equal('test');
          should(result.markdown).equal('**');
          bddone();
        })
      })
    });
    it('should createNewArticle without prototype',function(bddone) {
      var newArticle = articleModule.createNewArticle(function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("article",id,function(err,result){
          should.not.exist(err);
          bddone();
        })
      });
    })
    it('should create no New Article with ID',function(bddone){
      (function() {
        var newArticle = articleModule.createNewArticle({id:2,blog:"test",markdown:"**"},function (err,result){
        })
      }).should.throw();
      bddone();
    })
  })
  describe('save',function(){
    it('should report a conflict, if version number differs', function (bddone){
      // Generate an article for test
      var newArticle;
      articleModule.createNewArticle({markdown:"markdown",blog:"TEST"},function(err,result){
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
              should(err).eql(Error("Version Nummber differs"));
              bddone();
            })
          })
        })
      })
    })    
  })
  describe('setAndSave',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    }) 
    it('should set only the one Value in the database', function (bddone){
      var newArticle;
      articleModule.createNewArticle({markdown:"markdown",blog:"TEST"},function(err,result){
        should.not.exist(err);
        newArticle = result;
        var id =result.id;
        newArticle.markdown = "This Value will not be logged";
        newArticle.setAndSave("user",{version:"1",blog:"Reference",collection:"text",category:"Importe"},function(err,result) {
          should.not.exist(err);
          testutil.getJsonWithId("article",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,markdown:"This Value will not be logged",blog:"Reference",collection:"text",category:"Importe",categoryEN:"Imports",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(4);
              var r0id = result[0].id;
              var r1id = result[1].id;
              var r2id = result[2].id;
              var r3id = result[3].id;
              var t0 = result[0].timestamp;
              var t1 = result[1].timestamp;
              var t2 = result[2].timestamp;
              var t3 = result[3].timestamp;
              var now = new Date();
              var t0diff = ((new Date(t0)).getTime()-now.getTime());
              var t1diff = ((new Date(t1)).getTime()-now.getTime());
              var t2diff = ((new Date(t2)).getTime()-now.getTime());
              var t3diff = ((new Date(t3)).getTime()-now.getTime());

              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(t1diff).be.below(10);
              should(t2diff).be.below(10);
              should(t3diff).be.below(10);
              should(result[0]).eql({id:r0id,timestamp:t0,oid:id,user:"user",table:"article",property:"blog",from:"TEST",to:"Reference"});
              should(result[1]).eql({id:r1id,timestamp:t1,oid:id,user:"user",table:"article",property:"category",to:"Importe"});
              should(result[2]).eql({id:r2id,timestamp:t2,oid:id,user:"user",table:"article",property:"categoryEN",to:"Imports"});
              should(result[3]).eql({id:r3id,timestamp:t3,oid:id,user:"user",table:"article",property:"collection",to:"text"});
              bddone();
            })
          })
        })
      })
    })    
    it('should ignore unchanged Values', function (bddone){
      var newArticle;
      articleModule.createNewArticle({markdown:"markdown",blog:"TEST"},function(err,result){
        should.not.exist(err);
        newArticle = result;
        var id =result.id;
        var empty;
        var changeValues = {}
        changeValues.markdown = newArticle.markdown;
        changeValues.blog = empty;
        changeValues.version = "1";
        newArticle.setAndSave("user",changeValues,function(err,result) {
          should.not.exist(err);
          testutil.getJsonWithId("article",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,markdown:"markdown",blog:"TEST",version:2});
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
    it('should report a conflict, if version number differs', function (bddone){
      // Generate an article for test
      var newArticle;
      debug('Create a new Article');
      articleModule.createNewArticle({markdown:"markdown",blog:"TEST"},function testSetAndSaveCreateNewArticleCB(err,result){
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
              should(err).eql(Error("Version Nummber differs"));
              debug('Count log Entries');
              logModule.find({},function(err,result) {
                should.not.exist(err);
                should(result.length).equal(2);
                articleModule.findById(id,function(err,result){
                  should.not.exist(err);
                  should(result.blog).equal("TESTNEW");
                  bddone();
                })
              })
            })
          })
        })
      })
    })
  })
  describe('findFunctions',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test1",collection:"col1",category:"catA"},cb)},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test2",collection:"col2",category:"catB"},cb)},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdown:"test3",collection:"col3",category:"catA"},
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
        articleModule.find({blog:"WN1"},{column:"collection"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].id;
          delete result[1]._meta;
          delete result[1].id;
          should(result[0]).eql({blog:"WN1",markdown:"test1",collection:"col1",category:"catA",version:1});
          should(result[1]).eql({blog:"WN1",markdown:"test2",collection:"col2",category:"catB",version:1});
          bddone();
        })
      })
    })
    describe('findOne',function() {
      it('should findOne object with sort',function(bddone){
        articleModule.findOne({blog:"WN1"},{column:"collection"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({blog:"WN1",markdown:"test1",collection:"col1",category:"catA",version:1});
          bddone();
        })
      })
    })
    describe('findById',function() {
      it('should find saved Object',function(bddone){
        articleModule.findById(idToFindLater,function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({blog:"WN2",markdown:"test3",collection:"col3",category:"catA",version:1});
          bddone();
        })
      })
    })
  })
  describe('displayTitle',function() {
    var article;
    it('should return title first',function(bddone){
      article = articleModule.create({title:"Titel",markdown:"markdown"});
      should(article.displayTitle()).equal("Titel");

      article = articleModule.create({title:"Very Long Title",markdown:"markdown"});
      should(article.displayTitle(10)).equal("Very Long ...");
      bddone();
    })
    it('should return markdown second',function(bddone){
      article = articleModule.create({markdown:"markdown",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("markdown");

      article = articleModule.create({title:"",markdown:"markdown",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("markdown");

      article = articleModule.create({title:"",markdown:"* This is more markdown text to test the default limit of charachter",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("This is more markdown text to ...");
      bddone();
    })
    it('should return collection third',function(bddone){
      article = articleModule.create({markdown:"",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("col");

      article = articleModule.create({title:"",collection:"col",category:"CAT"});
      should(article.displayTitle()).equal("col");

      article = articleModule.create({collection:"Extrem shortening",category:"CAT"});
      should(article.displayTitle(2)).equal("Ex...");
      bddone();

    })
  })
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

    })
    it('should collect Multiple Links from markdown and collection without doubling', function(){
      article = articleModule.create(
          {collection:"Forum Article is good: http://forum.openstreetmap.org/thisIsALink?id=200 \
              but be aware of http://bing.de/subpage/relation and of ftp://test.de",
           markdown:"The [Forum Article](https://forum.openstreetmap.org/thisIsALink?id=200) \
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

    })
  })
  describe('getListOfOrphanBlog',function() {
    beforeEach(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test1",collection:"col1",category:"catA"},cb)},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test2",collection:"col2",category:"catB"},cb)},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdown:"test3",collection:"col3",category:"catA"},cb)},
        function b1(cb) {blogModule.createNewBlog({name:"WN2",status:"open"},cb)}

        ],function(err) {
          should.not.exist(err);
          bddone();
        });
    })
    it('should return orphanBlogs',function(bddone) {
      articleModule.getListOfOrphanBlog(function(err,result){
        should.not.exist(err);
        should.exist(result);
        should(result).eql(["WN1"]);
        blogModule.findOne({name:"WN2"},{column:"name"},function(err,blog){
          should.not.exist(err);
          should.exist(blog);
          blog.setAndSave("user",{status:"published"},function (err,result){
            articleModule.getListOfOrphanBlog(function(err,result){
              should.not.exist(err);
              should.exist(result);
              should(result).eql(["WN1"]);
              bddone();
            })
          })

        })
      })
    })
  })
  describe('remove',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test1",collection:"col1",category:"catA"},cb)},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test2",collection:"col2",category:"catB"},cb)},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdown:"test3",collection:"col3",category:"catA"},
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
          })
        })
      })
    })
  })
  describe('lock', function() {
    before(function(bddone){
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",title:"1",markdown:"test1 some [ping](https://link.to/hallo)",collection:"col1 http://link.to/hallo",category:"catA"},cb)},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",blogEN:"EN1",title:"2",markdown:"test1 some [ping](https://link.to/hallo) http://www.osm.de/12345",collection:"http://www.osm.de/12345",category:"catB"},cb)},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",blogEN:"EN1",title:"3",markdown:"test1 some [ping](https://link.to/hallo)",collection:"col3 http://www.google.de",category:"catA"},cb)},
        function a1(cb) {blogModule.createNewBlog({title:"WN1",status:"published"},cb)},
        function a2(cb) {blogModule.createNewBlog({title:"WN2",status:"open"},cb);},
        function a2(cb) {blogModule.createNewBlog({title:"EN1",status:"published"},cb);}
                      
        ],function(err) {
          should.not.exist(err);
          bddone();
        }
      )
    })
    it('should lock articles in open blogs',function(bddone){
      articleModule.findOne({title:"3"},function(err,article){
        should.not.exist(err);
        should.exist(article);
        article.doLock("TEST",function(err){
          should.not.exist(err);
          should(article.isClosed).is.false();
          should(article.isClosedEN).is.true();
          should(article.lock.user).equal("TEST");
          // Hope that 30ms are enough to come from locking to this code on
          // the test machine.
          should(new Date() - new Date(article.lock.timestamp)).lessThan(30);
          bddone();
        })
      })
    })
    it('should not lock articles in published blogs',function(bddone){
      articleModule.findOne({title:"2"},function(err,article){
        should.not.exist(err);
        should.exist(article);
        article.doLock("TEST",function(err){
          should.not.exist(err);
          should(article.isClosed).is.true();
          should(article.isClosedEN).is.true();
          should.not.exist(article.lock);
          bddone();
        })
      })
    })  
  })
  describe('preview',function() {
    it('should generate a preview when no markdown is specified (no Edit Link)',function (bddone) {
      var article = articleModule.create({title:"Test Title"});
      var result = article.preview();
      should(result).equal('<li>\n<mark>Test Title\n</mark></li>');
      bddone();
    })
    it('should generate a preview when no markdown is specified (Edit Link)',function (bddone) {
      var article = articleModule.create({title:"Test Title"});
      var result = article.preview(true);
      should(result).equal('<p>\n<mark><a href="/article/0"><span class="glyphicon glyphicon-edit"></span></a> Test Title\n</mark></p>');
      bddone();
    })
    it('should generate a preview when no markdown2 is specified (no Edit Link)',function (bddone) {
      var article = articleModule.create({collection:"Test Collection"});
      var result = article.preview();
      should(result).equal('<li>\n<mark>Test Collection\n</mark></li>');
      bddone();
    })
    it('should generate a preview when no markdown2 is specified (Edit Link)',function (bddone) {
      var article = articleModule.create({collection:"Test Collection"});
      var result = article.preview(true);
      should(result).equal('<p>\n<mark><a href="/article/0"><span class="glyphicon glyphicon-edit"></span></a> Test Collection\n</mark></p>');
      bddone();
    })
    it('should generate a preview when markdown is specified (Edit Link)',function (bddone) {
      var article = articleModule.create({markdown:"[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = article.preview(true);
      should(result).equal('<p>\n<a href="/article/0"><span class="glyphicon glyphicon-edit"></span></a> <a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>.\n</p>');
      bddone();
    })
    it('should generate a preview when markdown is specified (No Edit Link)',function (bddone) {
      var article = articleModule.create({markdown:"[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = article.preview(false);
      should(result).equal('<li>\n<a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>.\n</li>');
      bddone();
    })
    it('should generate a preview when markdown is specified (with Star)',function (bddone) {
      var article = articleModule.create({markdown:"* [Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = article.preview(false);
      should(result).equal('<li>\n<a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>.\n</li>');
      bddone();
    })
  })
  describe('calculateUsedLinks',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test1 some [ping](https://link.to/hallo)",collection:"col1 http://link.to/hallo",category:"catA"},cb)},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test1 some [ping](https://link.to/hallo) http://www.osm.de/12345",collection:"http://www.osm.de/12345",category:"catB"},cb)},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdown:"test1 some [ping](https://link.to/hallo)",collection:"col3 http://www.google.de",category:"catA"},
                         function(err,result){
                          should.not.exist(err);
                          idToFindLater = result.id;
                          cb(err);
                         })}

        ],function(err) {
          should.not.exist(err);
          bddone();
        }
      );
    })
    it('should display the other Articles Links',function(bddone){
      articleModule.findById(idToFindLater,function(err,article){
        should.not.exist(err);
        article.calculateUsedLinks(function(err,result){
          should.not.exist(err);
          console.dir(result);
          console.dir(article);
          should.exist(result);
          should(result.count).equal(2);
          should(result["https://link.to/hallo"].length).equal(1);
          should(result["http://www.google.de"].length).equal(1);

          bddone();

        })
      })
    })
  })
})
