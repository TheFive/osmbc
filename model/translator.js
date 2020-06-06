"use strict";

const request = require("request");
const uuidv4 = require("uuid/v4");

const markdown = require("markdown-it")()
  .use(require("markdown-it-sup"))
  .use(require("markdown-it-imsize"), { autofill: true });

const TurndownService = require("turndown");

const config    = require("../config.js");

const debug       = require("debug")("OSMBC:model:translator");


const deeplClient = require("deepl-client");

function normLanguage(lang) {
  if (lang === "cz") lang = "cs";
  if (lang === "jp") lang = "ja";
  return lang;
}


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}


const deeplAuthKey = config.getValue("DeeplAPIKey");

function translateDeeplPro(options, callback) {
  debug("translateDeeplPro");

  if (typeof deeplAuthKey === "undefined") {
    return new Error("No Deepl Pro Version registered");
  }


  const fromLang = normLanguage(options.fromLang);
  const toLang = normLanguage(options.toLang);
  const text = options.text;


  var htmltext = markdown.render(text);

  var deeplParams = {};
  deeplParams.text = htmltext;
  deeplParams.source_lang = fromLang.toUpperCase();
  deeplParams.target_lang = toLang.toUpperCase();
  deeplParams.auth_key = deeplAuthKey;
  deeplParams.tag_handling = "xml";


  if (deeplParams.target_lang === "DE-LESS") {
    deeplParams.target_lang = "DE";
    deeplParams.formality = "less";
  }
  if (deeplParams.target_lang === "DE-MORE") {
    deeplParams.target_lang = "DE";
    deeplParams.formality = "more";
  }



  deeplClient.translate(deeplParams)
    .then(result => {
      if (result && result.message) return callback(null, result.message);
      var htmlresult = result.translations[0].text;
      var turndownService = new TurndownService();
      var mdresult = turndownService.turndown(htmlresult);
      mdresult = mdresult.replace(
        RegExp(
          escapeRegExp("https://translate.google.com/translate?sl=auto&tl=" + fromLang), "g"),
        "https://translate.google.com/translate?sl=auto&tl=" + toLang
      );
      mdresult = mdresult.replace(
        RegExp(
          escapeRegExp("https://translate.google.com/translate?sl=auto&tl=" + fromLang.toUpperCase()), "g"),
        "https://translate.google.com/translate?sl=auto&tl=" + toLang.toUpperCase()
      );
      return callback(null, mdresult);
    })
    .catch(err => { return callback(err); });
}
function deeplProActive () {
  return (typeof deeplAuthKey === "string");
}

const subscriptionKey = config.getValue("MS_TranslateApiKey");

const msTranslate = {
  translate: function(from, to, text, callback) {
    const options = {
      method: "POST",
      baseUrl: "https://api.cognitive.microsofttranslator.com/",
      url: "translate",
      qs: {
        "api-version": "3.0",
        from: from,
        to: to,
        textType: "html"
      },
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-type": "application/json",
        "X-ClientTraceId": uuidv4().toString()
      },
      body: [{
        text: text
      }],
      json: true
    };

    request(options, function(err, response, body) {
      if (body && body.error) err = new Error(body.error.message);
      if (err) return callback(err);
      callback(null, body[0].translations[0].text);
    });
  }
};


function bingProActive () {
  return (typeof subscriptionKey === "string");
}

function translateBingPro(options, callback) {
  debug("translateBingPro");

  if (typeof subscriptionKey === "undefined") {
    return new Error("No Bing Pro Version registered");
  }

  const fromLang = normLanguage(options.fromLang);
  const toLang = normLanguage(options.toLang);
  const text = options.text;

  var htmltext = markdown.render(text);


  msTranslate.translate(fromLang, toLang, htmltext, function(err, translation) {
    if (err) return callback(err);
    var turndownService = new TurndownService();
    var mdresult = turndownService.turndown(translation);
    mdresult = mdresult.replace(
      RegExp(
        escapeRegExp("https://translate.google.com/translate?sl=auto&tl=" + fromLang), "g"),
      "https://translate.google.com/translate?sl=auto&tl=" + toLang);
    mdresult = mdresult.replace(
      RegExp(
        escapeRegExp("https://translate.google.com/translate?sl=auto&tl=" + fromLang.toUpperCase()), "g"),
      "https://translate.google.com/translate?sl=auto&tl=" + toLang.toUpperCase());
    return callback(null, mdresult);
  });
}



module.exports.deeplPro = {};
module.exports.bingPro = {};
module.exports.fortestonly = {};

module.exports.deeplPro.translate = translateDeeplPro;
module.exports.deeplPro.active = deeplProActive;
module.exports.deeplPro.name = "DeepLPro";

module.exports.bingPro.translate = translateBingPro;
module.exports.bingPro.active = bingProActive;
module.exports.bingPro.name = "BingPro";

module.exports.fortestonly.msTransClient = msTranslate;
