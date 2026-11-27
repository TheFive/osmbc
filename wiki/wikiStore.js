// Wiki pages as Markdown files in a git repository.
//
// The store knows nothing about OSMBC (no DB, no config.js, no Express):
// everything it needs is passed to the constructor, so the wiki module can
// be split out later. One .md file per page, folders are namespaces,
// media files live under media/. Every change is one git commit with the
// editor as author.

import { execFile } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { load as yamlLoad } from "js-yaml";

const SEGMENT = "[a-z0-9_-]+";
const PAGE_ID = new RegExp("^" + SEGMENT + "(/" + SEGMENT + ")*$");
const MEDIA_FILE = /^[a-z0-9_-][a-z0-9_.-]*\.([a-z0-9]+)$/;
const REVISION = /^[0-9a-f]{7,40}$/;
const MAX_ID_LENGTH = 200;

export const MEDIA_DIR = "media";

// extension -> content type of the media files we accept and serve
export const MEDIA_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml"
};

export class WikiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "WikiError";
    this.status = status;
    Object.assign(this, details);
  }
}

function invalid(message) { return new WikiError(message, 400); }

export function isValidPageId(id) {
  if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH) return false;
  if (!PAGE_ID.test(id)) return false;
  // media/ holds the images, _xxx are reserved for routes (/wiki/_search)
  const first = id.split("/")[0];
  return first !== MEDIA_DIR && !first.startsWith("_");
}

export function validatePageId(id) {
  if (!isValidPageId(id)) throw invalid("Invalid wiki page name: " + id);
  return id;
}

// media path relative to media/, e.g. "osmbc/howto-leadpicture.png"
export function validateMediaPath(mediaPath) {
  if (typeof mediaPath !== "string" || mediaPath.length === 0 || mediaPath.length > MAX_ID_LENGTH) {
    throw invalid("Invalid media name: " + mediaPath);
  }
  const segments = mediaPath.split("/");
  const fileName = segments.pop();
  for (const s of segments) {
    if (!new RegExp("^" + SEGMENT + "$").test(s)) throw invalid("Invalid media name: " + mediaPath);
  }
  const match = MEDIA_FILE.exec(fileName);
  if (!match || !MEDIA_TYPES[match[1]]) throw invalid("Invalid media name or type: " + mediaPath);
  return { mediaPath, extension: match[1], contentType: MEDIA_TYPES[match[1]] };
}

