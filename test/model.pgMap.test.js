"use strict";

var config = require('../config.js');
var should = require('should');
var async  = require('async');

var pgMap = require('../model/pgMap.js');


function TestTable(proto) {
  for (var k in proto) {
    this[k]=proto[k];
  }
}
TestTable.prototype.getTable= function getTable() {return "TestTable";};
function create(proto){
  var result = new TestTable(proto);

  return result;
}
var testModule = {table:"TestTable",create:create};


var testTableCreateString =  'CREATE TABLE testtable (  id bigserial NOT NULL , data json,  \
                  CONSTRAINT testtable_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);';

describe('model/pgMap',function(){
  before(function(bddone){
    config.initialise(bddone);
  });
  describe('createTable',function() {
    it('should return an error, if problems with Database',function(bddone){
      // local store connect String
      var connectString = config.pgstring;
      config.pgstring = "This wont work";
      var createString = 'CREATE TABLE test (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT test_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);';

      pgMap.createTable("Test",createString,"",function(err,result){
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      });
    });
    it('should return an error, if problems with Create String',function(bddone){
      // local store connect String
      var createString = 'CREATE TABLE test (  id bigserial NOT NULL  data json,  \
                  CONSTRAINT test_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);';

      pgMap.createTable("Test",createString,"",function(err,result){
        should.not.exist(result);
        should.exist(err);
        should(err.code).eql('42601'); // pg Syntax Error Code
        bddone();
      });
    });
  });
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
      });
    });
    it('should return an error, if problems with deletion String',function(bddone){
      // local store connect String
      pgMap.dropTable("Test & me",function(err,result){
        should.not.exist(result);
        should.exist(err);
        bddone();
      });
    });
  });
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
        });     
      });
    });
    describe('findById',function(){
      it('should return an error, if problems with the database',function(bddone){
        var connectString = config.pgstring;
        config.pgstring = "This wont work";
        pgMap.findById(testModule,1,function(err,result){
          should.not.exist(result);
          should.exist(err);
          config.pgstring = connectString;
          bddone();
        });      
      });
    });
    describe('find',function(){
      beforeEach(function(bddone){
        async.series([
          function(cb){pgMap.dropTable("testtable",cb);},
          function(cb){pgMap.createTable("testtable",testTableCreateString,"",cb);},
          function(cb){
            var to = new TestTable({id:0,name:''});
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb){
            var to = new TestTable({id:0,nameEN:''});
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb){
            var to = new TestTable({id:0,name:'Hallo',value:3});
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb){
            var to = new TestTable({id:0,name:'Hallo',value:4});
            to.save = pgMap.save;
            to.save(cb);
          }
        ], 
        bddone
        );      
      });
      it('should return an error, if problems with the database',function(bddone){
        var connectString = config.pgstring;
        config.pgstring = "This wont work";
        pgMap.find({table:"testtable"},1,function(err,result){
          should.not.exist(result);
          should.exist(err);
          config.pgstring = connectString;
          bddone();
        });      
      });
      it('should create a valid SQL for emty string queries',function(bddone){
        pgMap.find(testModule,{name:""},function(err,result){
          should.not.exist(err);
          should(result.length).equal(2);
          bddone();
        });
      });
      it('should find on element with !=',function(bddone) {
        pgMap.find(testModule,{name:"Hallo",value:"!=3"},function(err,result){
          should.not.exist(err);
          should(result.length).equal(1);
          should(result[0].value).equal(4);
          bddone();
        });
      });
      it('should find on element with IN',function(bddone) {
        pgMap.find(testModule,{name:"Hallo",value:"IN('3','4')"},function(err,result){
          should.not.exist(err);
          should(result.length).equal(2);
          should(result[0].value).equal(3);
          should(result[1].value).equal(4);
          bddone();
        });
      });
      it('should find on element with != ""',function(bddone) {
        pgMap.find(testModule,{name:"!=",},function(err,result){
          should.not.exist(err);
          should(result.length).equal(2);
          should(result[0].name).equal("Hallo");
          should(result[1].name).equal("Hallo");
          bddone();
        });
      });
      it('should find all elements',function(bddone){
        pgMap.find(testModule,function(err,result){
          should.not.exist(err);
          should(result.length).equal(4);
          bddone();
        });
      });
    });
  });
  describe('remove',function(){
    it('should return an error, if id is 0',function(bddone){
      var testObject = new TestTable({id:0});
      testObject.remove = pgMap.remove;
      testObject.remove(function(err,result){
        should.not.exist(result);
        should.exist(err);
        should(err.message).eql("ID is zero, transient object not deleted.");
        bddone();
      });      
    });
  });
  describe('save',function(){
    it('should return an error, if problems with the database (id=0)',function(bddone){
      var testObject = new TestTable({id:0});
      var connectString = config.pgstring;
      config.pgstring = "This wont work";
      testObject.save = pgMap.save;
      testObject.save(function(err,result){
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      });      
    });
    it('should return an error, if problems with the database (id!=0)',function(bddone){
      var testObject = new TestTable({id:1});
      var connectString = config.pgstring;
      config.pgstring = "This wont work";
      testObject.save = pgMap.save;
      testObject.save(function(err,result){
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      });      
    });
  });
});