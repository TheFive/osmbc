"use strict";

const cheerio = require("cheerio");
const axios = require("axios").default;
const ssrf = require("ssrf");
const debug = require("debug")("OSMBC:model:htmltitle");
const iconv = require("iconv-lite");


function linkFrom(url, page) {
  if (url.substring(0, page.length + 7) === ("http://" + page)) return true;
  if (url.substring(0, page.length + 8) === ("https://" + page)) return true;
  return false;
}


function retrieveForum(body, url) {
  if (linkFrom(url, "forum.openstreetmap.org")) {
    const c = cheerio.load(body);
    const title = c("title").text().replace(" / OpenStreetMap Forum", "").trim();
    return title;
  }
  return null;
}

function retrieveOsmBlog(body, url) {
  if (linkFrom(url, "www.openstreetmap.org")) {
    const c = cheerio.load(body);
    const title = c("title").text().replace("OpenStreetMap | ", "").trim();
    return title;
  }
  return null;
}

function retrieveTwitter(body, url) {
  if (linkFrom(url, "twitter.com")) {
    const c = cheerio.load(body);
    let title = c('meta[property="og:description"]').attr("content");

    // Only replace Twitter Url, if it exists.
    if (title) title = title.replace(/(https?:\/\/[^[\] \n\r"”“]*)/gi, "<..>").trim();
    return title;
  }
  return null;
}

function retrieveTitle(body) {
  const c = cheerio.load(body);
  const title = c("title").text().trim();
  return title;
}

// Team wished only to grap title, not description.
/*
function retrieveDescription(body) {
  let c = cheerio.load(body);
  let title = c('meta[property="og:description"]').attr("content");
  if (typeof(title)=="undefined") title = null;
  return title;
} */

const converterList = [retrieveForum, retrieveTwitter, retrieveOsmBlog, retrieveTitle];

async function getTitle(url) {
  debug("getTitle");
  let gotUrl;
  try {
    gotUrl = await ssrf.url(url);
  } catch (err) {
    throw new Error("SSRL Test failed for URL");
  }
  let body = null;
  let r = null;
  try {
    const response = await axios.get(gotUrl, { timeout: 2000, responseType: "arraybuffer", responseEncoding: "binary" });
    body = response.data;

    // try to get charset from Headers (version 1)
    let fromcharset = response.headers["content-encoding"];

    // if not exist, try to get charset from Headers (version 2)
    if (!fromcharset) {
      const ct = response.headers["content-type"];
      if (ct) {
        const r = ct.match(/.*?charset=([^"']+)/);
        if (r)fromcharset = r[1];
      }
    }
    // if not exist, try to parse html page for charset in text
    if (!fromcharset) {
      const r = body.toString("utf-8").match((/<meta.*?charset=([^"']+)/i));
      if (r) fromcharset = r[1];
    }

    // nothing given, to use parser set incoming & outcoming charset equal
    if (!iconv.encodingExists(fromcharset)) fromcharset = "UTF-8";

    body = iconv.decode(body, fromcharset);
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      r = url + " TIMEOUT";
    } else throw new Error("Problem with url");
  }
  for (let i = 0; i < converterList.length; i++) {
    if (r) break;
    r = converterList[i](body, url);
  }
  // remove all linebreaks
  r = r.replace(/(\r\n|\n|\r)/gm, " ");
  if (r === null) r = "Not Found";
  return r;
}





module.exports.getTitle = getTitle;

module.exports.fortestonly = {};
module.exports.fortestonly.linkFrom = linkFrom;

