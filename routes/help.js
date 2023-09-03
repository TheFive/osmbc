

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


const help = {
  getText: generateHelpText
};

export default help;
