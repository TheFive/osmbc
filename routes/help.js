"use strict";

var fs = require("fs");
var path = require("path");
var debug = require("debug")("OSMBC:routes:help");
var config = require("../config.js");

var markdown = require("markdown-it")()
          .use(require("markdown-it-sup"))
          .use(require("markdown-it-imsize"), { autofill: true });


var token = null;

function initToken() {
  debug("initToken");
  if (token) return;
  token = {
    "##osmbcroot##": config.getValue("htmlroot")
  };
}


function generateHelpText(filename) {
  debug("generateHelpText");
  initToken();

  var helpdir = "help";
  if (filename === "CHANGELOG.md") helpdir = "";
  var result = fs.readFileSync(path.resolve(__dirname, "..", helpdir, filename), "UTF8");
  for (var t in token) {
    while (result.indexOf(t) >= 0) {
      result = result.replace(t, token[t]);
    }
  }
  result = markdown.render(result);
  return result;
}

exports.getText = generateHelpText;
