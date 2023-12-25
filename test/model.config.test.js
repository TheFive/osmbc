

import async from "async";
import should from "should";

import testutil from "./testutil.js";

import configModule from "../model/config.js";
import logModule from "../model/logModule.js";
import messageCenter from "../notification/messageCenter.js";






describe("model/config", function() {
  before(function (bddone) {
    messageCenter.initialise();
    async.series([
      testutil.clearDB,
      configModule.initialise
    ], bddone);
  });
  it("should read initialised values", function (bddone) {
    const c = configModule.getConfig("calendarflags");
    should.exist(c);
    should(c.brasil).eql("http://blog.openstreetmap.de/wp-uploads/2016/03/br.svg");
    bddone();
  });
  it("should have stored initialised value", async function () {
    const result = await testutil.findJSON("config", { name: "calendarflags" });
    should.exist(result);
    should(result.type).eql("yaml");
  });



  describe("setAndSave", function() {
    beforeEach(async function() {
      await testutil.clearDB();
    });
    it("should set only the one Value in the database", async function () {
      let result = await configModule.getConfigObject("calendarflags");
      should.exist(result);
      const changeConfig = result;
      const id = changeConfig.id;
      changeConfig.yaml = "not logged";
      await changeConfig.setAndSave({ OSMUser: "user" }, { version: 1, yaml: "not logged" });

      result = await testutil.findJSON("config", { name: "calendarflags" });

      should(result).eql({ id: id, yaml: "not logged", version: 2, name: "calendarflags", type: "yaml" });
      result = await logModule.find({}, { column: "property" });

      should.exist(result);
      should(result.length).equal(0);
    });
  });
  const yamlData = `
  pictures: 
    title: "#BlogName# Pictures"
    collection: sample Collection
    markdownDE: sample
    notUsedKey: valueOfNotUsedKey
  pictures2: 
    title: "#BlogName# Pictures2"
  `;
  it("should only set allowed values for newArticles", async function() {
    const newArticlesConfig = await configModule.getConfigObject("newArticles");
    should.exist(newArticlesConfig);
    const id = newArticlesConfig.id;
    await newArticlesConfig.setAndSave({ OSMUser: "user" }, { version: 1, yaml: yamlData });
    const result = await configModule.getConfigObject("newArticles");
    // call json to create in memory.
    result.getJSON();
    should(result).eql({
      id: id,
      yaml: "\n  pictures: \n    title: \"#BlogName# Pictures\"\n    collection: sample Collection\n    markdownDE: sample\n    notUsedKey: valueOfNotUsedKey\n  pictures2: \n    title: \"#BlogName# Pictures2\"\n  ",
      version: 2,
      name: "newArticles",
      type: "yaml",
      json: {
        pictures: {
          collection: "sample Collection",
          title: "#BlogName# Pictures"
        },
        pictures2: {
          title: "#BlogName# Pictures2"
        }
      }
    });
  });
});

