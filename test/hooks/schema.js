// Mocha root hook: create the database tables once before the first test.
// Every test run gets a new, empty database (scripts/run-tests.mjs), and
// some test files read from it before their own clearDB. With this hook any
// single test file or subset runs on its own, not only after the files that
// happened to create the tables first.
import testutil from "../testutil.js";

export const mochaHooks = {
  async beforeAll() {
    this.timeout(20000);
    await testutil.clearDB();
  }
};
