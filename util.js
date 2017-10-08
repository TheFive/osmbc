"use strict";

var debug = require("debug")("OSMBC:util");
var should = require('should');

var markdown = require("markdown-it")()
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
  if (typeof (string) === "number") return string;
  if (!string) return "";
  var newstring = string;
  if (typeof (string) === "object") newstring = JSON.stringify(string);
  if (typeof (string) === "boolean") newstring = string.toString();

  if (newstring.length < maxlength) return newstring;
  return newstring.substring(0, maxlength) + "...";
}

function toPGString(string, count) {
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
  var result = string.toLowerCase();
  while (result.indexOf(" ") >= 0) {
    result = result.replace(" ", "_");
  }
  return result;
}


function md_render(text) {
  if (typeof text === "undefined") text = "";
  if (text === null) text = "";

  // search a free standing link and make a markdown link from it.
  text = text.replace(/\s(https?:\/\/[^\[\]\(\)\s]*)\s/gi, " [$1]($1) ");
  text = text.replace(/^(https?:\/\/[^\[\]\(\)\s]*)\s/gi, "[$1]($1) ");
  text = text.replace(/\s(https?:\/\/[^\[\]\(\)\s]*$)/gi, " [$1]($1)");
  text = text.replace(/^(https?:\/\/[^\[\]\(\)\s]*$)/gi, "[$1]($1)");
  text = markdown.render(text);
  while (text.search("<a href=") >= 0) {
    text = text.replace("<a href=", '<a target="_blank" href=');
  }

  return text;
}


var isUrlRegex =      /^(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
var getAllUrlRegex = /(https?:\/\/[^\[\] \n\r()]*)/g;

// var getAllUrlRegex  = /(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g;

// var getAllUrlRegex  = /(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g;
// var isUrlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/

function isURL(t) {
  if (t) return isUrlRegex.test(t);
  return isUrlRegex;
}

function getAllURL(t) {
  let r = t.match(getAllUrlRegex);
  if (r === null) return [];
  return r;
}

function requireTypes(vars,types) {
  for (let i = 0;i<vars.length;i++) {
    should(typeof vars[i]).eql(types[i]);
  }
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

// Convert MD to HTML, and mark all http(s) links as hyperlinks.
exports.md_render = md_render;
