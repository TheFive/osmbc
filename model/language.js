"use strict";


const config = require("../config.js");
const debug = require("debug")("OSMBC:model:language");
const assert = require("assert");



let langMap = null;
let lid = null;

class Language {
  constructor(lid, displayShort, displayLong, localeString, bingPro, deeplProSource, deeplProTarget, deepProFormality) {
    this.lid = lid;
    this.displayShort = displayShort;
    this.displayLong = displayLong;
    this.localeString = localeString;
    this.bingPro = bingPro;
    this.deeplProSource = deeplProSource;
    this.deeplProTarget = deeplProTarget;
    this.deeplProFormality = deepProFormality;
  }
  // get displayShort() {return displayShort};
  // get displayLong() {return displayLong};
  // get localeString() {return localeString};
}


function initialise() {
  debug("initialise");
  assert(langMap === null);
  assert(lid === null);
  langMap = {};

  lid = [];
  const l = config.getValue("languages");
  if (!l.find(function(o) { if (o.lid === "EN") { return true; } return false; })) l.push({ lid: "EN" });
  l.forEach(function(lang) {
    assert(lang.lid);
    let ml = lang.momentLocale;
    if (!ml) ml = lang.lid;
    let dll = lang.displayLong;
    if (!dll) dll = lang.id;
    let dls = lang.displayShort;
    if (!dls) dls = lang.id;
    langMap[lang.lid.toUpperCase()] = new Language(lang.lid, dls, dll, ml, lang.bingPro, lang.deeplProSource, lang.deeplProTarget, lang.deeplProFormality);
    lid.push(lang.lid);
  });
}

exports.getLanguages = function() {
  if (langMap === null) initialise();
  return langMap;
};

exports.getLid = function() {
  if (lid === null) initialise();
  return lid;
};


exports.momentLocale = function(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  return (langMap[lang]) ? langMap[lang].localeString : "";
};

exports.bingPro = function(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  let result = lang.toUpperCase();
  if (langMap[lang.toUpperCase()] && langMap[lang.toUpperCase()].bingPro) result = langMap[lang.toUpperCase()].bingPro;
  return result;
};

exports.deeplProSourceLang = function(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  let result = lang.toUpperCase();
  if (langMap[lang.toUpperCase()] && langMap[lang.toUpperCase()].deeplProSource) result = langMap[lang.toUpperCase()].deeplProSource;
  return result;
};

exports.deeplProTargetLang = function(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  let result = lang.toUpperCase();
  if (langMap[lang.toUpperCase()] && langMap[lang.toUpperCase()].deeplProTarget) result = langMap[lang.toUpperCase()].deeplProTarget;
  return result;
};
exports.deeplProFormality = function(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  let result = null;
  if (langMap[lang.toUpperCase()] && langMap[lang.toUpperCase()].deeplProFormality) result = langMap[lang.toUpperCase()].deeplProFormality;
  return result;
};
