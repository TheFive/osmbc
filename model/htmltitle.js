"use strict";

const cheerio = require("cheerio");
const axios = require("axios").default;
const ssrfFilter = require("ssrf-req-filter");

const debug = require("debug")("OSMBC:model:htmltitle");

const charsetDecoder = require("../util/util.js").charsetDecoder;


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


const converterList = [retrieveForum, retrieveTwitter, retrieveOsmBlog, retrieveTitle];



async function getTitle(url) {
  debug("getTitle");

  let body = null;
  let r = null;
  const responseInterseptor = axios.interceptors.response.use(charsetDecoder);
  try {
    const response = await axios.get(url, {
      httpAgent: ssrfFilter(url),
      httpsAgent: ssrfFilter(url),
      timeout: 2000,
      responseType: "arraybuffer",
      responseEncoding: "binary"
    });
    body = response.data;
    axios.interceptors.response.eject(responseInterseptor);
  } catch (err) {
    axios.interceptors.response.eject(responseInterseptor);
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

