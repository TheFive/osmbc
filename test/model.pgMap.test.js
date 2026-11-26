

import config from "../config.js";
import should from "should";
import async from "async";

import pgMap from "../model/pgMap.js";
import db from "../model/db.js";
import blogModule from "../model/blog.js";
import articleModule from "../model/article.js";
import logModule from "../model/logModule.js";
import userModule from "../model/user.js";
import configModule from "../model/config.js";
import session from "../model/session.js";
import linkModule from "../model/link.js";


function TestTable(proto) {
  for (const k in proto) {
    this[k] = proto[k];
  }
}
TestTable.prototype.getTable = function getTable() { return "TestTable"; };
function create(proto) {
  const result = new TestTable(proto);

  return result;
}
const testModule = { table: "TestTable", create: create };


const testTableObject = {};
testTableObject.createString = "CREATE TABLE testtable (  id bigserial NOT NULL , data json,  \
                  CONSTRAINT testtable_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
testTableObject.indexDefinition = {};
testTableObject.viewDefinition = {};
testTableObject.table = "testtable";


describe("model/pgMap", function() {
  before(function(bddone) {
    config.initialise(bddone);
  });
  describe("createTable", function() {
    it("should return an error, if problems with Create String", function(bddone) {
      const pgObject = {};

      pgObject.createString = "CREATE TABLE test (  id bigserial NOT NULL  data json,  \
                  CONSTRAINT test_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
      pgObject.indexDefinition = {};
      pgObject.viewDefinition = {};
      pgObject.table = "test";

      pgMap.createTables(pgObject, { createTables: true, dropTables: true }, function(err, result) {
        should.not.exist(result);
        should.exist(err);
        should(err.code).eql("42601"); // pg Syntax Error Code
        bddone();
      });
    });
  });
  describe("analyseIndexes and updateIndex", function() {
    const indexTable = {
      createString: "CREATE TABLE indextest (id bigserial NOT NULL, data json, CONSTRAINT indextest_pkey PRIMARY KEY (id))",
      indexDefinition: {
        indextest_a_idx: "CREATE INDEX indextest_a_idx ON indextest USING btree (((data ->> 'a'::text)))",
        indextest_b_idx: "CREATE INDEX indextest_b_idx ON indextest USING btree (((data ->> 'b'::text)))"
      },
      viewDefinition: {},
      table: "indextest"
    };
    const analyse = () => new Promise((resolve, reject) => pgMap.analyseIndexes(indexTable, (err, r) => err ? reject(err) : resolve(r)));
    const run = (options, analysed) => new Promise((resolve, reject) => pgMap.createTables(indexTable, options, analysed, (err) => err ? reject(err) : resolve()));
    const query = (sql) => new Promise((resolve, reject) => db.query(sql, (err, r) => err ? reject(err) : resolve(r)));
    beforeEach(async function() {
      await run({ dropTable: "indextest", createTable: "indextest", createIndex: true }, { foundNOK: {}, expected: {} });
    });
    after(async function() {
      await run({ dropTable: "indextest" }, { foundNOK: {}, expected: {} });
    });
    it("should find all indexes OK right after creation (schema prefix public. ignored)", async function() {
      const result = await analyse();
      should(Object.keys(result.foundOK).sort()).eql(["indextest_a_idx", "indextest_b_idx"]);
      should(result.foundNOK).eql({});
      should(result.expected).eql({});
      should(result.foundUnnecessary).eql({});
    });
    it("should add a missing index and keep unknown ones", async function() {
      await query("drop index indextest_b_idx");
      await query("create index indextest_own_idx on indextest ((data->>'c'))");
      await query("drop index indextest_a_idx");
      await query("create index indextest_a_idx on indextest ((data->>'x'))");
      let result = await analyse();
      should(Object.keys(result.expected)).eql(["indextest_b_idx"]);
      should(Object.keys(result.foundNOK)).eql(["indextest_a_idx"]);
      should(Object.keys(result.foundUnnecessary)).eql(["indextest_own_idx"]);

      await run({ updateIndex: true }, result);
      result = await analyse();
      should(Object.keys(result.foundOK).sort()).eql(["indextest_a_idx", "indextest_b_idx"]);
      should(Object.keys(result.foundUnnecessary)).eql(["indextest_own_idx"]);
    });
    it("should report no missing primary key right after creation", async function() {
      const result = await analyse();
      should(result.missingPrimaryKey).eql({});
    });
    it("should add a missing primary key with updateIndex (production usert had none)", async function() {
      await query("insert into indextest (data) values ('{}'), ('{}')");
      await query("alter table indextest drop constraint indextest_pkey");
      let result = await analyse();
      should(Object.keys(result.missingPrimaryKey)).eql(["indextest_pkey"]);
      // the primary key index is no regular index, so nothing else changes
      should(result.expected).eql({});
      should(result.foundUnnecessary).eql({});

      await run({ updateIndex: true }, result);
      result = await analyse();
      should(result.missingPrimaryKey).eql({});
      const keys = await query("select c.conname from pg_constraint c join pg_class t on t.oid = c.conrelid where t.relname = 'indextest' and c.contype = 'p'");
      should(keys.rows.map(r => r.conname)).eql(["indextest_pkey"]);
    });
    it("should leave a missing primary key alone without updateIndex", async function() {
      await query("alter table indextest drop constraint indextest_pkey");
      const result = await analyse();
      await run({ verbose: true }, result);
      should(Object.keys((await analyse()).missingPrimaryKey)).eql(["indextest_pkey"]);
    });
    it("should create a missing table with its key and indexes with updateIndex (dump older than the table)", async function() {
      await run({ dropTable: "indextest" }, { foundNOK: {}, expected: {} });
      let result = await analyse();
      should(result.tableMissing).be.true();
      // the key comes with the create statement, not as separate step
      should(result.missingPrimaryKey).eql({});
      should(Object.keys(result.expected).sort()).eql(["indextest_a_idx", "indextest_b_idx"]);

      await run({ updateIndex: true }, result);
      result = await analyse();
      should(result.tableMissing).be.false();
      should(result.missingPrimaryKey).eql({});
      should(result.expected).eql({});
      should(Object.keys(result.foundOK).sort()).eql(["indextest_a_idx", "indextest_b_idx"]);
    });
  });
  describe("primaryKeyOf", function() {
    it("should read the primary key of every model table from its createString", function() {
      const tables = [blogModule, articleModule, logModule, userModule, configModule, session, linkModule].map(m => m.pg);
      const keys = Object.fromEntries(tables.map(pg => [pg.table, pgMap.primaryKeyOf(pg)?.name]));
      should(keys).eql({
        blog: "blog_pkey",
        article: "article_pkey",
        changes: "changes_pkey",
        usert: "user_pkey",
        config: "config_pkey",
        session: "session_pkey",
        link: "link_pkey"
      });
    });
    it("should build the statement that adds the key", function() {
      should(pgMap.primaryKeyOf(session.pg).sql).eql("ALTER TABLE \"session\" ADD CONSTRAINT \"session_pkey\" PRIMARY KEY (\"sid\")");
      should(pgMap.primaryKeyOf(userModule.pg).sql).eql("ALTER TABLE \"usert\" ADD CONSTRAINT \"user_pkey\" PRIMARY KEY (\"id\")");
    });
    it("should return null for a table without primary key", function() {
      should(pgMap.primaryKeyOf({ table: "x", createString: "CREATE TABLE x (data json)" })).be.null();
    });
  });
  describe("find functions", function() {
    describe("find", function() {
      beforeEach(function(bddone) {
        async.series([
          function(cb) { pgMap.createTables(testTableObject, { createTables: true, dropTables: true }, cb); },
          function(cb) {
            const to = new TestTable({ id: 0, name: "" });
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb) {
            const to = new TestTable({ id: 0, nameEN: "" });
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb) {
            const to = new TestTable({ id: 0, name: "Hallo", value: "3" });
            to.save = pgMap.save;
            to.save(cb);
          },
          function(cb) {
            const to = new TestTable({ id: 0, name: "Hallo", value: "4" });
            to.save = pgMap.save;
            to.save(cb);
          }
        ],
        bddone
        );
      });
      it("should create a valid SQL for empty string queries", function(bddone) {
        pgMap.find(testModule, { name: "" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result).eql([new TestTable({ id: "1", name: "", version: 1 }), new TestTable({ id: "2", nameEN: "", version: 1 })]);
          bddone();
        });
      });
      it("should find on element with !=", function(bddone) {
        pgMap.find(testModule, { name: "Hallo", value: "!=3" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(1);
          should(result[0].value).equal("4");
          bddone();
        });
      });
      it("should find on element with <", function(bddone) {
        pgMap.find(testModule, { name: "Hallo", value: "<4" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(1);
          should(result[0].value).equal("3");
          bddone();
        });
      });
      it("should find on element with >", function(bddone) {
        pgMap.find(testModule, { name: "Hallo", value: ">3" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(1);
          should(result[0].value).equal("4");
          bddone();
        });
      });
      it("should find on element with <=", function(bddone) {
        pgMap.find(testModule, { name: "Hallo", value: "<=4" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result).eql([
            new TestTable({ id: "3", name: "Hallo", value: "3", version: 1 }),
            new TestTable({ id: "4", name: "Hallo", value: "4", version: 1 })]);
          bddone();
        });
      });
      it("should find on element with >=", function(bddone) {
        pgMap.find(testModule, { name: "Hallo", value: ">=3" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result).eql([
            new TestTable({ id: "3", name: "Hallo", value: "3", version: 1 }),
            new TestTable({ id: "4", name: "Hallo", value: "4", version: 1 })]);
          bddone();
        });
      });
      it("should find on element with IN", function(bddone) {
        pgMap.find(testModule, { name: "Hallo", value: "IN(3,4)" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result[0].value).equal("3");
          should(result[1].value).equal("4");
          bddone();
        });
      });
      it('should find on element with != ""', function(bddone) {
        pgMap.find(testModule, { name: "!=" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result[0].name).equal("Hallo");
          should(result[1].name).equal("Hallo");
          bddone();
        });
      });
      it("should find all elements", function(bddone) {
        pgMap.find(testModule, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(4);
          bddone();
        });
      });
      it("should work with params", function(bddone) {
        pgMap.find(testModule, { sql: "where data->>'name'=$1 and data->>'value' = $2", params: ["Hallo", 4] }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(1);
          bddone();
        });
      });
      it("should use like", function(bddone) {
        pgMap.find(testModule, { name: "Ha%" }, function(err, result) {
          should.not.exist(err);
          should(result.length).equal(2);
          should(result[0].name).equal("Hallo");
          should(result[1].name).equal("Hallo");
          bddone();
        });
      });
    });
  });
  describe("remove", function() {
    it("should return an error, if id is 0", function(bddone) {
      const testObject = new TestTable({ id: 0 });
      testObject.remove = pgMap.remove;
      testObject.remove(function(err, result) {
        should.not.exist(result);
        should.exist(err);
        should(err.message).eql("ID is zero, transient object not deleted.");
        bddone();
      });
    });
  });
  describe("save", function() {
    it("should return an error, if problems with the database (id!=0)", function(bddone) {
      const testObject = new TestTable({ id: 1 });
      const connectString = config.pgstring;
      config.pgstring = "This wont work";
      testObject.save = pgMap.save;
      testObject.save(function(err, result) {
        should.not.exist(result);
        should.exist(err);
        config.pgstring = connectString;
        bddone();
      });
    });
  });
});
