"use strict";

var should  = require("should");

var helpRoutes = require("../routes/help.js");



describe("routes/help", function() {
  describe("generateHelpText", function() {
    /* eslint-disable mocha/no-synchronous-tests */
    it("should render the text with token", function() {
      var result = helpRoutes.getText("../test/data/helptext.test.md");
      should(result).equal('<h2>This Is a Help Test</h2>\n<p>Use a <a href="/testlink">link</a> to test tokens.</p>\n');
    });
    /* eslint-enable mocha/no-synchronous-tests */
  });
});



