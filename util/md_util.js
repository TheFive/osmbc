"use strict";

function fixLength(text, len, fillChar) {
  let result = text;
  if (typeof text === "undefined") result = "";
  if (text === null) result = "";
  for (let i = result.length; i < len; i++) {
    result = result + fillChar;
  }
  return result;
}

function mdTable(json, columns) {
  for (const c of columns) {
    let cMin = c.name.length;
    let o;
    for (o of json) {
      if (o[c.field] && o[c.field].length > cMin) cMin = o[c.field].length;
    }
    c.displayLength = cMin;
  }
  let md = "";
  // Generate Markdown Header
  for (const c of columns) {
    md = md + "|";
    md = md + fixLength(c.name, c.displayLength, " ");
  }
  md = md + "|\n";
  // generate Markdown Line
  for (const c of columns) {
    md = md + "|";
    md = md + fixLength("", c.displayLength, "-");
  }
  md = md + "|\n";
  // Generate rest

  for (const o of json) {
    for (const c of columns) {
      md = md + "|";
      md = md + fixLength(o[c.field], c.displayLength, " ");
    }
    md = md + "|\n";
  }
  return md;
}

module.exports.mdTable = mdTable;
