import should from "should";
import config from "../config.js";
import testutil from "./testutil.js";
import initialiseModules from "../util/initialise.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();

// The OSM display name of the logged-in user is looked up on every
// request; characters like < > ! = : are allowed in OSM names and must
// not turn into SQL operators (#1188).
describe("routes/auth user lookup", function() {
  before(async function () {
    await testutil.clearDB();
    await initialiseModules();
    testutil.startServerSync();
  });
  after(function () {
    testutil.stopServer();
  });
  beforeEach(async function () {
    await testutil.importData({ user: [{ OSMUser: "Admin", access: "full" }], clear: true });
  });
  it("should not log in an OSM user named <B as another user", async function () {
    const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
    await client.post(baseLink + "/login", { username: "<B", password: "lessB" });
    const body = await client.get(baseLink + "/usert/list", { validateStatus: () => true });
    should(body.data).not.containEql("Admin");
    should(body.status).not.eql(200);
  });
});
