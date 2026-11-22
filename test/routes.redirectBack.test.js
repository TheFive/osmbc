import should from "should";

import config from "../config.js";
import { sameHostReferer, redirectBack } from "../routes/redirectBack.js";


function fakeRequest(referer, host = "osmbc.example.org") {
  const headers = { referer: referer, host: host };
  return {
    header: (name) => headers[name.toLowerCase()],
    get: (name) => headers[name.toLowerCase()]
  };
}

describe("routes/redirectBack", function() {
  describe("sameHostReferer", function() {
    it("should accept a page of this server", function() {
      should(sameHostReferer(fakeRequest("https://osmbc.example.org/blog/WN824?tab=review"))).eql("https://osmbc.example.org/blog/WN824?tab=review");
    });
    it("should accept http behind a TLS proxy (same host, other protocol)", function() {
      should(sameHostReferer(fakeRequest("http://osmbc.example.org/blog/WN824"))).eql("http://osmbc.example.org/blog/WN824");
    });
    it("should keep the port in the comparison", function() {
      should(sameHostReferer(fakeRequest("http://localhost:3000/osmbc", "localhost:3000"))).eql("http://localhost:3000/osmbc");
      should(sameHostReferer(fakeRequest("http://localhost:8080/other-app", "localhost:3000"))).be.undefined();
    });
    it("should reject a foreign server", function() {
      should(sameHostReferer(fakeRequest("https://evil.example.com/blog/WN824"))).be.undefined();
      should(sameHostReferer(fakeRequest("https://osmbc.example.org.evil.example.com/"))).be.undefined();
    });
    it("should reject relative and protocol-relative referers (browsers always send absolute ones)", function() {
      should(sameHostReferer(fakeRequest("/blog/WN824"))).be.undefined();
      should(sameHostReferer(fakeRequest("//evil.example.com/"))).be.undefined();
      should(sameHostReferer(fakeRequest("/\\evil.example.com/"))).be.undefined();
    });
    it("should reject other protocols", function() {
      should(sameHostReferer(fakeRequest("javascript://osmbc.example.org/%0aalert(1)"))).be.undefined();
    });
    it("should reject the OSM login callback, it would start the login again", function() {
      should(sameHostReferer(fakeRequest("https://osmbc.example.org/osmbc/auth/openstreetmap/callback?code=x"))).be.undefined();
    });
    it("should give undefined without or with a broken referer", function() {
      should(sameHostReferer(fakeRequest(undefined))).be.undefined();
      should(sameHostReferer(fakeRequest(""))).be.undefined();
      should(sameHostReferer(fakeRequest("not a url"))).be.undefined();
    });
  });

  describe("redirectBack", function() {
    function fakeResponse() {
      return { redirect(target) { this.target = target; } };
    }
    it("should redirect to the page the user came from", function() {
      const res = fakeResponse();
      redirectBack(fakeRequest("https://osmbc.example.org/article/12"), res);
      should(res.target).eql("https://osmbc.example.org/article/12");
    });
    it("should redirect to the start page without a usable referer", function() {
      const res = fakeResponse();
      redirectBack(fakeRequest("https://evil.example.com/"), res);
      should(res.target).eql(config.htmlRoot() + "/osmbc");
    });
    it("should redirect to the given fallback without a usable referer", function() {
      const res = fakeResponse();
      redirectBack(fakeRequest(undefined), res, "/osmbc/article/12");
      should(res.target).eql("/osmbc/article/12");
    });
  });
});
