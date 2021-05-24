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
  if (!l.find(function(o) { if (o.lid === "EN") { return true; } return false; })) l.push({ lid: "EN" });
  l.forEach(function(lang) {
    assert(lang.lid);
    let ml = lang.momentLocale;
    if (!ml) ml = lang.lid;
    langMap[lang.lid] = new Language(lang.lid, lang.lid, lang.lid, ml);
    lid.push(lang.lid);
  });
}

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
