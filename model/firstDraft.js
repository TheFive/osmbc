import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import _debug from "debug";

import config from "../config.js";
import configModule from "../model/config.js";
import language from "../model/language.js";
import util from "../util/util.js";
import ssrfAgents from "../util/ssrfAgents.js";

const debug = _debug("OSMBC:model:firstDraft");

// First Draft: let Claude write a first summary of a collected link,
// as starting point for an empty language markdown.
//
// config.*.yaml:
// FirstDraftConfig:
//   apiKey: sk-ant-...         (optional, otherwise ANTHROPIC_API_KEY)
//   model: claude-opus-5-5     (optional)
//   effort: medium             (optional, low|medium|high|xhigh|max)
//   visibleFor:                (OSM user names, or "full" for everybody)
//     - TheFive
//
// The prompt itself is the config text "firstdraftprompt" (admin page).

const defaultModel = "claude-opus-5-5";
const defaultEffort = "medium";

const firstDraftConfig = config.getValue("FirstDraftConfig", { default: {} });
const userAgent = config.getValue("User-Agent", { mustExist: true });

let client = null;

function getClient() {
  if (client) return client;
  const options = {};
  if (typeof firstDraftConfig.apiKey === "string") options.apiKey = firstDraftConfig.apiKey;
  client = new Anthropic(options);
  return client;
}

// for tests: replace the Anthropic client by a stub
function setClient(c) {
  client = c;
}

function active() {
  return (typeof firstDraftConfig.apiKey === "string" || typeof process.env.ANTHROPIC_API_KEY === "string");
}

function isVisibleFor(user) {
  if (!user) return false;
  const visibleFor = firstDraftConfig.visibleFor;
  if (visibleFor === "full") return user.access === "full";
  if (!Array.isArray(visibleFor)) return false;
  return visibleFor.indexOf(user.OSMUser) >= 0;
}

async function loadPageText(url) {
  debug("loadPageText %s", url);
  // own axios instance, so the charset decoder does not affect
  // other requests running at the same time
  const instance = axios.create();
  instance.interceptors.response.use(util.charsetDecoder);
  const response = await instance.get(url, {
    httpAgent: ssrfAgents.httpAgent,
    httpsAgent: ssrfAgents.httpsAgent,
    headers: { "User-Agent": userAgent },
    responseType: "arraybuffer",
    responseEncoding: "binary"
  });
  const doc = new JSDOM(response.data, { url: url });
  const article = new Readability(doc.window.document).parse();
  if (!article || !article.textContent || article.textContent.trim() === "") {
    throw new Error("Could not extract text from " + url);
  }
  return { title: article.title, text: article.textContent.trim() };
}

function languageName(lang) {
  const l = language.getLanguages()[lang.toUpperCase()];
  if (l && typeof l.displayLong === "string" && l.displayLong !== lang) return lang + " (" + l.displayLong + ")";
  return lang;
}

async function createDraft(options) {
  debug("createDraft %s %s", options.lang, options.url);
  if (!active()) throw new Error("No Anthropic API key configured");
  if (!/^https?:\/\//.test(options.url ?? "")) throw new Error("Not a valid url: " + options.url);

  const prompt = configModule.getConfig("firstdraftprompt");
  const page = await loadPageText(options.url);

  const userMessage = "Target language: " + languageName(options.lang) + "\n" +
    "URL: " + options.url + "\n" +
    "Title: " + (page.title ?? "") + "\n\n" +
    "<page_content>\n" + page.text + "\n</page_content>";

  const response = await getClient().beta.messages.create({
    model: firstDraftConfig.model ?? defaultModel,
    max_tokens: 16000,
    output_config: { effort: firstDraftConfig.effort ?? defaultEffort },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: prompt,
    messages: [{ role: "user", content: userMessage }]
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to summarise " + options.url);
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (text === "") throw new Error("Claude returned no text for " + options.url);
  return text;
}

const firstDraft = {
  active: active,
  isVisibleFor: isVisibleFor,
  createDraft: createDraft,
  fortestonly: {
    setClient: setClient,
    loadPageText: loadPageText
  }
};

export default firstDraft;
