// Cache of the blogs every page shows in the menu bar (routes/layout.js):
// the TBC blog, the open blogs and the blogs in edit, each with the part of
// its derived data that is the same for every user (Blog.calculateStatus).
// Without it every request loaded all their articles and authors.
//
// The cache is dropped after every write to article, blog or changes in
// this process (model/tableWrites.js) and after MAX_AGE_MS at the latest,
// for writes from outside (a second instance on the same database, import
// scripts). Blogs and articles in the cache are shared between requests:
// never change or save them; take per-user data from Blog.mentionsFor.
// Automated translation counts are added only on request
// (calculateAutoTranslate), as they need the authors from changes.

import { each } from "async";
import { getTBC, find } from "./blog.js";
import { onTableWrite } from "./tableWrites.js";
import _debug from "debug";

const debug = _debug("OSMBC:model:navbarBlogs");

const MAX_AGE_MS = 60 * 1000;
const WATCHED_TABLES = new Set(["article", "blog", "changes"]);

let generation = 0;
let entry = null; // { generation, loadedAt, promise }

onTableWrite(function(table) {
  if (WATCHED_TABLES.has(table)) invalidate();
});

function findBlogs(status) {
  return new Promise((resolve, reject) => find({ status: status }, (err, list) => err ? reject(err) : resolve(list)));
}

async function load() {
  debug("load");
  const [open, edit] = await Promise.all([findBlogs("open"), findBlogs("edit")]);
  const tbc = getTBC();
  await new Promise((resolve, reject) => {
    each([tbc, ...open, ...edit], (blog, cb) => blog.calculateStatus(cb), err => err ? reject(err) : resolve());
  });
  return { tbc, open, edit };
}

/**
 * The menu bar blogs with their status data: `{ tbc, open, edit }` (open
 * and edit as found by blog.find, i.e. ordered by id). Requests arriving
 * while the data is loaded share that load. The objects are shared: read
 * only.
 * @param {Function} callback (err, { tbc, open, edit })
 */
export function getNavbarBlogs(callback) {
  const now = Date.now();
  if (!entry || entry.generation !== generation || now - entry.loadedAt > MAX_AGE_MS) {
    const current = { generation: generation, loadedAt: now, promise: load() };
    entry = current;
    // a failed load is not kept, the next request tries again
    current.promise.catch(() => { if (entry === current) entry = null; });
  }
  // callback outside the promise chain: an exception in it must not turn
  // into an unhandled rejection or a second callback call
  entry.promise.then(
    result => process.nextTick(callback, null, result),
    err => process.nextTick(callback, err)
  );
}

/**
 * Add the automated translation counts (Blog.getAutoTranslate) to menu bar
 * blogs, for pages that show them (start page status table). Each blog
 * reads its authors once; later calls on the same cached blog are free.
 * @param {Array} blogs blogs from getNavbarBlogs
 * @param {Function} callback (err)
 */
export function calculateAutoTranslate(blogs, callback) {
  each(blogs, (blog, cb) => blog.calculateAutoTranslate(cb), callback);
}

/**
 * Drop the cached blogs; the next getNavbarBlogs loads them again. Called
 * automatically after writes to article, blog and changes.
 */
export function invalidate() {
  generation += 1;
}

export default { getNavbarBlogs, calculateAutoTranslate, invalidate };
