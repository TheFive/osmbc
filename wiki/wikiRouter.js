// Express router for the wiki.
//
// Like the store it does not import OSMBC: everything it needs from the
// host application is passed in (see createWikiRouter). Views live in
// views/wiki/ and get the host's layout variables.

import express from "express";
import { WikiError, isValidPageId, pageAllowsAccess, splitFrontMatter } from "./wikiStore.js";
import wikiMarkdownPlugin from "./wikiMarkdown.js";

const SIDEBAR_ID = "sidebar";
const START_ID = "start";

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
 *    ({ type, id, user, rev, message, url })
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

  function assertPageAccess(req, page) {
    if (page && !pageAllowsAccess(page.frontMatter, req.user.access)) {
      throw new WikiError("OSM User >" + req.user.OSMUser + "< has not enough access rights for this page", 403);
    }
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
      maxUploadBytes: wikiConfig.maxUploadBytes
    }, extra), extra && extra.status);
  }

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // ---- index and helpers ----------------------------------------------------

  router.get("/", canRead, wrap(async (req, res) => {
    const pages = (await store.listPages()).filter(p => pageAllowsAccess(p.frontMatter, req.user.access));
    renderView(req, res, "index", {
      groups: groupByNamespace(pages),
      pageCount: pages.length,
      breadcrumbs: breadcrumbs(basePath, null)
    });
  }));

  // "new page" form on the index: /wiki/_new?id=ns/page
  router.get("/_new", canWrite, (req, res, next) => {
    const id = String(req.query.id || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "").replace(/\s+/g, "_");
    if (!isValidPageId(id)) return next(new WikiError("Invalid wiki page name: " + id + " (allowed: a-z, 0-9, _ and -, namespaces separated by /)", 400));
    res.redirect(pageUrl(id) + "?edit");
  });

  router.post("/_preview", canWrite, wrap(async (req, res) => {
    const id = req.body && isValidPageId(req.body.id) ? req.body.id : null;
    const ids = await existingIds();
    const { body } = splitFrontMatter(String((req.body && req.body.markdown) || ""));
    res.json({ html: render(body, id, ids).html });
  }));

  // ---- pages ------------------------------------------------------------------

  router.get("/{*page}", canRead, wrap(async (req, res) => {
    const id = pageIdFromParams(req);
    const page = await store.readPage(id);
    assertPageAccess(req, page);
    if ("edit" in req.query) {
      if (!userMayWrite(req)) throw new WikiError("OSM User >" + req.user.OSMUser + "< has not enough access rights to edit", 403);
      return renderEdit(req, res, id, page);
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
      breadcrumbs: breadcrumbs(basePath, id),
      sidebar: await sidebarFor(req, id, ids)
    });
  }));

  router.post("/{*page}", canWrite, prepareLayout, wrap(async (req, res) => {
    const id = pageIdFromParams(req);
    const body = req.body || {};
    if (typeof body.markdown !== "string") throw new WikiError("Missing page text", 400);
    const baseBlob = typeof body.baseBlob === "string" ? body.baseBlob : undefined;
    const message = typeof body.message === "string" && body.message.trim() ? body.message.trim().substring(0, 200) : undefined;
    const current = await store.readPage(id);
    assertPageAccess(req, current);
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
      onChange({
        type: result.created ? "create" : "edit",
        id,
        user: req.user.OSMUser,
        rev: result.rev,
        message: message || "",
        url: pageUrl(id)
      });
    }
    res.redirect(pageUrl(id) + "?saved");
  }));

  return router;
}
