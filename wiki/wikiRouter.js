// Express router for the wiki.
//
// Like the store it does not import OSMBC: everything it needs from the
// host application is passed in (see createWikiRouter). Views live in
// views/wiki/ and get the host's layout variables.
//
// URLs (below the mount point):
//   GET  /                     index          GET  /_search?q=   search
//   GET  /_new?id=             -> editor      POST /_preview     JSON preview
//   GET  /_media/<path>        image          POST /_media       JSON upload
//   GET  /<page>               view           ?edit ?history ?diff=<rev>
//                                             ?rev=<rev> ?move ?delete
//   POST /<page>               save, or action=revert|move|delete
// Actions are query/form fields, not path suffixes, so they never clash
// with page names.

import express from "express";
import {
  WikiError, isValidPageId, pageAllowsAccess, splitFrontMatter, validateMediaPath
} from "./wikiStore.js";
import wikiMarkdownPlugin from "./wikiMarkdown.js";
import { htmlLineDiff } from "./wikiDiff.js";

const SIDEBAR_ID = "sidebar";
const START_ID = "start";
const REVISION = /^[0-9a-f]{7,40}$/;

function pageIdFromParams(req) {
  const page = req.params.page;
  const id = Array.isArray(page) ? page.join("/") : String(page || "");
  if (!isValidPageId(id)) throw new WikiError("Invalid wiki page name: " + id, 404);
  return id;
}

function namespaceOf(id) {
  const index = id.lastIndexOf("/");
  return index < 0 ? "" : id.substring(0, index);
}

function revisionFrom(value) {
  if (typeof value !== "string" || !REVISION.test(value)) throw new WikiError("Invalid revision: " + value, 400);
  return value;
}

// user input "Howto/My Page" -> "howto/my_page"
export function normalisePageId(value) {
  return String(value || "").trim().toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "_");
}

// uploaded "My Screenshot (1).PNG" -> "my_screenshot_1.png"
export function normaliseMediaName(value) {
  const name = String(value || "").split(/[\\/]/).pop().toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  const base = name.substring(0, dot).replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").substring(0, 80) || "image";
  const extension = name.substring(dot + 1).replace(/[^a-z0-9]/g, "");
  return base + "." + extension;
}

// [{ label, href }] for wiki / ns / ns2 / page
function breadcrumbs(basePath, id) {
  const result = [{ label: "Wiki", href: basePath }];
  if (!id) return result;
  const segments = id.split("/");
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    // a namespace links to its start page, the last segment is the page itself
    const target = isLast ? segments.join("/") : segments.slice(0, index + 1).join("/") + "/" + START_ID;
    result.push({ label: segment, href: basePath + "/" + target, active: isLast });
  });
  return result;
}

// pages grouped by namespace for the index: [{ namespace, pages }]
function groupByNamespace(pages) {
  const groups = new Map();
  for (const page of pages) {
    const namespace = namespaceOf(page.id);
    if (!groups.has(namespace)) groups.set(namespace, []);
    groups.get(namespace).push(page);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([namespace, list]) => ({ namespace, pages: list }));
}

/**
 * options:
 *  - store: WikiStore
 *  - wikiConfig: { readAccess, writeAccess, maxUploadBytes }
 *  - checkRole(roles): middleware, rejects users without one of the roles
 *  - createMarkdown(): a new markdown-it instance with the host's plugins
 *    (HTML off), called per render
 *  - basePath: URL path the router is mounted at, e.g. htmlRoot + "/wiki"
 *  - layout(req, res): the host's layout variables for the views
 *  - prepareLayout: optional middleware that fills the layout for POST routes
 *  - onChange(event): optional, called after every saved change
 *    ({ type, id, user, rev, message, url, fromId, mediaPath })
 */
