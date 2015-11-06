

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
    process.env.TZ = 'Europe/Amsterdam';
  }) 

  describe('createNewBlog',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    }) 
    it('should createNewArticle with prototype',function(bddone) {
      var newBlog = blogModule.createNewBlog({name:"test",status:"open"},function (err,result){
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
    it('should createNewArticle with existing WN',function(bddone) {
      var previousBlog = blogModule.createNewBlog({name:"WN100",endDate:new Date("1.1.2000")},function(err,result){

        should.not.exist(err);
        should.exist(result);
        result.save(function(err) {
          should.not.exist(err);
          var newBlog = blogModule.createNewBlog(function (err,result){
            should.not.exist(err);
            var id = result.id;
            testutil.getJsonWithId("blog",id,function(err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.name).equal('WN101');
              should(new Date(result.startDate).toLocaleDateString()).eql(new Date("2000-01-02").toLocaleDateString());
              should(new Date(result.endDate).toLocaleDateString()).eql(new Date("2000-01-08").toLocaleDateString());
              bddone();
            })
          });       

        })
      })
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
            delete result.categories;
            delete result.startDate;
            delete result.endDate;
            should(result).eql({id:id,name:"New Title",status:"published",field:"test",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(2);
              delete result[0].id;
              delete result[1].id;
              var t0 = result[0].timestamp;
              var t1 = result[1].timestamp;
              var now = new Date();
              var t0diff = ((new Date(t0)).getTime()-now.getTime());
              var t1diff = ((new Date(t1)).getTime()-now.getTime());

              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(t1diff).be.below(10);
              delete result[0].timestamp;
              delete result[1].timestamp;

              should(result).containEql({oid:id,user:"user",table:"blog",property:"status",from:"TEST",to:"published"});
              should(result).containEql({oid:id,user:"user",table:"blog",property:"field",to:"test"});
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
        function c1(cb) {blogModule.createNewBlog({name:"WN1",status:"open",startDate:"2015-01-01",endDate:"2016-01-01"},cb)},
        function c2(cb) {blogModule.createNewBlog({name:"WN2",status:"open",startDate:"2015-01-01",endDate:"2016-01-01"},cb)},
        function c3(cb) {blogModule.createNewBlog({name:"WN3",status:"finished",startDate:"2015-01-01",endDate:"2016-01-01"},
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
        })
      })
    })
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
        })
      })
    })
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
        })
      })
    })
  })
 
  describe('getPreview',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    })
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
            blog.getPreview(data.style,"user",function(err,result){
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

            try {
              // try to read file content,
              // if it fails, use the allready defined value
              var file =  path.resolve(__dirname,'data', htmlResult);
              htmlResult =  fs.readFileSync(file,"utf-8");
            }
            catch (err) {/* ignore the error */}
            var result = testutil.domcompare(html,htmlResult);



            if (result.getDifferences().length>0) {
              should.not.exist(result.getDifferences());
            }
            bddone();
          }
        )   
      })
    }
    testutil.generateTests("data",/^model.blog.getPreview.+json/,doATest);
  })  
})
