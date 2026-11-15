// Line diff of two page versions as HTML for the diff view. Every text
// part is escaped (the page text is user input).

import { diffLines } from "diff";

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitLines(value) {
  const lines = value.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// returns { html, added, removed }; unchanged runs longer than 2 * context
// lines are shortened to "…"
export function htmlLineDiff(before, after, options = {}) {
  const context = options.context ?? 3;
  const rows = [];
  for (const part of diffLines(before || "", after || "")) {
    const type = part.added ? "added" : (part.removed ? "removed" : "same");
    for (const line of splitLines(part.value)) rows.push({ type, line });
  }
  let added = 0;
  let removed = 0;
  const keep = rows.map(() => false);
  rows.forEach((row, index) => {
    if (row.type === "same") return;
    if (row.type === "added") added++; else removed++;
    for (let i = Math.max(0, index - context); i <= Math.min(rows.length - 1, index + context); i++) keep[i] = true;
  });
  let html = "";
  let skipped = false;
  rows.forEach((row, index) => {
    if (!keep[index]) {
      if (!skipped) html += "<div class=\"osmbc-wiki-diff-skip\">…</div>\n";
      skipped = true;
      return;
    }
    skipped = false;
    const prefix = row.type === "added" ? "+" : (row.type === "removed" ? "-" : " ");
    const cls = row.type === "added" ? " osmbc-wiki-diff-added" : (row.type === "removed" ? " osmbc-wiki-diff-removed" : "");
    html += "<div class=\"osmbc-wiki-diff-line" + cls + "\">" + prefix + " " + escapeHtml(row.line) + "</div>\n";
  });
  return { html, added, removed };
}
