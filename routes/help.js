

import _debug from "debug";
import fs from "fs";
import path from "path";
import config from "../config.js";
import mdUtil from "../util/md_util.js";
const debug = _debug("OSMBC:routes:help");


let token = null;

const htmlroot = config.htmlRoot();

function initToken() {
  debug("initToken");
  if (token) return;
  token = {
    "##osmbcroot##": htmlroot
  };
}


function generateHelpText(filename) {
  debug("generateHelpText");
  initToken();
  const markdown = mdUtil.osmbcMarkdown();

  let helpdir = "help";
  if (filename === "CHANGELOG.md") helpdir = "";
  let result = fs.readFileSync(path.resolve(config.getDirName(), helpdir, filename), "UTF8");
  for (const t in token) {
    while (result.indexOf(t) >= 0) {
      result = result.replace(t, token[t]);
    }
  }
  result = markdown.render(result);
  return result;
}


function readDoc(filename) {
  return fs.readFileSync(path.resolve(config.getDirName(), "docs", filename), "UTF8");
}

// Links between the docs (e.g. "config.md#notifications") don't work
// inside OSMBC; they point to the file in the repository instead.
function renderDoc(md) {
  const markdown = mdUtil.osmbcMarkdown();
  const repoDocs = "https://github.com/TheFive/osmbc/blob/master/docs/";
  const html = markdown.render(md.replace(/\]\(([a-z-]+\.md)(#[a-z0-9-]*)?\)/g, (m, file, anchor) => "](" + repoDocs + file + (anchor || "") + ")"));
  // Bootstrap look for the tables; wide tables scroll on phones
  return html.replace(/<table>/g, "<div class=\"table-responsive\"><table class=\"table table-sm\">").replace(/<\/table>/g, "</table></div>");
}

/**
 * The whole document docs/<filename> as HTML (e.g. the admin
 * configuration help).
 * @param {string} filename file name inside docs/
 * @returns {string} HTML
 */
function generateDocText(filename) {
  debug("generateDocText");
  return renderDoc(readDoc(filename));
}

/**
 * The section of docs/<filename> whose "## " heading names `name` in
 * backticks (e.g. "## `votes` — ..."), as HTML without the heading, or
 * null if there is none. Used for the help on each admin config page.
 * @param {string} filename file name inside docs/
 * @param {string} name the name in the heading
 * @returns {string|null} HTML
 */
function generateDocSection(filename, name) {
  debug("generateDocSection");
  const lines = readDoc(filename).split("\n");
  const start = lines.findIndex(l => l.startsWith("## ") && l.indexOf("`" + name + "`") >= 0);
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  return renderDoc(lines.slice(start + 1, end).join("\n"));
}

const help = {
  getText: generateHelpText,
  getDocText: generateDocText,
  getDocSection: generateDocSection
};

export default help;
