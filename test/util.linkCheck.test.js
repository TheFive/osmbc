import should from "should";
import nock from "nock";
import sinon from "sinon";
import axios from "axios";

import linkCheck from "../util/linkCheck.js";

function check(url) {
  return new Promise((resolve) => linkCheck.checkLink(url, (err, result) => resolve(result)));
}

describe("util/linkCheck", function() {
  beforeEach(function() {
    nock.cleanAll();
  });
  afterEach(function() {
    nock.cleanAll();
  });

  it("should report an existing page as ok", async function() {
    nock("https://site.example").head("/page").reply(200);
    should(await check("https://site.example/page")).eql({ state: "ok", status: "OK" });
  });

  it("should report 404 and 410 as broken", async function() {
    nock("https://site.example").head("/gone").reply(404).head("/away").reply(410);
    should(await check("https://site.example/gone")).eql({ state: "broken", status: 404 });
    should(await check("https://site.example/away")).eql({ state: "broken", status: 410 });
  });

  it("should report bot protection (DataDome 401, Cloudflare 403) and 451 as blocked", async function() {
    nock("https://www.reuters.example").head("/news").reply(401, "", { "x-datadome": "protected" });
    nock("https://cf.example").head("/news").reply(403, "", { "cf-mitigated": "challenge" });
    nock("https://geo.example").head("/news").reply(451);
    should(await check("https://www.reuters.example/news")).eql({ state: "blocked", status: 401 });
    should(await check("https://cf.example/news")).eql({ state: "blocked", status: 403 });
    should(await check("https://geo.example/news")).eql({ state: "blocked", status: 451 });
  });

  it("should report a certificate error as blocked", async function() {
    const stub = sinon.stub(axios, "head").rejects({ code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", message: "unable to verify the first certificate" });
    try {
      should(await check("https://cert.example/page")).eql({ state: "blocked", status: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" });
    } finally {
      stub.restore();
    }
  });

  it("should try a dropped connection a second time", async function() {
    const stub = sinon.stub(axios, "head");
    stub.onFirstCall().rejects({ code: "ECONNRESET", message: "socket hang up" });
    stub.onSecondCall().rejects({ code: "ECONNRESET", message: "socket hang up" });
    try {
      should(await check("https://reset.example/page")).eql({ state: "unreachable", status: "ECONNRESET" });
      should(stub.calledTwice).be.true();
    } finally {
      stub.restore();
    }
  });

  it("should try GET when HEAD is not allowed", async function() {
    const scope = nock("https://nohead.example").head("/page").reply(405).get("/page").reply(200, "body");
    should(await check("https://nohead.example/page")).eql({ state: "ok", status: "OK" });
    should(scope.isDone()).be.true();
  });

  it("should report a 404 to the GET after a 405 as broken", async function() {
    nock("https://nohead.example").head("/page").reply(405).get("/page").reply(404);
    should(await check("https://nohead.example/page")).eql({ state: "broken", status: 404 });
  });

  it("should try a temporary error a second time", async function() {
    const scope = nock("https://flaky.example").head("/page").reply(503).head("/page").reply(200);
    should(await check("https://flaky.example/page")).eql({ state: "ok", status: "OK" });
    should(scope.isDone()).be.true();
  });

  it("should report a lasting server error as unreachable", async function() {
    nock("https://down.example").head("/page").twice().reply(502);
    should(await check("https://down.example/page")).eql({ state: "unreachable", status: 502 });
  });

  it("should not repeat a request after 429", async function() {
    const scope = nock("https://busy.example").head("/page").reply(429).head("/page").reply(200);
    should(await check("https://busy.example/page")).eql({ state: "unreachable", status: 429 });
    should(scope.isDone()).be.false();
  });

  it("should report a broken url as broken", async function() {
    should(await check("https://")).eql({ state: "broken", status: "Invalid URI \"https://\"" });
  });

  it("should keep the short answer of checkUrl", function(bddone) {
    nock("https://www.reuters.example").head("/news").reply(401);
    linkCheck.checkUrl("https://www.reuters.example/news", function(err, status) {
      should(err).be.null();
      should(status).eql(401);
      bddone();
    });
  });
});
