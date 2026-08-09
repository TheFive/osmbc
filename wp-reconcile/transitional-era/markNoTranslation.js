#!/usr/bin/env node
// Marks a single article's markdown<LANG> as "no translation" - the
// established osmbc sentinel (model/blog.js:532/784) that excludes the
// article from that language's export entirely and suppresses the
// "contains empty Articles" warning, instead of leaving it truly empty
// (which renders as a visible "No Title" placeholder).
//
// Real case: WN276 article 46780 (the EN/JP-only "Releases" stub created
// earlier via createArticleFromWp.js) has no DE equivalent in the real
// original post at all - so DE should be marked "no translation", not
// filled with invented content. The same pattern is expected to recur for
// WN277's equivalent stub (article 46781) and similar EN/JP-only bullets.
//
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/markNoTranslation.js --id 46780 --lang DE --commit

import { strict as assert } from "assert";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import language from "../../model/language.js";
import messageCenter from "../../notification/messageCenter.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "markNoTranslation.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-backport" };

program
  .requiredOption("--id <n>", "article id", (v) => parseInt(v, 10))
  .requiredOption("--lang <LANG>", "osmbc language code, e.g. DE")
  .option("--commit", "actually write the change (default: dry-run)")
  .parse(process.argv);

const options = program.opts();
const field = "markdown" + options.lang.toUpperCase();

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  articleModule.findById(options.id, function (err, article) {
    if (err) { console.error(err); process.exit(1); }
    if (!article) { console.error(`No article found for id ${options.id}`); process.exit(1); }

    console.info(`Article ${options.id} [${article.blog}]: current ${field} = ${JSON.stringify(article[field])}`);
    if (!options.commit) {
      console.info(`DRY RUN - would set ${field} = "no translation". Pass --commit to actually write.`);
      return process.exit(0);
    }

    blogModule.findOne({ name: article.blog }, function (err, blog) {
      if (err) { console.error(err); process.exit(1); }
      if (!blog) { console.error(`No blog found for ${article.blog}`); process.exit(1); }

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
        if (err) { console.error(err); process.exit(1); }
        article._blog = null;
        article.setAndSave(USER, { [field]: "no translation", version: article.version }, function (articleErr) {
          blog.setAndSave(USER, original, function (restoreErr) {
            if (articleErr) { console.error(articleErr); process.exit(1); }
            if (restoreErr) { console.error(restoreErr); process.exit(1); }
            console.info(`Article ${options.id}: ${field} set to "no translation".`);
          });
        });
      });
    });
  });
});
