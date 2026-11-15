// markdown-it plugin for wiki pages.
//
// Pages link to each other as "/wiki/<id>" (or relative to the current
// page) and to images as "/wiki/_media/<path>" (or a relative path), so the
// page files do not depend on where OSMBC is mounted. The plugin
// - rewrites those links to the real base path,
// - marks links to pages that do not exist (class osmbc-wiki-missing),
// - gives every heading an id and collects a table of contents.
//
// Per render call pass the page context as env:
//   md.render(text, { wiki: { currentId, exists(id) } })
// After rendering env.toc holds [{ level, id, text }].

import { isValidPageId } from "./wikiStore.js";

const CANONICAL_BASE = "/wiki";
const MISSING_CLASS = "osmbc-wiki-missing";

export function slugify(text) {
  const slug = String(text)
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
  return slug || "section";
}

function hasScheme(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

// "../x" and "y" relative to the namespace of currentId
function resolveRelative(relative, currentId) {
  const segments = currentId ? currentId.split("/").slice(0, -1) : [];
  for (const part of relative.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(part);
    }
  }
  return segments.join("/");
}

// like DokuWiki: link targets are case-insensitive and spaces become "_",
// so [x](Onboarding) and [x](My%20Page) reach onboarding / my_page
function normaliseLinkTarget(pageId) {
  let decoded = pageId;
  try {
    decoded = decodeURIComponent(pageId);
  } catch (err) {
    // keep it as it is, it is marked as missing anyway
  }
  return decoded.toLowerCase().replace(/\s+/g, "_");
}

// returns { href, pageId } or null if the link is not a wiki link
export function resolveWikiLink(href, basePath, currentId) {
  if (typeof href !== "string" || href === "" || hasScheme(href) || href.startsWith("#")) return null;
  const hashIndex = href.search(/[?#]/);
  const pathPart = hashIndex >= 0 ? href.substring(0, hashIndex) : href;
  const suffix = hashIndex >= 0 ? href.substring(hashIndex) : "";
  let pageId;
  if (pathPart.startsWith("/")) {
    if (pathPart === CANONICAL_BASE || pathPart === CANONICAL_BASE + "/") return { href: basePath + suffix, pageId: null };
    if (!pathPart.startsWith(CANONICAL_BASE + "/")) return null;
    pageId = pathPart.substring(CANONICAL_BASE.length + 1);
  } else {
    pageId = resolveRelative(pathPart, currentId);
    if (pageId === null) return null;
  }
  pageId = normaliseLinkTarget(pageId);
  if (pageId.startsWith("_")) return { href: basePath + "/" + pageId + suffix, pageId: null };
  return { href: basePath + "/" + pageId + suffix, pageId };
}

export function resolveWikiMedia(src, basePath, currentId) {
  if (typeof src !== "string" || src === "" || hasScheme(src) || src.startsWith("data:")) return src;
  if (src.startsWith(CANONICAL_BASE + "/_media/")) return basePath + src.substring(CANONICAL_BASE.length);
  if (src.startsWith("/")) return src;
  // relative: media/<path> or a path below the page's namespace
  const mediaPath = src.startsWith("media/") ? src.substring(6) : resolveRelative(src, currentId);
  if (!mediaPath) return src;
  return basePath + "/_media/" + mediaPath;
}

function inlineText(token) {
  if (!token || !token.children) return token ? token.content : "";
  return token.children
    .filter(t => t.type === "text" || t.type === "code_inline" || t.type === "emoji")
    .map(t => t.content)
    .join("");
}

// options: basePath (e.g. htmlRoot + "/wiki")
export default function wikiMarkdownPlugin(md, options = {}) {
  const basePath = options.basePath ?? CANONICAL_BASE;

  md.core.ruler.push("osmbc_wiki", function (state) {
    const context = (state.env && state.env.wiki) || {};
    const exists = typeof context.exists === "function" ? context.exists : null;
    const usedIds = new Map();
    const toc = [];

    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === "heading_open") {
        const text = inlineText(tokens[i + 1]);
        let id = slugify(text);
        const count = usedIds.get(id) || 0;
        usedIds.set(id, count + 1);
        if (count > 0) id = id + "-" + (count + 1);
        token.attrSet("id", id);
        toc.push({ level: Number(token.tag.substring(1)), id, text });
      }
      if (token.type !== "inline" || !token.children) continue;
      for (const child of token.children) {
        if (child.type === "link_open") {
          const link = resolveWikiLink(child.attrGet("href"), basePath, context.currentId);
          if (!link) continue;
          child.attrSet("href", link.href);
          if (link.pageId !== null && (!isValidPageId(link.pageId) || (exists && !exists(link.pageId)))) {
            child.attrJoin("class", MISSING_CLASS);
          }
        } else if (child.type === "image") {
          child.attrSet("src", resolveWikiMedia(child.attrGet("src"), basePath, context.currentId));
        }
      }
    }
    if (state.env) state.env.toc = toc;
  });
}
