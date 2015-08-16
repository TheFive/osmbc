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
  before(function (bddone) {
    async.series([
      function(done) {config.initialise(done)},
      function(done) {articleModule.dropTable(done)},
      function(done) {articleModule.createTable(done)}
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
    it('should createNewArticle with ID',function(bddon){
      (function() {
        var newArticle = articleModule.createNewArticle({id:2,blog:"test",markdown:"**"},function (err,result){
        })
      }).should.throw();
      bddone();
    })
  })
})
