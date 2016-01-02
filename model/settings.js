"use strict";
var debug= require("debug")("model/settings");
var config = require("../config.js");

// information from article:
//      edit:      true if any additional edit links should be generated
//      comment:   true if blue or red border should be placed based on comment
//      glyphicon: true if the bullet should be an edit glyphicon
//      editLink:  true if an "Edit&Translate" should be placed at the end of an article
//      overview:  true if title or a small text is shown, instead of an article
//      marktext:  true if missing language markdown should be <mark>ed.


var settings = {};

settings["overview ##"] = {
            edit : true,
            comment : true,
            viewLink : true,
            editLink: true,
            overview : true,
            marktext : true,
            smallPicture : true  
}
settings["overview ## with Translation"] = {
            edit : true,
            comment : true,
            glyphicon_view : true,
            editLink : true,
            marktext : true,
            overview : true,
            languageLinks:true 
}

settings["overview ## "] = {
            edit : true,
            comment : true,
            glyphicon_view : true,
            editLink : true,
            marktext : true,
            overview : true,
            languageLinks:true 
}

var settingsOld = {};



settingsOld.overview = {
            edit : true,
            comment : true,
            viewLink : true,
            editLink: true,
            overview : true,
            marktext : true,
            smallPicture : true
          };
settingsOld.translation = {
            edit : true,
            comment : true,
            glyphicon_view : true,
            editLink : true,
            marktext : true,
            overview : true,
            languageLinks:true
          };
settingsOld.full = {
            edit : true,
            comment : true,
            glyphicon_edit : true,
            glyphicon_view : true,
            marktext : true,
            smallPicture : true
          };
settingsOld.fullfinal = {
            edit : true,
            fullfinal : true,
            shortEditLink : true,
            smallPicture : false
          };
settingsOld.markdown = {
            
            markdown : true
          };


var languagesOld = {};



for (var i = 0;i<config.getLanguages().length;i++) {
  var lang = config.getLanguages()[i];
  languagesOld[lang] = {};
  languagesOld[lang].left_lang = lang;
  languagesOld[lang].right_lang = "--";
  
  if (lang != "EN") {
    languagesOld["EN."+lang] = {};
    languagesOld["EN."+lang].left_lang = "EN";
    languagesOld["EN."+lang].right_lang = lang;
    languagesOld["EN."+lang].bilingual = true;

    languagesOld["EN("+lang+")"] = {};
    languagesOld["EN("+lang+")"].left_lang = "EN";
    languagesOld["EN("+lang+")"].right_lang = lang;
  }
}
languagesOld["DE.EN"] = {};
languagesOld["DE.EN"].left_lang = "DE";
languagesOld["DE.EN"].right_lang = "EN";
languagesOld["DE.EN"].bilingual = true;

languagesOld["DE(EN)"] = {};
languagesOld["DE(EN)"].left_lang = "DE";
languagesOld["DE(EN)"].right_lang = "EN";

languagesOld["ES.PT"] = {};
languagesOld["ES.PT"].left_lang = "ES";
languagesOld["ES.PT"].right_lang = "PT";
languagesOld["ES.PT"].bilingual = true;

languagesOld["ES(PT)"] = {};
languagesOld["ES(PT)"].left_lang = "ES";
languagesOld["ES(PT)"].right_lang = "PT";

exports.settings = settings;
exports.languages=languages;

 /*exported getSettings */
function getSettings(string) {
  debug("getSettings(%s)",string);


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

  for (var k in settings) {
    var temp = string.replace(k,"");
    if (temp != string) {
      s = settings[k];
      if (typeof(languages[temp])!="undefined") {
        l = languages[temp];
         break;
      }
    }
  }

  var result = {};
  for (k in s) {result[k]=s[k];}
  for (k in l) {result[k]=l[k];}
  return result;
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

