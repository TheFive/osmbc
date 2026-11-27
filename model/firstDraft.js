import Anthropic from "@anthropic-ai/sdk";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import _debug from "debug";

import config from "../config.js";
import configModule from "../model/config.js";
import language from "../model/language.js";
import blogModule from "../model/blog.js";
import util from "../util/util.js";
import { fetchExternalPage } from "../util/externalPage.js";
import DraftContextRenderer, { DRAFT_MARKER, PLACEHOLDER_PREFIX } from "../render/DraftContextRenderer.js";
import { CLAUDE_AI } from "./serviceUsers.js";
import { BAD_REQUEST } from "http-status-codes";
import { UNPUBLISHED } from "./specialCategories.js";

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
  const html = await fetchExternalPage(url);
  const doc = new JSDOM(html, { url: url });
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
const notForClaude = ["Picture", "Breaking news", "About us", "[Actual Category]", "Weekly exercise:", "Releases", "Upcoming Events", UNPUBLISHED];

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

// The current issue as part of the user message, so the model sees the
// wording of the other items and can vary it (#1185)
function contextMessage(lang, context) {
  const place = (context.markerPlaced)
    ? "Your item goes where " + DRAFT_MARKER + " stands."
    : "Your item is not placed in it yet.";
  return "\n\nThe current state of this week's issue in " + languageName(lang) + " follows in <current_issue>. " + place +
    " Items shown as " + PLACEHOLDER_PREFIX + "…]] have no text yet; use them only to avoid duplicates." +
    " Keep the usual sentence structure of the issue, but vary the wording: use a verb that names the concrete action" +
    " and that is not already frequent in the issue. Do not copy or repeat the other items." +
    "\n\n<current_issue>\n" + context.text + "\n</current_issue>";
}

function userMessage(options, page, choice) {
  return "Target language: " + languageName(options.lang) + "\n" +
    "URL: " + options.url + "\n" +
    "Title: " + (page.title ?? "") + "\n\n" +
    "<page_content>\n" + page.text + "\n</page_content>" +
    ((options.context) ? contextMessage(options.lang, options.context) : "") +
    ((options.withTitle)
      ? "\n\nAlso give a compact working title for the editors' article list: a few words, at most about 60 characters, in the target language, no markdown." +
        categoryRequest(choice)
      : "");
}

function answerText(response, url) {
  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to summarise " + url);
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (text === "") throw new Error("Claude returned no text for " + url);
  return text;
}

function parseDraftWithTitle(response, text, url, choice) {
  if (response.stop_reason === "max_tokens") throw new Error("Claude's answer for " + url + " was cut off");
  const draft = JSON.parse(text);
  if (typeof draft.markdown !== "string" || draft.markdown.trim() === "") throw new Error("Claude returned no text for " + url);
  // the schema allows only listed categories, anything else falls back
  const category = (choice.offered.some((c) => c.name === draft.category)) ? draft.category : choice.fallback;
  return { markdown: draft.markdown.trim(), title: (typeof draft.title === "string") ? draft.title.trim() : "", category: category };
}

/**
 * Asks Claude for a first draft of the item for one link. Saves nothing.
 * @param {object} options { lang, url, withTitle, context }; context is the
 *   result of issueContext (or null), withTitle asks for title + category
 * @returns {Promise<string|object>} the markdown, with withTitle
 *   { markdown, title, category }
 */
async function createDraft(options) {
  debug("createDraft %s %s", options.lang, options.url);
  if (!active()) throw new Error("No Anthropic API key configured");
  if (!/^https?:\/\//.test(options.url ?? "")) throw new Error("Not a valid url: " + options.url);

  const prompt = configModule.getConfig("firstdraftprompt");
  const page = await loadPageText(options.url);
  const choice = (options.withTitle) ? categoryChoice() : null;

  const outputConfig = { effort: firstDraftConfig.effort ?? defaultEffort };
  if (options.withTitle) outputConfig.format = { type: "json_schema", schema: draftWithTitleSchema(choice) };

  const response = await getClient().beta.messages.create({
    model: firstDraftConfig.model ?? defaultModel,
    max_tokens: 16000,
    output_config: outputConfig,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: prompt,
    messages: [{ role: "user", content: userMessage(options, page, choice) }]
  });

  const text = answerText(response, options.url);
  if (!options.withTitle) return text;
  return parseDraftWithTitle(response, text, options.url, choice);
}

// Categories that say nothing about the wording of the items
const notInContext = ["Picture", "Upcoming Events"];

/**
 * The issue a draft is written for, rendered as Markdown in the draft's
 * language (see render/DraftContextRenderer.js). Only full users get it:
 * guests may not see blogs, the draft would show them other editors' texts.
 * @param {object} user the user asking for the draft
 * @param {string} lang language of the draft
 * @param {string} blogName name of the blog the article is (or will be) in
 * @param {string|number|null} articleId article being drafted, null if new
 * @returns {Promise<object|null>} { text, markerPlaced }, null without context
 */
async function issueContext(user, lang, blogName, articleId) {
  if (!user || typeof user.hasFullAccess !== "function" || !user.hasFullAccess()) return null;
  if (typeof blogName !== "string" || blogName === "") return null;
  const blog = await blogModule.findOne({ name: blogName });
  if (!blog) return null;
  const data = await new Promise((resolve, reject) => {
    blog.getPreviewData({ lang: lang, disableNotranslation: true }, (err, result) => (err) ? reject(err) : resolve(result));
  });
  for (const category of notInContext) delete data.articles[category];
  data.teamString = "";
  const renderer = new DraftContextRenderer(blog, articleId);
  const text = renderer.renderBlog(lang, data);
  return { text: text, markerPlaced: renderer.markerPlaced };
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: BAD_REQUEST });
}

