"use strict";

const markdownIt = require("markdown-it");
const markdownItEmoji = require("markdown-it-emoji");
const markdownItSup = require("markdown-it-sup");
const markdownItImsize = require("markdown-it-imsize");
const mila = require("markdown-it-link-attributes");
const config = require("../config.js");
const { regex } = require("list-matcher");

const configModule = require("../model/config.js");

const htmlRoot = config.htmlRoot();
const url = config.url();



function addUserAndArticleLinkify(markdownIt, accessMap) {
  // Add a converter for User Mentions (used in Comments)
  // and a converter for #2382 (Links to Articles) from Markdown to HTML
  const listDenied = [];
  const listGuest = [];
  const listAll = [];
  if (accessMap) {
    for (const u in accessMap) {
      listAll.push(u);
      if (accessMap[u] === "denied") listDenied.push(u);
      if (accessMap[u] === "guest") listGuest.push(u);
    }
  }
  const regexDenied = regex(listDenied);
  const regexGuest = regex(listGuest);
  const regexAll = regex(listAll);

  const milaConfig = [
    {
      matcher(href) {
        return href.match(new RegExp(regexDenied.source + /$/.source, "i"));
      },
      attrs: {
        class: "bg-danger",
        style: "color:black"
      }
    },
    {
      matcher(href) {
        return href.match(new RegExp(regexGuest.source + /$/.source, "i"));
      },
      attrs: {
        class: "bg-warning",
        style: "color:black"
      }
    },
    {
      matcher(href) {
        return href.match(new RegExp(regexAll.source + /$/.source, "i"));
      },
      attrs: {
        class: "bg-success",
        style: "color:black"
      }
    }
  ];
  markdownIt.use(mila, milaConfig);
  markdownIt.linkify.add("@", {
    validate: function (text, pos, self) {
      const tail = text.slice(pos);
      if (!self.re.twitter) {
        self.re.twitter = new RegExp(/^/.source + regexAll.source, "i");
      }
      if (self.re.twitter.test(tail)) {
        // Linkifier allows punctuation chars before prefix,
        // but we additionally disable `@` ("@@mention" is invalid)
        if (pos >= 2 && tail[pos - 2] === "@") {
          return false;
        }
        return tail.match(self.re.twitter)[0].length;
      }
      return 0;
    },
    normalize: function (match) {
      // const userUrl = match.url.replace(" ", "%20");
      match.url = url + htmlRoot + "/usert/" + match.url.replace(/^@/, "");
    }
  });
  markdownIt.linkify.add("#", {
    validate: function (text, pos, self) {
      const tail = text.slice(pos);
      console.log("validating #");
      if (!self.re.articleLink) {
        self.re.articleLink = /^[0-9]+/;
      }
      if (self.re.articleLink.test(tail)) {
        console.log("validating # found something");
        return tail.match(self.re.articleLink)[0].length;
      }
      return 0;
    },
    normalize: function (match) {
      // const userUrl = match.url.replace(" ", "%20");
      match.url = url + htmlRoot + "/article/" + match.url.replace(/^#/, "");
    }
  });
}




module.exports.osmbcMarkdown = function osmbcMarkdown(options, accessMap) {
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
  const linkify = (options && options.target && options.target === "editor");


  const result =  markdownIt({ linkify: linkify })
    .use(mila, { attrs: linkAttributeOptions })
    .use(markdownItEmoji, { defs: localEmoji, shortcuts: languageFlags.shortcut })
    .use(markdownItSup)
    .use(markdownItImsize, { autofill: true });

  if (linkify && accessMap) {
    addUserAndArticleLinkify(result, accessMap);
  }
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
