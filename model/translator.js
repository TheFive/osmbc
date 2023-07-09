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






function translateCopy(options, callback) {
  debug("translateCopy");
  return callback(null, options.text);
}



module.exports.deeplPro = {};
module.exports.fortestonly = {};
module.exports.copy = {};

module.exports.deeplPro.translate = translateDeeplPro;
module.exports.deeplPro.active = deeplProActive;
module.exports.deeplPro.name = "DeepLPro";
module.exports.deeplPro.user = "deeplPro API Call";

module.exports.copy.translate = translateCopy;
module.exports.copy.active = () => { return true; };

module.exports.copy.name = "Copy";
module.exports.copy.user = "Copy User";

