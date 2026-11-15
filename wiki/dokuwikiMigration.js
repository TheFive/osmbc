// Converts the git history of a DokuWiki "gitbacked" data repo into a wiki
// repo for OSMBC (Markdown pages, same authors and dates).
//
// The source history has two eras:
// - jingo (until 2024): Markdown files "Page-Name.md" in the repo root,
//   links as [[Text|Page Name]]
// - DokuWiki: pages/<ns>/<page>.txt, media/<ns>/<file> (for one commit in
//   2024 the pages lay in the root as <ns>/<page>.txt)
// The commit that turned the jingo pages into DokuWiki pages tells which
// jingo page became which DokuWiki page, so a page keeps its whole history
// in one file.
//
// The run is repeatable: same source + same options give the same commits
// (same hashes), because committer and date are taken from the source.
//
// Needs pandoc (DokuWiki -> Markdown). Called by tools/dokuwiki-to-md.mjs.

import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { isValidPageId, MEDIA_DIR, MEDIA_TYPES } from "./wikiStore.js";
import { slugify } from "./wikiMarkdown.js";

const execFileP = promisify(execFile);
const MAX_BUFFER = 256 * 1024 * 1024;

export const MIGRATION_MARKER = "dokuwiki";
const COMMITTER = "OSMBC wiki migration <migration@osmbc>";

// ---- ids --------------------------------------------------------------------

const ACCENTS = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", æ: "ae", ø: "oe", å: "aa" };

// DokuWiki page name (with ":" or "/") -> OSMBC page id.
// Like DokuWiki's cleanID (lower case, deaccent, other characters -> "_"),
// plus: dots are not allowed in OSMBC ids, "31.8.2016" -> "31-8-2016".
export function cleanPageId(name) {
  let id = String(name).toLowerCase().normalize("NFC")
    .replace(/[äöüßæøå]/g, c => ACCENTS[c])
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/:/g, "/");
  id = id.split("/").map(segment => segment
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/\.+/g, "-")
    .replace(/_+/g, "_")
    .replace(/-{2,}/g, "-")
    .replace(/^[_-]+|[_-]+$/g, "")
  ).filter(s => s !== "").join("/");
  return id;
}

// media path below media/: folders cleaned like page ids, the file name keeps
// its extension
export function cleanMediaPath(name) {
  const parts = String(name).replace(/:/g, "/").split("/").filter(s => s !== "");
  const file = parts.pop() || "";
  const dot = file.lastIndexOf(".");
  const base = dot > 0 ? file.substring(0, dot) : file;
  const extension = dot > 0 ? file.substring(dot + 1).toLowerCase() : "";
  const cleanBase = cleanPageId(base) || "file";
  const folders = parts.map(cleanPageId).filter(s => s !== "");
  return folders.concat([extension ? cleanBase + "." + extension : cleanBase]).join("/");
}

function namespaceOf(id) {
  const segments = id.split("/");
  segments.pop();
  return segments;
}

function lastSegment(id) {
  return id.split("/").pop();
}