function checkLanguage(lang) {
  const err = language.checkLanguage(lang);
  if (err) throw err;
}

function saveArticle(article, user, data) {
  return new Promise((resolve, reject) => {
    article.setAndSave(user, data, (err) => (err) ? reject(err) : resolve());
  });
}

const claudeUser = { OSMUser: CLAUDE_AI };

/**
 * Article page: writes a draft for one link of the article's collection and
 * saves it into markdown<lang> as user ClaudeAI, so the editor's next save
 * is a normal change on top of it.
 * @param {object} user the user asking for the draft
 * @param {object} article the article (from the route)
 * @param {object} options { lang, url, old }: old is the markdown the page
 *   was loaded with, a different value in the database gives a 409
 * @returns {Promise<string>} the saved markdown
 */
async function draftIntoArticle(user, article, options) {
  debug("draftIntoArticle %s %s", article.id, options.lang);
  checkLanguage(options.lang);
  const urls = (typeof article.collection === "string") ? util.getAllURL(article.collection) : [];
  if (!urls.includes(options.url)) throw badRequest("The url is not in the collection of the article");
  const context = await issueContext(user, options.lang, article.blog, article.id);
  const markdown = await createDraft({ lang: options.lang, url: options.url, context: context });
  const field = "markdown" + options.lang;
  await saveArticle(article, claudeUser, { [field]: markdown, old: { [field]: options.old ?? "" } });
  return article[field];
}

/**
 * Collect page: writes a draft with working title and category for a link
 * that is not an article yet. Saves nothing; the route keeps the draft in
 * the session until the article is created (saveCollectedDraft).
 * @param {object} user the user asking for the draft
 * @param {object} options { lang, url, blog }: blog is the one chosen in
 *   the collect form
 * @returns {Promise<object>} { markdown, title, category }
 */
async function draftForCollect(user, options) {
  debug("draftForCollect %s", options.lang);
  checkLanguage(options.lang);
  const context = await issueContext(user, options.lang, options.blog, null);
  return createDraft({ lang: options.lang, url: options.url, withTitle: true, context: context });
}

/**
 * After a collected article was created: saves the draft made on the
 * collect page as ClaudeAI, then the text the user sent as the user: the
 * edited draft, or nothing for "Save link only" (the draft stays in the
 * history as not usable).
 * @param {object} user the user who created the article
 * @param {object} article the new article
 * @param {object} draft { lang, markdown } kept from draftForCollect
 * @param {string|undefined} sentText markdown<lang> from the form
 * @returns {Promise<void>} resolves when both changes are saved
 */
async function saveCollectedDraft(user, article, draft, sentText) {
  debug("saveCollectedDraft %s", article.id);
  checkLanguage(draft.lang);
  const field = "markdown" + draft.lang;
  const sent = (typeof sentText === "string") ? sentText.replace(/\r\n/g, "\n").trim() : "";
  const current = article[field] ?? "";
  // e.g. "no translation" in a language already closed in that blog (#1133)
  if (current !== "") {
    if (sent !== "") await saveArticle(article, user, { [field]: sent, old: { [field]: current } });
    return;
  }
  await saveArticle(article, claudeUser, { [field]: draft.markdown, old: { [field]: "" } });
  await saveArticle(article, user, { [field]: sent, old: { [field]: article[field] ?? "" } });
}

const firstDraft = {
  active: active,
  isVisibleFor: isVisibleFor,
  createDraft: createDraft,
  draftIntoArticle: draftIntoArticle,
  draftForCollect: draftForCollect,
  saveCollectedDraft: saveCollectedDraft,
  fortestonly: {
    isVisibleForValue: isVisibleForValue,
    setClient: setClient,
    categoryChoice: categoryChoice,
    loadPageText: loadPageText,
    issueContext: issueContext
  }
};

export default firstDraft;
