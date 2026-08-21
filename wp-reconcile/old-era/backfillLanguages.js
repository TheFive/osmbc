#!/usr/bin/env node
// Backfills non-German language content for old-era issues (WN001-271)
// that were rebuilt from wp_1_posts (German-only) but ALSO have real
// multi-language content sitting in wp_posts - a range that was, until
// now, invisible to every tool here (see parseShortcode.js's <!--:xx-->
// fix): 27 real issues, #219-257 (Sept 2014-June 2015), have genuine
// non-German translations (EN/TR confirmed for #221) that were never
// even compared against osmbc, let alone backported.
//
// Unlike the transitional era's positional matching (safe there because
// every language of the same osmbc issue was assembled by the same
// editorial team from the same link set), these old translations are
// real independent, often ABRIDGED editorial translations - real case
// WN221: German has 57 bullets across 15 categories, English has only 31
// bullets across 10 categories (5 categories - Konferenzen, Karten,
// Wochenaufgabe, Wochenvorschau, In eigener Sache - not translated at
// all that week). So this reuses the transitional era's link-based
// matching (matchByLinks.js) instead of position - matching by the set
// of external links a bullet/article contains, since that's independent
// of how much got translated or in what order.
//
// osmbc's own markdown<LANG> is rendered to HTML via a bare markdown-it
// instance (just for <a href> extraction - no need for the app's full
// emoji/user-linkify setup) so matchByLinks' HTML-based extractLinks
// works unchanged on both sides.
//
// After matchByLinks' direct per-language pass, two more passes resolve
// some of what's left, both reported for manual confirmation rather than
// written out like direct matches (weaker evidence than a direct link hit):
//   - Cross-language "bridge" pass (bridgeMatch.js): e.g. WN220's osmbc/DE
//     article links a secondary source, EN's translation kept that link and
//     matched directly, but ES only linked the two primary sources the
//     sentence names - zero overlap with DE, so ES alone would land in
//     unmatched-wp even though it's the same bullet. ES DOES share a link
//     with EN, though, so it bridges to EN's already-matched osmbc article.
//   - Anchor-relative positional pass (anchorPositionalMatch.js): e.g.
//     WN225's DE article links a mailing-list message reporting an outage,
//     EN's translation (written later) links a follow-up message in the
//     same thread reporting the fix - no link overlap at all, but both sit
//     immediately next to the same already-matched neighbour, which is
//     enough to infer the pairing without ever comparing bullet content.
//
// Dry-run by default; --commit to actually write (bridged matches are never
// auto-written, direct matches only). --issue/--from/--to to scope a partial
// run.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/backfillLanguages.js --issue 221
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/backfillLanguages.js --from 219 --to 257 --commit

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";
import MarkdownIt from "markdown-it";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import language from "../../model/language.js";
import messageCenter from "../../notification/messageCenter.js";
import { parseOldBlogSections } from "./parseOldBlogSections.js";
import { matchByLinks } from "../transitional-era/matchByLinks.js";
import { bridgeMatch } from "./bridgeMatch.js";
import { anchorPositionalMatch } from "./anchorPositionalMatch.js";
import { htmlToMarkdown } from "../backport/htmlToMarkdown.js";
import { htmlTableToMarkdown } from "../backport/htmlTableToMarkdown.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "backfillLanguages.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-oldimport" };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WP_POSTS_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts");
const WP1_POSTS_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_1_posts");
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output", "old-era-languages");
const MIN_REAL_BODY_LENGTH = 50; // shorter than this is a stub/placeholder translation, not real content (verified: WN221 es/ro/ja bodies are literally "</p>", 5 chars)

const md = new MarkdownIt();

program
  .option("--issue <n>", "single issue number, e.g. 221", (v) => parseInt(v, 10))
  .option("--from <n>", "start of issue number range", (v) => parseInt(v, 10), 219)
  .option("--to <n>", "end of issue number range", (v) => parseInt(v, 10), 267)
  .option("--commit", "actually write changes (default: dry-run)")
  .parse(process.argv);

