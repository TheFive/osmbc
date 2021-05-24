"use strict";


const config = require("../config.js");
const debug = require("debug")("OSMBC:model:language");
const assert = require("assert");



let languages = null;
const langMap = {};
let lid = null;

class Language {
  constructor(lid, displayShort, displayLong, localeString) {
    this.lid = lid;
    this.displayShort = displayShort;
    this.displayLong = displayLong;
    this.localeString = localeString;
  }
  // get displayShort() {return displayShort};
  // get displayLong() {return displayLong};
  // get localeString() {return localeString};
}


function initialise() {
  debug("initialise");
  assert(languages === null);
  assert(lid === null);
  languages = [];
  lid = [];
  const l = config.getValue("languages");
  let momentLocale = config.getValue("moment_locale");
  if (!momentLocale) momentLocale = {};
  if (l.indexOf("EN") < 0) l.push("EN");

  l.forEach(function(lang) {
    let ml = momentLocale[lang];
    if (!ml) ml = lang;
    langMap[lang] = new Language(lang, lang, lang, ml);
    lid.push(lang);
  });
};


exports.getLanguages = function() {
  if (languages === null) initialise();
  return languages;
};

exports.getLid = function() {
  if (lid === null) initialise();
  return lid;
};


exports.momentLocale = function(lang) {
  if (lang === null) return null;
  if (languages === null) initialise();
  return langMap[lang].localeString;
};
