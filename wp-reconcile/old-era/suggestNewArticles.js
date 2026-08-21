#!/usr/bin/env node
// Suggests new-article candidates for old-era WP bullets that genuinely
// never existed in German - the pattern found repeatedly while working
// through needs-review.csv by hand (WN221 commute-times, WN228 Kansas
// Linux Fest, WN231 overpass-turbo tip, WN232 masthead call-for-news,
// WN234 Lyon métropole, WN235 Belo Horizonte, WN238/239/240's several
// cases): a WP bullet shared across one or more non-German languages,
// with NO link overlap with any osmbc/DE article, and NO trace of that
// link anywhere in the raw German source either (ruling out a parser gap,
// not just "matchByLinks didn't find it" - the real lesson from initially
// misjudging WN221's case before checking the raw DE body directly).
//
// Output only - never writes to osmbc. Writing a suggested article is a
// separate, explicit step (this session did it by hand each time; see
// backfillLanguages.js's applyChanges for the audited write pattern to
// follow for an eventual automated writer).
//
// Category is a best-guess: the DE category already used by a
// directly-matched neighbour bullet in the same section if one can be
// established (mirrors anchorPositionalMatch.js's empirical section
// alignment), otherwise the cluster's own section heading text verbatim
// (real cases with no DE equivalent category at all: WN231 "Did you know
// ...?", WN238 "Have you come across ..."). Always a guess for a human to
// confirm, never auto-applied.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/suggestNewArticles.js --issue 240
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/suggestNewArticles.js --from 219 --to 267

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";
import MarkdownIt from "markdown-it";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import messageCenter from "../../notification/messageCenter.js";
import { parseOldBlogSections } from "./parseOldBlogSections.js";
import { matchByLinks, extractLinks } from "../transitional-era/matchByLinks.js";
import { htmlToMarkdown } from "../backport/htmlToMarkdown.js";
import { htmlTableToMarkdown } from "../backport/htmlTableToMarkdown.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "suggestNewArticles.js must run with NODE_ENV=wpreconcile."
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WP_POSTS_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts");
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output", "old-era-languages");
const MIN_REAL_BODY_LENGTH = 50;
// Genuinely corrupted source content (see project_wp_backport_data_corruption_incident) -
// a lower bar than the 8% ratio used to detect corruption on already-written
// osmbc content, since here false positives just mean a language is
// skipped from a suggestion, not that real content gets lost.
const CORRUPTION_QMARK_RATIO = 0.05;

const md = new MarkdownIt();

program
  .option("--issue <n>", "single issue number, e.g. 240", (v) => parseInt(v, 10))
  .option("--from <n>", "start of issue number range", (v) => parseInt(v, 10), 219)
  .option("--to <n>", "end of issue number range", (v) => parseInt(v, 10), 267)
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

function qMarkRatio(text) {
  if (!text) return 0;
  const q = (text.match(/\?/g) || []).length;
  return text.length ? q / text.length : 0;
}