// "../x", "x", "sub/x" relative to the namespace of currentId
function resolveRelative(target, currentId) {
  const segments = currentId ? namespaceOf(currentId) : [];
  for (const part of target.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}

// key to compare page names across the jingo -> DokuWiki rename
function nameKey(name) {
  return cleanPageId(name).replace(/[^a-z0-9]/g, "");
}

// ---- links ------------------------------------------------------------------

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const EMAIL = /^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i;

function addTo(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

// context: { pageIds: Set of the page ids in the final tree, plus lookups
// by name for links to missing pages }
export function createLinkContext(finalIds) {
  const pageIds = new Set(finalIds);
  const byName = new Map();
  const byKey = new Map();
  const byNameKey = new Map();
  for (const id of pageIds) {
    addTo(byName, lastSegment(id), id);
    addTo(byKey, nameKey(id), id);
    addTo(byNameKey, nameKey(lastSegment(id)), id);
  }
  return { pageIds, byName, byKey, byNameKey };
}

// a link to a page that does not exist goes to the one page that fits:
// 1. same name elsewhere (DokuWiki [[Onboarding]] in meetings/ meant
//    osmbc/onboarding), 2. same path when "_", "-" and "." are ignored
//    (online_meeting_2020 -> online-meeting-2020), 3. same name ignoring them
function remapMissing(id, context) {
  if (!context || context.pageIds.has(id)) return id;
  const lookups = [
    [context.byName, lastSegment(id)],
    [context.byKey, nameKey(id)],
    [context.byNameKey, nameKey(lastSegment(id))]
  ];
  for (const [map, key] of lookups) {
    const candidates = map.get(key) || [];
    if (candidates.length === 1) return candidates[0];
  }
  return id;
}

function canonicalPageLink(id, section, context) {
  const target = remapMissing(id, context);
  return "/wiki/" + target + (section ? "#" + slugify(section) : "");
}

// link target as pandoc reads it from DokuWiki ("/ns/page", "page",
// "../page", "page#section") -> canonical OSMBC link "/wiki/<id>"
export function mapDokuLink(target, currentId, context) {
  if (typeof target !== "string" || target === "") return target;
  if (SCHEME.test(target) || target.startsWith("//")) return target;
  if (EMAIL.test(target)) return "mailto:" + target;
  if (target.startsWith("#")) return "#" + slugify(target.substring(1));
  const hash = target.indexOf("#");
  const pathPart = hash >= 0 ? target.substring(0, hash) : target;
  const section = hash >= 0 ? target.substring(hash + 1) : "";
  let id = pathPart.startsWith("/") ? pathPart.substring(1) : resolveRelative(pathPart, currentId);
  // namespace link "ns:" -> its start page
  if (pathPart.endsWith("/") || id === "") id = (id ? id + "/" : "") + "start";
  id = cleanPageId(id);
  if (!isValidPageId(id)) return target;
  return canonicalPageLink(id, section, context);
}

// media target -> { href, isImage } (canonical "/wiki/_media/<path>")
export function mapDokuMedia(target, currentId) {
  if (typeof target !== "string" || target === "" || SCHEME.test(target) || target.startsWith("//")) {
    return { href: target, isImage: true, external: true };
  }
  const mediaPath = cleanMediaPath(target.startsWith("/")
    ? target.substring(1)
    : resolveRelative(target, currentId));
  const extension = mediaPath.includes(".") ? mediaPath.split(".").pop() : "";
  return { href: "/wiki/_media/" + mediaPath, isImage: Object.hasOwn(MEDIA_TYPES, extension) };
}

// ---- DokuWiki -> Markdown -----------------------------------------------------

const BLOCK_OPEN = /<(code|file|nowiki|html|php|HTML|PHP)\b[^>]*>/;

// DokuWiki lists need two leading spaces; "* item" without them was plain
// text, but meant as a list. Not inside code/file/nowiki/html blocks.
export function fixUnindentedLists(text) {
  const lines = text.split("\n");
  let openTag = null;
  let percent = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (openTag) {
      if (line.includes("</" + openTag)) openTag = null;
      continue;
    }
    if (percent) {
      if ((line.match(/%%/g) || []).length % 2 === 1) percent = false;
      continue;
    }
    if (/^\* \S/.test(line)) lines[i] = "  " + line;
    const open = line.match(BLOCK_OPEN);
    if (open && !line.substring(open.index).includes("</" + open[1])) openTag = open[1];
    if ((line.match(/%%/g) || []).length % 2 === 1) percent = true;
  }
  return lines.join("\n");
}

function runPandoc(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("pandoc", args);
    const out = [];
    const err = [];
    child.stdout.on("data", d => out.push(d));
    child.stderr.on("data", d => err.push(d));
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error("pandoc " + args.join(" ") + " failed: " + Buffer.concat(err).toString()));
      resolve(Buffer.concat(out).toString("utf8"));
    });
    child.stdin.end(input);
  });
}

export async function pandocVersion() {
  const { stdout } = await execFileP("pandoc", ["--version"]);
  return stdout.split("\n")[0];
}

