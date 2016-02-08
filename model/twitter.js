"use strict";

var twit = require("twit");
var config = require('../config.js');
var debug = require('debug')('OSMBC:model:twitter');


var client = new twit(
  config.getValue("twitter")
);

function expandTwitterUrl(url,callback) {
  debug("expandTwitterUrl");

  // No Twitter Url, return url as result.
    
 
  if ((url.substring(0,20)!=="https://twitter.com/") && (url.substring(0,19)!=="http://twitter.com/")) {
    return callback(null,url);
  } 
    
 
  if (url.indexOf("/status/")<0) return callback(null,url);

  var id = url.substring(url.indexOf("/status/")+8,99);
  client.get("/statuses/show/"+id,function(err,result) {
    // not working, ignore error

    if (err) return callback(null,url);
    if (!result) return callback(null,url);

    var collection = url + "\n";
    collection += result.text+"\n";

    console.dir(result.entities.urls);
    for (var i =0;i<result.entities.urls.length;i++) {
      var u = result.entities.urls[i];
      collection += u.expanded_url+"\n";
    }
    return callback(null,collection);
  });
}


expandTwitterUrl("https://twitter.com/mangomap/status/695426961548574722",function (err,result){
  console.log(result);
});