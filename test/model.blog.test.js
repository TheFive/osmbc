"use strict";

const async  = require("async");
const should = require("should");
const nock   = require("nock");

const testutil = require("./testutil.js");

const logModule     = require("../model/logModule.js");
const blogModule    = require("../model/blog.js");
const articleModule = require("../model/article.js");


describe("model/blog", function() {
  before(function (bddone) {
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");

    process.env.TZ = "Europe/Amsterdam";
    testutil.clearDB(bddone);
  });
  after(function (bddone) {
    nock.cleanAll();
    bddone();
  });

  describe("createNewBlog", function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    it("should createNewArticle with prototype", function(bddone) {
      blogModule.createNewBlog({ OSMUser: "test" }, { name: "test", status: "open" }, function (err, result) {
        should.not.exist(err);
        const id = result.id;
        testutil.getJsonWithId("blog", id, function(err, result) {
          should.not.exist(err);
          should(result.name).equal("test");
          should(result.status).equal("open");
          const start = new Date();
          const end = new Date();
          start.setDate(start.getDate() + 1);
          end.setDate(end.getDate() + 7);


          should(new Date(result.startDate).toLocaleDateString()).equal(start.toLocaleDateString());
          should(new Date(result.endDate).toLocaleDateString()).equal(end.toLocaleDateString());
          bddone();
        });
      });
    });
    it("should createNewArticle without prototype", function(bddone) {
      blogModule.createNewBlog({ OSMUser: "test" }, function (err, result) {
        should.not.exist(err);
        const id = result.id;
        testutil.getJsonWithId("blog", id, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          should(result.name).equal("WN251");
          bddone();
        });
      });
    });
    it("should createNewArticle with existing WN", function(bddone) {
      blogModule.createNewBlog({ OSMUser: "test" },
        { name: "WN100", endDate: new Date("1.1.2000") },
        function(err, result) {
          should.not.exist(err);
          should.exist(result);
          result.save(function(err) {
            should.not.exist(err);
            blogModule.createNewBlog({ OSMUser: "test" }, function (err, result) {
              should.not.exist(err);
              const id = result.id;
              testutil.getJsonWithId("blog", id, function(err, result) {
                should.not.exist(err);
                should.exist(result);
                should(result.name).equal("WN101");
                should(new Date(result.startDate).toLocaleDateString()).eql(new Date("2000-01-02").toLocaleDateString());
                should(new Date(result.endDate).toLocaleDateString()).eql(new Date("2000-01-08").toLocaleDateString());
                bddone();
              });
            });
          });
        });
    });
    it("should create no New Article with ID", function(bddone) {
      blogModule.createNewBlog({ OSMUser: "test" }, { id: 2, name: "test", status: "**" }, function (err) {
        should.exist(err);
        should(err.message).eql("Should not exist proto id");
        bddone();
      });
    });
  });
  describe("isEditable", function() {
    /* eslint-disable mocha/no-synchronous-tests */
    it("should be editable if no review or closed state", function() {
      const newBlog = blogModule.create({ id: 2, name: "test", status: "**" });
      should(newBlog.isEditable("DE")).be.True();
    });
    it("should be editable if review state (exported Set)", function() {
      const newBlog = blogModule.create({ id: 2, name: "test", status: "**", reviewCommentDE: ["comment"], exportedDE: true });
      should(newBlog.isEditable("DE")).be.False();
    });
    it("should be editable if no review and closed state", function() {
      const newBlog = blogModule.create({ id: 2, name: "test", status: "**", reviewCommentEN: ["comment"], closeEN: true });
      should(newBlog.isEditable("EN")).be.False();
    });
    it("should be editable if reopened", function() {
      const newBlog = blogModule.create({ id: 2, name: "test", status: "**", reviewCommentDE: ["comment"], closeDE: false });
      should(newBlog.isEditable("DE")).be.True();
    });
    /* eslint-enable mocha/no-synchronous-tests */
    it("should handle an review by error with reopening (with review in WP)", function(cb) {
      // Please ensure, that "DE" is in ReviewInWP in config
      let newBlog = blogModule.create({ name: "test", status: "**" });
      async.series([
        function (cb1) { newBlog.save(cb1); },
        function (cb1) {
          blogModule.findOne({ name: "test" }, function(err, result) { newBlog = result; cb1(err); });
        },
        function (cb1) {
          should(newBlog.isEditable("DE")).be.True();
          newBlog.setReviewComment("DE", { OSMUser: "Test" }, "startreview", cb1);
        },
        function (cb1) {
          blogModule.find({ name: "test" }, function(err, result) {
            should(result.length).eql(1);
            newBlog = result[0];
            cb1(err);
          });
        },
        function (cb2) {
          should(newBlog.isEditable("DE")).be.True();
          newBlog.closeBlog({ lang: "DE", user: { OSMUser: "Test" }, status: true }, cb2);
        },
        function (cb1) {
          should(newBlog.isEditable("DE")).be.False();
          blogModule.findOne({ name: "test" }, function(err, result) { newBlog = result; cb1(err); });
        },
        function (cb3) { newBlog.closeBlog({ lang: "DE", user: { OSMUser: "Test" }, status: false }, cb3); },
        function (cb1) {
          blogModule.findOne({ name: "test" }, function(err, result) { newBlog = result; cb1(err); });
        }
      ], function final(err) {
        should.not.exist(err);
        should(newBlog.isEditable("DE")).be.True();
        should.not.exist(newBlog.reviewCommentDE);
        cb();
      }
      );
    });
    it("should handle reopen Blog with existing reviews with reopening (without review in WP)", function(cb) {
      // Please ensure, that "EN" is not in ReviewInWP in config
      let newBlog = blogModule.create({ name: "test", status: "**" });
      async.series([
        function (cb1) { newBlog.save(cb1); },
        function (cb1) { blogModule.findOne({ name: "test" }, function(err, result) { newBlog = result; cb1(err); }); },
        function (cb1) {
          should(newBlog.isEditable("EN")).be.True();
          newBlog.setReviewComment("EN", { OSMUser: "Test" }, "startreview", cb1);
        },
        function (cb1) {
          newBlog.setReviewComment("EN", { OSMUser: "Test" }, "I have done a review", cb1);
        },
        function (cb1) { blogModule.findOne({ name: "test" }, function(err, result) { newBlog = result; cb1(err); }); },
        function (cb2) {
          should(newBlog.isEditable("EN")).be.True();
          newBlog.setReviewComment("EN", { OSMUser: "Test" }, "markexported", cb2);
        },
        function (cb1) {
          should(newBlog.isEditable("EN")).be.False();
          blogModule.findOne({ name: "test" }, function(err, result) { newBlog = result; cb1(err); });
        },
        function (cb1) {
          should(newBlog.isEditable("EN")).be.False();
          blogModule.findOne({ name: "test" }, function(err, result) { newBlog = result; cb1(err); });
        },
        function (cb3) { newBlog.closeBlog({ lang: "EN", user: { OSMUser: "Test" }, status: false }, cb3); },
        function (cb1) {
          blogModule.findOne({ name: "test" }, function(err, result) { newBlog = result; cb1(err); });
        }
      ], function final(err) {
        should.not.exist(err);
        should(newBlog.isEditable("EN")).be.True();
        should.exist(newBlog.reviewCommentEN);
        cb();
      }
      );
    });
  });
  describe("setAndSave", function() {
    before(function (bddone) {
      testutil.clearDB(bddone);
    });
    it("should set only the one Value in the database", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "test" }, { name: "Title", status: "TEST" }, function(err, newBlog) {
        should.not.exist(err);
        should.exist(newBlog);
        const id = newBlog.id;
        newBlog.name = "New Title";
        newBlog.setAndSave({ OSMUser: "user" }, { status: "published", field: "test" }, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("blog", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            delete result.categories;
            delete result.startDate;
            delete result.endDate;
            should(result).eql({ id: id, name: "New Title", status: "published", field: "test", version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(6);
              delete result[1].id;
              delete result[5].id;
              const t0 = result[2].timestamp;
              const t1 = result[5].timestamp;
              const now = new Date();
              const t0diff = ((new Date(t0)).getTime() - now.getTime());
              const t1diff = ((new Date(t1)).getTime() - now.getTime());

              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(t1diff).be.below(10);
              delete result[1].timestamp;
              delete result[5].timestamp;

              should(result).containEql(logModule.create({ oid: id, blog: "New Title", user: "user", table: "blog", property: "status", from: "TEST", to: "published" }));
              should(result).containEql(logModule.create({ oid: id, blog: "New Title", user: "user", table: "blog", property: "field", to: "test" }));
              bddone();
            });
          });
        });
      });
    });
  });
  describe("closeBlog", function() {
    before(function (bddone) {
      testutil.clearDB(bddone);
      process.env.TZ = "Europe/Amsterdam";
    });

    it("should close the Blog and write a log Message", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "test" }, { name: "Title", status: "TEST" }, function(err, newBlog) {
        should.not.exist(err);
        should.exist(newBlog);
        const id = newBlog.id;
        newBlog.closeBlog({ lang: "DE", user: { OSMUser: "user" }, status: true }, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("blog", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            delete result.categories;
            delete result.startDate;
            delete result.endDate;
            should(result).eql({ id: id, name: "Title", status: "TEST", closeDE: true, version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(5);
              for (let i = 0; i < 5; i++) {
                delete result[i].id;
                const t0 = result[i].timestamp;
                const now = new Date();
                const t0diff = ((new Date(t0)).getTime() - now.getTime());

                // The Value for comparison should be small, but not to small
                // for the test machine.
                should(t0diff).be.below(10);
                delete result[i].timestamp;
              }
              should(result).containEql(logModule.create({ oid: id, blog: "Title", user: "user", table: "blog", property: "closeDE", to: true }));
              bddone();
            });
          });
        });
      });
    });
  });
  describe("reviewComment", function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
      process.env.TZ = "Europe/Amsterdam";
    });
    it("should review the Blog and write a log Message", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "test" }, { name: "Title", status: "TEST" }, function(err, newBlog) {
        should.not.exist(err);
        should.exist(newBlog);
        const id = newBlog.id;
        newBlog.setReviewComment("DE", { OSMUser: "user" }, "it is approved.", function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("blog", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            delete result.categories;
            delete result.startDate;
            delete result.endDate;
            const now = new Date();
            const t0 = result.reviewCommentDE[0].timestamp;
            const t0diff = ((new Date(t0)).getTime() - now.getTime());
            should(t0diff).be.below(10);

            should(result.reviewCommentDE[0].text).equal("it is approved.");
            should(result.reviewCommentDE[0].user).equal("user");
            delete result.reviewCommentDE;
            should(result).eql({ id: id, name: "Title", status: "TEST", version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(5);
              for (let i = 0; i < result.length; i++) {
                delete result[i].id;
                delete result[i].timestamp;
              }

              should(result).containEql(logModule.create({ oid: id, blog: "Title", user: "user", table: "blog", property: "reviewCommentDE", to: "it is approved.", from: "Add" }));
              bddone();
            });
          });
        });
      });
    });
    it("should edit a review", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "test" }, { name: "Title", status: "TEST" }, function(err, newBlog) {
        should.not.exist(err);
        should.exist(newBlog);
        const id = newBlog.id;
        newBlog.setReviewComment("DE", { OSMUser: "user" }, "it is approved.", function(err) {
          should.not.exist(err);

          blogModule.findById(id, function(err, blog) {
            should.not.exist(err);
            blog.editReviewComment("DE", { OSMUser: "user" }, 0, "is nearly approved.", function(err) {
              should.not.exist(err);
              testutil.getJsonWithId("blog", id, function(err, result) {
                should.not.exist(err);
                delete result._meta;
                delete result.categories;
                delete result.startDate;
                delete result.endDate;
                const now = new Date();
                const t0 = result.reviewCommentDE[0].timestamp;
                const t0diff = ((new Date(t0)).getTime() - now.getTime());
                should(t0diff).be.below(10);

                should(result.reviewCommentDE[0].text).equal("is nearly approved.");
                should(result.reviewCommentDE[0].user).equal("user");
                delete result.reviewCommentDE;
                should(result).eql({ id: id, name: "Title", status: "TEST", version: 3 });
                logModule.find({}, { column: "property" }, function (err, result) {
                  should.not.exist(err);
                  should.exist(result);
                  should(result.length).equal(6);
                  for (let i = 0; i < result.length; i++) {
                    delete result[i].id;
                    delete result[i].timestamp;
                  }
                  should(result).containEql(logModule.create({ oid: id, blog: "Title", user: "user", table: "blog", property: "reviewCommentDE", to: "it is approved.", from: "Add" }));
                  should(result).containEql(logModule.create({ oid: id, blog: "Title", user: "user", table: "blog", property: "reviewCommentDE", to: "is nearly approved.", from: "Add" }));
                  bddone();
                });
              });
            });
          });
        });
      });
    });
    it("should reset a review process", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "test" }, { name: "Title", status: "EDIT" }, function(err, newBlog) {
        should.not.exist(err);
        should.exist(newBlog);
        const id = newBlog.id;
        newBlog.setReviewComment("DE", { OSMUser: "user" }, "it is approved.", function(err) {
          should.not.exist(err);

          blogModule.findById(id, function(err, blog) {
            should.not.exist(err);
            should(blog.getStatus("DE")).eql("Review DE");
            blog.setReviewComment("DE", { OSMUser: "user2" }, "deleteallreviews", function(err) {
              should.not.exist(err);
              blogModule.findById(id, function(err, blog) {
                should.not.exist(err);
                should(blog.getStatus("DE")).eql("EDIT");
                bddone();
              });
            });
          });
        });
      });
    });
  });
  describe("findFunctions", function() {
    let idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) { blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "open", startDate: "2015-01-01", endDate: "2016-01-01" }, cb); },
        function c2(cb) { blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN2", status: "open", startDate: "2015-01-01", endDate: "2016-01-01" }, cb); },
        function c3(cb) {
          blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" },
            function(err, result) {
              should.not.exist(err);
              idToFindLater = result.id;
              cb(err);
            });
        }

      ], function(err) {
        should.not.exist(err);
        bddone();
      });
    });
    describe("find", function() {
      it("should find multiple objects with sort", function(bddone) {
        blogModule.find({ status: "open" }, { column: "name" }, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].categories;
          delete result[0].id;
          delete result[0].startDate;
          delete result[0].endDate;
          delete result[1]._meta;
          delete result[1].categories;
          delete result[1].id;
          delete result[1].startDate;
          delete result[1].endDate;
          should(result[0]).eql({ name: "WN1", status: "open", version: 1 });
          should(result[1]).eql({ name: "WN2", status: "open", version: 1 });
          bddone();
        });
      });
    });
    describe("findOne", function() {
      it("should findOne object with sort", function(bddone) {
        blogModule.findOne({ status: "open" }, { column: "name" }, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.categories;
          delete result.id;
          should(result.name).eql("WN1");
          should(result.status).eql("open");
          should(result.version).eql(1);
          should(new Date(result.startDate).toLocaleDateString()).equal(new Date("2015-01-01").toLocaleDateString());
          should(new Date(result.endDate).toLocaleDateString()).equal(new Date("2016-01-01").toLocaleDateString());

          bddone();
        });
      });
    });
    describe("findById", function() {
      it("should find saved Object", function(bddone) {
        blogModule.findById(idToFindLater, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.categories;
          delete result.id;
          should(result).eql({ name: "WN3", status: "finished", version: 1, startDate: "2015-01-01", endDate: "2016-01-01" });
          bddone();
        });
      });
    });
  });


  describe("autoCloseBlog", function() {
    it("should do nothing if nothing to do", function(bddone) {
      const time = (new Date()).toISOString();
      const dataBefore = {
        blog: [
          { name: "WN1", status: "edit", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "edit", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" }]
      };
      const dataAfter = {
        blog: [
          { name: "WN1", status: "edit", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "edit", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN4", status: "open", startDate: (new Date("2016-01-02")).toISOString(), endDate: (new Date("2016-01-08")).toISOString() }]
      };
      const testFunction = function testFunction(cb) {
        blogModule.autoCloseBlog(cb);
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should close a blog and create a new", function(bddone) {
      const time = (new Date()).toISOString();
      const dataBefore = {
        blog: [
          { name: "WN1", status: "open", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "edit", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" }]
      };
      const dataAfter = {
        blog: [
          { name: "WN1", status: "edit", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "edit", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN4", status: "open", startDate: (new Date("2016-01-02")).toISOString(), endDate: (new Date("2016-01-08")).toISOString() }]
      };
      const testFunction = function testFunction(cb) {
        blogModule.autoCloseBlog(cb);
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should close 2 blog and not create new if there is one open and should not be started twice", function(bddone) {
      const time = (new Date()).toISOString();
      const dataBefore = {
        blog: [
          { name: "WN0", status: "open", startDate: "2015-01-01", endDate: time },
          { name: "WN1", status: "open", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "open", startDate: "2015-01-01", endDate: "2099-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" }]
      };
      const dataAfter = {
        blog: [
          { name: "WN0", status: "edit", startDate: "2015-01-01", endDate: time },
          { name: "WN1", status: "edit", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "open", startDate: "2015-01-01", endDate: "2099-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" }]
      };
      const testFunction = function testFunction(cb) {
        async.parallel([
          blogModule.autoCloseBlog,
          blogModule.autoCloseBlog
        ], function (err) {
          should.not.exist(err);
          cb();
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should not close a blog if it is not time", function(bddone) {
      const timein2sec = new Date();
      timein2sec.setTime(timein2sec.getTime() + 2000);
      const time = timein2sec.toISOString();
      const dataBefore = {
        blog: [
          { name: "WN1", status: "open", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "edit", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" }]
      };
      const dataAfter = {
        blog: [
          { name: "WN1", status: "open", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "edit", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" }]
      };
      const testFunction = function testFunction(cb) {
        blogModule.autoCloseBlog(cb);
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
  });
  describe("calculations", function() {
    it("should calculate Time To Close", function(bddone) {
      const time = (new Date()).toISOString();
      let time2 = new Date();
      time2.setDate(time2.getDate() + 3);
      time2 = time2.toISOString();
      const dataBefore = {
        blog: [
          { name: "WN1", status: "open", startDate: "2015-01-01", endDate: time },
          { name: "WN2", status: "edit", startDate: "2015-01-01", endDate: "2016-01-01" },
          { name: "WN3", status: "finished", startDate: "2015-01-01", endDate: "2016-01-01" }],
        change: [
          { oid: 1, blog: "WN1", property: "closeDE", timestamp: time },
          { oid: 1, blog: "WN1", property: "closeEN", timestamp: time2 }
        ]
      };
      const dataAfter = {};
      const testFunction = function testFunction(cb) {
        blogModule.findById(1, function(err, blog) {
          should.not.exist(err);
          blog.calculateTimeToClose(function(err) {
            should.not.exist(err);
            should(blog._timeToClose).eql({ DE: 0, EN: 3 });
            cb();
          });
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
  });
  describe("sortArticles", function() {
    /* eslint-disable mocha/no-synchronous-tests */
    it("should not sort without predecessors", function() {
      const input = [{ id: 1 }, { id: 4 }, { id: 3 }];
      const result = blogModule.sortArticles(input);
      should(result).eql([{ id: 1 }, { id: 4 }, { id: 3 }]);
    });
    it("should not sort without predecessors and title", function() {
      const input = [{ id: "1", title: "2" }, { id: "4", title: "1" }, { id: "3", title: "3" }];
      const result = blogModule.sortArticles(input);
      should(result).eql([{ id: "4", title: "1" }, { id: "1", title: "2" }, { id: "3", title: "3" }]);
    });
    it("should sort with predecessors", function() {
      const input = [{ id: 1 }, { id: 4 }, { id: 3, predecessorId: 1 }];
      const result = blogModule.sortArticles(input);
      should(result).eql([{ id: 1 }, { id: 3, predecessorId: 1 }, { id: 4 }]);
    });
    it("should sort with predecessors and title", function() {
      const input = [{ id: 1, title: "2" }, { id: 4, title: "1" }, { id: 3, predecessorId: 1 }];
      const result = blogModule.sortArticles(input);
      should(result).eql([{ id: 4, title: "1" }, { id: 1, title: "2" }, { id: 3, predecessorId: 1 }]);
    });
    it("should place 0 first", function() {
      const input = [{ id: "1" }, { id: "4" }, { id: "3", predecessorId: "0" }];
      const result = blogModule.sortArticles(input);
      should(result).eql([{ id: "3", predecessorId: "0" }, { id: "1" }, { id: "4" }]);
    });
    it("should place 0 first with title", function() {
      const input = [{ id: "1", title: "a" }, { id: "4", title: "b" }, { id: "3", title: "c", predecessorId: "0" }];
      const result = blogModule.sortArticles(input);
      should(result).eql([{ id: "3", title: "c", predecessorId: "0" }, { id: "1", title: "a" }, { id: "4", title: "b" }]);
    });
    it("should sort a longer array", function() {
      const input = [{ id: "1" }, { id: "4" }, { id: "3", predecessorId: "0" }, { id: "5", predecessorId: "8" }, { id: "8", predecessorId: "9" }, { id: "9", predecessorId: "5" }];
      const result = blogModule.sortArticles(input);
      should(result).eql([{ id: "3", predecessorId: "0" }, { id: "1" }, { id: "4" }, { id: "5", predecessorId: "8" }, { id: "9", predecessorId: "5" }, { id: "8", predecessorId: "9" }]);
    });
    it("should sort a longer array based real data", function() {
      const input = [{ id: 11244, predecessorId: 11201 }, { id: 11205, predecessorId: 11209 }, { id: 11201, predecessorId: 11205 }, { id: 11209 }, { id: 11231 }, { id: 11206 }, { id: 11200 }];
      const result = blogModule.sortArticles(input);
      should(result).eql([{ id: 11209 }, { id: 11205, predecessorId: 11209 }, { id: 11201, predecessorId: 11205 }, { id: 11244, predecessorId: 11201 }, { id: 11231 }, { id: 11206 }, { id: 11200 }]);
    });
    /* eslint-enable mocha/no-synchronous-tests */
  });
  describe("copyAllArticles", function () {
    beforeEach(function(bddone) {
      testutil.importData({
        clear: true,
        blog: [{ name: "WN1", status: "edit" }],
        article: [{ blog: "WN1", title: "first", id: 1, markdownDE: "DE Text" },
          { blog: "WN1", title: "first", id: 2, markdownDE: "DE Text", markdownEN: "EN Text" },
          { blog: "WN1", title: "first", id: 3, markdownEN: "EN Text" },
          { blog: "WN1", title: "first", id: 4 }
        ]
      }, bddone);
    });
    it("should copy article and write changelog", function(bddone) {
      blogModule.findOne({ name: "WN1" }, function(err, blog) {
        should.not.exist(err);
        should.exist(blog);
        blog.copyAllArticles({ OSMUser: "Test" }, "DE", "EN", function(err) {
          should.not.exist(err);

          articleModule.find({}, function(err, result) {
            should.not.exist(err);
            should(result.length).eql(4);
            should(result[0].version).eql(2);
            should(result[0].markdownEN).eql("DE Text");
            should(result[1].version).eql(1);
            should(result[1].markdownEN).eql("EN Text");
            should(result[2].version).eql(1);
            should(result[2].markdownEN).eql("EN Text");
            should(result[3].version).eql(1);
            should(result[3].markdownEN).eql(undefined);
            logModule.find({ table: "article" }, function(err, result) {
              should.not.exist(err);
              should(result.length).eql(1);
              should(result[0].blog).eql("WN1");
              should(result[0].user).eql("Test");
              should(result[0].to).eql("DE Text");
              bddone();
            });
          });
        });
      });
    });
    it("should copy article fail when closed", function(bddone) {
      blogModule.findOne({ name: "WN1" }, function(err, blog) {
        should.not.exist(err);
        should.exist(blog);
        blog.closeBlog({ user: { OSMUser: "Test" }, lang: "EN", status: true }, function(err) {
          should.not.exist(err);
          blog.copyAllArticles({ OSMUser: "Test" }, "DE", "EN", function(err) {
            should.exist(err);
            should(err.message).eql("EN can not be edited");
            bddone();
          });
        });
      });
    });
  });
  describe("translateAllArticles", function () {
    beforeEach(function(bddone) {
      testutil.importData({
        clear: true,
        blog: [{ name: "WN1", status: "edit" }],
        article: [{ blog: "WN1", title: "first", id: 1, markdownDE: "Deutscher *Text*" },
          { blog: "WN1", title: "first", id: 2, markdownDE: "Deutscher *Text*", markdownEN: "English Text already translated." },
          { blog: "WN1", title: "first", id: 3, markdownEN: "English Text, no german one." },
          { blog: "WN1", title: "first", id: 4 }
        ]
      }, bddone);
    });
    it("should translate article and write changelog", function(bddone) {
      nock("https://api.deepl.com")
        .post("/v2/translate", "auth_key=Test%20Key%20Fake&source_lang=DE&tag_handling=xml&target_lang=EN&text=%3Cp%3EDeutscher%20%3Cem%3EText%3C%2Fem%3E%3C%2Fp%3E%0A")
        .reply(200, { translations: [{ detected_source_language: "EN", text: "<p>English <b>text</b></p>" }] });
      blogModule.findOne({ name: "WN1" }, function(err, blog) {
        should.not.exist(err);
        should.exist(blog);
        blog.translateAllArticles({ OSMUser: "Test" }, "DE", "EN", "deeplPro", function(err) {
          should.not.exist(err);

          articleModule.find({}, function(err, result) {
            should.not.exist(err);
            should(result.length).eql(4);
            should(result[0].version).eql(2);
            should(result[0].markdownEN).eql("English **text**");
            should(result[1].version).eql(1);
            should(result[1].markdownEN).eql("English Text already translated.");
            should(result[2].version).eql(1);
            should(result[2].markdownEN).eql("English Text, no german one.");
            should(result[3].version).eql(1);
            should(result[3].markdownEN).eql(undefined);
            logModule.find({ table: "article" }, function(err, result) {
              should.not.exist(err);
              should(result.length).eql(1);
              should(result[0].blog).eql("WN1");
              should(result[0].user).eql("deeplPro API Call");
              should(result[0].to).eql("English **text**");
              logModule.find({ table: "blog", property: "translation with deeplPro" }, function(err, result) {
                should.not.exist(err);
                should(result[0].to).eql("DE -> EN");
                bddone();
              });
            });
          });
        });
      });
    });
    it("should copy article fail when closed", function(bddone) {
      blogModule.findOne({ name: "WN1" }, function(err, blog) {
        should.not.exist(err);
        should.exist(blog);
        blog.closeBlog({ user: { OSMUser: "Test" }, lang: "EN", status: true }, function(err) {
          should.not.exist(err);
          blog.copyAllArticles({ OSMUser: "Test" }, "DE", "EN", function(err) {
            should.exist(err);
            should(err.message).eql("EN can not be edited");
            bddone();
          });
        });
      });
    });
  });

  describe("Helper Functions", function() {
    it("should sanitize Blog Key", async function() {
      should(blogModule.sanitizeBlogKey("WN34887")).eql("WN34887");
      should(blogModule.sanitizeBlogKey("blog34887")).eql("34887");
      should(blogModule.sanitizeBlogKey("blog348\n87")).eql("34887");
    });
  });
});
