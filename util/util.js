import _debug from "debug";
import { strict as assert } from "assert";
import moment from "moment";
import language from "../model/language.js";
import iconv from "iconv-lite";
import markdownIt from "markdown-it";
import markdownItEmoji from "markdown-it-emoji";
import markdownItSup from "../util/markdown-it-sup.js";
import markdownItImsize from "../util/markdown-it-imsize.js";



import config from "../config.js";


const debug = _debug("OSMBC:util:util");
const htmlRoot = config.htmlRoot();
const url = config.url();


function sanitizeString(str) {
  str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim, "");
  return str.trim();
};

const markdown = markdownIt()
  .use(markdownItEmoji)
  .use(markdownItSup)
  .use(markdownItImsize, { autofill: true });

function isTrue(expr) {
  return (expr === true || expr === "true");
};

function shorten(string, maxlength) {
  debug("maxString");
  if (typeof (string) === "number") return string;
  if (typeof (maxlength) === "undefined") maxlength = 30;
  if (typeof (string) === "undefined") return "";
  if (!string) return "";
  let newstring = string;
  if (typeof (string) === "object") newstring = JSON.stringify(string);
  if (typeof (string) === "boolean") newstring = string.toString();

  if (newstring.length < maxlength) return newstring;
  return newstring.substring(0, maxlength) + "...";
};

function toPGString(string, count) {
  if (typeof string !== "string") return "";
  let result = "";
  if (!count) count = 1;
  for (let i = 0; i < string.length; i++) {
    let c = string.substring(i, i + 1);
    if ((c === "'") && (count === 1)) c = "''";
    if ((c === "'") && (count === 2)) c = "''''";
    // if (c= "\\") c= "\\\\";
    result += c;
  }
  return result;
};

function linkify(string) {
  debug("linkify");
  if (string === undefined) string = "undefined";
  let result = string.toLowerCase();
  while (result.indexOf(" ") >= 0) {
    result = result.replace(" ", "_");
  }
  return result;
};

// eslint-disable-next-line camelcase
function md_render(text, accessMap) {
  if (typeof text === "undefined") text = "";
  if (text === null) text = "";

  // search a free standing link and make a markdown link from it.
  text = text.replace(/\s(https?:\/\/[^\[\]\(\)\s]*)\s/gi, " [$1]($1) ");
  text = text.replace(/^(https?:\/\/[^\[\]\(\)\s]*)\s/gi, "[$1]($1) ");
  text = text.replace(/\s(https?:\/\/[^\[\]\(\)\s]*$)/gi, " [$1]($1)");
  text = text.replace(/^(https?:\/\/[^\[\]\(\)\s]*$)/gi, "[$1]($1)");
  text = text.replace(/#([0-9]+)/gi, "[#$1](" + url + htmlRoot + "/article/$1)");
  text = markdown.render(text);
  while (text.search("<a href=") >= 0) {
    text = text.replace("<a href=", '<a target="_blank" href=');
  }
  if (accessMap) {
    for (const user in accessMap) {
      const mention = "\\@" + user;
      let cl = "bg-success";
      if (accessMap[user] === "guest") cl = "bg-warning";
      if (accessMap[user] === "denied") cl = "bg-danger";
      const userUrl = user.replace(" ", "%20");
      text = text.replace(new RegExp("( |\n|<p>)" + mention + "( |\n|</p>)", "i"), "$1<a class='" + cl + "' style='color:black' href=" + htmlRoot + "/usert/" + userUrl + ">@" + user + "</a>$2");
    }
  }
  return text;
}


const isUrlRegex =      /^(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
const getAllUrlRegex = /(https?:\/\/[^\[\] \n\r()]*)/g;

// var getAllUrlRegex  = /(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g;

// var getAllUrlRegex  = /(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g;
// var isUrlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/

function isURL(t) {
  if (t) return isUrlRegex.test(t);
  return isUrlRegex;
};

function getAllURL(t) {
  const r = t.match(getAllUrlRegex);
  if (r === null) return [];
  return r;
};

function requireTypes(vars, types) {
  for (let i = 0; i < vars.length; i++) {
    assert.equal(typeof (vars[i]), types[i]);
  }
};

function dateFormat(date, lang) {
  return moment(date).tz("Europe/Berlin").locale(language.momentLocale(lang)).format("L");
};




function sleep(time) {
  return new Promise((resolve, reject) => { setTimeout(resolve, time); });
}




function osmbcLink(link) {
  // warning this seems to be only implemented for tests
  const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
  return baseLink + link;
};

function charsetDecoder(response) {
  let fromcharset = response.headers["content-encoding"];
  if (!fromcharset) {
    const ct = response.headers["content-type"];
    if (ct) {
      const r = ct.match(/.*?charset=([^"']+)/);
      if (r)fromcharset = r[1];
    }
  }
  if (!fromcharset) {
    const r = response.data.toString("utf-8").match((/<meta.*?charset=([^"']+)/i));
    if (r) fromcharset = r[1];
  }

  if (!iconv.encodingExists(fromcharset)) fromcharset = "UTF-8";



  response.data = iconv.decode(response.data, fromcharset);

  return response;
};





const util = {
  sanitizeString: sanitizeString,
  isTrue: isTrue,
  shorten: shorten,
  toPGString: toPGString,
  linkify: linkify,
  isURL: isURL,
  getAllURL: getAllURL,
  requireTypes: requireTypes,
  dateFormat: dateFormat,
  charsetDecoder: charsetDecoder,
  sleep: sleep,
  osmbcLink: osmbcLink,
  md_render: md_render
};

export default util;
