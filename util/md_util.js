

import markdownIt from "markdown-it";
import { full as markdownItEmoji } from "markdown-it-emoji";
import markdownItSup from "./markdown-it-sup.js";
import markdownItImsize from "./markdown-it-imsize.js";
import mila from "markdown-it-link-attributes";

import TurndownService from "turndown";
import turndownItSup from "../util/turndown-it-sup.js";
import turndownItEmoji from "../util/turndown-it-emoji.js";
import turndownItImsize from "../util/turndown-it-imsize.js";



import config from "../config.js";

import configModule from "../model/config.js";

const htmlRoot = config.htmlRoot();
const url = config.url();



/**
 * Builds the alternation of user and language names for mentions.
 * Longest names come first: the regex is used case-insensitively, so
 * `DE` (a language) must not win over `derFred` (a user) for `@derFred`.
 * @param {string[]} names user or language names, matched literally
 * @returns {string} regex source that never matches for an empty list
 */
function namesRegexSource(names) {
  if (names.length === 0) return "(?!)";
  const sorted = [...names].sort((a, b) => b.length - a.length);
  return "(?:" + sorted.map(n => n.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|") + ")";
}

// A mention ends where the name ends, not inside a longer word.
const mentionEnd = "(?![\\p{L}\\p{N}_])";

function userUrlMatcher(names) {
  const re = new RegExp("/usert/" + namesRegexSource(names) + "$", "iu");
  return function matcher(href) {
    try {
      return re.test(decodeURI(href)); // user names may contain spaces
    } catch {
      return re.test(href);
    }
  };
}

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

  const milaConfig = [
    {
      matcher: userUrlMatcher(listDenied),
      attrs: {
        class: "bg-danger",
        style: "color:black"
      }
    },
    {
      matcher: userUrlMatcher(listGuest),
      attrs: {
        class: "bg-warning",
        style: "color:black"
      }
    },
    {
      matcher: userUrlMatcher(listAll),
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
        self.re.twitter = new RegExp("^" + namesRegexSource(listAll) + mentionEnd, "iu");
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
      if (!self.re.articleLink) {
        self.re.articleLink = /^[0-9]+/;
      }
      if (self.re.articleLink.test(tail)) {
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




export function osmbcMarkdown(options, accessMap) {
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
}


function fixLength(text, len, fillChar) {
  let result = text;
  if (typeof text === "undefined") result = "";
  if (text === null) result = "";
  for (let i = result.length; i < len; i++) {
    result = result + fillChar;
  }
  return result;
}

function cleanPipeSymbol(text) {
  if (typeof text !== "string") return text;
  return text.replaceAll("|", " ");
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
      md = md + fixLength(cleanPipeSymbol(o[c.field]), c.displayLength, " ");
    }
    md = md + "|\n";
  }
  return md;
}


export function turndownService(options) {
    const turndownService = new TurndownService();
    turndownService.use(turndownItSup);
    if (!(options && options.hugo)) {
      turndownService.use(turndownItEmoji);
    }
    turndownService.use(turndownItImsize);
    return turndownService;
}



const mdUtil = {
  mdTable: mdTable,
  osmbcMarkdown: osmbcMarkdown,
  turndownService: turndownService
};

export default mdUtil;
