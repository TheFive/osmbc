import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import should from "should";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

import config from "../config.js";
import { mergeConfigs, splitConfig } from "../util/configSplit.js";

const appDir = config.getDirName();

function runNode(args, env) {
  const childEnv = Object.assign({}, process.env, { NODE_ENV: "test", TEST_LOG: "TRUE" }, env);
  for (const k of Object.keys(childEnv)) if (childEnv[k] === undefined) delete childEnv[k];
  return spawnSync(process.execPath, args, { cwd: appDir, env: childEnv, encoding: "utf8" });
}

// loads config.js in a child process (it reads its files once per process)
function runConfig(env, expression) {
  const script = `import("./config.js").then(m => { const config = m.default; console.log("RESULT" + JSON.stringify(${expression})); });`;
  const result = runNode(["--input-type=module", "-e", script], env);
  const line = result.stdout.split("\n").find(l => l.startsWith("RESULT"));
  return {
    status: result.status,
    value: line ? JSON.parse(line.substring(6)) : undefined,
    output: result.stdout + result.stderr
  };
}

function testConfig() {
  return yamlLoad(fs.readFileSync(path.join(appDir, "config.test.yaml"), "utf8"));
}

describe("config split", function() {
  describe("mergeConfigs", function() {
    it("should merge objects key by key", function() {
      const r = mergeConfigs(
        { a: 1, FirstDraftConfig: { apiKey: "secret" } },
        { b: [1, 2], FirstDraftConfig: { visibleFor: ["X"] } }
      );
      should(r.conflicts).eql([]);
      should(r.config).eql({ a: 1, b: [1, 2], FirstDraftConfig: { apiKey: "secret", visibleFor: ["X"] } });
    });
    it("should report values set in both files", function() {
      const r = mergeConfigs(
        { a: 1, list: [1], Transition: { enabled: true } },
        { a: 2, list: [2], Transition: { enabled: false, AutoEditMode: { enabled: true } } }
      );
      should(r.conflicts).eql(["a", "list", "Transition.enabled"]);
    });
    it("should not change its arguments", function() {
      const technical = { Transition: { enabled: true } };
      mergeConfigs(technical, { Transition: { AutoTranslate: {} } });
      should(technical).eql({ Transition: { enabled: true } });
    });
  });

  describe("splitConfig", function() {
    it("should split known, mixed and unknown keys", function() {
      const r = splitConfig({
        serverport: 3000,
        languages: [{ lid: "DE" }],
        FirstDraftConfig: { apiKey: "secret", visibleFor: ["full"] },
        Transition: { enabled: true, scheduleCron: "* * * * *", AutoTranslate: { enabled: true } },
        somethingNew: 1
      });
      should(r.technical).eql({
        serverport: 3000,
        FirstDraftConfig: { apiKey: "secret" },
        Transition: { enabled: true, scheduleCron: "* * * * *" },
        somethingNew: 1
      });
      should(r.editorial).eql({
        languages: [{ lid: "DE" }],
        FirstDraftConfig: { visibleFor: ["full"] },
        Transition: { AutoTranslate: { enabled: true } }
      });
      should(r.unknown).eql(["somethingNew"]);
    });
    it("should merge config.test.yaml back to the original", function() {
      const full = testConfig();
      const { technical, editorial } = splitConfig(full);
      const merged = mergeConfigs(technical, editorial);
      should(merged.conflicts).eql([]);
      should(merged.config).eql(full);
    });
  });

  describe("loading two files", function() {
    this.timeout(20000);
    let tmpDir;

    beforeEach(function() {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "osmbc-configsplit-"));
    });
    afterEach(function() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeSplit(changeEditorial) {
      const { technical, editorial } = splitConfig(testConfig());
      technical.editorial_config = "editorial.yaml";
      if (changeEditorial) changeEditorial(editorial);
      fs.writeFileSync(path.join(tmpDir, "config.test.yaml"), yamlDump(technical));
      fs.writeFileSync(path.join(tmpDir, "editorial.yaml"), yamlDump(editorial));
    }

    it("should read values from both files", function() {
      writeSplit(e => { e["Blog Title For Export"] = "from editorial"; });
      const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir },
        "[config.getValue('AppName'), config.getValue('Blog Title For Export'), config.getValue('FirstDraftConfig')]");
      should(r.status).equal(0, r.output);
      should(r.value[0]).equal("TESTBC");
      should(r.value[1]).equal("from editorial");
      should(r.value[2]).eql(testConfig().FirstDraftConfig);
      should(r.output).containEql("Reading editorial Config from: " + path.join(tmpDir, "editorial.yaml"));
    });

    it("should stop when a value is set in both files", function() {
      writeSplit(e => { e.AppName = "twice"; e.Transition = { enabled: true }; });
      const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir }, "config.getValue('AppName')");
      should(r.status).equal(1);
      should(r.output).containEql("Values set in both config files, remove them from one: AppName, Transition.enabled");
    });

    it("should stop when the editorial file is missing", function() {
      writeSplit();
      fs.rmSync(path.join(tmpDir, "editorial.yaml"));
      const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir }, "config.getValue('AppName')");
      should(r.status).equal(1);
      should(r.output).containEql("Could not read editorial config (editorial_config)");
    });

    it("should split a config file with tools/split-config.mjs", function() {
      const technicalOut = path.join(tmpDir, "config.test.yaml");
      const editorialOut = path.join(tmpDir, "config.editorial.yaml");
      const split = runNode(["tools/split-config.mjs", path.join(appDir, "config.test.yaml"), technicalOut, editorialOut]);
      should(split.status).equal(0, split.stdout + split.stderr);
      should(yamlLoad(fs.readFileSync(technicalOut, "utf8")).editorial_config).equal("config.editorial.yaml");
      should(yamlLoad(fs.readFileSync(editorialOut, "utf8"))).have.property("languages");
      should(fs.statSync(technicalOut).mode & 0o777).equal(0o600);

      const r = runConfig({ OSMBC_CONFIG_DIR: tmpDir }, "[config.getValue('languages'), config.getValue('postgres')]");
      should(r.status).equal(0, r.output);
      should(r.value[0]).eql(testConfig().languages);

      const again = runNode(["tools/split-config.mjs", path.join(appDir, "config.test.yaml"), technicalOut, editorialOut]);
      should(again.status).equal(1);
      should(again.stderr).containEql("not overwritten");
    });
  });
});
