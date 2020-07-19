"use strict";

var Twit = require("twit");
var config = require("../config.js");
var request = require("request");
var async = require("../util/async_wrap.js");
var debug = require("debug")("OSMBC:model:twitter");



function expandUrl(shortUrl, callback) {
  debug("expandUrl");
  request({ method: "HEAD", url: shortUrl, followAllRedirects: true },
    function (error, response) {
      if (error) return callback(null, shortUrl);
      return callback(null, response.request.href);
    }
  );
}

var client = new Twit(
  config.getValue("twitter")
);


function expandTwitterUrl(collection, callback) {
  debug("expandTwitterUrl");
  if (!collection) return callback();


  // extracting Twitter Status from collection
  // put them in an array twitIDs

  const getAllTwitterIds = /https?:\/\/twitter\.com\/[^\/ ]*\/status\/([0-9]*)/g;

  const twitIDs = [];

  let m;

  while ((m = getAllTwitterIds.exec(collection)) !== null) {
    /* jshint loopfunc: true */
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === getAllTwitterIds.lastIndex) {
      getAllTwitterIds.lastIndex++;
    }

    // The result can be accessed through the `m`-variable.
    m.forEach((match, groupIndex) => {
      if (groupIndex === 1) twitIDs.push(match);
    });
  }

  if (twitIDs.length === 0) return callback(null, collection);
  const collExtension = [];


  async.eachOf(twitIDs, function(twitID, index, cbEachID) {
    client.get("/statuses/show/" + twitID, { tweet_mode: "extended" }, function(err, result) {
      debug("client.get");
      // fs.writeFileSync("TwitterStatus-"+id+".json",JSON.stringify(result,null,2));
      // not working, ignore error

      collExtension[index] = "";

      // Error, ignore and do not expand
      if (err) {
        console.error("Error while expanding twitter url" + "/statuses/show/" + twitID);
        console.error(err);
        return callback(null, collection);
      }
      if (!result) return callback(null, collection);

      let tweetAsText = result.full_text;

      // Expand Tweet Urls

      async.eachSeries(result.entities.urls, function(item, cb) {
        var u = item.expanded_url;
        expandUrl(u, function(err, url) {
          if (err) return cb(err);
          tweetAsText = tweetAsText.replace(item.url, url);

          cb();
        });
      }, function finalFunction(err) {
        if (err) return cbEachID(err);

        tweetAsText = tweetAsText.replace(/.https:\/\/t\.co\/........../i, "");


        // tweet is already expanded
        if (collection.replace(/\r/g, "").indexOf(tweetAsText) > 0) return cbEachID(null);

        collExtension[index] = "Tweet by **" + result.user.name + "**\r\n";
        collExtension[index] += tweetAsText + "\r\n";
        collExtension[index] += "(Retweets: **" + result.retweet_count + "** Favs: **" + result.favorite_count + "**)\r\n";

        return cbEachID(null);
      });
    });
  }, function(err) {
    if (err) return callback(err, null);
    let result = collection;
    collExtension.forEach(function(item) {
      if (item.length > 0) result = result + "\r\n\r\n" + item;
    });
    callback(null, result);
  });
}

module.exports.expandTwitterUrl = expandTwitterUrl;

module.exports.for_debug_only = { twitterClient: client };
