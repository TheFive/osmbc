import should from "should";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadKnownRemoteIds, recordCreated } from "../wp-reconcile/blog-sync-merger/syncState.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "..", "wp-reconcile", "blog-sync-merger", ".sync-state.json");

describe("wp-reconcile/blog-sync-merger/syncState", function() {
  let originalContent;

  before(function() {
    // Preserve whatever real state (if any) a human might have accumulated
    // running the actual tool - this file is gitignored, local-only state,
    // never something to clobber just by running the test suite.
    try {
      originalContent = fs.readFileSync(STATE_FILE, "utf8");
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      originalContent = null;
    }
  });

  beforeEach(function() {
    try {
      fs.unlinkSync(STATE_FILE);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  });

  after(function() {
    if (originalContent === null) {
      try {
        fs.unlinkSync(STATE_FILE);
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    } else {
      fs.writeFileSync(STATE_FILE, originalContent, "utf8");
    }
  });

  it("should return an empty map when no state file exists yet", function() {
    const map = loadKnownRemoteIds("WN300");
    should(map).be.instanceof(Map);
    should(map.size).eql(0);
  });

  it("should round-trip a recorded creation", function() {
    recordCreated("WN300", [{ localId: 47680, id: 36886 }]);
    const map = loadKnownRemoteIds("WN300");
    should(map.get("47680")).eql("36886");
  });

  it("should merge additional creations into existing state for the same blog", function() {
    recordCreated("WN300", [{ localId: 1, id: 100 }]);
    recordCreated("WN300", [{ localId: 2, id: 200 }]);
    const map = loadKnownRemoteIds("WN300");
    should(map.get("1")).eql("100");
    should(map.get("2")).eql("200");
  });

  it("should keep different blogs' state separate", function() {
    recordCreated("WN300", [{ localId: 1, id: 100 }]);
    recordCreated("WN301", [{ localId: 1, id: 999 }]);
    should(loadKnownRemoteIds("WN300").get("1")).eql("100");
    should(loadKnownRemoteIds("WN301").get("1")).eql("999");
  });

  it("should be a no-op for an empty/missing created list, never creating a file", function() {
    recordCreated("WN300", []);
    recordCreated("WN300", undefined);
    should(fs.existsSync(STATE_FILE)).be.False();
  });

  it("should return an empty map for a blog with no recorded entries, even once the file exists", function() {
    recordCreated("WN300", [{ localId: 1, id: 100 }]);
    const map = loadKnownRemoteIds("WN_NEVER_TOUCHED");
    should(map.size).eql(0);
  });
});
