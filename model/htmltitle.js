"use strict";

var cheerio = require('cheerio');
var request = require('request');
var Iconv  = require('iconv').Iconv;
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

    // Only replace Twitter Url, if it exists.
    if (title) title=title.replace(/(https?:\/\/[^[\] \n\r"”“]*)/gi, '<..>');
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
  request( { method: "GET", url: url, followAllRedirects: true,encoding:null,timeout:2000},
    function (error, response,body) {
      if (error) console.dir(error);
      if (error && error.code =="ESOCKETTIMEDOUT") return callback(null,url+" TIMEOUT");
      if (error) return callback(null,"Page not Found");

      // try to get charset from Headers (version 1)
      var fromcharset = response.headers['content-encoding'];

      // if not exist, try to get charset from Headers (version 2)
      if (!fromcharset) {
        let ct = response.headers['content-type'];
        if (ct) {
          let r = ct.match(/.*?charset=([^"']+)/);
          if (r)fromcharset = r[1];
        }
      }
      // if not exist, try to parse html page for charset in text
      if (!fromcharset) {
        let r = body.toString('utf-8').match((/<meta.*?charset=([^"']+)/));
        if (r) fromcharset = r[1];
      }

      // nothing given, to use parser set incoming & outcoming charset equal
      if (!fromcharset) fromcharset = "UTF-8";
      var utf8body = null;
      try {
        var iconv = new Iconv(fromcharset,'UTF-8');
        utf8body = iconv.convert(body).toString('UTF-8');
      } catch (err) {
        // There is a convert error, ognore it and convert with UTF-8
        utf8body = body.toString('UTF-8');
      }



      let r = null;
      for (let i=0;i<converterList.length;i++) {
        r = converterList[i](utf8body,url);
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

