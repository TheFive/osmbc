"use strict";

var twitter = require("../model/twitter.js");
var config = require('../config.js');
var path = require('path');
var fs = require('fs');
var sinon = require('sinon');
var should = require('should');
// https://twitter.com/simonecortesi/status/692635300867092480
// https://twitter.com/mangomap/status/695426961548574722

describe("model/twitter",function() {
  var oldGetFunction;
  before(function (bddone){
    config.initialise();
    var oldGetFunction = twitter.for_debug_only.twitterClient.get;
    twitter.for_debug_only.twitterClient.get = sinon.spy(function (param,cb){
      if (param.substring(0,15)==="/statuses/show/") {
        var id = param.substring(15,999);
        var r = fs.readFileSync(path.join(__dirname,"data","TwitterStatus-"+id+".json"));
        r = JSON.parse(r);
        return cb(null,r);
      }
      return cb(new Error("API not simulated"));
    });
    bddone();
  });
  after(function (bddone){
    twitter.for_debug_only.twitterClient.get = oldGetFunction;
    bddone();
  });
  it('should expand a twitter collection url with no url in tweet',function (bddone){
    console.log("start test");
    twitter.expandTwitterUrl("https://twitter.com/simonecortesi/status/692635300867092480",function(err,result){
      should.not.exist(err);
      should(result).eql("https://twitter.com/simonecortesi/status/692635300867092480\n\nTweet by Simone Cortesi\nStarting today @WikimediaItalia is the official Local Chapter for Italy for @openstreetmap. Long live OSM!\n(Retweets: 22 Favs: 24)\n")
      bddone();
    });
  });
  it('should expand a twitter collection url with url in tweet',function (bddone){
    console.log("start test");
    twitter.expandTwitterUrl("https://twitter.com/mangomap/status/695426961548574722",function(err,result){
      should.not.exist(err);
      should(result).eql("https://twitter.com/mangomap/status/695426961548574722\n\nTweet by MangoMap\nHave you enrolled in our #QGIS for Beginners course on @discoverspatial? It's free! http://discoverspatial.com/courses/qgis-for-beginners\n(Retweets: 10 Favs: 5)\n")
      bddone();
    });
  });
});


     
