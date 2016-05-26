"use strict";

var cheerio = require('cheerio');
var request = require('request');

var debug = require('debug')('OSMBC:model:htmltitle');

function linkFrom(url,page) {
  if (url.substring(0,page.length+7)==("http://"+page)) return true;
  if (url.substring(0,page.length+8)==("https://"+page)) return true;
  return false;
}


function retrieveForum(body,url) {
  if (linkFrom(url,"forum.openstreetmap.org")) {
    let c = cheerio.load(body);
    let title = c("title").text().replace(" / OpenStreetMap Forum","");
    return title;
  }
  return null;
}

function retrieveOsmBlog(body,url) {
  if (linkFrom(url,"www.openstreetmap.org")) {
    let c = cheerio.load(body);
    let title = c("title").text().replace("OpenStreetMap | ","");
    return title;
  }
  return null;
}

function retrieveTwitter(body,url) {
  if (linkFrom(url,"twitter.com")) {
    let c = cheerio.load(body);
    let title = c('meta[property="og:description"]').attr("content");
    //
    title=title.replace(/(https?:\/\/[^[\] \n\r"”“]*)/gi, '<..>');
    return title;
  }
  return null;
}

function retrieveTitle(body) {
  let c = cheerio.load(body);
  let title = c('title').text();
  return title;
}

// Team wished only to grap title, not description.
/*
function retrieveDescription(body) {
  let c = cheerio.load(body);
  let title = c('meta[property="og:description"]').attr("content");
  if (typeof(title)=="undefined") title = null;
  return title;
}*/

var converterList = [retrieveForum,retrieveTwitter,retrieveOsmBlog,retrieveTitle];


function getTitle(url,callback) {
  debug("getTitle");
  request( { method: "GET", url: url, followAllRedirects: true },
    function (error, response,body) {
      if (error) return callback(null,"Page not Found");
      let r = null;
      for (let i=0;i<converterList.length;i++) {
        r = converterList[i](body,url);
        if (r) break;
      }
      // remove all linebreaks
      r = r.replace(/(\r\n|\n|\r)/gm," ");
      return callback(null,r);
    }
  );
}


module.exports.getTitle = getTitle;

module.exports.fortestonly = {};
module.exports.fortestonly.linkFrom = linkFrom;

