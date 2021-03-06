"use strict";

const request = require("request");
const uuidv4 = require("uuid/v4");
const querystring = require("query-string");
const axios = require("axios");


const markdown = require("markdown-it")()
  .use(require("markdown-it-sup"))
  .use(require("markdown-it-imsize"), { autofill: true });

const TurndownService = require("turndown");
const turndownItSup = require("../util/turndown-it-sup.js");

const config    = require("../config.js");
const debug       = require("debug")("OSMBC:model:translator");




async function deeplTranslate(url, params) {
  try {
    const query = querystring.stringify(params);
    const response = await axios.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: query
    });

    if (response.status !== 200) return "Problem with Deepl Translation";

    return response.data;
  } catch (error) {
    return { message: "caught Problem with Deepl Translation" };
  }
}

function normLanguage(lang) {
  if (lang === "cz") lang = "cs";
  if (lang === "jp") lang = "ja";
  return lang;
}


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}


const deeplConfig = config.getValue("DeeplConfig", { mustExist: true });

function translateDeeplPro(options, callback) {
  debug("translateDeeplPro");

  if (typeof deeplConfig.authKey === "undefined") {
    return new Error("No Deepl Key registered");
  }
  if (typeof deeplConfig.url === "undefined") {
    return new Error("No Deepl Url registered configured");
  }


  const fromLang = normLanguage(options.fromLang);
  const toLang = normLanguage(options.toLang);
  const text = options.text;


  const htmltext = markdown.render(text);

  const deeplParams = {};
  deeplParams.text = htmltext;
  deeplParams.source_lang = fromLang.toUpperCase();
  deeplParams.target_lang = toLang.toUpperCase();
  deeplParams.auth_key = deeplConfig.authKey;
  deeplParams.tag_handling = "xml";


  if (deeplParams.target_lang === "DE-LESS") {
    deeplParams.target_lang = "DE";
    deeplParams.formality = "less";
  }
  if (deeplParams.target_lang === "DE-MORE") {
    deeplParams.target_lang = "DE";
    deeplParams.formality = "more";
  }



  deeplTranslate(deeplConfig.url, deeplParams)
    .then(result => {
      if (result && result.message) return callback(null, result.message);
      if (!result || !result.translations) return callback(null, "Something went wrong with translation in this article.");
      const htmlresult = result.translations[0].text;
      const turndownService = new TurndownService();
      turndownService.use(turndownItSup);
      let mdresult = turndownService.turndown(htmlresult);
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
  return (typeof deeplConfig.authKey === "string");
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

  const htmltext = markdown.render(text);


  msTranslate.translate(fromLang, toLang, htmltext, function(err, translation) {
    if (err) return callback(err);
    const turndownService = new TurndownService();
    let mdresult = turndownService.turndown(translation);
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
module.exports.deeplPro.user = "deeplPro API Call";

module.exports.bingPro.translate = translateBingPro;
module.exports.bingPro.active = bingProActive;
module.exports.bingPro.name = "BingPro";
module.exports.bingPro.user = "Bing API Call";

module.exports.fortestonly.msTransClient = msTranslate;
