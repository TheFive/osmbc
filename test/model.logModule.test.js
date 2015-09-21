var should = require('should');
var testutil = require('./testutil.js');
var logModule = require('../model/logModule.js');


describe('model/changes',function() {
  describe('find',function() {
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
})