function stringifyInlines(inlines) {
  let text = "";
  for (const node of inlines || []) {
    if (node.t === "Str") text += node.c;
    else if (node.t === "Space" || node.t === "SoftBreak") text += " ";
    else if (node.t === "Code") text += node.c[1];
    else if (Array.isArray(node.c)) text += stringifyInlines(node.c.find(Array.isArray) || []);
  }
  return text;
}

const SIZE_MARK = "osmbc-size=";

// changes the pandoc AST in place: links, images, things OSMBC's markdown
// (HTML off) cannot show
function transformAst(ast, currentId, context, report) {
  function inlineList(list) {
    const result = [];
    for (const node of list) result.push(...inline(node));
    return result;
  }
  function inline(node) {
    switch (node.t) {
      case "Link": {
        const [attr, content, [target, title]] = node.c;
        const href = mapDokuLink(target, currentId, context);
        if (href && href.startsWith("/wiki/") && context) {
          const id = href.substring(6).split("#")[0];
          if (!context.pageIds.has(id)) report.missingLinks.add(id);
        }
        // [[osmbc:]] has no text, it would be an invisible link
        const fallback = target.replace(/^\/+|\/+$/g, "") || target;
        const text = stringifyInlines(content).trim() ? inlineList(content) : [{ t: "Str", c: fallback }];
        return [{ t: "Link", c: [attr, text, [href, title]] }];
      }
      case "Image": {
        const [, content, [target, title]] = node.c;
        const text = stringifyInlines(content);
        if (/^\/?rss>/.test(target)) {
          const url = target.replace(/^\/?rss>/, "").split(" ")[0].replace(/^(https?)\/\/\//, "$1://");
          return [{ t: "Link", c: [["", [], []], [{ t: "Str", c: "RSS: " + url }], [url, ""]] }];
        }
        const media = mapDokuMedia(target, currentId);
        if (!media.isImage) {
          return [{ t: "Link", c: [["", [], []], [{ t: "Str", c: text || lastSegment(media.href) }], [media.href, title]] }];
        }
        const attrs = Object.fromEntries(node.c[0][2]);
        let href = media.href;
        if (attrs.width || attrs.height) href += "?" + SIZE_MARK + (attrs.width || "") + "x" + (attrs.height || "");
        return [{ t: "Image", c: [["", [], []], inlineList(content), [href, title]] }];
      }
      case "Underline":
        return [{ t: "Emph", c: inlineList(node.c) }];
      case "Superscript":
        return [{ t: "Str", c: "^" }, ...inlineList(node.c), { t: "Str", c: "^" }];
      case "Subscript":
        return inlineList(node.c);
      case "RawInline":
        return [{ t: "Code", c: [["", [], []], node.c[1]] }];
      case "Strong": case "Emph": case "Strikeout": case "SmallCaps":
        return [{ t: node.t, c: inlineList(node.c) }];
      case "Span":
        return [{ t: "Span", c: [node.c[0], inlineList(node.c[1])] }];
      case "Quoted":
        return [{ t: "Quoted", c: [node.c[0], inlineList(node.c[1])] }];
      case "Note":
        return [{ t: "Note", c: blockList(node.c) }];
      default:
        return [node];
    }
  }
  function blockList(list) {
    return list.map(block);
  }
  function block(node) {
    switch (node.t) {
      case "Para": case "Plain":
        return { t: node.t, c: inlineList(node.c) };
      case "Header":
        return { t: "Header", c: [node.c[0], node.c[1], inlineList(node.c[2])] };
      case "RawBlock":
        return { t: "CodeBlock", c: [["", [], []], node.c[1]] };
      case "BlockQuote":
        return { t: "BlockQuote", c: blockList(node.c) };
      case "BulletList":
        return { t: "BulletList", c: node.c.map(blockList) };
      case "OrderedList":
        return { t: "OrderedList", c: [node.c[0], node.c[1].map(blockList)] };
      case "Div":
        return { t: "Div", c: [node.c[0], blockList(node.c[1])] };
      case "Table": {
        // [attr, caption, colspecs, head, bodies, foot]; cells hold blocks
        const cell = c => [c[0], c[1], c[2], c[3], blockList(c[4])];
        const row = r => [r[0], r[1].map(cell)];
        const [attr, caption, colspecs, head, bodies, foot] = node.c;
        return {
          t: "Table",
          c: [attr, caption, colspecs,
            [head[0], head[1].map(row)],
            bodies.map(b => [b[0], b[1], b[2].map(row), b[3].map(row)]),
            [foot[0], foot[1].map(row)]]
        };
      }
      default:
        return node;
    }
  }
  ast.blocks = blockList(ast.blocks);
}

function tidyMarkdown(markdown) {
  return markdown
    // pandoc separates two adjacent lists with an HTML comment
    .replace(/^<!-- -->\n/gm, "")
    // image sizes in the markdown-it-imsize syntax: ![x](src =200x)
    .replace(new RegExp("\\?" + SIZE_MARK + "([0-9]*x[0-9]*)\\)", "g"), " =$1)")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\s*$/, "\n");
}

