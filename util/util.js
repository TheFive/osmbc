import _debug from "debug";
import { strict as assert } from "assert";
import moment from "moment";
import language from "../model/language.js";
import iconv from "iconv-lite";

import config from "../config.js";


const debug = _debug("OSMBC:util:util");


function sanitizeString(str) {
  str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim, "");
  return str.trim();
};

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

function summarizeError(error, extraFields = {}) {
  if (!error) {
    return Object.assign({ message: "Unknown error" }, extraFields);
  }

  if (typeof error === "string") {
    return Object.assign({ message: error }, extraFields);
  }

  return Object.assign({
    name: error.name,
    message: error.message || String(error),
    code: error.code,
    status: error.status || error.response?.status,
    statusText: error.response?.statusText,
    method: error.config?.method,
    url: error.config?.url
  }, extraFields);
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



const isUrlRegex =      /^(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;

// this regex is simplified for plain text (collection box) usage
// for Markdown Link Extraction use the markdown link extractor
const getAllUrlRegex = /\b(https?:\/\/[^\[\] \n\r]*)\b/g;

// const getAllUrlRegex  = /(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g;

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
  assert(Array.isArray(vars));
  assert(Array.isArray(types));
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


/**
 * Replaces all ##key## placeholders in a template string with values from a variables object.
 * The key lookup is case-insensitive. The case of the placeholder determines value conversion:
 * - ##KEY## (UPPERCASE) converts value to UPPERCASE
 * - ##key## (lowercase) converts value to lowercase
 * - ##Key## (Mixed case) keeps value as-is
 * Integers and other non-strings are converted to string automatically.
 * @param {string} template - The template string containing ##key## placeholders
 * @param {object} variables - Object with key-value pairs to replace
 * @returns {string} - The template string with all placeholders replaced
 */
function replaceTemplateVariables(template, variables = {}) {
  if (typeof template !== "string") {
    debug(`replaceTemplateVariables: template is not a string, got ${typeof template}`);
    return String(template);
  }

  // Build a case-insensitive lookup map: lowercase key -> original value
  const lookup = {};
  for (const [key, value] of Object.entries(variables)) {
    lookup[key.toLowerCase()] = value;
  }

  return template.replace(/##([^#]+)##/g, (match, placeholderKey) => {
    const normalizedKey = placeholderKey.toLowerCase();
    if (!(normalizedKey in lookup)) return match;

    const stringValue = String(lookup[normalizedKey]);

    if (placeholderKey === placeholderKey.toUpperCase() && placeholderKey !== placeholderKey.toLowerCase()) {
      // Placeholder key is UPPERCASE -> convert value to UPPERCASE
      return stringValue.toUpperCase();
    } else if (placeholderKey === placeholderKey.toLowerCase()) {
      // Placeholder key is lowercase -> convert value to lowercase
      return stringValue.toLowerCase();
    }
    // Mixed case -> keep value as-is
    return stringValue;
  });
};





const util = {
  sanitizeString: sanitizeString,
  isTrue: isTrue,
  shorten: shorten,
  summarizeError: summarizeError,
  toPGString: toPGString,
  linkify: linkify,
  isURL: isURL,
  getAllURL: getAllURL,
  requireTypes: requireTypes,
  dateFormat: dateFormat,
  charsetDecoder: charsetDecoder,
  sleep: sleep,
  osmbcLink: osmbcLink,
  replaceTemplateVariables: replaceTemplateVariables
};

export default util;
