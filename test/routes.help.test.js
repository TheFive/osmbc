"use strict";

const should  = require("should");
const initialise = require("../util/initialise.js")

var helpRoutes = require("../routes/help.js");



describe("routes/help", function() {
  before(async function() {
    await initialise.initialiseModules();
  })
  describe("generateHelpText", function() {
    /* eslint-disable mocha/no-synchronous-tests */
    it("should render the text with token", function() {
      var result = helpRoutes.getText("../test/data/helptext.test.md");
      should(result).equal('<h2>This Is a Help Test</h2>\n<p>Use a <a href="/testlink">link</a> to test tokens.</p>\n');
    });
    /* eslint-enable mocha/no-synchronous-tests */
  });
});