// the content has to match the extension: no HTML or script uploaded as
// .png, no scripts or event handlers in an SVG
export function validateMediaContent(buffer, extension) {
  const startsWith = (bytes) => bytes.every((b, i) => buffer[i] === b);
  let ok;
  switch (extension) {
    case "png": ok = startsWith([0x89, 0x50, 0x4e, 0x47]); break;
    case "jpg":
    case "jpeg": ok = startsWith([0xff, 0xd8, 0xff]); break;
    case "gif": ok = startsWith([0x47, 0x49, 0x46, 0x38]); break;
    case "webp": ok = startsWith([0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString("latin1") === "WEBP"; break;
    case "svg": {
      const text = buffer.toString("utf8");
      ok = /<svg[\s>]/i.test(text) && !/<script|\son[a-z]+\s*=|javascript:|<foreignObject/i.test(text);
      break;
    }
    default: ok = false;
  }
  if (!ok) throw invalid("File content does not match the type " + extension + " (or the SVG contains scripts)");
}

function validateRevision(rev) {
  if (typeof rev !== "string" || !REVISION.test(rev)) throw invalid("Invalid revision: " + rev);
  return rev;
}

// same hash git uses for a blob, so a client can send back what it loaded
export function blobHash(text) {
  const buffer = Buffer.from(text, "utf8");
  return createHash("sha1").update("blob " + buffer.length + "\0").update(buffer).digest("hex");
}

// Optional YAML front matter between "---" lines at the very start.
export function splitFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { frontMatter: {}, body: text };
  let frontMatter;
  try {
    frontMatter = yamlLoad(match[1]);
  } catch (err) {
    return { frontMatter: {}, body: text, frontMatterError: err.message };
  }
  if (!frontMatter || typeof frontMatter !== "object" || Array.isArray(frontMatter)) frontMatter = {};
  return { frontMatter, body: text.substring(match[0].length) };
}

// wiki-wide access list (readAccess/writeAccess): "full" and "guest" are
// access levels, every other entry is an OSM user name (case ignored), e.g.
// [full, someGuest] or [alice, bob] for a small rollout. "denied" users
// never get access.
export const ACCESS_LEVELS = ["full", "guest"];
export function userHasAccess(list, user) {
  if (!user || !Array.isArray(list) || user.access === "denied") return false;
  const name = String(user.OSMUser || "").toLowerCase();
  return list.some(entry => ACCESS_LEVELS.includes(entry)
    ? entry === user.access
    : name !== "" && String(entry).toLowerCase() === name);
}

// front matter can only narrow access: "access: full" hides a page from
// everyone without full access, whatever the wiki-wide read access is
export function pageAllowsAccess(frontMatter, userAccess) {
  if (frontMatter && frontMatter.access === "full") return userAccess === "full";
  return true;
}

function requireText(markdown) {
  if (typeof markdown !== "string") throw invalid("Missing page text");
}

// Every change must name the version it is based on, so nobody overwrites
// a change they have not seen.
function requireBaseBlob(baseBlob) {
  if (typeof baseBlob !== "string") throw invalid("Missing base version (baseBlob) of the page");
}

function assertUnchangedSince(id, current, baseBlob) {
  const currentBlob = (current === null) ? "" : blobHash(current);
  if (currentBlob === baseBlob) return;
  throw new WikiError("Page " + id + " was changed in the meantime, please check it and try again", 409, {
    conflict: true,
    currentMarkdown: current,
    currentBlob
  });
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

function normaliseText(text) {
  text = text.replace(/\r\n?/g, "\n");
  if (text.length > 0 && !text.endsWith("\n")) text += "\n";
  return text;
}

function firstHeading(body) {
  const match = /^#\s+(.+?)\s*#*\s*$/m.exec(body);
  return match ? match[1] : null;
}

function gitAuthor(user) {
  const name = String(user || "").replace(/[<>\n\r]/g, "").trim();
  if (!name) throw invalid("Missing user for wiki change");
  const mail = name.replace(/[^A-Za-z0-9._-]/g, "_") + "@osmbc";
  return name + " <" + mail + ">";
}

export class WikiStore {
  // options: directory (absolute), autoPush (git push after each commit),
  // logger ({info, error}), git (binary, for tests)
  constructor(options) {
    if (!options || typeof options.directory !== "string" || !path.isAbsolute(options.directory)) {
      throw new Error("WikiStore needs an absolute directory");
    }
    this.directory = path.resolve(options.directory);
    this.autoPush = !!options.autoPush;
    this.logger = options.logger || console;
    this.gitBinary = options.git || "git";
    this._queue = Promise.resolve();
    this._ready = null;
  }

  // ---- git plumbing -------------------------------------------------------

  _git(args, options = {}) {
    // committer is always OSMBC, the author is the editor (set per commit)
    const fullArgs = ["-c", "user.name=OSMBC", "-c", "user.email=osmbc@osmbc", "-c", "core.quotepath=off"].concat(args);
    return new Promise((resolve, reject) => {
      execFile(this.gitBinary, fullArgs, {
        cwd: this.directory,
        maxBuffer: 64 * 1024 * 1024,
        encoding: options.encoding || "utf8",
        env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" })
      }, (err, stdout, stderr) => {
        if (err) {
          if (options.allowExitCodes && options.allowExitCodes.includes(err.code)) return resolve(stdout);
          err.message = "git " + args[0] + " failed: " + (stderr || err.message);
          return reject(err);
        }
        resolve(stdout);
      });
    });
  }

  // run fn exclusively: one repository, saves may arrive concurrently
  _exclusive(fn) {
    const run = this._queue.then(() => this.init()).then(fn);
    this._queue = run.catch(() => {});
    return run;
  }

  init() {
    if (!this._ready) this._ready = this._init();
    return this._ready;
  }

  async _init() {
    fs.mkdirSync(this.directory, { recursive: true });
    if (fs.existsSync(path.join(this.directory, ".git"))) return;
    const entries = fs.readdirSync(this.directory);
    if (entries.length > 0) {
      throw new Error("Wiki directory " + this.directory + " is not empty and not a git repository");
    }
    await this._git(["init", "--quiet"]);
    this.logger.info("Wiki: initialised git repository in " + this.directory);
  }

  async _commit(message, author) {
    await this._git(["commit", "--quiet", "--no-verify", "-m", message, "--author=" + author]);
    const rev = (await this._git(["rev-parse", "HEAD"])).trim();
    if (this.autoPush) this._push();
    return rev;
  }

  _push() {
    this._git(["push", "--quiet"]).catch((err) => {
      this.logger.error("Wiki: git push failed: " + err.message);
    });
  }

  _pagePath(id) {
    return validatePageId(id) + ".md";
  }

  // ids and media paths are validated before; this second check keeps
  // every file access inside the wiki directory
  _absolute(relative) {
    const file = path.resolve(this.directory, relative);
    if (file !== this.directory && !file.startsWith(this.directory + path.sep)) throw invalid("Invalid wiki path: " + relative);
    return file;
  }

  // ---- pages --------------------------------------------------------------

  async exists(id) {
    await this.init();
    return fs.existsSync(this._absolute(this._pagePath(id)));
  }

  // returns null if the page does not exist
  async readPage(id) {
    await this.init();
    const file = this._absolute(this._pagePath(id));
    if (!fs.existsSync(file)) return null;
    const markdown = fs.readFileSync(file, "utf8");
    const { frontMatter, body, frontMatterError } = splitFrontMatter(markdown);
    return {
      id,
      markdown,
      body,
      frontMatter,
      frontMatterError,
      title: frontMatter.title || firstHeading(body) || id.split("/").pop(),
      blob: blobHash(markdown)
    };
  }

  /**
   * Creates or edits a page and commits it. Line ends become "\n".
   * Saving the text the page already has changes nothing (no commit, no
   * conflict, even if the page changed since `baseBlob`).
   * @param {string} id - Page id, e.g. "osmbc/rules".
   * @param {string} markdown - The new page text.
   * @param {object} options - `user` (OSM name, required), `baseBlob`
   *   (required: blobHash of the text the editor started from, "" for a
   *   new page), `message` (optional commit message).
   * @returns {Promise<object>} `{ changed: false, blob }` or
   *   `{ changed: true, created, rev, blob }`; `blob` is the hash of the
   *   stored text, the base for the next save.
   * @throws {WikiError} 400 for missing text/baseBlob/user or a bad id,
   *   409 with `conflict`, `currentMarkdown`, `currentBlob` if the page
   *   is no longer at `baseBlob`.
   */
  async savePage(id, markdown, options = {}) {
    requireText(markdown);
    requireBaseBlob(options.baseBlob);
    const relative = this._pagePath(id);
    const author = gitAuthor(options.user);
    return this._exclusive(async () => {
      const file = this._absolute(relative);
      const text = normaliseText(markdown);
      const current = readIfExists(file);
      if (current === text) return { changed: false, blob: blobHash(text) };
      assertUnchangedSince(id, current, options.baseBlob);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, "utf8");
      await this._git(["add", "--", relative]);
      const created = (current === null);
      const rev = await this._commit(options.message || ((created ? "Create " : "Edit ") + id), author);
      return { changed: true, created, rev, blob: blobHash(text) };
    });
  }

  /**
   * Renames a page (git mv) and commits it.
   * @param {string} fromId - Current page id.
   * @param {string} toId - New page id, must not exist yet.
   * @param {object} options - `user` (required), `baseBlob` (required:
   *   blobHash of the page text the user saw), `message` (optional).
   * @returns {Promise<{rev: string}>} The new commit.
   * @throws {WikiError} 400 for missing baseBlob/user or a bad id, 404 if
   *   the page is gone, 409 if the target exists or the page changed.
   */
  async movePage(fromId, toId, options = {}) {
    requireBaseBlob(options.baseBlob);
    const from = this._pagePath(fromId);
    const to = this._pagePath(toId);
    const author = gitAuthor(options.user);
    return this._exclusive(async () => {
      const current = readIfExists(this._absolute(from));
      if (current === null) throw new WikiError("Page " + fromId + " does not exist", 404);
      assertUnchangedSince(fromId, current, options.baseBlob);
      if (fs.existsSync(this._absolute(to))) throw new WikiError("Page " + toId + " already exists", 409);
      fs.mkdirSync(path.dirname(this._absolute(to)), { recursive: true });
      await this._git(["mv", "--", from, to]);
      const rev = await this._commit(options.message || ("Move " + fromId + " to " + toId), author);
      return { rev };
    });
  }

  /**
   * Deletes a page (git rm) and commits it; the history keeps it.
   * @param {string} id - Page id.
   * @param {object} options - `user` (required), `baseBlob` (required:
   *   blobHash of the page text the user saw), `message` (optional).
   * @returns {Promise<{rev: string}>} The new commit.
   * @throws {WikiError} 400 for missing baseBlob/user or a bad id, 404 if
   *   the page is gone, 409 if the page changed.
   */
  async deletePage(id, options = {}) {
    requireBaseBlob(options.baseBlob);
    const relative = this._pagePath(id);
    const author = gitAuthor(options.user);
    return this._exclusive(async () => {
      const current = readIfExists(this._absolute(relative));
      if (current === null) throw new WikiError("Page " + id + " does not exist", 404);
      assertUnchangedSince(id, current, options.baseBlob);
      await this._git(["rm", "--quiet", "--", relative]);
      const rev = await this._commit(options.message || ("Delete " + id), author);
      return { rev };
    });
  }

  // all pages, sorted by id: [{ id, title, frontMatter }]
  async listPages() {
    await this.init();
    const result = [];
    const walk = (relativeDir) => {
      const absoluteDir = this._absolute(relativeDir);
      for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const relative = relativeDir ? relativeDir + "/" + entry.name : entry.name;
        if (entry.isDirectory()) {
          if (!relativeDir && entry.name === MEDIA_DIR) continue;
          walk(relative);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          const id = relative.slice(0, -3);
          if (!isValidPageId(id)) continue;
          const { frontMatter, body } = splitFrontMatter(fs.readFileSync(this._absolute(relative), "utf8"));
          result.push({ id, title: frontMatter.title || firstHeading(body) || entry.name.slice(0, -3), frontMatter });
        }
      }
    };
    walk("");
    result.sort((a, b) => a.id.localeCompare(b.id));
    return result;
  }

  // ---- history ------------------------------------------------------------

  // commits touching the page, newest first, following renames:
  // [{ rev, author, date, message, path }]
  async history(id, options = {}) {
    const relative = this._pagePath(id);
    await this.init();
    const args = ["log", "--follow", "--name-only", "--format=%x1e%H%x1f%an%x1f%aI%x1f%s"];
    if (options.limit) args.push("-n", String(options.limit));
    args.push("--", relative);
    const out = await this._git(args, { allowExitCodes: [128] });
    const entries = [];
    for (const record of out.split("\x1e")) {
      if (!record.trim()) continue;
      const [header, ...rest] = record.split("\n");
      const [rev, author, date, message] = header.split("\x1f");
      const filePath = rest.map(s => s.trim()).find(s => s.length > 0) || relative;
      entries.push({ rev, author, date, message, path: filePath });
    }
    return entries;
  }

  // text of the page at a revision (the path it had then), null if it did
  // not exist (e.g. the deleting commit)
  async pageAt(id, rev) {
    validateRevision(rev);
    const entries = await this.history(id);
    const entry = entries.find(e => e.rev.startsWith(rev));
    if (!entry) throw new WikiError("Revision " + rev + " not found for page " + id, 404);
    return this._showFile(entry.rev, entry.path);
  }

  async _showFile(rev, relative) {
    try {
      return await this._git(["show", rev + ":" + relative]);
    } catch (err) {
      return null;
    }
  }

  // text before and after a revision of the page, for the diff view
  async change(id, rev) {
    validateRevision(rev);
    const entries = await this.history(id);
    const index = entries.findIndex(e => e.rev.startsWith(rev));
    if (index < 0) throw new WikiError("Revision " + rev + " not found for page " + id, 404);
    const entry = entries[index];
    const previous = entries[index + 1];
    const after = await this._showFile(entry.rev, entry.path);
    const before = previous ? await this._showFile(previous.rev, previous.path) : null;
    return { entry, previous, before: before || "", after: after || "" };
  }

  /**
   * Saves the text of an older revision as the new version (also brings
   * back a deleted page). Same rules and result as `savePage`.
   * @param {string} id - Page id.
   * @param {string} rev - Git revision to take the text from.
   * @param {object} options - `user`, `baseBlob` (both required, "" if the
   *   page does not exist now), `message` (optional).
   * @returns {Promise<object>} See `savePage`.
   * @throws {WikiError} 404 if the page did not exist in `rev`, else as `savePage`.
   */
  async revert(id, rev, options = {}) {
    const text = await this.pageAt(id, rev);
    if (text === null) throw new WikiError("Page " + id + " did not exist in revision " + rev, 404);
    return this.savePage(id, text, {
      user: options.user,
      baseBlob: options.baseBlob,
      message: options.message || ("Revert " + id + " to " + rev.substring(0, 8))
    });
  }

  // ---- search -------------------------------------------------------------

  // case-insensitive plain-text search: [{ id, matches: [{ line, text }] }]
  async search(query, options = {}) {
    await this.init();
    if (typeof query !== "string" || query.trim().length === 0) return [];
    const out = await this._git(["grep", "-I", "-i", "-F", "-n", "--no-color", "-e", query.trim(), "--", "*.md"], { allowExitCodes: [1] });
    const byId = new Map();
    for (const line of out.split("\n")) {
      const match = /^(.+?)\.md:(\d+):(.*)$/.exec(line);
      if (!match || !isValidPageId(match[1])) continue;
      if (!byId.has(match[1])) byId.set(match[1], []);
      byId.get(match[1]).push({ line: Number(match[2]), text: match[3] });
    }
    const limit = options.limitPerPage || 3;
    return Array.from(byId.entries()).map(([id, matches]) => ({ id, matchCount: matches.length, matches: matches.slice(0, limit) }));
  }

  // ---- media --------------------------------------------------------------

  async mediaExists(mediaPath) {
    validateMediaPath(mediaPath);
    await this.init();
    return fs.existsSync(this._absolute(MEDIA_DIR + "/" + mediaPath));
  }

  async readMedia(mediaPath) {
    const { contentType } = validateMediaPath(mediaPath);
    await this.init();
    const file = this._absolute(MEDIA_DIR + "/" + mediaPath);
    if (!fs.existsSync(file)) return null;
    return { buffer: fs.readFileSync(file), contentType };
  }

  // options: user, maxBytes, overwrite (default false)
  async saveMedia(mediaPath, buffer, options = {}) {
    const { extension } = validateMediaPath(mediaPath);
    const author = gitAuthor(options.user);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw invalid("Empty media file");
    if (options.maxBytes && buffer.length > options.maxBytes) {
      throw new WikiError("Media file too large (" + buffer.length + " bytes, max " + options.maxBytes + ")", 413);
    }
    validateMediaContent(buffer, extension);
    const relative = MEDIA_DIR + "/" + mediaPath;
    return this._exclusive(async () => {
      const file = this._absolute(relative);
      const exists = fs.existsSync(file);
      if (exists && !options.overwrite) throw new WikiError("Media file " + mediaPath + " already exists", 409);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buffer);
      await this._git(["add", "--", relative]);
      const rev = await this._commit(options.message || ((exists ? "Replace " : "Upload ") + relative), author);
      return { rev, mediaPath };
    });
  }
}
