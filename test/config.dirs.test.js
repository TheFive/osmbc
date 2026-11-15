import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import should from "should";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

import config from "../config.js";

// config.js reads its file once per process, so every case runs it in a
// child process with its own environment and prints the values asked for.
const appDir = config.getDirName();

function runConfig(env, expression) {
  const script = `import("./config.js").then(m => { const config = m.default; console.log(JSON.stringify(${expression})); });`;
  const childEnv = Object.assign({}, process.env, { NODE_ENV: "test" }, env);
  for (const k of Object.keys(childEnv)) if (childEnv[k] === undefined) delete childEnv[k];
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: appDir,
    env: childEnv,
    encoding: "utf8"
  });
  return {
    status: result.status,
    value: result.status === 0 ? JSON.parse(result.stdout.trim().split("\n").pop()) : undefined,
    stderr: result.stderr
  };
}

function writeTestConfig(dir, changes) {
  const data = yamlLoad(fs.readFileSync(path.join(appDir, "config.test.yaml"), "utf8"));
  Object.assign(data, changes);
  fs.writeFileSync(path.join(dir, "config.test.yaml"), yamlDump(data));
}

describe("config directories", function() {
  this.timeout(20000);
  let tmpDir;

  beforeEach(function() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "osmbc-configdir-"));
  });
  afterEach(function() {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should read the config from the app directory by default", function() {
    const r = runConfig({ OSMBC_CONFIG_DIR: undefined }, "[config.getConfigDir(), config.getValue('AppName')]");
    should(r.status).equal(0, r.stderr);
    should(r.value).eql([appDir, "TESTBC"]);
  });

  it("should read the config from OSMBC_CONFIG_DIR", function() {
    writeTestConfig(tmpDir, { AppName: "FROM_CONFIG_DIR" });
    const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir }, "[config.getConfigDir(), config.getValue('AppName')]");
    should(r.status).equal(0, r.stderr);
    should(r.value).eql([tmpDir, "FROM_CONFIG_DIR"]);
  });

  it("should stop if OSMBC_CONFIG_DIR has no config file", function() {
    const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir }, "config.getValue('AppName')");
    should(r.status).equal(1);
  });

  it("should keep cache and profiles in the app directory by default", function() {
    const r = runConfig({ OSMBC_CONFIG_DIR: undefined }, "[config.getCacheDir(), config.getProfileDir()]");
    should(r.status).equal(0, r.stderr);
    should(r.value).eql([path.join(appDir, "cache"), path.join(appDir, "public", "profile")]);
  });

  it("should use cache_directory and profile_directory, relative to the app directory", function() {
    const dataDir = path.join(tmpDir, "data");
    writeTestConfig(tmpDir, { cache_directory: path.join(dataDir, "cache"), profile_directory: "relative/profile" });
    const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir }, "[config.getCacheDir(), config.getProfileDir()]");
    should(r.status).equal(0, r.stderr);
    should(r.value).eql([path.join(dataDir, "cache"), path.join(appDir, "relative", "profile")]);
  });

  describe("wiki", function() {
    it("should be off without wiki.directory", function() {
      writeTestConfig(tmpDir, { wiki: undefined });
      const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir, OSMBC_TEST_TMPDIR: undefined }, "config.getWikiConfig()");
      should(r.status).equal(0, r.stderr);
      should(r.value).be.null();
    });

    it("should use the defaults for access and upload size", function() {
      const wikiDir = path.join(tmpDir, "wikidata");
      writeTestConfig(tmpDir, { wiki: { directory: wikiDir } });
      const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir, OSMBC_TEST_TMPDIR: undefined }, "config.getWikiConfig()");
      should(r.status).equal(0, r.stderr);
      should(r.value).eql({ directory: wikiDir, readAccess: ["full"], writeAccess: ["full"], autoPush: false, maxUploadBytes: 5242880, mattermost: null });
    });

    it("should move the wiki into the test run's temp directory", function() {
      writeTestConfig(tmpDir, { wiki: { directory: "/somewhere/else", readAccess: ["full", "guest"] } });
      const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir, OSMBC_TEST_TMPDIR: tmpDir }, "config.getWikiConfig()");
      should(r.status).equal(0, r.stderr);
      should(r.value.directory).eql(path.join(tmpDir, "wiki"));
      should(r.value.readAccess).eql(["full", "guest"]);
    });
    it("should accept OSM user names in the access lists", function() {
      writeTestConfig(tmpDir, { wiki: { directory: "/somewhere/else", readAccess: ["full", "SomeGuest"], writeAccess: ["TheFive"] } });
      const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir, OSMBC_TEST_TMPDIR: tmpDir }, "config.getWikiConfig()");
      should(r.status).equal(0, r.stderr);
      should(r.value.readAccess).eql(["full", "SomeGuest"]);
      should(r.value.writeAccess).eql(["TheFive"]);
    });

    for (const [name, wiki] of [
      ["a relative directory", { directory: "wikidata" }],
      ["a directory inside the app", { directory: path.join(appDir, "wikidata") }],
      ["the app directory itself", { directory: appDir }],
      ["the access level denied", { directory: "/srv/wiki", readAccess: ["denied"] }],
      ["an empty access entry", { directory: "/srv/wiki", readAccess: ["full", " "] }],
      ["access that is not a list", { directory: "/srv/wiki", writeAccess: "full" }]
    ]) {
      it("should stop for " + name, function() {
        writeTestConfig(tmpDir, { wiki });
        const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir, OSMBC_TEST_TMPDIR: undefined }, "config.getWikiConfig()");
        should(r.status).equal(1, r.stderr);
      });
    }
  });
});
