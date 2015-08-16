var config = require('../config.js');
var async = require('async');
var should = require('should');

describe('config',function() {
  describe('initialise',function(){
    it('should initialise twice',function(bddone){
      var firstCallbackCalled = false;
      async.series([
        config.initialise,  
        config.initialise
      ],function(err){bddone();})
    })
  })
  describe("get*",function() {
    it('should return standard values',function(bddone){
      should((config.getCallbackUrl())).equal("TestValue");
      should((config.getServerPort())).equal(3000);
      bddone();
    })
  })
  describe("getValue",function() {
    it('should return Standard Values',function(bddone){
      should((config.getValue("callbackUrl"))).equal("TestValue");
      should((config.getValue("serverport"))).equal(3000);
      bddone();
    })
  })
})