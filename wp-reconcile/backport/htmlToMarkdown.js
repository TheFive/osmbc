// Converts a real WordPress HTML article fragment into osmbc-style markdown,
// reusing osmbc's own conversion pipeline (util/md_util.js:turndownService,
// the same one used when pasting HTML into the editor and in
// render/MarkdownRenderer.js) so the result matches what an editor would
// have produced, rather than inventing a separate conversion.

import mdUtil from "../../util/md_util.js";

export function htmlToMarkdown(html) {
  if (typeof html !== "string" || html.trim() === "") return "";
  const td = mdUtil.turndownService();
  return td.turndown(html).trim();
}

export default { htmlToMarkdown };
