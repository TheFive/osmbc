"use strict";

var twitter = require("../model/twitter.js");
var config = require("../config.js");
var path = require("path");
var fs = require("fs");
var sinon = require("sinon");
var nock = require("nock");
var should = require("should");


describe("model/twitter", function() {
  var oldGetFunction;
  before(function (bddone) {
    config.initialise();
    oldGetFunction = twitter.for_debug_only.twitterClient.get;
    twitter.for_debug_only.twitterClient.get = sinon.spy(function (param, option, cb) {
      should(option).eql({tweet_mode: "extended"});
      if (param.substring(0, 15) === "/statuses/show/") {
        var id = param.substring(15, 999);
        var r = fs.readFileSync(path.join(__dirname, "data", "TwitterStatus-" + id + ".json"));
        r = JSON.parse(r);
        return cb(null, r);
      }
      return cb(new Error("API not simulated"));
    });
    bddone();
  });
  after(function (bddone) {
    twitter.for_debug_only.twitterClient.get = oldGetFunction;
    bddone();
  });
  it("should expand a twitter collection url with no url in tweet", function (bddone) {
    twitter.expandTwitterUrl("https://twitter.com/simonecortesi/status/692635300867092480", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://twitter.com/simonecortesi/status/692635300867092480\n\nTweet by **Simone Cortesi**\nStarting today @WikimediaItalia is the official Local Chapter for Italy for @openstreetmap. Long live OSM!\n(Retweets: **22** Favs: **24**)\n");
      bddone();
    });
  });
  it("should expand a twitter collection url with url in tweet", function (bddone) {
    nock("http://bit.ly")
      .intercept("/1Ghc7dI", "HEAD")
      .reply(301, undefined, {location: "http://discoverspatial.com/courses/qgis-for-beginners"});

    nock("http://discoverspatial.com")
      .intercept("/courses/qgis-for-beginners", "HEAD")
      .reply(200, "OK");

    twitter.expandTwitterUrl("https://twitter.com/mangomap/status/695426961548574722", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://twitter.com/mangomap/status/695426961548574722\n\nTweet by **MangoMap**\nHave you enrolled in our #QGIS for Beginners course on @discoverspatial? It's free! http://discoverspatial.com/courses/qgis-for-beginners\n(Retweets: **10** Favs: **5**)\n");
      bddone();
    });
  });
  it("should expand a twitter collection url with no twitter reference", function (bddone) {
    twitter.expandTwitterUrl("https://twitter.com/OSMBuildings/status/669252548600139776", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://twitter.com/OSMBuildings/status/669252548600139776\n\nTweet by **OSM Buildings**\nJust saw the ArcGIS city viewer at #ddj meetup. How many working hours were spent for that slow thing?\n(Retweets: **2** Favs: **3**)\n");
      bddone();
    });
  });
  it("should not expand non twitter collections", function (bddone) {
    twitter.expandTwitterUrl("https://www.openstreetmap.de/halloliloe", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://www.openstreetmap.de/halloliloe");
      bddone();
    });
  });
  it("should not expand a twitter collections without status", function (bddone) {
    twitter.expandTwitterUrl("https://twitter.com/OSMBuildings/669252548600139776", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://twitter.com/OSMBuildings/669252548600139776");
      bddone();
    });
  });
  it("should expand two twitter urls", function (bddone) {
    nock("http://bit.ly")
      .intercept("/1Ghc7dI", "HEAD")
      .reply(301, undefined, {location: "http://discoverspatial.com/courses/qgis-for-beginners"});

    nock("http://discoverspatial.com")
      .intercept("/courses/qgis-for-beginners", "HEAD")
      .reply(200, "OK");

    twitter.expandTwitterUrl("https://twitter.com/mangomap/status/695426961548574722?s=09 https://twitter.com/OSMBuildings/status/669252548600139776", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://twitter.com/mangomap/status/695426961548574722?s=09 https://twitter.com/OSMBuildings/status/669252548600139776\n\nTweet by **MangoMap**\nHave you enrolled in our #QGIS for Beginners course on @discoverspatial? It's free! http://discoverspatial.com/courses/qgis-for-beginners\n(Retweets: **10** Favs: **5**)\n\n\nTweet by **OSM Buildings**\nJust saw the ArcGIS city viewer at #ddj meetup. How many working hours were spent for that slow thing?\n(Retweets: **2** Favs: **3**)\n");
      bddone();
    });
  });
  it("should not reexpand two twitter urls, if they are expanded", function (bddone) {
    nock("http://bit.ly")
      .intercept("/1Ghc7dI", "HEAD")
      .reply(301, undefined, {location: "http://discoverspatial.com/courses/qgis-for-beginners"});

    nock("http://discoverspatial.com")
      .intercept("/courses/qgis-for-beginners", "HEAD")
      .reply(200, "OK");

    twitter.expandTwitterUrl("https://twitter.com/mangomap/status/695426961548574722?s=09 https://twitter.com/OSMBuildings/status/669252548600139776\n\nTweet by **MangoMap**\nHave you enrolled in our #QGIS for Beginners course on @discoverspatial? It's free! http://discoverspatial.com/courses/qgis-for-beginners\n(Retweets: **10** Favs: **5**)\n\n\nTweet by **OSM Buildings**\nJust saw the ArcGIS city viewer at #ddj meetup. How many working hours were spent for that slow thing?\n(Retweets: **2** Favs: **3**)\n", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://twitter.com/mangomap/status/695426961548574722?s=09 https://twitter.com/OSMBuildings/status/669252548600139776\n\nTweet by **MangoMap**\nHave you enrolled in our #QGIS for Beginners course on @discoverspatial? It's free! http://discoverspatial.com/courses/qgis-for-beginners\n(Retweets: **10** Favs: **5**)\n\n\nTweet by **OSM Buildings**\nJust saw the ArcGIS city viewer at #ddj meetup. How many working hours were spent for that slow thing?\n(Retweets: **2** Favs: **3**)\n");
      bddone();
    });
  });
  it("should not reexpand one twitter urls, if one other is expanded", function (bddone) {
    nock("http://bit.ly")
      .intercept("/1Ghc7dI", "HEAD")
      .reply(301, undefined, {location: "http://discoverspatial.com/courses/qgis-for-beginners"});

    nock("http://discoverspatial.com")
      .intercept("/courses/qgis-for-beginners", "HEAD")
      .reply(200, "OK");

    twitter.expandTwitterUrl("https://twitter.com/mangomap/status/695426961548574722?s=09 https://twitter.com/OSMBuildings/status/669252548600139776\n\nTweet by **MangoMap**\nHave you enrolled in our #QGIS for Beginners course on @discoverspatial? It's free! http://discoverspatial.com/courses/qgis-for-beginners https://t.co/p2UjgWVTUa\n(Retweets: **10** Favs: **5**)\n", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://twitter.com/mangomap/status/695426961548574722?s=09 https://twitter.com/OSMBuildings/status/669252548600139776\n\nTweet by **MangoMap**\nHave you enrolled in our #QGIS for Beginners course on @discoverspatial? It's free! http://discoverspatial.com/courses/qgis-for-beginners https://t.co/p2UjgWVTUa\n(Retweets: **10** Favs: **5**)\n\n\nTweet by **OSM Buildings**\nJust saw the ArcGIS city viewer at #ddj meetup. How many working hours were spent for that slow thing?\n(Retweets: **2** Favs: **3**)\n");
      bddone();
    });
  });
});



