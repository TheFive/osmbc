"use strict";

const querystring = require("query-string");
const axios = require("axios");
const language = require("../model/language.js");





const TurndownService = require("turndown");
const turndownItSup = require("../util/turndown-it-sup.js");
const turndownItEmoji = require("../util/turndown-it-emoji");
const mdUtil = require("../util/md_util.js");

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
    return response.data;
  } catch (err) {
    const message = err.message.replaceAll(deeplConfig.authKey, "APIKEY");
    throw (new Error(message));
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

const deeplConfig = config.getValue("DeeplProConfig", { mustExist: true });

function translateDeeplPro(options, callback) {
  const markdown = mdUtil.osmbcMarkdown({ translation: true });
  debug("translateDeeplPro");

  if (typeof deeplConfig.authKey === "undefined") {
    return new Error("No Deepl Key registered");
  }
  if (typeof deeplConfig.url === "undefined") {
    return new Error("No Deepl Url registered configured");
  }


  const fromLang = language.deeplProSourceLang(options.fromLang);
  const formality = language.deeplProFormality(options.toLang);
  const toLang = language.deeplProTargetLang(options.toLang);
  const text = options.text;


  const htmltext = markdown.render(text);

  const deeplParams = {};
  deeplParams.text = htmltext;
  deeplParams.source_lang = fromLang.toUpperCase();
  deeplParams.target_lang = toLang.toUpperCase();
  deeplParams.auth_key = deeplConfig.authKey;
  deeplParams.tag_handling = "xml";
  if (formality) deeplParams.formality = formality;



  deeplTranslate(deeplConfig.url, deeplParams)
    .then(result => {
      if (result && result.message) return callback(null, result.message);
      if (!result || !result.translations) return callback(null, "Something went wrong with translation in this article.");
      const htmlresult = result.translations[0].text;
      const turndownService = new TurndownService();
      turndownService.use(turndownItSup);
      turndownService.use(turndownItEmoji);
      let mdresult = turndownService.turndown(htmlresult);
      mdresult = mdresult.replaceAll("_x_tr_sl=auto&_x_tr_tl=" + fromLang.toLowerCase(), "_x_tr_sl=auto&_x_tr_tl=" + toLang.toLowerCase());
      mdresult = mdresult.replaceAll("_x_tr_sl=auto&_x_tr_tl=" + fromLang.toUpperCase(), "_x_tr_sl=auto&_x_tr_tl=" + toLang.toUpperCase());
      mdresult = mdresult.replaceAll(":" + fromLang.toUpperCase() + "-t:", ":" + toLang.toUpperCase() + "-t:");
      return callback(null, mdresult);
    })
    .catch(err => { return callback(err); });
}
function deeplProActive () {
  return (typeof deeplConfig.authKey === "string");
}

const bingProAuthkey = config.getValue("BingProConfig").authKey;

/* const msTranslate = {
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
        "Ocp-Apim-Subscription-Key": bingProAuthkey,
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
      if (err) {
        const message = err.message.replaceAll(bingProAuthkey, "APIKEY");
        return callback(new Error(message));
      }
      callback(null, body[0].translations[0].text);
    });
  }
};
*/


function bingProActive () {
  return (typeof bingProAuthkey === "string");
}

function translateBingPro(options, callback) {
  debug("translateBingPro");
  const markdown = mdUtil.osmbcMarkdown({ translation: true });

  if (typeof bingProAuthkey === "undefined") {
    return callback(new Error("No Bing Pro Version registered"));
  }
  const fromLang = language.bingPro(options.fromLang);
  const toLang = language.bingPro(options.toLang);
  const text = options.text;
  const htmltext = markdown.render(text);
  const msTranslate = null;

  msTranslate.translate(fromLang, toLang, htmltext, function(err, translation) {
    if (err) return callback(err);
    const turndownService = new TurndownService();
    turndownService.use(turndownItSup);
    turndownService.use(turndownItEmoji);
    let mdresult = turndownService.turndown(translation);
    mdresult = mdresult.replace(
      RegExp(
        escapeRegExp("https://translate.google.com/translate?sl=auto&tl=" + fromLang), "g"),
      "https://translate.google.com/translate?sl=auto&tl=" + toLang);
    mdresult = mdresult.replace(
      RegExp(
        escapeRegExp("https://translate.google.com/translate?sl=auto&tl=" + fromLang.toUpperCase()), "g"),
      "https://translate.google.com/translate?sl=auto&tl=" + toLang.toUpperCase());

    mdresult = mdresult.replaceAll(":" + fromLang.toUpperCase() + "-t:", ":" + toLang.toUpperCase() + "-t:");

    return callback(null, mdresult);
  });
}

function translateCopy(options, callback) {
  debug("translateCopy");
  return callback(null, options.text);
}



module.exports.deeplPro = {};
module.exports.bingPro = {};
module.exports.fortestonly = {};
module.exports.copy = {};

module.exports.deeplPro.translate = translateDeeplPro;
module.exports.deeplPro.active = deeplProActive;
module.exports.deeplPro.name = "DeepLPro";
module.exports.deeplPro.user = "deeplPro API Call";

module.exports.bingPro.translate = translateBingPro;
module.exports.bingPro.active = bingProActive;
module.exports.bingPro.name = "BingPro";
module.exports.bingPro.user = "Bing API Call";

module.exports.copy.translate = translateCopy;
module.exports.copy.active = () => { return true; };

module.exports.copy.name = "Copy";
module.exports.copy.user = "Copy User";

