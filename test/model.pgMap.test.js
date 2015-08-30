var config = require('../config.js');
var should = require('should');
var async  = require('async');

var pgMap = require('../model/pgMap.js');


var testModule = {table:"TestTable"};
testModule.create = function create(){
  var result = {_meta:{table:testModule.table}};
  return result;
}

var testTableCreateString =  'CREATE TABLE testtable (  id bigserial NOT NULL , data json,  \
                  CONSTRAINT testtable_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);'

describe.only('model/pgMap',function(){
  before(function(bddone){
    config.initialise(bddone);
  })
  describe('createTable',function() {
    it('should return an error, if problems with Database',function(bddone){
      // local store connect String
      var connectString = config.pgstring;
      config.pgstring = "This wont work";
      var createString = 'CREATE TABLE test (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT test_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);'

      pgMap.createTable("Test",createString,"",function(err,result){
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      })
    })
    it('should return an error, if problems with Create String',function(bddone){
      // local store connect String
      var createString = 'CREATE TABLE test (  id bigserial NOT NULL  data json,  \
                  CONSTRAINT test_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);'

      pgMap.createTable("Test",createString,"",function(err,result){
        should.not.exist(result);
        should.exist(err);
        should(err.code).eql('42601'); // pg Syntax Error Code
        bddone();
      })
    })
  })
  describe('dropTable',function() {
    it('should return an error, if problems with Database',function(bddone){
      // local store connect String
      var connectString = config.pgstring;
      config.pgstring = "This wont work";
      pgMap.dropTable("Test",function(err,result){
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      })
    })
  })
  describe('find functions',function() {
    describe('findOne',function(){
      it('should return an error, if problems with the database',function(bddone){
        var connectString = config.pgstring;
        config.pgstring = "This wont work";
        pgMap.findOne(testModule,function(err,result){
          should.not.exist(result);
          should.exist(err);
          config.pgstring = connectString;
          bddone();
        })      
      })
    })
    describe('findById',function(){
      it('should return an error, if problems with the database',function(bddone){
        var connectString = config.pgstring;
        config.pgstring = "This wont work";
        pgMap.findById(testModule,1,function(err,result){
          should.not.exist(result);
          should.exist(err);
          config.pgstring = connectString;
          bddone();
        })      
      })
    })
    describe('find',function(){
      it('should return an error, if problems with the database',function(bddone){
        var connectString = config.pgstring;
        config.pgstring = "This wont work";
        pgMap.find(testModule,1,function(err,result){
          should.not.exist(result);
          should.exist(err);
          config.pgstring = connectString;
          bddone();
        })      
      })
      it('should create a valid SQL for emty string queries',function(bddone){
        async.series([
          function(cb){pgMap.dropTable("testtable",cb);},
          function(cb){pgMap.createTable("testtable",testTableCreateString,"",cb);},
          function(cb){
            var to = {_meta:{table:testModule.table},id:0,name:''};
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb){
            var to = {_meta:{table:testModule.table},id:0,nameEN:''};
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb){
            var to = {_meta:{table:testModule.table},id:0,name:'Hallo'};
            to.save = pgMap.save;
            to.save(cb);
          }

          ],
          function(err){
            should.not.exist(err);
            pgMap.find(testModule,{name:""},function(err,result){
              should.not.exist(err);
              should(result.length).equal(2);
              bddone();
            })
          }
        )
      })
    })
  })
  describe('remove',function(){
    it('should return an error, if id is 0',function(bddone){
      var testObject = {_meta:{table:testModule.table},id:0};
      testObject.remove = pgMap.remove;
      testObject.remove(function(err,result){
        should.not.exist(result);
        should.exist(err);
        should(err.message).eql("ID is zero, transient object not deleted.");
        bddone();
      })      
    })
  })
  describe('save',function(){
    it('should return an error, if problems with the database (id=0)',function(bddone){
      var testObject = {_meta:{table:testModule.table},id:0};
      var connectString = config.pgstring;
      config.pgstring = "This wont work";
      testObject.save = pgMap.save;
      testObject.save(function(err,result){
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      })      
    })
    it('should return an error, if problems with the database (id!=0)',function(bddone){
      var testObject = {_meta:{table:testModule.table},id:1};
      var connectString = config.pgstring;
      config.pgstring = "This wont work";
      testObject.save = pgMap.save;
      testObject.save(function(err,result){
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      })      
    })
  })
})