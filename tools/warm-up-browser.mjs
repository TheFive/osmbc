// Start Chrome for the UI tests once, before the test run.
//
// On a fresh CI runner the first Chrome start is slow (new profile, font
// cache, binaries not yet in the page cache). The first UI test of the run
// paid for it in its "before each" hook and sometimes ran into the 30 s
// mocha timeout (test/blog/uc.blog.mobile.test.js, 2026-11). Two starts
// are timed, so the CI log shows the cold and the warm start time.
//
// Usage: NODE_ENV=test TEST_HEADLESS=TRUE node tools/warm-up-browser.mjs

import { startBrowser } from "../test/browser.js";

for (const run of ["cold", "warm"]) {
  const startedAt = performance.now();
  const driver = await startBrowser({ device: "phone" });
  await driver.get("about:blank");
  await driver.quit();
  console.log(`Chrome start (${run}): ${Math.round(performance.now() - startedAt)} ms`);
}
