

import queryString from "query-string";
import axios from "axios";
import language from "../model/language.js";





import TurndownService from "turndown";
import turndownItSup from "../util/turndown-it-sup.js";
import turndownItEmoji from "../util/turndown-it-emoji.js";
import turndownItImsize from "../util/turndown-it-imsize.js";
import { osmbcMarkdown } from "../util/md_util.js";

import config from "../config.js";
import _debug from "debug";
const request = axios.request;
const debug = _debug("OSMBC:model:translator");




async function deeplTranslate(url, params) {
  try {
    const query = queryString.stringify(params);
    const response = await request(url, {
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

async function deeplUsage() {
  const deeplParams = {};

  if (typeof deeplConfig.authKey === "undefined") {
    return new Error("No Deepl Key registered");
  }
  if (typeof deeplConfig.usageUrl === "undefined") {
    return new Error("No Deepl Url registered configured");
  }
  deeplParams.auth_key = deeplConfig.authKey;

  try {
    const response = await request(deeplConfig.usageUrl, {
      method: "GET",
      headers: {
        Authorization: "DeepL-Auth-Key " + deeplConfig.authKey
      }
    });
    const data = response.data;
    data.character_limit = data.character_limit ?? "not defined";
    data.character_count = data.character_count ?? "not defined";

    if (Number.isInteger(response.data.character_limit)) {
      response.data.character_percent = parseInt(100 * response.data.character_count / response.data.character_limit).toString() + "%";
    } else {
      response.data.character_percent = "not a number";
    }



    return response.data;
  } catch (err) {
    // ignore error and deliver some data
    return ({ character_count: "request failed", character_limit: "request failed", character_percent: "request failed" });
  }
}


const deeplConfig = config.getValue("DeeplProConfig", { mustExist: true });

function translateDeeplPro(options, callback) {
  const markdown = osmbcMarkdown({ translation: true });
  debug("translateDeeplPro");

  if (typeof deeplConfig.authKey === "undefined") {
    return new Error("No Deepl Key registered");
  }
  if (typeof deeplConfig.url === "undefined") {
    return new Error("No Deepl Url registered configured");
  }


  const fromLangDeepl = language.deeplProSourceLang(options.fromLang);
  const fromLangOsmbc = options.fromLang;
  const formality = language.deeplProFormality(options.toLang);
  const toLangDeepl = language.deeplProTargetLang(options.toLang);
  const toLangOsmbc = options.toLang;
  const text = options.text;


  const htmltext = markdown.render(text);

  const deeplParams = {};
  deeplParams.text = htmltext;
  deeplParams.source_lang = fromLangDeepl.toUpperCase();
  deeplParams.target_lang = toLangDeepl.toUpperCase();
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
      turndownService.use(turndownItImsize);
      let mdresult = turndownService.turndown(htmlresult);
      console.log(mdresult);
      mdresult = mdresult.replaceAll("_x_tr_sl=auto&_x_tr_tl=" + fromLangOsmbc.toLowerCase(), "_x_tr_sl=auto&_x_tr_tl=" + toLangOsmbc.toLowerCase());
      mdresult = mdresult.replaceAll("_x_tr_sl=auto&_x_tr_tl=" + fromLangOsmbc.toUpperCase(), "_x_tr_sl=auto&_x_tr_tl=" + toLangOsmbc.toUpperCase());
      mdresult = mdresult.replaceAll(":" + fromLangOsmbc.toUpperCase() + "-t:", ":" + toLangOsmbc.toUpperCase() + "-t:");
      console.log(mdresult);
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


const deeplPro = {};
const copy = {};

deeplPro.translate = translateDeeplPro;
deeplPro.active = deeplProActive;
deeplPro.name = "DeepLPro";
deeplPro.user = "deeplPro API Call";

copy.translate = translateCopy;
copy.active = () => { return true; };
copy.name = "Copy Article";
copy.user = "automated copy";

copy.name = "Copy";
copy.user = "Copy User";

const translator = {
  deeplPro: deeplPro,
  copy: copy,
  deeplUsage: deeplUsage
};

export default translator;