const options = program.opts();

function convertWpHtml(html) {
  return /<tr[\s>]/i.test(html) ? htmlTableToMarkdown(html) : htmlToMarkdown(html);
}

function issueName(n) {
  return "WN" + String(n).padStart(3, "0");
}

function resolveIssueNumbers() {
  if (options.issue) return [options.issue];
  const numbers = [];
  for (let n = options.from; n <= options.to; n++) numbers.push(n);
  return numbers;
}

const pendingChanges = [];
const reviewRows = [["issue", "lang", "type", "articleId", "text"]];
let totalMatched = 0;

// Re-parses the DE wp_1_posts body (the exact source rebuildOldBlog.js used
// to create these osmbc articles in the first place) and maps each parsed
// bullet to the osmbc articleId it became, by converting it with the same
// htmlToMarkdown() rebuildOldBlog.js used and looking that string up
// against the articles' own markdownDE - not by id/sequence assumptions.
// Returns [{ headingText, articleIds }] (articleIds[i] parallels the
// section's bullets in original document order; null where no osmbc
// article matches, e.g. it was later moved to "Trash").
function buildDeSections(n, articles) {
  const file = path.join(WP1_POSTS_DIR, n + ".json");
  if (!fs.existsSync(file)) return [];
  const wp1 = JSON.parse(fs.readFileSync(file, "utf8"));
  const body = wp1.perLanguage.de && wp1.perLanguage.de.body;
  if (!body) return [];

  const markdownToId = new Map();
  for (const a of articles) {
    if (a.markdownDE) markdownToId.set(a.markdownDE, a.id);
  }

  const { sections } = parseOldBlogSections(body);
  return sections.map((s) => ({
    headingText: s.headingText,
    articleIds: s.articlesHtml.map((html) => {
      // rebuildOldBlog.js wrote markdownDE via plain htmlToMarkdown (never
      // the table-aware convertWpHtml dispatcher) - match that exactly, or
      // table-shaped DE bullets would never resolve to their articleId.
      const id = markdownToId.get(htmlToMarkdown(html));
      return id != null ? id : null;
    })
  }));
}

