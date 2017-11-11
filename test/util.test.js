"use strict";

var util = require("../util/util.js");
var should = require("should");
var path = require("path");
var fs     = require("fs");

/* eslint-disable mocha/no-synchronous-tests */
describe("util", function() {
  var data;
  before(function() {
    var file =  path.resolve(__dirname, "data", "util.data.json");
    data = JSON.parse(fs.readFileSync(file));
  });
  describe("shorten", function () {
    it("should return empty string for undefined", function(bddone) {
      should(util.shorten()).equal("");
      var t;
      should(util.shorten(t)).equal("");
      should(util.shorten(t, 25)).equal("");
      bddone();
    });
    it("should not shorten small strings", function(bddone) {
      should(util.shorten("Short Test String")).equal("Short Test String");
      should(util.shorten("Short Test String", 20)).equal("Short Test String");
      bddone();
    });
    it("should shorten long strings", function(bddone) {
      should(util.shorten("This is a long string that will not fit on a web page table, so please shorten it")).equal("This is a long string that wil...");
      should(util.shorten("Extreme Test", 1)).equal("E...");
      bddone();
    });
    it("should shorten objects and other non strings", function(bddone) {
      should(util.shorten({name: "Hallo"})).equal('{"name":"Hallo"}');
      should(util.shorten(null)).equal("");
      should(util.shorten(true)).equal("true");
      bddone();
    });
  });
  describe("toPGString", function() {
    it("should keep things unchanged", function() {
      should(util.toPGString("This is a string")).eql("This is a string");
      should(util.toPGString("https://thisisanurl.org/hallo/do")).eql("https://thisisanurl.org/hallo/do");
    });
    it("should escape ' with '", function() {
      should(util.toPGString("This is a 'string")).eql("This is a ''string");
    });
    it("should double escape ' with '", function() {
      should(util.toPGString("This is a 'string", 2)).eql("This is a ''''string");
    });
  });
  describe("isURL", function() {
    it("should recognise some urls", function() {
      for (var i = 0; i < data.isURLArray.length; i++) {
        should(util.isURL(data.isURLArray[i])).is.True();
      }
    });
    it("should sort Not Urls out", function() {
      for (var i = 0; i < data.isNoURLArray.length; i++) {
        should(util.isURL(data.isNoURLArray[i])).is.False();
      }
    });
    it("should return a regex", function() {
      should((util.isURL() instanceof RegExp)).is.True();
    });
    it("should return false for markdown", function() {
      should((util.isURL("On October 8th, 2015 [Locus](http://www.locusmap.eu/) version [3.13.1](http://www.locusmap.eu/news-version-3-13.0/) was released."))).is.False();
    });
    it("should return false for complex google url", function() {
      should((util.isURL("https://www.google.de/maps/place/Fehlerbereich,+01067+Dresden/@51.0515917,13.7388822,19z/data=!3m1!4b1!4m2!3m1!1s0x4709cf67e58aaa97:0xf782605d9ac23f2c"))).is.True();
    });
  });
  describe("getAllUrl", function() {
    it("should return an empty array for different strings", function() {
      should(util.getAllURL("")).eql([]);
      should(util.getAllURL("Some Text")).eql([]);
    });
    it("should return one url for a 'collection'", function() {
      for (var i = 0; i < data.isURLArray.length; i++) {
        let url = data.isURLArray[i];
        should(util.getAllURL(url)).eql([url]);
        should(util.getAllURL(url + "\n ")).eql([url]);
        should(util.getAllURL(" \n" + url)).eql([url]);
      }
    });
    it("should return several url for a 'collection'", function() {
      for (var i = 0; i < data.isURLArray.length - 1; i++) {
        let url1 = data.isURLArray[i];
        let url2 = data.isURLArray[i + 1];
        should(util.getAllURL(url1 + " " + url2)).eql([url1, url2]);
        should(util.getAllURL(url1 + "\n " + url2)).eql([url1, url2]);
        should(util.getAllURL("  " + url1 + " \n" + url2)).eql([url1, url2]);
      }
    });
    it("should return several url for a 'markdown'", function() {
      should(util.getAllURL('* Wer schon immer mal einen ["Fehlerbereich"]( https://www.google.de/maps/place/Fehlerbereich,+01067+Dresden/@51.0515917,13.7388822,19z/data=!3m1!4b1!4m2!3m1!1s0x4709cf67e58aaa97:0xf782605d9ac23f2c) besuchen wollte, kann sich von Google Maps dahin leiten lassen. Wer sich von Google Maps zum [Brecon Beacons National Park](http://www.openstreetmap.org/#map=10/51.8031/-3.5170) in Wales hat führen lassen, ist an einem Ort südlich des Londoner Hyde Parks gelandet, wie die BBC [berichtet](http://www.bbc.com/news/uk-wales-mid-wales-34410736).'))
        .eql(["https://www.google.de/maps/place/Fehlerbereich,+01067+Dresden/@51.0515917,13.7388822,19z/data=!3m1!4b1!4m2!3m1!1s0x4709cf67e58aaa97:0xf782605d9ac23f2c",
          "http://www.openstreetmap.org/#map=10/51.8031/-3.5170",
          "http://www.bbc.com/news/uk-wales-mid-wales-34410736"]);
    });
  });
  describe("linkify", function() {
    it("should convert the links correct", function() {
      should(util.linkify("#WN271_Titel Des Artikels")).equal("#wn271_titel_des_artikels");
    });
  });
  describe("md_render", function() {
    it("should convert a simple link", function() {
      var r = util.md_render("http://www.google.de/hallo");
      should(r).eql('<p><a target="_blank" href="http://www.google.de/hallo">http://www.google.de/hallo</a></p>\n');
    });
    it("should convert a simple link at the end", function() {
      var r = util.md_render("*italic* http://www.google.de/hallo");
      should(r).eql("<p><em>italic</em> <a target=\"_blank\" href=\"http://www.google.de/hallo\">http://www.google.de/hallo</a></p>\n");
    });
    it("should convert a simple link at the start and ignore a MD LInk", function() {
      var r = util.md_render("http://www.google.de/hallo is a synonym for [this](https://www.google.de/hallo2)");
      should(r).eql('<p><a target="_blank" href="http://www.google.de/hallo">http://www.google.de/hallo</a> is a synonym for <a target="_blank" href="https://www.google.de/hallo2">this</a></p>\n');
    });
  });
});
