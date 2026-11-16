import should from "should";

import testutil from "./testutil.js";
import { checkAnchor, findAnchors } from "../util/anchorCheck.js";

describe("util/anchorCheck", function() {
  before(function(done) {
    testutil.clearDB(done);
  });
  beforeEach(function(done) {
    testutil.importData({
      clear: true,
      blog: [{ name: "WN796", status: "edit" }, { name: "WN795", status: "closed" }],
      article: [
        { id: 1, blog: "WN796", title: "a", categoryEN: "Mapping" },
        { id: 2, blog: "WN796", title: "b", categoryEN: "--unpublished--" },
        { id: 3, blog: "WN795", title: "c", categoryEN: "Mapping" }
      ]
    }, done);
  });

  /* eslint-disable mocha/no-synchronous-tests */
  it("finds the anchors used as link targets in markdown", function() {
    should(findAnchors("![pic](x.png)\n\n[[1](#wn796_1)] caption [[2](#WN796_2)] and [[1](#wn796_1)]")).eql(["#wn796_1", "#WN796_2"]);
    should(findAnchors("no anchor, only #wn796_1 as text")).eql([]);
    should(findAnchors(undefined)).eql([]);
  });
  /* eslint-enable mocha/no-synchronous-tests */

  function check(anchor, expectedBlog) {
    return new Promise((resolve, reject) => checkAnchor(anchor, expectedBlog, (err, status) => err ? reject(err) : resolve(status)));
  }

  it("accepts an anchor to a published article of the issue", async function() {
    should(await check("#wn796_1", "WN796")).eql("OK");
    should(await check("#wn795_3", null)).eql("OK");
  });
  it("rejects an anchor to another issue than the blog being closed", async function() {
    should(await check("#wn795_3", "WN796")).eql("Anchor \"#wn795_3\" points to WN795, not WN796");
  });
  it("rejects anchors to missing, unpublished or misplaced articles", async function() {
    should(await check("#wn796_99", "WN796")).eql("Anchor \"#wn796_99\" refers to a non-existing article");
    should(await check("#wn796_2", "WN796")).eql("Anchor \"#wn796_2\" points to an unpublished article");
    should(await check("#wn796_3", "WN796")).eql("Anchor \"#wn796_3\" points to an article in WN795, not WN796");
  });
});