function processIssue(n, callback) {
  const file = path.join(WP_POSTS_DIR, n + ".json");
  if (!fs.existsSync(file)) return callback();
  const wp = JSON.parse(fs.readFileSync(file, "utf8"));
  const name = issueName(n);

  articleModule.find({ blog: name }, function (err, articles) {
    if (err) return callback(err);
    if (!articles || articles.length === 0) {
      console.info(`${name}: no osmbc articles found, skipping`);
      return callback();
    }

    const osmbcArticles = {};
    const articleById = new Map();
    for (const a of articles) {
      articleById.set(String(a.id), a);
      if (!a.markdownDE || a.markdownDE.trim() === "" || a.markdownDE === "no translation") continue;
      osmbcArticles[a.id] = md.render(a.markdownDE);
    }

    const deSections = buildDeSections(n, articles);

    // Direct per-language pass first, keeping every bullet (matched or not)
    // around in one flat list so the cross-language bridge pass below can
    // see all languages of this issue at once.
    const bridgeNodes = [];
    const perLangResults = [];
    const validatedArticleIds = new Set();
    let nodeSeq = 0;

    for (const [lang, data] of Object.entries(wp.perLanguage)) {
      if (lang === "de") continue;
      const body = data.body || "";
      const stripped = body.replace(/<[^>]+>/g, "").trim();
      if (stripped.length < MIN_REAL_BODY_LENGTH) continue; // stub translation, nothing real to backport

      const { sections, warnings } = parseOldBlogSections(body);
      const bullets = sections.flatMap((s) => s.articlesHtml);
      if (bullets.length === 0) {
        console.info(`${name} [${lang}]: real body (${stripped.length} chars) but no bullets parsed - warnings: ${warnings.join("; ")}`);
        continue;
      }

      const { matches, unmatchedOsmbc, unmatchedWp, ambiguous } = matchByLinks(osmbcArticles, bullets);
      totalMatched += matches.length;

      // Anchor-relative positional pass: some bullets left unmatched above
      // share no link with DE at all (or with any other language), but sit
      // in a single-item gap immediately next to an already-matched
      // neighbour on both sides - see anchorPositionalMatch.js.
      const anchored = anchorPositionalMatch({ deSections, targetSections: sections, directMatches: matches });
      const anchoredByHtml = new Map(anchored.map((a) => [a.wpHtml, a.articleId]));

      // Full-issue-completeness check (the project owner's proposed
      // validation): if applying every anchor-position match for this
      // language leaves NOTHING else unresolved, that's strong indirect
      // evidence those specific matches are correct - a wrong pairing would
      // very likely leave some inconsistency rather than a perfectly clean
      // 1:1 accounting of every bullet. Real case: WN229 ES/TR reach 0
      // unmatched-wp / 0 ambiguous once their one anchor match (article
      // 44783) is counted, validating that match well enough to write it
      // for real - including for EN/JA, where it doesn't itself complete
      // the language (a separate, unrelated bullet is still missing there).
      const complete = unmatchedWp.length === anchored.length && ambiguous.length === 0;
      if (complete) {
        for (const a of anchored) validatedArticleIds.add(a.articleId);

        // The other half of completeness: every real bullet in this
        // language is now accounted for, so whatever DE article is STILL
        // left with no counterpart cannot possibly have been translated -
        // not a guess, a direct consequence of the WP side being fully
        // exhausted. Mark it "no translation" (the established sentinel,
        // model/blog.js:532/784) instead of leaving it silently blank,
        // which would otherwise render as an empty-article warning/"No
        // Title" placeholder rather than being cleanly excluded.
        const langUpper = lang.toUpperCase();
        for (const o of unmatchedOsmbc) {
          const article = articleById.get(String(o.articleId));
          if (article && !article["markdown" + langUpper]) {
            pendingChanges.push({ issue: name, articleId: o.articleId, lang: langUpper, markdown: "no translation" });
            reviewRows.push([name, langUpper, "marked-no-translation", o.articleId, "(every real bullet in this language matched something else)"]);
          }
        }
      }

      console.info(`${name} [${lang}]: ${matches.length} matched, ${anchored.length} anchor-positioned${complete ? " (issue complete for this language)" : ""}, ${unmatchedWp.length - anchored.length} unmatched-wp, ${ambiguous.length} ambiguous (${bullets.length} real bullets, ${Object.keys(osmbcArticles).length} osmbc articles with DE content)`);

      for (const m of matches) {
        const langUpper = lang.toUpperCase();
        pendingChanges.push({ issue: name, articleId: m.articleId, lang: langUpper, markdown: convertWpHtml(m.wpHtml) });
        bridgeNodes.push({ id: nodeSeq++, lang, html: m.wpHtml, articleId: m.articleId });
      }

      const unmatchedNodes = unmatchedWp.map((html) => {
        const node = { id: nodeSeq++, lang, html, articleId: anchoredByHtml.get(html) || null };
        bridgeNodes.push(node);
        return node;
      });

      perLangResults.push({ lang, unmatchedNodes, ambiguous });
    }

    // Cross-language bridge pass: some bullets left unmatched above share no
    // link with the DE original but DO share one with another language's
    // translation of the same bullet that already matched directly - see
    // bridgeMatch.js. Nodes the anchor-position pass already resolved carry
    // their articleId in from the start, so they bridge (and report) as
    // "anchor-position", never fall through to plain "unmatched-wp".
    const bridged = bridgeMatch(bridgeNodes);
    const bridgeByNodeId = new Map(bridged.map((b) => [b.node.id, b]));

    for (const { lang, unmatchedNodes, ambiguous } of perLangResults) {
      for (const node of unmatchedNodes) {
        const plain = node.html.replace(/<[^>]+>/g, " ").trim();
        if (node.articleId != null) {
          const langUpper = lang.toUpperCase();
          if (validatedArticleIds.has(node.articleId)) {
            pendingChanges.push({ issue: name, articleId: node.articleId, lang: langUpper, markdown: convertWpHtml(node.html) });
            reviewRows.push([name, langUpper, "written-via-anchor-position", node.articleId, plain]);
          } else {
            reviewRows.push([name, langUpper, "matched-via-anchor-position", node.articleId, plain]);
          }
          continue;
        }
        const b = bridgeByNodeId.get(node.id);
        if (b) {
          const via = `bridged via ${b.viaLang.toUpperCase()}${b.sharedLink ? " (" + b.sharedLink + ")" : ""}`;
          reviewRows.push([name, lang.toUpperCase(), "matched-via-bridge", b.articleId, `[${via}] ${plain}`]);
        } else {
          reviewRows.push([name, lang.toUpperCase(), "unmatched-wp", "", plain]);
        }
      }
      for (const a of ambiguous) {
        reviewRows.push([name, lang.toUpperCase(), "ambiguous", a.articleId, a.html.replace(/<[^>]+>/g, " ").trim()]);
      }
    }
    callback();
  });
}

