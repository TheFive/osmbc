


import { ESLint } from "eslint";
import should from "should";

function createESLintInstance() {
  return new ESLint({ useEslintrc: true });
}
const eslint = createESLintInstance();

async function lintModule(module) {
  const report = await eslint.lintFiles([module]);
  for (const result of report) {
    if (result.messages) {
      for (const error of result.messages) {
        console.error(result.filePath + " " + error.line + ": " + error.message);
      }
    }
    should(result.errorCount).eql(0);
    should(result.warningCount).eql(0);
  }
}


describe("ESLint", function() {
  it("should lint model", async function() {
    await lintModule("model");
  });
  it("should lint routes", async function() {
    await lintModule("routes");
  });
  it("should lint notification", async function() {
    await lintModule("notification");
  });
  it("should lint render", async function() {
    await lintModule("render");
  });
  it("should lint util", async function() {
    await lintModule("util");
  });
  it("should lint public/javascripts", async function() {
    await lintModule("public/javascripts");
  });
});
