


import config from "../config.js";
import { strict as assert } from "assert";
import _debug from "debug";
const debug = _debug("OSMBC:model:language");



let langMap = null;
let lid = null;

class Language {
  constructor(lid, displayShort, displayLong, localeString, deeplProSource, deeplProTarget, deepProFormality, wpExportName) {
    this.lid = lid;
    this.displayShort = displayShort;
    this.displayLong = displayLong;
    this.localeString = localeString;
    this.deeplProSource = deeplProSource;
    this.deeplProTarget = deeplProTarget;
    this.deeplProFormality = deepProFormality;
    this.wpExportName = wpExportName;
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
    langMap[lang.lid.toUpperCase()] = new Language(lang.lid, dls, dll, ml, lang.deeplProSource, lang.deeplProTarget, lang.deeplProFormality, lang.wpExportName);
    lid.push(lang.lid);
  });
}

function getLanguages() {
  if (langMap === null) initialise();
  return langMap;
}

function getLid() {
  if (lid === null) initialise();
  return lid;
}


function momentLocale(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  return (langMap[lang]) ? langMap[lang].localeString : "";
}


function deeplProSourceLang(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  let result = lang.toUpperCase();
  if (langMap[lang.toUpperCase()] && langMap[lang.toUpperCase()].deeplProSource) result = langMap[lang.toUpperCase()].deeplProSource;
  return result;
}

function deeplProTargetLang(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  let result = lang.toUpperCase();
  if (langMap[lang.toUpperCase()] && langMap[lang.toUpperCase()].deeplProTarget) result = langMap[lang.toUpperCase()].deeplProTarget;
  return result;
}
function deeplProFormality(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  let result = null;
  if (langMap[lang.toUpperCase()] && langMap[lang.toUpperCase()].deeplProFormality) result = langMap[lang.toUpperCase()].deeplProFormality;
  return result;
}
function wpExportName(lang) {
  if (lang === null) return null;
  if (langMap === null) initialise();
  let result = lang.toUpperCase();
  if (langMap[lang.toUpperCase()] && langMap[lang.toUpperCase()].wpExportName) result = langMap[lang.toUpperCase()].wpExportName;
  return result;
}


const language = {
  getLanguages: getLanguages,
  getLid: getLid,
  momentLocale: momentLocale,
  deeplProSourceLang: deeplProSourceLang,
  deeplProTargetLang: deeplProTargetLang,
  deeplProFormality: deeplProFormality,
  wpExportName: wpExportName

};

export default language;
