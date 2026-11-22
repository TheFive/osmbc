import should from "should";
import nock from "nock";
import axios from "axios";
import http from "http";

import { fetchExternalPage } from "../util/externalPage.js";


describe("util/externalPage", function() {
  afterEach(function() {
    nock.cleanAll();
  });

  it("should decode a page from its charset", async function() {
    // "Grüße" in ISO-8859-1
    nock("https://page.example.org").get("/latin1").reply(200, Buffer.from([0x47, 0x72, 0xfc, 0xdf, 0x65]), { "Content-Type": "text/html; charset=ISO-8859-1" });
    should(await fetchExternalPage("https://page.example.org/latin1")).eql("Grüße");
  });

  it("should refuse a local address", async function() {
    // a real local server counts whether the request reaches it; under
    // nock the refused request does not fail at once but runs into the
    // timeout, so only "rejected and never arrived" is checked
    let hits = 0;
    const server = http.createServer((req, res) => { hits++; res.end("internal"); });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const url = "http://127.0.0.1:" + server.address().port + "/";
      await should(fetchExternalPage(url, { timeout: 500 })).be.rejected();
      should(hits).eql(0);
    } finally {
      server.close();
    }
  });

  it("should give the timeout as ECONNABORTED", async function() {
    nock("https://slow.example.org").get("/").delay(200).reply(200, "late");
    const err = await fetchExternalPage("https://slow.example.org/", { timeout: 50 }).catch((e) => e);
    should(err.code).eql("ECONNABORTED");
  });

  it("should not decode other requests while a page is loading", async function() {
    // the decoder used to sit on the global axios instance and threw on
    // the parsed JSON of any request answered in the meantime
    nock("https://slow.example.org").get("/").delay(100).reply(200, "<html><body>page</body></html>");
    nock("https://api.example.org").get("/data").reply(200, { translations: [{ text: "Hallo" }] });
    const page = fetchExternalPage("https://slow.example.org/");
    const json = await axios.get("https://api.example.org/data");
    should(json.data).eql({ translations: [{ text: "Hallo" }] });
    should(await page).eql("<html><body>page</body></html>");
  });
});
