var util = require('../util.js');
var should = require('should');

describe('util',function() {
  describe('shorten', function () {
    it('should return empty string for undefined',function(bddone) {
      should(util.shorten()).equal("");
      var t;
      should(util.shorten(t)).equal("");
      should(util.shorten(t,25)).equal("");
      bddone();
    })
    it('should not shorten small strings',function(bddone){
      should(util.shorten("Short Test String")).equal("Short Test String");
      should(util.shorten("Short Test String",20)).equal("Short Test String");
      bddone();
    })
    it('shold shorten long strings',function(bddone){
      should(util.shorten("This is a long string that will not fit on a web page table, so please shorten it")).equal("This is a long string that wil...");
      should(util.shorten("Extreme Test",1)).equal("E...");
      bddone();
    })
  })
})