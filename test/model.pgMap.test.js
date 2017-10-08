"use strict";

var config = require("../util/config.js");
var should = require("should");
var async  = require("async");

var pgMap  = require("../model/pgMap.js");


function TestTable(proto) {
  for (var k in proto) {
    this[k] = proto[k];
  }
}
TestTable.prototype.getTable = function getTable() { return "TestTable"; };
function create(proto) {
  var result = new TestTable(proto);

  return result;
}
var testModule = {table: "TestTable", create: create};


var testTableObject = {};
testTableObject.createString = "CREATE TABLE testtable (  id bigserial NOT NULL , data json,  \
                  CONSTRAINT testtable_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
testTableObject.indexDefinition = {};
testTableObject.viewDefinition = {};
testTableObject.table = "testtable";


describe("model/pgMap", function() {
  before(function(bddone) {
    config.initialise(bddone);
  });
  describe("createTable", function() {
    it("should return an error, if problems with Create String", function(bddone) {
      var pgObject = {};

      pgObject.createString = "CREATE TABLE test (  id bigserial NOT NULL  data json,  \
                  CONSTRAINT test_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
      pgObject.indexDefinition = {};
      pgObject.viewDefinition = {};
      pgObject.table = "test";

      pgMap.createTables(pgObject, {createTables: true, dropTables: true}, function(err, result) {
        should.not.exist(result);
        should.exist(err);
        should(err.code).eql("42601"); // pg Syntax Error Code
        bddone();
      });
    });
  });
  describe("find functions", function() {
    describe("find", function() {
      beforeEach(function(bddone) {
        async.series([
          function(cb) { pgMap.createTables(testTableObject, {createTables: true, dropTables: true}, cb); },
          function(cb) {
            var to = new TestTable({id: 0, name: ""});
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb) {
            var to = new TestTable({id: 0, nameEN: ""});
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb) {
            var to = new TestTable({id: 0, name: "Hallo", value: 3});
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb) {
            var to = new TestTable({id: 0, name: "Hallo", value: 4});
            to.save = pgMap.save;
            to.save(cb);
          }
        ],
        bddone
        );
      });
      it("should create a valid SQL for empty string queries", function(bddone) {
        pgMap.find(testModule, {name: ""}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result).eql([new TestTable( { id: '1', name: '', version: 1 }),new TestTable({ id: '2', nameEN: '', version: 1 })]);
          bddone();


        });
      });
      it("should find on element with !=", function(bddone) {
        pgMap.find(testModule, {name: "Hallo", value: "!=3"}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(1);
          should(result[0].value).equal(4);
          bddone();
        });
      });
      it("should find on element with <", function(bddone) {
        pgMap.find(testModule, {name: "Hallo", value: "<4"}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(1);
          should(result[0].value).equal(3);
          bddone();
        });
      });
      it("should find on element with >", function(bddone) {
        pgMap.find(testModule, {name: "Hallo", value: ">3"}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(1);
          should(result[0].value).equal(4);
          bddone();
        });
      });
      it("should find on element with <=", function(bddone) {
        pgMap.find(testModule, {name: "Hallo", value: "<=4"}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result).eql([new TestTable({ id: "3", name: "Hallo", value: 3, version: 1 }),
                              new TestTable({ id: "4", name: "Hallo", value: 4, version: 1 })]);
          bddone();
        });
      });
      it("should find on element with >=", function(bddone) {
        pgMap.find(testModule, {name: "Hallo", value: ">=3"}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result).eql([new TestTable({ id: "3", name: "Hallo", value: 3, version: 1 }),
                              new TestTable({ id: "4", name: "Hallo", value: 4, version: 1 })]);
          bddone();
        });
      });
      it("should find on element with IN", function(bddone) {
        pgMap.find(testModule, {name: "Hallo", value: "IN('3','4')"}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result[0].value).equal(3);
          should(result[1].value).equal(4);
          bddone();
        });
      });
      it('should find on element with != ""', function(bddone) {
        pgMap.find(testModule, {name: "!="}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result[0].name).equal("Hallo");
          should(result[1].name).equal("Hallo");
          bddone();
        });
      });
      it("should find all elements", function(bddone) {
        pgMap.find(testModule, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(4);
          bddone();
        });
      });
      it("should work with params", function(bddone) {
        pgMap.find(testModule, {sql: "where data->>'name'=$1 and data->>'value' = $2", params: ["Hallo", 4]}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(1);
          bddone();
        });
      });
      it("should use like", function(bddone) {
        pgMap.find(testModule, {name: "Ha%"}, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result[0].name).equal("Hallo");
          should(result[1].name).equal("Hallo");
          bddone();
        });
      });
    });
  });
  describe("remove", function() {
    it("should return an error, if id is 0", function(bddone) {
      var testObject = new TestTable({id: 0});
      testObject.remove = pgMap.remove;
      testObject.remove(function(err, result) {
        should.not.exist(result);
        should.exist(err);
        should(err.message).eql("ID is zero, transient object not deleted.");
        bddone();
      });
    });
  });
  describe("save", function() {
    it("should return an error, if problems with the database (id!=0)", function(bddone) {
      var testObject = new TestTable({id: 1});
      var connectString = config.pgstring;
      config.pgstring = "This wont work";
      testObject.save = pgMap.save;
      testObject.save(function(err, result) {
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      });
    });
  });
});
