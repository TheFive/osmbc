// Article createNewArticle
// create article with prototyp
// create Article without prototyp
// create article with ID (non existing in db, existing in DB)


var pg     = require('pg');
var async  = require('async');
var should = require('should');
var path   = require('path');

var config = require('../config.js');

var articleModule = require('../model/article.js');
var logModule     = require('../model/logModule.js');
var blogModule    = require('../model/blog.js');


// getJsonWithID can be used to select a id,data structure from postgres
// without using the model source, and is intended to used in 
// mocha tests.
// in table there has to be a row with id, otherwise the function
// will throw an error
function getJsonWithId(table,id,cb) {
  debug('getJsonWithId');
  pg.connect(config.pgstring, function(err, client, pgdone) {
    should.not.exist(err);
    var query = client.query('select data from '+table+' where id = $1',[id]);
    var result;
    query.on('row',function(row) {
      result = row.data;
    })
    query.on('end',function(err,r) {
      pgdone();
      cb(null,result);
      return;
    })
  })
}


// This function is used to clean up the tables in the test module
// and create them new
// the order of the creatTable is important (as views are created)
// with the tables, and assuming some tables to exist
// the function requires the test environment

function clearDB(done) {
  should(config.env).equal("test");
  async.series([
    function(done) {config.initialise(done)},
    function(done) {blogModule.dropTable(done)},
    function(done) {blogModule.createTable(done)},
    function(done) {articleModule.dropTable(done)},
    function(done) {articleModule.createTable(done)},
    function(done) {logModule.dropTable(done)},
    function(done) {logModule.createTable(done)}
  ],function(err) {
    if (err) console.dir(err);
    should.not.exist(err);
    done();
  });  
}

describe('Article', function() {
  before(function (bddone) {
    clearDB(bddone);
  }) 

  describe('createNewArticle',function() {
    it('should createNewArticle with prototype',function(bddone) {
      var newArticle = articleModule.createNewArticle({blog:"test",markdown:"**"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        getJsonWithId("article",id,function(err,result){
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
        getJsonWithId("article",id,function(err,result){
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
  describe('setAndSave',function() {
    it('should set only the one Value in the database', function (bddone){
      var newArticle;
      articleModule.createNewArticle({markdown:"markdown",blog:"TEST"},function(err,result){
        should.not.exist(err);
        newArticle = result;
        var id =result.id;
        newArticle.markdown = "This Value will not be logged";
        newArticle.setAndSave("user",{blog:"Reference",collection:"text"},function(err,result) {
          should.not.exist(err);
          getJsonWithId("article",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,markdown:"This Value will not be logged",blog:"Reference",collection:"text"});
            logModule.find({},"property",function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(2);
              var r0id = result[0].id;
              var r1id = result[1].id;
              var t0 = result[0].timestamp;
              var t1 = result[1].timestamp;
              var now = new Date();
              var t0diff = ((new Date(t0)).getTime()-now.getTime());
              var t1diff = ((new Date(t1)).getTime()-now.getTime());

              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(t1diff).be.below(10);
              should(result[0]).eql({id:r0id,timestamp:t0,oid:id,user:"user",table:"article",property:"blog",from:"TEST",to:"Reference"});
              should(result[1]).eql({id:r1id,timestamp:t1,oid:id,user:"user",table:"article",property:"collection",to:"text"});
              bddone();
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
        clearDB,
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
        articleModule.find({blog:"WN1"},"collection",function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].id;
          delete result[1]._meta;
          delete result[1].id;
          should(result[0]).eql({blog:"WN1",markdown:"test1",collection:"col1",category:"catA"});
          should(result[1]).eql({blog:"WN1",markdown:"test2",collection:"col2",category:"catB"});
          bddone();
        })
      })
    })
    describe('findOne',function() {
      it('should findOne object with sort',function(bddone){
        articleModule.findOne({blog:"WN1"},"collection",function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({blog:"WN1",markdown:"test1",collection:"col1",category:"catA"});
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
          should(result).eql({blog:"WN2",markdown:"test3",collection:"col3",category:"catA"});
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
      should(article.displayTitle()).equal("* This is more markdown text t...");
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
  describe('getListOfOpenBlog',function() {
    beforeEach(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        clearDB,
        function c1(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test1",collection:"col1",category:"catA"},cb)},
        function c2(cb) {articleModule.createNewArticle({blog:"WN1",markdown:"test2",collection:"col2",category:"catB"},cb)},
        function c3(cb) {articleModule.createNewArticle({blog:"WN2",markdown:"test3",collection:"col3",category:"catA"},cb)},
        function b1(cb) {blogModule.createNewBlog({name:"WN2",status:"open"},cb)}

        ],function(err) {
          should.not.exist(err);
          bddone();
        });
    })
    it('should return openBlogs',function(bddone) {
      articleModule.getListOfOpenBlog(function(err,result){
        should.not.exist(err);
        should.exist(result);
        should(result).eql(["WN1","WN2"]);
        blogModule.findOne({name:"WN2"},"name",function(err,blog){
          should.not.exist(err);
          should.exist(blog);
          blog.setAndSave("user",{status:"published"},function (err,result){
            articleModule.getListOfOpenBlog(function(err,result){
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
})
