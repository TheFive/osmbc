// Mocha root hooks: keep the last WebDriver commands of the running test and
// print them when the test fails. A command without "<<<" never got an answer
// from chromedriver - that is the step a bare mocha timeout hung in.

import logging from "selenium-webdriver/lib/logging.js";

const MAX_ENTRIES = 40;
let entries = [];
let start = performance.now();

function since() {
  return String(Math.round(performance.now() - start)).padStart(6) + "ms";
}

const executorLog = logging.getLogger(`${logging.Type.DRIVER}.http.Executor`);
executorLog.setLevel(logging.Level.FINER);
executorLog.addHandler(function(entry) {
  // message is "[webdriver.http.Executor] " + the logged text
  const msg = entry.message.replace(/^\[[^\]]*\] /, "");
  if (msg.startsWith(">>> ")) {
    entries.push(`${since()} ${msg}`);
  } else {
    // ">>>\n<request>\n<<<\n<response>": keep only the status line
    const response = msg.split("\n<<<\n")[1] || "";
    entries.push(`${since()} <<< ${response.split("\n")[0]}`);
  }
  if (entries.length > MAX_ENTRIES) entries.shift();
});

export const mochaHooks = {
  beforeEach() {
    entries = [];
    start = performance.now();
  },
  afterEach() {
    if (this.currentTest && this.currentTest.state === "failed" && entries.length > 0) {
      console.error(`\nLast WebDriver commands of "${this.currentTest.fullTitle()}" (incl. afterEach):\n  ` + entries.join("\n  "));
    }
  }
};
