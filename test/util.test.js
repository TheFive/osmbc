var util = require('../util.js');
var should = require('should');
var path = require('path');
var fs     = require('fs');

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
    it('should shorten long strings',function(bddone){
      should(util.shorten("This is a long string that will not fit on a web page table, so please shorten it")).equal("This is a long string that wil...");
      should(util.shorten("Extreme Test",1)).equal("E...");
      bddone();
    })
  })
  describe('isURL', function() {
    var file =  path.resolve(__dirname,'data', "util.data.json");
    var data = JSON.parse(fs.readFileSync(file));
    it('should recognise some urls',function() {
      for (var i=0;i<data.isURLArray.length;i++) {
        should(util.isURL(data.isURLArray[i])).is.True();
      }
    })
    it('should sort Not Urls out',function() {
      for (var i=0;i<data.isNoURLArray.length;i++) {
        should(util.isURL(data.isNoURLArray[i])).is.False();
      }
    })
    it('should return a regex',function() {
      should((util.isURL() instanceof RegExp)).is.True();
    })
    it('should return false for markdown', function() {
      should((util.isURL('On October 8th, 2015 [Locus](http://www.locusmap.eu/) version [3.13.1](http://www.locusmap.eu/news-version-3-13.0/) was released.'))).is.False();
    })
  })
})