// Converts an HTML <table>'s inner content (thead/tbody, as stored by
// parseOldBlogSections.js - the <table> wrapper itself is not included) into
// a real Markdown table (matching osmbc's own convention, e.g. the existing
// "| Software|Version|..." style seen in real osmbc content).
//
// htmlToMarkdown.js (osmbc's own turndownService, util/md_util.js) does NOT
// include the GFM table plugin, so feeding it a table flattens all rows
// into one run-on paragraph of text, losing the row/column structure
// entirely (confirmed: this happened to all 83 already-rebuilt WN187-271
// "Wochenvorschau" articles). Deliberately not fixing that in md_util.js
// itself here - that's shared app code used by the live editor's
// paste-HTML-as-markdown feature, out of scope for this tool - so this is a
// small, local, table-specific converter instead.

import { load } from "cheerio";
import { htmlToMarkdown } from "./htmlToMarkdown.js";

function cellText(html) {
  return htmlToMarkdown(html || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

export function htmlTableToMarkdown(tableInnerHtml) {
  const $ = load(`<table>${tableInnerHtml}</table>`, null, false);
  const headerCells = $("thead tr th");
  const headers = headerCells.length > 0
    ? headerCells.map((_, th) => cellText($(th).html())).get()
    : $("tbody tr").first().find("td").map((_, td) => cellText($(td).html())).get();

  const bodyRows = headerCells.length > 0
    ? $("tbody tr")
    : $("tbody tr").slice(1);

  // Plain JS .map() over .toArray() here, not cheerio's own .map() - cheerio
  // (like jQuery) auto-flattens array results returned from its .map()
  // callback, which would merge every row's cells into one flat list and
  // lose the row grouping entirely.
  const rows = bodyRows.toArray().map((tr) => $(tr).find("td").map((__, td) => cellText($(td).html())).get());

  if (headers.length === 0) return "";

  const lines = [
    "| " + headers.join(" | ") + " |",
    "| " + headers.map(() => "---").join(" | ") + " |",
    ...rows.map((row) => "| " + row.join(" | ") + " |")
  ];
  return lines.join("\r\n");
}

export default { htmlTableToMarkdown };
