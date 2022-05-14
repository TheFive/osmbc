"use strict";

const debug = require("debug")("OSMBC:util:util");
const assert = require("assert").strict;
const moment = require("moment");
const language = require("../model/language.js");


const htmlRoot = require("../config").htmlRoot();
const url = require("../config").url();



const markdown = require("markdown-it")()
  .use(require("markdown-it-sup"))
  .use(require("markdown-it-imsize"), { autofill: true });

function isTrue(expr) {
  return (expr === true || expr === "true");
}

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
}

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
}

function linkify(string) {
  debug("linkify");
  if (string === undefined) string = "undefined";
  let result = string.toLowerCase();
  while (result.indexOf(" ") >= 0) {
    result = result.replace(" ", "_");
  }
  return result;
}

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
}

function getAllURL(t) {
  const r = t.match(getAllUrlRegex);
  if (r === null) return [];
  return r;
}

function requireTypes(vars, types) {
  for (let i = 0; i < vars.length; i++) {
    assert.equal(typeof (vars[i]), types[i]);
  }
}

function dateFormat(date, lang) {
  return moment(date).tz("Europe/Berlin").locale(language.momentLocale(lang)).format("L");
}


// shorten shorten a string up to maxlength
// default is 30. If a string is shortenend, "..." is appendet
exports.shorten = shorten;
exports.isURL = isURL;
exports.toPGString = toPGString;
exports.getAllURL = getAllURL;
exports.requireTypes = requireTypes;
exports.linkify = linkify;
exports.isTrue = isTrue;
exports.dateFormat = dateFormat;

// Convert MD to HTML, and mark all http(s) links as hyperlinks.
// eslint-disable-next-line camelcase
exports.md_render = md_render;
