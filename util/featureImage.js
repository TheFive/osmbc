import _debug from "debug";

import config from "../config.js";
import linkCheck from "../util/linkCheck.js";

const debug = _debug("OSMBC:util:featureImage");

// Base url the (relative) feature image path is resolved against, e.g.
// https://weeklyosm.eu - the published site, where Hugo serves the image.
// Required: without it, a feature image can't be validated on save.
const featureImageBaseUrl = config.getValue("Feature Image Base URL", { mustExist: true }).replace(/\/+$/, "");

const regexMarkdownImage = /!\[([^\]]*)\]\(([^)]+)\)/;
const regexUrlFromCollection = /\b(https?:\/\/[^\[\]() \n\r]*)\b/g;


// Splits the markdown of a Picture article into the feature image link and
// the remaining caption text. This is the parsing the Hugo export uses for
// featureImage / featureImageCap (see HugoMarkdownRenderer._generateFrontText),
// so the save check validates exactly the link that ends up in Hugo.
function splitFeatureImage(md) {
  let link = null;
  if (!md) return { link: link, text: md };
  // (?<!\s) lets a match start only at the beginning of a whitespace run,
  // otherwise long runs of whitespace are scanned quadratically (ReDoS)
  md = md.replace(/(?<!\s)\s*=\d+\s*[xX]\s*\d+(?=\))/g, "");
  const imageMatch = regexMarkdownImage.exec(md);
  if (imageMatch && imageMatch.length >= 3) {
    link = imageMatch[2];
    md = md.replace(regexMarkdownImage, "").trim();
  } else {
    regexUrlFromCollection.lastIndex = 0;
    const urlMatch = regexUrlFromCollection.exec(md);
    if (urlMatch && urlMatch.length > 0) {
      link = urlMatch[0];
      md = md.replace(/!\[([^\]]*)\]\s*\(\s*[^)]*\)/g, "").trim();
      if (md.includes(urlMatch[0])) {
        md = md.replace(urlMatch[0], "").trim();
      }
    }
  }
  return { link: link, text: md };
}

function isEmptyMarkdown(md) {
  if (typeof md !== "string") return true;
  const t = md.trim();
  return t === "" || t === "no translation" || t.indexOf("----------") >= 0;
}

// Checks the feature image of a Picture article markdown.
// Calls back with "OK" or a human readable error text.
function checkFeatureImage(md, callback) {
  debug("checkFeatureImage");
  if (isEmptyMarkdown(md)) return callback(null, "OK");
  const link = splitFeatureImage(md).link;
  if (!link) return callback(null, "Picture article needs a feature image ![...](/...)");
  if (link.charAt(0) !== "/" || link.charAt(1) === "/") {
    return callback(null, `Feature image "${link}" must be a relative path starting with /`);
  }
  const url = featureImageBaseUrl + link;
  linkCheck.checkUrl(url, function(err, status) {
    if (err) return callback(err);
    if (status === "OK") return callback(null, "OK");
    return callback(null, `Feature image ${url} does not exist (${status})`);
  });
}

const featureImage = {
  splitFeatureImage: splitFeatureImage,
  checkFeatureImage: checkFeatureImage
};

export default featureImage;
