import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import _debug from "debug";

import config from "../config.js";
import configModule from "../model/config.js";
import language from "../model/language.js";
import blogModule from "../model/blog.js";
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
//   visibleFor:                (who sees First Draft, see isVisibleFor)
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

// FirstDraftConfig.visibleFor, to roll the function out step by step:
//   list of OSM user names   only these users
//   "full"                   all full users
//   "guest"                  all full and guest users
//   missing, null, "", []    nobody
// "full" and "guest" ignore case; any other value means nobody.
function isVisibleForValue(visibleFor, user) {
  if (!user) return false;
  if (Array.isArray(visibleFor)) return visibleFor.indexOf(user.OSMUser) >= 0;
  if (typeof visibleFor !== "string") return false;
  const value = visibleFor.trim().toLowerCase();
  if (value === "full") return user.access === "full";
  if (value === "guest") return user.access === "full" || user.access === "guest";
  return false;
}

function isVisibleFor(user) {
  return isVisibleForValue(firstDraftConfig.visibleFor, user);
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

// Categories an editor sets by hand or that other code fills,
// never proposed by Claude
const notForClaude = ["Picture", "Breaking news", "About us", "[Actual Category]", "Weekly exercise:", "Releases", "Upcoming Events", "--unpublished--"];

// The categories Claude may choose, with the description the editors see
// on the collect page (config "categorydescription"). A category without a
// description is not offered. The first category ("-- no category yet --")
// is the answer when nothing fits.
function categoryChoice() {
  const categories = blogModule.getCategories();
  const descriptions = configModule.getConfig("categorydescription") ?? {};
  const fallback = categories[0].EN;
  const offered = categories
    .slice(1)
    .filter((c) => !notForClaude.includes(c.EN) && typeof descriptions[c.EN] === "string" && descriptions[c.EN].trim() !== "")
    .map((c) => ({ name: c.EN, description: descriptions[c.EN].trim() }));
  return { fallback: fallback, offered: offered };
}

// With options.withTitle the answer is structured (JSON schema) and also
// carries a compact working title and the category:
// { markdown, title, category } instead of the text.
function draftWithTitleSchema(choice) {
  return {
    type: "object",
    properties: {
      markdown: { type: "string", description: "The markdown of the article, as described in the system prompt" },
      title: { type: "string", description: "Compact working title for the editors' article list" },
      category: {
        type: "string",
        enum: [choice.fallback].concat(choice.offered.map((c) => c.name)),
        description: "Category of the item in the issue"
      }
    },
    required: ["markdown", "title", "category"],
    additionalProperties: false
  };
}

function categoryRequest(choice) {
  return "\n\nAlso choose the category for this item in the issue. Allowed categories (name: when to use it):\n" +
    choice.offered.map((c) => "- " + c.name + ": " + c.description).join("\n") + "\n" +
    "Pick the one that fits best. If the page fits none of them clearly, use \"" + choice.fallback + "\"; the editor decides then.";
}

async function createDraft(options) {
  debug("createDraft %s %s", options.lang, options.url);
  if (!active()) throw new Error("No Anthropic API key configured");
  if (!/^https?:\/\//.test(options.url ?? "")) throw new Error("Not a valid url: " + options.url);

  const prompt = configModule.getConfig("firstdraftprompt");
  const page = await loadPageText(options.url);
  const choice = (options.withTitle) ? categoryChoice() : null;

  const userMessage = "Target language: " + languageName(options.lang) + "\n" +
    "URL: " + options.url + "\n" +
    "Title: " + (page.title ?? "") + "\n\n" +
    "<page_content>\n" + page.text + "\n</page_content>" +
    ((options.withTitle)
      ? "\n\nAlso give a compact working title for the editors' article list: a few words, at most about 60 characters, in the target language, no markdown." +
        categoryRequest(choice)
      : "");

  const outputConfig = { effort: firstDraftConfig.effort ?? defaultEffort };
  if (options.withTitle) outputConfig.format = { type: "json_schema", schema: draftWithTitleSchema(choice) };

  const response = await getClient().beta.messages.create({
    model: firstDraftConfig.model ?? defaultModel,
    max_tokens: 16000,
    output_config: outputConfig,
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
  if (!options.withTitle) return text;

  if (response.stop_reason === "max_tokens") throw new Error("Claude's answer for " + options.url + " was cut off");
  const draft = JSON.parse(text);
  if (typeof draft.markdown !== "string" || draft.markdown.trim() === "") throw new Error("Claude returned no text for " + options.url);
  // the schema allows only listed categories, anything else falls back
  const category = (choice.offered.some((c) => c.name === draft.category)) ? draft.category : choice.fallback;
  return { markdown: draft.markdown.trim(), title: (typeof draft.title === "string") ? draft.title.trim() : "", category: category };
}

const firstDraft = {
  active: active,
  isVisibleFor: isVisibleFor,
  createDraft: createDraft,
  fortestonly: {
    isVisibleForValue: isVisibleForValue,
    setClient: setClient,
    categoryChoice: categoryChoice,
    loadPageText: loadPageText
  }
};

export default firstDraft;