// DokuWiki text of page currentId -> { markdown, missingLinks }
export async function convertDokuWiki(text, currentId, context) {
  const report = { missingLinks: new Set() };
  const json = await runPandoc(["-f", "dokuwiki", "-t", "json"], fixUnindentedLists(text));
  const ast = JSON.parse(json);
  transformAst(ast, currentId, context, report);
  const markdown = await runPandoc(["-f", "json", "-t", "gfm", "--wrap=none"], JSON.stringify(ast));
  return { markdown: tidyMarkdown(markdown), missingLinks: report.missingLinks };
}

// ---- jingo -> Markdown --------------------------------------------------------

// jingo page "Page Name" is stored as Page-Name.md
function jingoFileName(page) {
  return page.trim().replace(/\s+/g, "-") + ".md";
}

// jingo Markdown: [[Page]] and [[Text|Page]] -> [Text](/wiki/<id>), outside
// code. jingoIds: Map lower-case file name -> page id
export function convertJingo(text, jingoIds, context) {
  const lookup = page => jingoIds.get(jingoFileName(page).toLowerCase());
  const linkFor = (inner) => {
    const parts = inner.split("|");
    let label = parts[0].trim();
    let page = (parts[1] ?? parts[0]).trim();
    if (parts.length === 2 && !lookup(page) && lookup(label)) [label, page] = [page, label];
    const id = lookup(page) || cleanPageId(page);
    if (!isValidPageId(id)) return "[[" + inner + "]]";
    return "[" + label + "](" + canonicalPageLink(id, "", context) + ")";
  };
  return text.split(/(```[\s\S]*?```|`[^`\n]*`)/).map((part, i) =>
    i % 2 === 1 ? part : part.replace(/\[\[([^\]\n]+)\]\]/g, (m, inner) => linkFor(inner))
  ).join("");
}

// ---- git helpers ---------------------------------------------------------------

function git(gitDir, args, options = {}) {
  return execFileP("git", ["--git-dir=" + gitDir].concat(args), Object.assign({ maxBuffer: MAX_BUFFER }, options));
}

async function gitLines(gitDir, args) {
  const { stdout } = await git(gitDir, args);
  return stdout.split("\n").filter(l => l !== "");
}

// "mode type sha\tpath\0" -> Map path -> sha (blobs only)
async function lsTree(gitDir, commit) {
  const { stdout } = await git(gitDir, ["ls-tree", "-r", "-z", commit]);
  const tree = new Map();
  for (const entry of stdout.split("\0")) {
    if (!entry) continue;
    const tab = entry.indexOf("\t");
    const [, type, sha] = entry.substring(0, tab).split(" ");
    if (type === "blob") tree.set(entry.substring(tab + 1), sha);
  }
  return tree;
}

// changes of a commit against its first parent: [{ status, sha, path }]
async function diffTree(gitDir, commit, parent) {
  const args = parent
    ? ["diff-tree", "-r", "-z", "--no-renames", "--raw", "--no-abbrev", parent, commit]
    : ["diff-tree", "-r", "-z", "--no-renames", "--raw", "--no-abbrev", "--root", commit];
  const { stdout } = await git(gitDir, args);
  const fields = stdout.split("\0");
  const changes = [];
  for (let i = 0; i < fields.length - 1; i++) {
    if (!fields[i].startsWith(":")) continue;
    const [, , , newSha, status] = fields[i].substring(1).split(" ");
    changes.push({ status: status[0], sha: newSha, path: fields[i + 1] });
    i++;
  }
  return changes;
}

// renames (old md -> new txt) of a commit, with git's similarity detection
async function renamesOf(gitDir, commit, parent) {
  const { stdout } = await git(gitDir, ["diff-tree", "-r", "-z", "-M30%", "--name-status", parent, commit]);
  const fields = stdout.split("\0");
  const renames = [];
  for (let i = 0; i < fields.length - 1;) {
    const status = fields[i];
    if (status.startsWith("R")) {
      renames.push({ from: fields[i + 1], to: fields[i + 2] });
      i += 3;
    } else {
      i += 2;
    }
  }
  return renames;
}

// ---- source paths ----------------------------------------------------------------

// source path -> { kind: "page"|"jingo"|"media", id|mediaPath } or null
export function classifyPath(path) {
  if (path.startsWith(MEDIA_DIR + "/")) return { kind: "media", mediaPath: cleanMediaPath(path.substring(MEDIA_DIR.length + 1)) };
  if (path.endsWith(".txt")) {
    const id = cleanPageId(path.replace(/^pages\//, "").replace(/\.txt$/, ""));
    return isValidPageId(id) ? { kind: "page", id } : null;
  }
  if (path.endsWith(".md") && !path.includes("/")) return { kind: "jingo", file: path };
  return null;
}

// jingo file name -> page id. Uses the commit(s) that removed jingo pages and
// added DokuWiki pages at the same time (the 2024 conversion): renames found
// by git first, then the same name; the rest go to jingo/<name>.
async function buildJingoIds(gitDir, commits, allJingoFiles) {
  const ids = new Map();
  const claimed = new Set();
  const claim = (file, id) => {
    if (ids.has(file.toLowerCase()) || claimed.has(id)) return false;
    ids.set(file.toLowerCase(), id);
    claimed.add(id);
    return true;
  };
  for (const commit of commits) {
    if (!commit.parents.length || commit.parents.length > 1) continue;
    const changes = await diffTree(gitDir, commit.sha, commit.parents[0]);
    const removedJingo = changes.filter(c => c.status === "D" && classifyPath(c.path)?.kind === "jingo");
    const addedPages = changes.filter(c => c.status === "A" && classifyPath(c.path)?.kind === "page");
    if (removedJingo.length === 0 || addedPages.length === 0) continue;
    for (const r of await renamesOf(gitDir, commit.sha, commit.parents[0])) {
      const from = classifyPath(r.from);
      const to = classifyPath(r.to);
      if (from?.kind === "jingo" && to?.kind === "page") claim(from.file, to.id);
    }
    const byKey = new Map();
    for (const added of addedPages) {
      const id = classifyPath(added.path).id;
      const key = nameKey(lastSegment(id));
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(id);
    }
    for (const removed of removedJingo) {
      const candidates = (byKey.get(nameKey(removed.path.replace(/\.md$/, ""))) || []).filter(id => !claimed.has(id));
      if (candidates.length === 1) claim(removed.path, candidates[0]);
    }
  }
  for (const file of Array.from(allJingoFiles).sort()) {
    if (ids.has(file.toLowerCase())) continue;
    const base = "jingo/" + (cleanPageId(file.replace(/\.md$/, "")) || "page");
    let id = base;
    for (let n = 2; claimed.has(id) || !isValidPageId(id); n++) id = base + "-" + n;
    claim(file, id);
  }
  return ids;
}

// ---- authors ------------------------------------------------------------------------

// authors: map of e-mail or name -> OSM user name. Without an entry the
// name stays; the e-mail is always replaced (no private addresses).
export function mapAuthor(name, email, authors = {}) {
  const user = (Object.hasOwn(authors, email) && authors[email]) ||
    (Object.hasOwn(authors, name) && authors[name]) || name || "unknown";
  const local = String(user).replace(/[^A-Za-z0-9._-]+/g, "_");
  return { name: String(user).replace(/[<>\n]/g, ""), email: local + "@osmbc" };
}

// ---- fast-import stream ----------------------------------------------------------------

function dataBlock(buffer) {
  return Buffer.concat([Buffer.from("data " + buffer.length + "\n"), buffer, Buffer.from("\n")]);
}

function quotePath(path) {
  return /^[A-Za-z0-9_./-]+$/.test(path) ? path : JSON.stringify(path);
}

// ---- migration -----------------------------------------------------------------------------

// options: source (bare git dir), target (new or empty directory),
// authors (map), restricted (page ids that get "access: full"), log(msg)
// returns { commits, skipped, pages, media, warnings, missingLinks }
export async function migrate(options) {
  const { source, target } = options;
  const authors = options.authors || {};
  const restricted = new Set(options.restricted || []);
  const log = options.log || (() => {});
  const warnings = [];

  const commitLines = await gitLines(source, ["rev-list", "--reverse", "--topo-order", "--parents", "HEAD"]);
  const commits = commitLines.map(line => {
    const [sha, ...parents] = line.split(" ");
    return { sha, parents };
  });
  log(commits.length + " source commits");

  const allJingoFiles = new Set();
  for (const p of await gitLines(source, ["log", "--all", "--format=", "--name-only", "-z"]).then(l => l.join("\n").split(/[\0\n]/))) {
    if (classifyPath(p)?.kind === "jingo") allJingoFiles.add(p);
  }
  const jingoIds = await buildJingoIds(source, commits, allJingoFiles);

  // links to missing pages are resolved against the pages of the final tree
  const finalTree = await lsTree(source, "HEAD");
  const finalIds = [];
  for (const path of finalTree.keys()) {
    const c = classifyPath(path);
    if (c?.kind === "page") finalIds.push(c.id);
  }
  const context = createLinkContext(finalIds);

  const blobCache = new Map();
  async function readBlob(sha) {
    if (!blobCache.has(sha)) {
      const { stdout } = await git(source, ["cat-file", "blob", sha], { encoding: "buffer" });
      blobCache.set(sha, stdout);
    }
    return blobCache.get(sha);
  }

  const convertCache = new Map();
  const missingByPath = new Map();
  async function outputFor(path, sha) {
    const c = classifyPath(path);
    if (!c) return null;
    if (c.kind === "media") return { outPath: MEDIA_DIR + "/" + c.mediaPath, content: await readBlob(sha) };
    const id = c.kind === "page" ? c.id : jingoIds.get(c.file.toLowerCase());
    const key = c.kind + " " + sha + " " + id;
    if (!convertCache.has(key)) {
      const text = (await readBlob(sha)).toString("utf8").replace(/\r\n/g, "\n");
      let result;
      if (c.kind === "page") {
        result = await convertDokuWiki(text, id, context);
      } else {
        result = { markdown: convertJingo(text, jingoIds, context).replace(/\s*$/, "\n"), missingLinks: new Set() };
      }
      let markdown = result.markdown;
      if (restricted.has(id)) markdown = "---\naccess: full\n---\n" + markdown;
      convertCache.set(key, { markdown: Buffer.from(markdown, "utf8"), missingLinks: result.missingLinks });
    }
    const converted = convertCache.get(key);
    missingByPath.set(id + ".md", converted.missingLinks);
    return { outPath: id + ".md", content: converted.markdown };
  }

  const chunks = [];
  const sourceState = new Map(); // source path -> sha
  const owner = new Map(); // output path -> source path
  const output = new Map(); // output path -> content
  let mark = 0;
  let written = 0;
  let skipped = 0;

  for (const commit of commits) {
    let changes;
    if (commit.parents.length > 1) {
      // merge: take its tree as it is
      const tree = await lsTree(source, commit.sha);
      changes = [];
      for (const [path, sha] of sourceState) if (!tree.has(path)) changes.push({ status: "D", path });
      for (const [path, sha] of tree) if (sourceState.get(path) !== sha) changes.push({ status: "M", sha, path });
    } else {
      changes = await diffTree(source, commit.sha, commit.parents[0]);
    }
    const ops = new Map(); // output path -> Buffer | null (delete)
    // deletions first: in the 2024 conversion a jingo page is removed and
    // its DokuWiki page added in the same commit, both map to one file
    for (const change of changes.filter(c => c.status === "D")) {
      sourceState.delete(change.path);
      for (const [outPath, src] of owner) {
        if (src === change.path) {
          owner.delete(outPath);
          output.delete(outPath);
          ops.set(outPath, null);
        }
      }
    }
    for (const change of changes.filter(c => c.status !== "D")) {
      sourceState.set(change.path, change.sha);
      const result = await outputFor(change.path, change.sha);
      if (!result) continue;
      const previousOwner = owner.get(result.outPath);
      if (previousOwner && previousOwner !== change.path && sourceState.has(previousOwner)) {
        warnings.push(commit.sha.substring(0, 7) + ": " + change.path + " and " + previousOwner + " both become " + result.outPath);
      }
      owner.set(result.outPath, change.path);
      output.set(result.outPath, result.content);
      ops.set(result.outPath, result.content);
    }
    // only real changes of the output
    const lines = [];
    for (const [outPath, content] of Array.from(ops).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      if (content === null) {
        if (!output.has(outPath)) lines.push(Buffer.from("D " + quotePath(outPath) + "\n"));
      } else {
        lines.push(Buffer.from("M 100644 inline " + quotePath(outPath) + "\n"), dataBlock(content));
      }
    }
    if (lines.length === 0) {
      skipped++;
      continue;
    }
    const { stdout: meta } = await git(source, ["show", "-s", "--format=%an%x00%ae%x00%ad%x00%B", "--date=raw", commit.sha]);
    const [name, email, date, ...body] = meta.split("\0");
    const author = mapAuthor(name, email, authors);
    const message = body.join("\0").replace(/\s*$/, "") + "\n\nMigrated-From: " + commit.sha + "\n";
    mark++;
    chunks.push(Buffer.from("commit refs/heads/master\nmark :" + mark + "\n" +
      "author " + author.name + " <" + author.email + "> " + date + "\n" +
      "committer " + COMMITTER + " " + date + "\n"));
    chunks.push(dataBlock(Buffer.from(message, "utf8")));
    if (mark > 1) chunks.push(Buffer.from("from :" + (mark - 1) + "\n"));
    chunks.push(...lines);
    chunks.push(Buffer.from("\n"));
    written++;
  }

  await execFileP("git", ["init", "--quiet", "--initial-branch=master", target]);
  await execFileP("git", ["-C", target, "config", "osmbc.migration", MIGRATION_MARKER]);
  await new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", target, "fast-import", "--quiet", "--done"]);
    const err = [];
    child.stderr.on("data", d => err.push(d));
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error("git fast-import failed: " + Buffer.concat(err).toString())));
    for (const chunk of chunks) child.stdin.write(chunk);
    child.stdin.end("done\n");
  });
  await execFileP("git", ["-C", target, "reset", "--hard", "--quiet"]);

  const missingLinks = new Map();
  for (const outPath of output.keys()) {
    for (const id of missingByPath.get(outPath) || []) {
      if (!missingLinks.has(id)) missingLinks.set(id, []);
      missingLinks.get(id).push(outPath.replace(/\.md$/, ""));
    }
  }
  const outPaths = Array.from(output.keys());
  return {
    commits: written,
    skipped,
    pages: outPaths.filter(p => !p.startsWith(MEDIA_DIR + "/")).length,
    media: outPaths.filter(p => p.startsWith(MEDIA_DIR + "/")).length,
    warnings,
    missingLinks
  };
}
