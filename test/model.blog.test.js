

var pg     = require('pg');
var async  = require('async');
var should = require('should');
var path   = require('path');
var fs     = require('fs');
var debug  = require('debug')('OSMBC:test:blog.test');

var config = require('../config.js');

var testutil = require('./testutil.js');

var logModule     = require('../model/logModule.js');
var blogModule    = require('../model/blog.js');







describe('model/blog', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  }) 

  describe('createNewBlog',function() {
    it('should createNewArticle with prototype',function(bddone) {
      var newBlog = blogModule.createNewBlog({name:"test",status:"open"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("blog",id,function(err,result){
          should.not.exist(err);
          should(result.name).equal('test');
          should(result.status).equal('open');
          bddone();
        })
      })
    });
    it('should createNewArticle without prototype',function(bddone) {
      var newBlog = blogModule.createNewBlog(function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("blog",id,function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.name).equal('WN251');
          bddone();
        })
      });
    })
    it('should create no New Article with ID',function(bddone){
      (function() {
        var newBlog = blogModule.createNewBlog({id:2,name:"test",status:"**"},function (err,result){
        })
      }).should.throw();
      bddone();
    })
  })
  describe('setAndSave',function() {
    it('should set only the one Value in the database', function (bddone){
      blogModule.createNewBlog({name:"Title",status:"TEST"},function(err,newBlog){
        should.not.exist(err);
        should.exist(newBlog);
        var id =newBlog.id;
        newBlog.name = "New Title";
        newBlog.setAndSave("user",{status:"published",field:"test"},function(err,result) {
          should.not.exist(err);
          testutil.getJsonWithId("blog",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,name:"New Title",status:"published",field:"test"});
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
              should(result[0]).eql({id:r0id,timestamp:t0,oid:id,user:"user",table:"blog",property:"status",from:"TEST",to:"published"});
              should(result[1]).eql({id:r1id,timestamp:t1,oid:id,user:"user",table:"blog",property:"field",to:"test"});
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
        testutil.clearDB,
        function c1(cb) {blogModule.createNewBlog({name:"WN1",status:"open"},cb)},
        function c2(cb) {blogModule.createNewBlog({name:"WN2",status:"open"},cb)},
        function c3(cb) {blogModule.createNewBlog({name:"WN3",status:"finished"},
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
        blogModule.find({status:"open"},"name",function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].id;
          delete result[1]._meta;
          delete result[1].id;
          should(result[0]).eql({name:"WN1",status:"open"});
          should(result[1]).eql({name:"WN2",status:"open"});
          bddone();
        })
      })
    })
    describe('findOne',function() {
      it('should findOne object with sort',function(bddone){
        blogModule.findOne({status:"open"},"name",function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({name:"WN1",status:"open"});
          bddone();
        })
      })
    })
    describe('findById',function() {
      it('should find saved Object',function(bddone){
        blogModule.findById(idToFindLater,function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({name:"WN3",status:"finished"});
          bddone();
        })
      })
    })
  })
  describe('preview',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    })

    var testdir = path.resolve(__dirname, "data")
    var listOfJson=fs.readdirSync(testdir);
    var list=[];
    for (var i =0;i<listOfJson.length;i++){
      var filenameLong=path.resolve(testdir,listOfJson[i]);
      if (!fs.statSync(filenameLong).isDirectory()) {
        list.push(listOfJson[i]);
      }
    }
    function doATest(filename) {
     
      it('should handle testfile '+filename,function (bddone) {
        var file =  path.resolve(__dirname,'data', filename);
        var data =  JSON.parse(fs.readFileSync(file));
       
        var blog;
        var md;
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
            })         
          } ,
          function(done) {
            blog.preview(false,function(err,result){
              should.not.exist(err);
              html = result.preview;
              articles = result.articles;
              done();
            })
          }

          ],
          function (err) {
            should.not.exist(err);

            var htmlResult = data.testBlogResultHtml;
            if (list.indexOf(htmlResult)>= 0) {
              var file =  path.resolve(__dirname,'data', htmlResult);
              htmlResult =  fs.readFileSync(file,"utf-8");
            }
            var result = testutil.domcompare(html,htmlResult);

            if (result.getDifferences().length>0) {
              should.not.exist(result.getDifferences());
            }
            bddone();
          }
        )   
      })
    }
    for (testfile in list) {
      if ((list[testfile]).search("html") >= 0) continue;
      doATest(list[testfile]);
    }
  }) 
})
