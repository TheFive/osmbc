// Article createNewArticle
// create article with prototyp
// create Article without prototyp
// create article with ID (non existing in db, existing in DB)


var pg     =require('pg');
var async  = require('async');
var should = require('should');
var path   = require('path');

var config = require('../config.js');


var articleModule = require('../model/article.js');
var logModule = require('../model/logModule.js');

function getJsonWithId(table,id,cb) {
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

describe('Article', function() {
  beforeEach(function (bddone) {
    async.series([
      function(done) {config.initialise(done)},
      function(done) {articleModule.dropTable(done)},
      function(done) {articleModule.createTable(done)},
      function(done) {logModule.dropTable(done)},
      function(done) {logModule.createTable(done)}
    ],function(err) {
      if (err) console.dir(err);
      should.not.exist(err);
      bddone();
    });
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
})
