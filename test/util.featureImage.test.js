import should from "should";
import nock from "nock";

import featureImage from "../util/featureImage.js";
import linkCheck from "../util/linkCheck.js";


describe("util/featureImage", function() {
  beforeEach(function() {
    linkCheck.cacheFlushAll();
  });
  afterEach(function() {
    nock.cleanAll();
  });

  describe("splitFeatureImage", function() {
    const split = featureImage.splitFeatureImage;
    it("should split image and caption, ignoring the image size", function() {
      should(split("![lead picture](/wp-content/uploads/a.jpg =800x500) Caption [1](#wn123_45)")).eql({
        link: "/wp-content/uploads/a.jpg",
        text: "Caption [1](#wn123_45)"
      });
    });
    it("should fall back to the first bare url", function() {
      should(split("https://example.com/a.jpg Caption")).eql({
        link: "https://example.com/a.jpg",
        text: "Caption"
      });
    });
    it("should return no link without an image", function() {
      should(split("Just a caption")).eql({ link: null, text: "Just a caption" });
      should(split(null)).eql({ link: null, text: null });
    });
  });

  describe("checkFeatureImage", function() {
    const check = featureImage.checkFeatureImage;
    it("should accept empty markdown and no translation", function(bddone) {
      check("", function(err, result) {
        should.not.exist(err);
        should(result).eql("OK");
        check("no translation", function(err, result) {
          should.not.exist(err);
          should(result).eql("OK");
          bddone();
        });
      });
    });
    it("should accept an existing relative image", function(bddone) {
      const sitecall = nock("https://featureimage.site")
        .head("/wp-content/uploads/a.jpg")
        .reply(200, "OK");
      check("![lead](/wp-content/uploads/a.jpg =800x500) Caption", function(err, result) {
        should.not.exist(err);
        should(result).eql("OK");
        should(sitecall.isDone()).be.true();
        bddone();
      });
    });
    it("should reject a missing relative image", function(bddone) {
      const sitecall = nock("https://featureimage.site")
        .head("/wp-content/uploads/missing.jpg")
        .reply(404, "Not Found");
      check("![lead](/wp-content/uploads/missing.jpg) Caption", function(err, result) {
        should.not.exist(err);
        should(result).eql("Feature image https://featureimage.site/wp-content/uploads/missing.jpg does not exist (404)");
        should(sitecall.isDone()).be.true();
        bddone();
      });
    });
    it("should reject an absolute image url without checking it", function(bddone) {
      check("![lead](https://example.com/a.jpg) Caption", function(err, result) {
        should.not.exist(err);
        should(result).eql("Feature image \"https://example.com/a.jpg\" must be a relative path starting with /");
        bddone();
      });
    });
    it("should reject a protocol relative image url", function(bddone) {
      check("![lead](//example.com/a.jpg) Caption", function(err, result) {
        should.not.exist(err);
        should(result).eql("Feature image \"//example.com/a.jpg\" must be a relative path starting with /");
        bddone();
      });
    });
    it("should reject a picture article without image", function(bddone) {
      check("Just a caption", function(err, result) {
        should.not.exist(err);
        should(result).eql("Picture article needs a feature image ![...](/...)");
        bddone();
      });
    });
  });
});
