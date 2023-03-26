"use strict";

const markdownIt = require("markdown-it");
const markdownItEmoji = require("markdown-it-emoji");
const markdownItSup = require("markdown-it-sup");
const markdownItImsize = require("markdown-it-imsize");
const mila = require("markdown-it-link-attributes");
const config = require("../config.js");

const configModule = require("../model/config.js");


module.exports.osmbcMarkdown = function osmbcMarkdown(options) {
  const languageFlags = configModule.getConfig("languageflags");
  let localEmoji = false;
  if (options && options.translation) {
    // this should only be called for the pretranslation html rendering it
    // has a simplified own defined output to ease turndown the translation result.
    localEmoji = {};
    for (const k in languageFlags.emoji) {
      localEmoji[k] = "<emoji src='" + k + "'>Picture</emoji>";
    }
  } else {
    localEmoji = languageFlags.emoji;
  }
  let linkAttributeOptions = {};
  if (options && options.target) {
    if (config.getValue("link-attributes") && config.getValue("link-attributes")[options.target]) {
      linkAttributeOptions = config.getValue("link-attributes")[options.target];
    }
  }

  const result =  markdownIt()
    .use(mila, { attrs: linkAttributeOptions })
    .use(markdownItEmoji, { defs: localEmoji, shortcuts: languageFlags.shortcut })
    .use(markdownItSup)
    .use(markdownItImsize, { autofill: true })
   ;
  return result;
};


function fixLength(text, len, fillChar) {
  let result = text;
  if (typeof text === "undefined") result = "";
  if (text === null) result = "";
  for (let i = result.length; i < len; i++) {
    result = result + fillChar;
  }
  return result;
}

function mdTable(json, columns) {
  for (const c of columns) {
    let cMin = c.name.length;
    let o;
    for (o of json) {
      if (o[c.field] && o[c.field].length > cMin) cMin = o[c.field].length;
    }
    c.displayLength = cMin;
  }
  let md = "";
  // Generate Markdown Header
  for (const c of columns) {
    md = md + "|";
    md = md + fixLength(c.name, c.displayLength, " ");
  }
  md = md + "|\n";
  // generate Markdown Line
  for (const c of columns) {
    md = md + "|";
    md = md + fixLength("", c.displayLength, "-");
  }
  md = md + "|\n";
  // Generate rest

  for (const o of json) {
    for (const c of columns) {
      md = md + "|";
      md = md + fixLength(o[c.field], c.displayLength, " ");
    }
    md = md + "|\n";
  }
  return md;
}



module.exports.mdTable = mdTable;
