"use strict";

var debug= require("debug")("model/settings");
var config = require("../config.js");
var should = require("should");

// information from article:
//      edit:      true if any additional edit links should be generated
//      comment:   true if blue or red border should be placed based on comment
//      glyphicon: true if the bullet should be an edit glyphicon
//      editLink:  true if an "Edit&Translate" should be placed at the end of an article
//      overview:  true if title or a small text is shown, instead of an article
//      marktext:  true if missing language markdown should be <mark>ed.


var settings = {};



var settings = {};



settings.overview = {
            edit : true,
            comment : true,
            viewLink : true,
            editLink: true,
            overview : true,
            marktext : true,
            smallPicture : true
          };
settings.translation = {
            edit : true,
            comment : true,
            glyphicon_view : true,
            editLink : true,
            marktext : true,
            overview : true,
            languageLinks:true
          };
settings.full = {
            edit : true,
            comment : true,
            glyphicon_edit : true,
            glyphicon_view : true,
            marktext : true,
            smallPicture : true
          };
settings.fullfinal = {
            edit : true,
            fullfinal : true,
            shortEditLink : true,
            smallPicture : false
          };
settings.markdown = {
            
            markdown : true
          };


var languages = {};



for (var i = 0;i<config.getLanguages().length;i++) {
  var lang = config.getLanguages()[i];
  languages[lang] = {};
  languages[lang].left_lang = lang;
  languages[lang].right_lang = "--";
  
  if (lang != "EN") {
    languages["EN."+lang] = {};
    languages["EN."+lang].left_lang = "EN";
    languages["EN."+lang].right_lang = lang;
    languages["EN."+lang].bilingual = true;

    languages["EN("+lang+")"] = {};
    languages["EN("+lang+")"].left_lang = "EN";
    languages["EN("+lang+")"].right_lang = lang;
  }
}
languages["DE.EN"] = {};
languages["DE.EN"].left_lang = "DE";
languages["DE.EN"].right_lang = "EN";
languages["DE.EN"].bilingual = true;

languages["DE(EN)"] = {};
languages["DE(EN)"].left_lang = "DE";
languages["DE(EN)"].right_lang = "EN";

languages["ES.PT"] = {};
languages["ES.PT"].left_lang = "ES";
languages["ES.PT"].right_lang = "PT";
languages["ES.PT"].bilingual = true;

languages["ES(PT)"] = {};
languages["ES(PT)"].left_lang = "ES";
languages["ES(PT)"].right_lang = "PT";

exports.settings = settings;
exports.languages=languages;

 /*exported getSettings */
function getSettings(string,language,language2) {
  debug("getSettings(%s)",string);
  if (!language) language="DE";
  

  if (typeof(string)=="undefined") {
    string = "";
  }
  var s = settings.full;
  var l = languages["DE(EN)"];

  for (var i=0;i<config.getLanguages().length;i++) {
    var ll = config.getLanguages()[i];
    if (string==ll) {
      return {edit:false,fullfinal:true,left_lang:string,right_lang:"--"};
    }
    for (var z=0;z<config.getLanguages().length;z++) {
      var rl = config.getLanguages()[z];
      if (string == ll+"."+rl) {
        return {edit:false,left_lang:ll,right_lang:rl};
      }
    }
  }

  var oldstyle = false;

  for (var k in settings) {
    var temp = string.replace(k,"");
    if (temp != string) {
      s = settings[k];
      if (typeof(languages[temp])!="undefined") {
        l = languages[temp];
        oldstyle = true;
        break;
      }
    }
    if (string.toUpperCase() === k.toUpperCase()) {
      should.exist(language);
      s = settings[k];
      oldstyle = false;
      break;
    }
  }
  var result;
  if (oldstyle) {
    result = {};
    for (k in s) {result[k]=s[k];}
    for (k in l) {result[k]=l[k];}
    result.style = string;
    return result;    
  }
  if (!oldstyle) {
    result ={};
    for (k in s) {result[k]=s[k];}
    if (language2) {
      result.bilingual=true;
      result.left_lang = language;
      result.right_lang = language2;
    } else {
      result.left_lang = language;
      result.right_lang = "--";
    }
    if (string === "TRANSLATION") {
      result.right_lang = "--";
      result.bilingual = false;
    }
    if (string === "TRANSLATION" || string === "FULLFINAL" || string == "OVERVIEW") {
     // result.right_lang = "--";
      result.bilingual = false;
    }
    result.style=string;
    return result;
  }
  return null;
}

var listSettings = [];
var listLanguages = [];

for (var k in settings) {
  if (k!="markdown") {
    listSettings.push(k);    
  }
}
for (var k in languages) {
  listLanguages.push(k);
}

exports.getSettings = getSettings;
exports.listSettings = listSettings;
exports.listLanguages = listLanguages;