function withReopenedBlog(blogName, action, callback) {
  blogModule.findOne({ name: blogName }, function (err, blog) {
    if (err) return callback(err);
    if (!blog) return callback(new Error(`No blog found for ${blogName}`));

    const langlist = language.getLanguages();
    const original = { status: blog.status };
    const openData = { status: "edit" };
    for (const l in langlist) {
      original["close" + l] = blog["close" + l];
      original["exported" + l] = blog["exported" + l];
      openData["close" + l] = false;
      openData["exported" + l] = false;
    }

    blog.setAndSave(USER, openData, function (err) {
      if (err) return callback(err);
      action(function (actionErr) {
        blog.setAndSave(USER, original, function (restoreErr) {
          if (actionErr) return callback(actionErr);
          if (restoreErr) return callback(restoreErr);
          callback();
        });
      });
    });
  });
}

function applyChanges(callback) {
  const groups = new Map();
  for (const c of pendingChanges) {
    const key = `${c.issue}|${c.articleId}`;
    if (!groups.has(key)) groups.set(key, { issue: c.issue, articleId: c.articleId, fields: [] });
    groups.get(key).fields.push({ lang: c.lang, markdown: c.markdown });
  }

  const byBlog = new Map();
  for (const g of groups.values()) {
    if (!byBlog.has(g.issue)) byBlog.set(g.issue, []);
    byBlog.get(g.issue).push(g);
  }

  async.eachSeries([...byBlog.entries()], function ([issue, articleGroups], cb) {
    withReopenedBlog(issue, function (done) {
      async.eachSeries(articleGroups, function ({ articleId, fields }, cb2) {
        articleModule.findById(parseInt(articleId, 10), function (err, article) {
          if (err) return cb2(err);
          if (!article) return cb2(new Error(`No article found for id ${articleId}`));
          article._blog = null;
          const data = { version: article.version };
          for (const f of fields) data["markdown" + f.lang] = f.markdown;
          article.setAndSave(USER, data, function (err) {
            if (err) return cb2(err);
            console.info(`${issue} article ${articleId}: ${fields.map((f) => f.lang).join(", ")} updated.`);
            cb2();
          });
        });
      }, done);
    }, cb);
  }, callback);
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  async.eachSeries(resolveIssueNumbers(), processIssue, function (err) {
    if (err) { console.error(err); process.exit(1); }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "pendingChanges.json"), JSON.stringify(pendingChanges, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, "needs-review.csv"),
      "﻿" + reviewRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n")
    );

    console.info(`\n${totalMatched} field change(s) found across ${new Set(pendingChanges.map((c) => c.articleId)).size} article(s).`);
    console.info(`${reviewRows.length - 1} row(s) need manual review (needs-review.csv).`);

    if (!options.commit) {
      console.info("\nDRY RUN - pass --commit to actually write changes.");
      return process.exit(0);
    }

    applyChanges(function (err) {
      if (err) { console.error(err); process.exit(1); }
      console.info("\nDone.");
    });
  });
});
