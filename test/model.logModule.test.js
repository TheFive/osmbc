var should = require('should');
var async  = require('async');
var testutil = require('./testutil.js');
var logModule = require('../model/logModule.js');


describe('model/changes',function() {
  context('find',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    })
    it('should find nothing',function (bddone) {
      logModule.find({table:"usert",oid:1},{column:"oid"},function(err,result){
        should.not.exist(err);
        should(result).eql([]);
        bddone();
      })
    })
  })
  context('countLogsForBlog',function(){
    beforeEach(function(bddone){
      testutil.clearDB(bddone);
    })
    it('should count the different logs',function(bddone){
      async.parallel([
        function writeLog1(cb){logModule.log({user:"Test1",blog:"Test",property:"field1"},cb)},
        function writeLog2(cb){logModule.log({user:"Test1",blog:"Test",property:"field1"},cb)},
        function writeLog3(cb){logModule.log({user:"Test2",blog:"Test",property:"field2"},cb)},
        function writeLog4(cb){logModule.log({user:"Test2",blog:"Test",property:"field3"},cb)},
        function writeLog5(cb){logModule.log({user:"Test2",blog:"Test",property:"field4"},cb)},
        function writeLog6(cb){logModule.log({user:"Test2",blog:"OtherTest",property:"field1"},cb)}

      ],function(err){
        should.not.exist(err);
        logModule.countLogsForBlog("Test",function(err,result){
          should.not.exist(err);
          should(result.length).equal(4);
          should(result.indexOf({ change_nr: '1', property: 'field3', user: 'Test2' })).equal(1);
          should(result).eql({"field1":{"Test1":2},"field2":{"Test2":1},"field3":{"Test2":1},"field4":{"Test2":1}});
          bddone();
        })
      })
    })
  })
})