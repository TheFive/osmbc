"use strict";

const fs = require("fs");
const path = require("path");
const debug = require("debug")("OSMBC:routes:help");
const config = require("../config.js");

const markdown = require("markdown-it")()
  .use(require("markdown-it-sup"))
  .use(require("markdown-it-imsize"), { autofill: true });


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

  let helpdir = "help";
  if (filename === "CHANGELOG.md") helpdir = "";
  let result = fs.readFileSync(path.resolve(__dirname, "..", helpdir, filename), "UTF8");
  for (const t in token) {
    while (result.indexOf(t) >= 0) {
      result = result.replace(t, token[t]);
    }
  }
  result = markdown.render(result);
  return result;
}

exports.getText = generateHelpText;