export function createWikiRouter(options) {
  const { store, wikiConfig, checkRole, basePath } = options;
  const layout = options.layout || ((req, res) => res.rendervar && res.rendervar.layout);
  const prepareLayout = options.prepareLayout || ((req, res, next) => next());
  const onChange = options.onChange || (() => {});
  // built per request: the host's Markdown settings (e.g. OSMBC's language
  // flags from the DB) are not loaded at start and may change at runtime
  const createMarkdown = () => options.createMarkdown().use(wikiMarkdownPlugin, { basePath });

  const router = express.Router();
  const canRead = checkRole(wikiConfig.readAccess);
  const canWrite = checkRole(wikiConfig.writeAccess);
  const userMayWrite = (req) => wikiConfig.writeAccess.includes(req.user.access);
  const pageUrl = (id) => basePath + "/" + id;
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  function notify(event) {
    try {
      onChange(event);
    } catch (err) {
      // a failing notification never fails the change itself
    }
  }

  async function existingIds() {
    const pages = await store.listPages();
    return new Set(pages.map(p => p.id));
  }

  function render(text, currentId, ids) {
    const env = { wiki: { currentId, exists: (id) => ids.has(id) } };
    const html = createMarkdown().render(text || "", env);
    return { html, toc: env.toc || [] };
  }

  async function sidebarFor(req, currentId, ids) {
    if (currentId === SIDEBAR_ID || !ids.has(SIDEBAR_ID)) return null;
    const sidebar = await store.readPage(SIDEBAR_ID);
    if (!sidebar || !pageAllowsAccess(sidebar.frontMatter, req.user.access)) return null;
    return render(sidebar.body, SIDEBAR_ID, ids).html;
  }

  function noAccess(req, what) {
    return new WikiError("OSM User >" + req.user.OSMUser + "< has not enough access rights " + what, 403);
  }

  function assertPageAccess(req, page) {
    if (page && !pageAllowsAccess(page.frontMatter, req.user.access)) throw noAccess(req, "for this page");
  }

  // old versions: the front matter of that version decides
  function assertTextAccess(req, ...texts) {
    for (const text of texts) {
      if (text && !pageAllowsAccess(splitFrontMatter(text).frontMatter, req.user.access)) throw noAccess(req, "for this page");
    }
  }

  function assertMayWrite(req) {
    if (!userMayWrite(req)) throw noAccess(req, "to change the wiki");
  }

  function renderView(req, res, view, vars, status) {
    if (status) res.status(status);
    res.render("wiki/" + view, Object.assign({
      layout: layout(req, res),
      wikiBase: basePath,
      canWrite: userMayWrite(req)
    }, vars));
  }

  function renderEdit(req, res, id, page, extra) {
    renderView(req, res, "edit", Object.assign({
      pageId: id,
      title: page ? page.title : id.split("/").pop(),
      isNew: !page,
      markdown: page ? page.markdown : "",
      baseBlob: page ? page.blob : "",
      message: "",
      breadcrumbs: breadcrumbs(basePath, id),
      previewUrl: basePath + "/_preview",
      uploadUrl: basePath + "/_media",
      maxUploadBytes: wikiConfig.maxUploadBytes
    }, extra), extra && extra.status);
  }

  // ---- index, search and helpers ----------------------------------------------

  router.get("/", canRead, wrap(async (req, res) => {
    const pages = (await store.listPages()).filter(p => pageAllowsAccess(p.frontMatter, req.user.access));
    renderView(req, res, "index", {
      groups: groupByNamespace(pages),
      pageCount: pages.length,
      breadcrumbs: breadcrumbs(basePath, null)
    });
  }));

  router.get("/_search", canRead, wrap(async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().substring(0, 200) : "";
    const pages = new Map((await store.listPages()).map(p => [p.id, p]));
    const results = (await store.search(query))
      .filter(r => pages.has(r.id) && pageAllowsAccess(pages.get(r.id).frontMatter, req.user.access))
      .map(r => Object.assign({ title: pages.get(r.id).title }, r));
    // page names match too, not only the text
    const lower = query.toLowerCase();
    const byName = query
      ? Array.from(pages.values()).filter(p => (p.id.includes(lower) || p.title.toLowerCase().includes(lower)) &&
        pageAllowsAccess(p.frontMatter, req.user.access) && !results.some(r => r.id === p.id))
      : [];
    renderView(req, res, "search", {
      query,
      results,
      byName,
      breadcrumbs: breadcrumbs(basePath, null).concat([{ label: "Search", active: true }])
    });
  }));

  // "new page" form on the index: /wiki/_new?id=ns/page
  router.get("/_new", canWrite, (req, res, next) => {
    const id = normalisePageId(req.query.id);
    if (!isValidPageId(id)) return next(new WikiError("Invalid wiki page name: " + id + " (allowed: a-z, 0-9, _ and -, namespaces separated by /)", 400));
    res.redirect(pageUrl(id) + "?edit");
  });

  router.post("/_preview", canWrite, wrap(async (req, res) => {
    const id = req.body && isValidPageId(req.body.id) ? req.body.id : null;
    const ids = await existingIds();
    const { body } = splitFrontMatter(String((req.body && req.body.markdown) || ""));
    res.json({ html: render(body, id, ids).html });
  }));

  // ---- media --------------------------------------------------------------------

  router.get("/_media/{*path}", canRead, wrap(async (req, res) => {
    const mediaPath = Array.isArray(req.params.path) ? req.params.path.join("/") : String(req.params.path || "");
    let media;
    try {
      media = await store.readMedia(mediaPath);
    } catch (err) {
      if (err instanceof WikiError) err.status = 404;
      throw err;
    }
    if (!media) throw new WikiError("Media file not found: " + mediaPath, 404);
    res.set({
      "Content-Type": media.contentType,
      "X-Content-Type-Options": "nosniff",
      // an SVG opened on its own must not run anything
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      "Cache-Control": "private, max-age=300"
    });
    res.send(media.buffer);
  }));

  // JSON { page, fileName, data (base64) } -> { mediaPath, url, markdown }
  router.post("/_media", canWrite, wrap(async (req, res) => {
    const body = req.body || {};
    const page = isValidPageId(body.page) ? body.page : null;
    const name = normaliseMediaName(body.fileName);
    if (!name) throw new WikiError("Invalid file name: " + body.fileName, 400);
    if (typeof body.data !== "string" || body.data.length === 0) throw new WikiError("Missing file data", 400);
    const buffer = Buffer.from(body.data.replace(/^data:[^,]*,/, ""), "base64");
    const namespace = page ? namespaceOf(page) : "";
    const prefix = namespace ? namespace + "/" : "";
    const dot = name.lastIndexOf(".");
    let mediaPath = prefix + name;
    validateMediaPath(mediaPath);
    for (let n = 2; await store.mediaExists(mediaPath); n++) {
      if (n > 100) throw new WikiError("Too many files named " + name, 409);
      mediaPath = prefix + name.substring(0, dot) + "-" + n + name.substring(dot);
    }
    const result = await store.saveMedia(mediaPath, buffer, { user: req.user.OSMUser, maxBytes: wikiConfig.maxUploadBytes });
    const url = basePath + "/_media/" + mediaPath;
    notify({ type: "upload", id: page || "", user: req.user.OSMUser, rev: result.rev, message: "", url, mediaPath });
    res.json({
      mediaPath,
      url,
      markdown: "![" + name.substring(0, dot).replace(/[_-]+/g, " ") + "](/wiki/_media/" + mediaPath + ")"
    });
  }));

  // JSON errors for the JSON routes, the host's error page for the others
  router.use(["/_media", "/_preview"], (err, req, res, next) => {
    if (req.method !== "POST") return next(err);
    res.status(err.status || 500).json({ error: err.message });
  });

  // ---- pages ----------------------------------------------------------------------

  async function viewHistory(req, res, id, page) {
    const history = await store.history(id, { limit: 200 });
    if (!page && history.length === 0) throw new WikiError("Page " + id + " has no history", 404);
    if (!page && history.length > 0) {
      // deleted page: the last version that had content decides access
      for (const entry of history) {
        const text = await store.pageAt(id, entry.rev);
        if (text === null) continue;
        assertTextAccess(req, text);
        break;
      }
    }
    renderView(req, res, "history", {
      pageId: id,
      title: page ? page.title : id.split("/").pop(),
      exists: !!page,
      currentBlob: page ? page.blob : "",
      history,
      breadcrumbs: breadcrumbs(basePath, id)
    });
  }

  async function viewDiff(req, res, id) {
    const rev = revisionFrom(req.query.diff);
    const change = await store.change(id, rev);
    assertTextAccess(req, change.before, change.after);
    const diff = htmlLineDiff(change.before, change.after);
    renderView(req, res, "diff", {
      pageId: id,
      title: id.split("/").pop(),
      entry: change.entry,
      previous: change.previous,
      diff,
      breadcrumbs: breadcrumbs(basePath, id)
    });
  }

  async function viewRevision(req, res, id, page) {
    const rev = revisionFrom(req.query.rev);
    const text = await store.pageAt(id, rev);
    if (text === null) throw new WikiError("Page " + id + " did not exist in revision " + rev, 404);
    assertTextAccess(req, text);
    const entry = (await store.history(id)).find(h => h.rev.startsWith(rev));
    const ids = await existingIds();
    const { html, toc } = render(splitFrontMatter(text).body, id, ids);
    renderView(req, res, "page", {
      pageId: id,
      title: id.split("/").pop(),
      html,
      toc,
      frontMatter: splitFrontMatter(text).frontMatter,
      oldRevision: entry,
      exists: !!page,
      currentBlob: page ? page.blob : "",
      breadcrumbs: breadcrumbs(basePath, id),
      sidebar: await sidebarFor(req, id, ids)
    });
  }

  router.get("/{*page}", canRead, wrap(async (req, res) => {
    const id = pageIdFromParams(req);
    const page = await store.readPage(id);
    assertPageAccess(req, page);
    if ("history" in req.query) return viewHistory(req, res, id, page);
    if ("diff" in req.query) return viewDiff(req, res, id);
    if ("rev" in req.query) return viewRevision(req, res, id, page);
    if ("edit" in req.query) {
      assertMayWrite(req);
      return renderEdit(req, res, id, page);
    }
    if (("move" in req.query || "delete" in req.query) && page) {
      assertMayWrite(req);
      return renderView(req, res, "move_delete", {
        pageId: id,
        title: page.title,
        mode: "move" in req.query ? "move" : "delete",
        blob: page.blob,
        breadcrumbs: breadcrumbs(basePath, id)
      });
    }
    const ids = await existingIds();
    if (!page) {
      return renderView(req, res, "missing", {
        pageId: id,
        title: id.split("/").pop(),
        breadcrumbs: breadcrumbs(basePath, id),
        sidebar: await sidebarFor(req, id, ids)
      }, 404);
    }
    const { html, toc } = render(page.body, id, ids);
    renderView(req, res, "page", {
      pageId: id,
      title: page.title,
      html,
      toc,
      frontMatter: page.frontMatter,
      frontMatterError: page.frontMatterError,
      saved: "saved" in req.query,
      exists: true,
      breadcrumbs: breadcrumbs(basePath, id),
      sidebar: await sidebarFor(req, id, ids)
    });
  }));

  function commitMessage(body) {
    return typeof body.message === "string" && body.message.trim() ? body.message.trim().substring(0, 200) : undefined;
  }

  async function savePage(req, res, id, current) {
    const body = req.body || {};
    if (typeof body.markdown !== "string") throw new WikiError("Missing page text", 400);
    const baseBlob = typeof body.baseBlob === "string" ? body.baseBlob : undefined;
    const message = commitMessage(body);
    let result;
    try {
      result = await store.savePage(id, body.markdown, { user: req.user.OSMUser, baseBlob, message });
    } catch (err) {
      if (!(err instanceof WikiError) || !err.conflict) throw err;
      // someone saved in between: show both texts, the next save is based
      // on the current version
      return renderEdit(req, res, id, current, {
        status: 409,
        conflict: true,
        markdown: body.markdown,
        message: message || "",
        currentMarkdown: err.currentMarkdown || "",
        baseBlob: err.currentBlob
      });
    }
    if (result.changed) {
      notify({ type: result.created ? "create" : "edit", id, user: req.user.OSMUser, rev: result.rev, message: message || "", url: pageUrl(id) });
    }
    res.redirect(pageUrl(id) + "?saved");
  }

  async function revertPage(req, res, id) {
    const body = req.body || {};
    const rev = revisionFrom(body.rev);
    const oldText = await store.pageAt(id, rev);
    assertTextAccess(req, oldText);
    const baseBlob = typeof body.baseBlob === "string" ? body.baseBlob : undefined;
    const result = await store.revert(id, rev, { user: req.user.OSMUser, baseBlob, message: commitMessage(body) });
    if (result.changed) {
      notify({ type: "revert", id, user: req.user.OSMUser, rev: result.rev, message: "to " + rev.substring(0, 8), url: pageUrl(id) });
    }
    res.redirect(pageUrl(id) + "?saved");
  }

  async function movePage(req, res, id, current) {
    const body = req.body || {};
    const toId = normalisePageId(body.to);
    if (!isValidPageId(toId)) throw new WikiError("Invalid wiki page name: " + toId, 400);
    if (toId === id) return res.redirect(pageUrl(id));
    if (typeof body.baseBlob === "string" && body.baseBlob !== current.blob) {
      throw new WikiError("Page " + id + " was changed in the meantime, please check it and try again", 409);
    }
    const result = await store.movePage(id, toId, { user: req.user.OSMUser, message: commitMessage(body) });
    notify({ type: "move", id: toId, fromId: id, user: req.user.OSMUser, rev: result.rev, message: commitMessage(body) || "", url: pageUrl(toId) });
    res.redirect(pageUrl(toId));
  }

  async function deletePage(req, res, id, current) {
    const body = req.body || {};
    if (typeof body.baseBlob === "string" && body.baseBlob !== current.blob) {
      throw new WikiError("Page " + id + " was changed in the meantime, please check it and try again", 409);
    }
    const result = await store.deletePage(id, { user: req.user.OSMUser, message: commitMessage(body) });
    notify({ type: "delete", id, user: req.user.OSMUser, rev: result.rev, message: commitMessage(body) || "", url: pageUrl(id) });
    res.redirect(basePath);
  }

  router.post("/{*page}", canWrite, prepareLayout, wrap(async (req, res) => {
    const id = pageIdFromParams(req);
    const current = await store.readPage(id);
    assertPageAccess(req, current);
    const action = (req.body && req.body.action) || "save";
    switch (action) {
      case "save": return savePage(req, res, id, current);
      case "revert": return revertPage(req, res, id);
      case "move":
      case "delete":
        if (!current) throw new WikiError("Page " + id + " does not exist", 404);
        return action === "move" ? movePage(req, res, id, current) : deletePage(req, res, id, current);
      default: throw new WikiError("Unknown action: " + action, 400);
    }
  }));

  return router;
}
