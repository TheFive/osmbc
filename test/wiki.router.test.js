import should from "should";

import { normalisePageId, normaliseMediaName, pageIdFromFolderAndName } from "../wiki/wikiRouter.js";

describe("wiki/wikiRouter helpers", function() {
  it("should normalise page names", function() {
    should(normalisePageId(" /Howto/My Page/ ")).eql("howto/my_page");
    should(normalisePageId("///")).eql("");
    should(pageIdFromFolderAndName("osmbc", "/Sub/New Page")).eql("osmbc/sub/new_page");
    should(normaliseMediaName("C:\\Shots\\__My Screenshot (1)__.PNG")).eql("my_screenshot_1.png");
    should(normaliseMediaName("no_extension")).be.null();
  });

  // a regex like /\/+$/ needs quadratic time on long runs of "/" that do
  // not end the text; user input must not block the server
  it("should handle long input in linear time", function() {
    const start = Date.now();
    should(normalisePageId("/".repeat(200000) + "x")).eql("x");
    should(pageIdFromFolderAndName("", "/".repeat(200000) + "x")).eql("x");
    should(normaliseMediaName("_".repeat(200000) + "x.png")).eql("x.png");
    should(Date.now() - start).be.below(500);
  });
});
