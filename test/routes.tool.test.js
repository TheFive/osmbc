import should from "should";
import sinon from "sinon";
import nock from "nock";
import config from "../config.js";

import testutil from "./testutil.js";
import initialiseModules from "../util/initialise.js";
import globApi from "../util/globApi.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();

describe("routes/tool", function() {
  let client;

  before(async function() {
    await initialiseModules();
    await testutil.clearDB();
    testutil.startServerSync();
  });

  after(function(bddone) {
    nock.cleanAll();
    sinon.restore();
    testutil.stopServer();
    bddone();
  });

  beforeEach(function(bddone) {
    config.initialise();
    sinon.restore();
    client = testutil.getWrappedAxiosClient();
    testutil.importData(
      {
        user: [{ OSMUser: "TestUser", access: "full", version: "1" }],
        clear: true
      }, bddone);
  });

  it("should render script log list with mocked glob", async function() {
    sinon.stub(globApi, "match").resolves(["/tmp/script_logs/b.log", "/tmp/script_logs/a.log"]);

    await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
    const body = await client.get(baseLink + "/tool/scripts/log");

    should(body.status).eql(200);
    body.data.should.containEql("a.log");
    body.data.should.containEql("b.log");
  });
});