class UnionFind {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  find(x) {
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function findSharedLink(a, b) {
  for (const url of a) if (b.has(url)) return url;
  return null;
}

const suggestions = [];

function processIssue(n, callback) {
  const file = path.join(WP_POSTS_DIR, n + ".json");
  if (!fs.existsSync(file)) return callback();
  const wp = JSON.parse(fs.readFileSync(file, "utf8"));
  const name = issueName(n);
  const deBody = (wp.perLanguage.de && wp.perLanguage.de.body) || "";

  articleModule.find({ blog: name }, function (err, articles) {
    if (err) return callback(err);
    if (!articles || articles.length === 0) return callback();

    const osmbcArticles = {};
    for (const a of articles) {
      if (!a.markdownDE || a.markdownDE.trim() === "" || a.markdownDE === "no translation") continue;
      osmbcArticles[a.id] = md.render(a.markdownDE);
    }

    // Build DE section heading order (for category guessing) and DE
    // articleId -> section index, the same way anchorPositionalMatch.js
    // does, by matching the freshly re-parsed wp_1_posts body against
    // osmbc's own markdownDE.
    const wp1File = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_1_posts", n + ".json");
    let deSections = [];
    if (fs.existsSync(wp1File)) {
      const wp1 = JSON.parse(fs.readFileSync(wp1File, "utf8"));
      const deSrc = wp1.perLanguage.de && wp1.perLanguage.de.body;
      if (deSrc) {
        const markdownToId = new Map();
        for (const a of articles) if (a.markdownDE) markdownToId.set(a.markdownDE, a.id);
        const { sections } = parseOldBlogSections(deSrc);
        deSections = sections.map((s) => ({
          headingText: s.headingText,
          articleIds: s.articlesHtml.map((html) => markdownToId.get(htmlToMarkdown(html)) ?? null)
        }));
      }
    }
    const deArticleIdToSection = new Map();
    deSections.forEach((s) => s.articleIds.forEach((id) => { if (id != null) deArticleIdToSection.set(id, s.headingText); }));

    const nodes = [];
    let seq = 0;

    for (const [lang, data] of Object.entries(wp.perLanguage)) {
      if (lang === "de") continue;
      const body = data.body || "";
      const stripped = body.replace(/<[^>]+>/g, "").trim();
      if (stripped.length < MIN_REAL_BODY_LENGTH) continue;
      if (qMarkRatio(body) > CORRUPTION_QMARK_RATIO) {
        console.info(`${name} [${lang}]: skipped, looks corrupted (source data issue, see project_wp_backport_data_corruption_incident)`);
        continue;
      }

      const { sections } = parseOldBlogSections(body);
      const bullets = sections.flatMap((s) => s.articlesHtml);
      if (bullets.length === 0) continue;

      const { matches, unmatchedWp } = matchByLinks(osmbcArticles, bullets);
      const matchedHtml = new Set(matches.map((m) => m.wpHtml));

      for (const s of sections) {
        for (const html of s.articlesHtml) {
          if (matchedHtml.has(html)) continue; // handled by backfillLanguages.js already
          nodes.push({ id: seq++, lang, html, headingText: s.headingText, links: extractLinks(html) });
        }
      }
    }

    // Cluster unmatched nodes across languages by shared link, same
    // technique as bridgeMatch.js - but here we want clusters with NO
    // path to any osmbc article at all, not ones that resolve to one.
    const uf = new UnionFind(nodes.map((n2) => n2.id));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].lang === nodes[j].lang) continue;
        if (findSharedLink(nodes[i].links, nodes[j].links)) uf.union(nodes[i].id, nodes[j].id);
      }
    }
    const clusters = new Map();
    for (const node of nodes) {
      const root = uf.find(node.id);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(node);
    }

    for (const cluster of clusters.values()) {
      const allLinks = new Set();
      for (const node of cluster) for (const link of node.links) allLinks.add(link);

      // Confirm absence from the RAW German source, not just osmbc's
      // already-parsed articles - a parser gap (real case: old <h4>/
      // styled-<p> heading formats) would otherwise look identical to a
      // genuinely-foreign-only bullet. Checked against link substrings,
      // since names/wording are translated but links are not.
      const rawLinkHit = [...allLinks].some((link) => {
        const path1 = link.split("/").slice(-1)[0];
        return path1.length > 4 && deBody.includes(path1);
      });
      if (rawLinkHit) {
        console.info(`${name}: cluster with link(s) [${[...allLinks].join(", ")}] found in raw DE source - skipping, needs a human look (possible parser gap, not a real "never in German" case)`);
        continue;
      }

      // Category guess: prefer a DE category already used by this issue,
      // found via anchorPositionalMatch-style empirical alignment - but
      // that needs a matched neighbour, which we don't have here (these
      // clusters have zero osmbc matches by construction). Fall back to
      // the cluster's own heading text, exactly as done by hand for
      // WN231/238's categories with no DE equivalent.
      const headingCounts = new Map();
      for (const node of cluster) headingCounts.set(node.headingText, (headingCounts.get(node.headingText) || 0) + 1);
      const category = [...headingCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

      suggestions.push({
        issue: name,
        category,
        collection: [...allLinks][0] || "",
        languages: cluster.map((node) => ({ lang: node.lang.toUpperCase(), markdown: convertWpHtml(node.html) }))
      });
    }
    callback();
  });
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  async.eachSeries(resolveIssueNumbers(), processIssue, function (err) {
    if (err) { console.error(err); process.exit(1); }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "suggestedNewArticles.json"), JSON.stringify(suggestions, null, 2));

    console.info(`\n${suggestions.length} new-article suggestion(s) written to suggestedNewArticles.json.`);
    for (const s of suggestions) {
      console.info(`${s.issue} [${s.category}] (${s.languages.map((l) => l.lang).join(", ")}): ${s.languages[0].markdown.slice(0, 80)}`);
    }
  });
});
