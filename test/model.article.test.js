"use strict";

/* jshint ignore:start */


const async  = require("async");
const should = require("should");
const nock   = require("nock");
const debug  = require("debug")("OSMBC:test:article.test");


const testutil = require("./testutil.js");
const mockdate = require("mockdate");

const articleModule = require("../model/article.js");
const logModule     = require("../model/logModule.js");
const blogModule    = require("../model/blog.js");
const messageCenter = require("../notification/messageCenter.js");


// set Test Standard to ignore prototypes for should
should.config.checkProtoEql = false;









describe("model/article", function() {
  const testUser = { OSMUser: "user" };
  before(function (bddone) {
    // nock all slack messages
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    messageCenter.initialise();

    testutil.clearDB(bddone);
  });
  after(function (bddone) {
    nock.cleanAll();
    bddone();
  });
  describe("Article Constructor", function() {
    it("should create an Article object", function(bddone) {
      const article = articleModule.create({ oid: "Test" });
      should(article.oid).eql("Test");
      should(typeof (article)).eql("object");
      should(article instanceof articleModule.Class).be.True();
      return bddone();
    });
  });
  describe("getCommentMention", function() {
    /* eslint-disable mocha/no-synchronous-tests */
    function createArticleWithComment(comment1, comment2) {
      const article = articleModule.create({ markdown: "test" });
      article.commentList = [];
      article.commentList.push({ user: "User", timestamp: new Date(), text: comment1 });
      if (comment2) article.commentList.push({ user: "User", timestamp: new Date(), text: comment2 });
      return article;
    }
    it("should select language in correct case", function() {
      const a = createArticleWithComment("@DE should to something", "Comment for @ES");
      should(a.getCommentMention("User", "DE")).eql("language");
      should(a.getCommentMention("User", "ES")).eql("language");
      should(a.getCommentMention("User", "AT", "ES")).eql("language");
      should(a.getCommentMention("User", "AT", "DE")).eql("language");
    });
    it("should select language in different case", function() {
      const a = createArticleWithComment("should to something @de", "Comment for @es or What");
      should(a.getCommentMention("User", "DE")).eql("language");
      should(a.getCommentMention("User", "ES")).eql("language");
      should(a.getCommentMention("User", "AT", "ES")).eql("language");
      should(a.getCommentMention("User", "AT", "DE")).eql("language");
    });
    it("should select user in different case", function() {
      const a = createArticleWithComment("should to something @user", "Comment for @es or What");
      should(a.getCommentMention("User", "DE")).eql("user");
      should(a.getCommentMention("User", "ES")).eql("user");
      should(a.getCommentMention("User", "AT", "ES")).eql("user");
      should(a.getCommentMention("User", "AT", "DE")).eql("user");
    });
    it("should not select language if its part of user name", function() {
      const a = createArticleWithComment("should to something @escadoni", "Test more");
      should(a.getCommentMention("escadoni", "ES")).eql("user");
      should(a.getCommentMention("User", "ES")).eql("other");
    });

    it("should select user with space", function() {
      const a = createArticleWithComment("should to something @user name", "Test more");
      should(a.getCommentMention("user name", "ES")).eql("user");
    });
    it("should not select language if user is at the end", function() {
      const a = createArticleWithComment("should to something @user");
      should(a.getCommentMention("user", "DE")).eql("user");
    });
    it("should select all", function() {
      const a = createArticleWithComment("should to something @all");
      should(a.getCommentMention("user", "DE")).eql("language");
    });
    /* eslint-enable mocha/no-synchronous-tests */
  });
  describe("createNewArticle", function() {
    it("should createNewArticle with prototype", function(bddone) {
      articleModule.createNewArticle({ blog: "test", markdownDE: "**" }, function (err, result) {
        should.not.exist(err);
        const id = result.id;
        testutil.getJsonWithId("article", id, function(err, result) {
          should.not.exist(err);
          should(result.blog).equal("test");
          should(result.markdownDE).equal("**");
          bddone();
        });
      });
    });
    it("should createNewArticle without prototype", function(bddone) {
      articleModule.createNewArticle(function (err, result) {
        should.not.exist(err);
        const id = result.id;
        testutil.getJsonWithId("article", id, function(err) {
          should.not.exist(err);
          bddone();
        });
      });
    });
    it("should create no New Article with ID", function(bddone) {
      articleModule.createNewArticle({ id: 2, blog: "test", markdownDE: "**" }, function (err) {
        bddone();
        should.exist(err);
        should(err.message).eql("adfadf");
      });
    });
  });
  describe("save", function() {
    it("Should do save with a Promise", async function () {
      // Generate an article for test
      let newArticle;
      newArticle = await articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" });
      const id = newArticle.id;

      // get a second copy of the article (use Database for Copy)
      const alternativeArticle = await articleModule.findById(id);

      newArticle.blog = "TESTNEW";
      await newArticle.save();
      alternativeArticle.blog = "TESTALTERNATIVE";
      try {
        await alternativeArticle.save();
      } catch (err) {
        should(err).eql(new Error("Version Number Differs"));
      }
    });
    it("should report a conflict, if version number differs", function (bddone) {
      // Generate an article for test
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function(err, result) {
        should.not.exist(err);
        newArticle = result;
        const id = result.id;

        // get a second copy of the article (use Database for Copy)
        articleModule.findById(id, function(err, result) {
          should.not.exist(err);
          const alternativeArticle = result;
          newArticle.blog = "TESTNEW";


          newArticle.save(function(err) {
            should.not.exist(err);
            alternativeArticle.blog = "TESTALTERNATIVE";

            alternativeArticle.save(function(err) {
              // debug(err);
              should.exist(err);
              should(err).eql(Error("Version Number Differs"));
              bddone();
            });
          });
        });
      });
    });
    it("should keep the intern reference to a blog (_blog)", function (bddone) {
      // Generate an article for test
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function(err, result) {
        should.not.exist(err);
        newArticle = result;
        const id = result.id;

        // get a second copy of the article (use Database for Copy)
        articleModule.findById(id, function(err, result) {
          should.not.exist(err);
          result.blog = "TESTNEW";
          result._blog = { name: "TESTNEW" };
          result._derivedInfo = 42;


          result.save(function(err) {
            should.not.exist(err);
            should(result).eql({
              id: id,
              markdownDE: "markdown",
              blog: "TESTNEW",
              version: 2,
              _blog: { name: "TESTNEW" }
            });
            bddone();
          });
        });
      });
    });
  });
  describe("setAndSave", function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    it("should set only the one Value in the database", function (bddone) {
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function(err, result) {
        should.not.exist(err);
        newArticle = result;
        const id = result.id;
        newArticle.markdownDE = "This Value will not be logged";
        newArticle.setAndSave(testUser, { version: 1, blog: "Reference", collection: "text", categoryEN: "Imports" }, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("article", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            should(result).eql({ id: id, markdownDE: "This Value will not be logged", blog: "Reference", collection: "text", categoryEN: "Imports", version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(3);
              const r0id = result[0].id;
              const r1id = result[1].id;
              const r2id = result[2].id;
              // var r3id = result[3].id;
              const t0 = result[0].timestamp;
              const t1 = result[1].timestamp;
              const t2 = result[2].timestamp;
              // var t3 = result[3].timestamp;
              const now = new Date();
              const t0diff = ((new Date(t0)).getTime() - now.getTime());
              const t1diff = ((new Date(t1)).getTime() - now.getTime());
              const t2diff = ((new Date(t2)).getTime() - now.getTime());
              //   var t3diff = ((new Date(t3)).getTime()-now.getTime());

              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(t1diff).be.below(10);
              should(t2diff).be.below(10);
              //  should(t3diff).be.below(10);
              should(result[0]).eql({ id: r0id, timestamp: t0, blog: "Reference", oid: id, user: "user", table: "article", property: "blog", from: "TEST", to: "Reference" });
              should(result[1]).eql({ id: r1id, timestamp: t1, blog: "Reference", oid: id, user: "user", table: "article", property: "categoryEN", to: "Imports" });
              should(result[2]).eql({ id: r2id, timestamp: t2, blog: "Reference", oid: id, user: "user", table: "article", property: "collection", to: "text" });
              //   should(result[3]).eql({id:r3id,timestamp:t3,oid:id,user:"user",table:"article",property:"collection",to:"text"});
              bddone();
            });
          });
        });
      });
    });
    it("should trim markdown Values", function (bddone) {
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown" }, function(err, result) {
        should.not.exist(err);
        newArticle = result;
        const id = result.id;
        newArticle.setAndSave(testUser, { version: "1", markdownDE: "  to be trimmed " }, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("article", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            should(result).eql({ id: id, markdownDE: "to be trimmed", version: 2 });
            bddone();
          });
        });
      });
    });
    it("should ignore unchanged Values", function (bddone) {
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function(err, result) {
        should.not.exist(err);
        newArticle = result;
        const id = result.id;
        let empty;
        const changeValues = {};
        changeValues.markdownDE = newArticle.markdownDE;
        changeValues.blog = empty;
        changeValues.version = "1";
        newArticle.setAndSave(testUser, changeValues, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("article", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            should(result).eql({ id: id, markdownDE: "markdown", blog: "TEST", version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(0);
              bddone();
            });
          });
        });
      });
    });
    it("should delete markdown with spaces", function (bddone) {
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function(err, result) {
        should.not.exist(err);
        newArticle = result;
        const id = result.id;
        let empty;
        const changeValues = {};
        changeValues.markdownDE = " ";
        changeValues.blog = empty;
        changeValues.version = "1";
        newArticle.setAndSave(testUser, changeValues, function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("article", id, function(err, result) {
            should.not.exist(err);
            delete result._meta;
            should(result).eql({ id: id, markdownDE: "", blog: "TEST", version: 2 });
            logModule.find({}, { column: "property" }, function (err, result) {
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(1);
              bddone();
            });
          });
        });
      });
    });
    it("should report a conflict, if version number differs", function (bddone) {
      // Generate an article for test
      let newArticle;
      debug("Create a new Article");
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result;
        const id = result.id;

        // get a second copy of the article (use Database for Copy)
        debug("Search for article to have two versions of it");
        articleModule.findById(id, function testSetAndSaveFindByIDCB(err, result) {
          should.not.exist(err);
          const alternativeArticle = result;

          newArticle.setAndSave({ OSMUser: "TEST" }, { version: "1", blog: "TESTNEW" }, function(err) {
            should.not.exist(err);
            alternativeArticle.setAndSave({ OSMUser: "TEST" }, { version: "1", blog: "TESTALTERNATIVE" }, function(err) {
              // debug(err);
              // should.exist(err);
              should(err).eql(Error("Version Number Differs"));
              // wait a little bit before
              // as logging looks not to be synchronous.
              setTimeout(function() {
                logModule.find({}, function(err, result) {
                  should.not.exist(err);
                  should(result.length).equal(2);
                  articleModule.findById(id, function(err, result) {
                    should.not.exist(err);
                    should(result.blog).equal("TESTNEW");
                    bddone();
                  });
                });
              }, 500);
            });
          });
        });
      });
    });
    it("should report a conflict, no version or olddata is given", function (bddone) {
      // Generate an article for test
      let newArticle;
      debug("Create a new Article");
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result;
        newArticle.setAndSave({ OSMUser: "test" }, { markdownDE: "Hallo" }, function(err) {
          should(err.message).eql("No Version and no History Value for <markdownDE> given");
          bddone();
        });
      });
    });
    it("should set a Value with comparing history Value", function (bddone) {
      // Generate an article for test
      let newArticle;
      debug("Create a new Article");
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result;
        newArticle.setAndSave({ OSMUser: "test" }, { markdownDE: "Hallo", old: { markdownDE: "markdown" } }, function(err) {
          should.not.exist(err);
          articleModule.findById(newArticle.id, function(err, result) {
            should.not.exist(err);
            should(result).eql({ _blog: null, markdownDE: "Hallo", version: 2, blog: "TEST", id: newArticle.id });
            bddone();
          });
        });
      });
    });
    it("should set a Value with comparing history Value ignoring \r\n \n differences", function (bddone) {
      // Generate an article for test
      let newArticle;
      debug("Create a new Article");
      articleModule.createNewArticle({ markdownDE: "markdown\n", blog: "TEST" }, function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result;
        newArticle.setAndSave({ OSMUser: "test" }, { markdownDE: "Hallo", old: { markdownDE: "markdown\r\n" } }, function(err) {
          should.not.exist(err);
          articleModule.findById(newArticle.id, function(err, result) {
            should.not.exist(err);
            should(result).eql({ _blog: null, markdownDE: "Hallo", version: 2, blog: "TEST", id: newArticle.id });
            bddone();
          });
        });
      });
    });
    it("should report error when old value wrong", function (bddone) {
      // Generate an article for test
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result;
        articleModule.findById(newArticle.id, function(err, result) {
          should.not.exist(err);
          result.setAndSave({ OSMUser: "test" }, { markdownDE: "test", version: 1 }, function (err) {
            should.not.exist(err);
            articleModule.findById(newArticle.id, function(err, result) {
              should.not.exist(err);
              result.setAndSave({ OSMUser: "test" }, { markdownDE: "Hallo", old: { markdownDE: "markdown" } }, function(err) {
                should(err.message).eql("Field markdownDE already changed in DB");
                bddone();
              });
            });
          });
        });
      });
    });
    it("should report error when blog is closed", function (bddone) {
      // Generate an article for test
      let newArticle;
      async.auto({
        blog: blogModule.createNewBlog.bind(null, { OSMUser: "TheFive" }, { name: "TEST", exportedEN: true }),
        article: articleModule.createNewArticle.bind(null, { markdownDE: "markdown", blog: "TEST" })

      },
      function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result.article;
        articleModule.findById(newArticle.id, function(err, result) {
          should.not.exist(err);
          result.setAndSave({ OSMUser: "test" }, { markdownEN: "test", version: 1 }, function (err) {
            should.exist(err);
            should(err.message).eql("markdownEN can not be edited. Blog is already exported.");
            bddone();
          });
        });
      });
    });
    it("should not report error when blog is closed, but markdown is undefined", function (bddone) {
      // Generate an article for test
      let newArticle;
      async.auto({
        blog: blogModule.createNewBlog.bind(null, { OSMUser: "TheFive" }, { name: "TEST", exportedEN: true }),
        article: articleModule.createNewArticle.bind(null, { markdownDE: "markdown", blog: "TEST" })

      },
      function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result.article;
        articleModule.findById(newArticle.id, function(err, result) {
          should.not.exist(err);
          let b;
          result.setAndSave({ OSMUser: "test" }, { markdownEN: b, markdownDE: "hallo", version: 1 }, function (err) {
            should.not.exist(err);
            bddone();
          });
        });
      });
    });
    it("should set comment to solved if article is unpublished", function (bddone) {
      // Generate an article for test
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result;
        articleModule.findById(newArticle.id, function(err, result) {
          should.not.exist(err);
          result.setAndSave({ OSMUser: "test" }, { categoryEN: "--unpublished--", unpublishReason: "doublette", version: 1 }, function (err) {
            should.not.exist(err);
            articleModule.findById(newArticle.id, function(err, result) {
              should.not.exist(err);
              should(result.commentStatus).eql("solved");
              should(result.commentList[0].text).eql("#solved because set to --unpublished--.\n\nReason: doublette");
              bddone();
            });
          });
        });
      });
    });
    it("should fail if something is set to unpublished without reason", function (bddone) {
      // Generate an article for test
      let newArticle;
      articleModule.createNewArticle({ markdownDE: "markdown", blog: "TEST" }, function testSetAndSaveCreateNewArticleCB(err, result) {
        should.not.exist(err);
        newArticle = result;
        articleModule.findById(newArticle.id, function(err, result) {
          should.not.exist(err);
          result.setAndSave({ OSMUser: "test" }, { categoryEN: "--unpublished--", version: 1 }, function (err) {
            should.exist(err);
            should(err.message).eql("Missing reason for unpublishing article.");
            bddone();
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
        function c1(cb) { articleModule.createNewArticle({ blog: "WN1's", markdownDE: "test1", collection: "col1", category: "catA" }, cb); },
        function c1(cb) { articleModule.createNewArticle({ blog: "WN1", markdownDE: "test1", collection: "col1", category: "catA" }, cb); },
        function c2(cb) { articleModule.createNewArticle({ blog: "WN1", markdownDE: "test2", collection: "col2", category: "catB" }, cb); },
        function c3(cb) {
          articleModule.createNewArticle({ blog: "WN2", markdownDE: "test3", collection: "col3", category: "catA" },
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
        articleModule.find({ blog: "WN1" }, { column: "collection" }, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].id;
          delete result[1]._meta;
          delete result[1].id;
          should(result[0]).eql({ blog: "WN1", markdownDE: "test1", collection: "col1", category: "catA", version: 1 });
          should(result[1]).eql({ blog: "WN1", markdownDE: "test2", collection: "col2", category: "catB", version: 1 });
          bddone();
        });
      });
    });
    describe("findOne", function() {
      it("should findOne object with sort", function(bddone) {
        articleModule.findOne({ blog: "WN1" }, { column: "collection" }, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({ blog: "WN1", markdownDE: "test1", collection: "col1", category: "catA", version: 1 });
          bddone();
        });
      });
      it("should findOne object with an apostrophe", function(bddone) {
        articleModule.findOne({ blog: "WN1's" }, { column: "collection" }, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({ blog: "WN1's", markdownDE: "test1", collection: "col1", category: "catA", version: 1 });
          bddone();
        });
      });
    });
    describe("findById", function() {
      it("should find saved Object", function(bddone) {
        articleModule.findById(idToFindLater, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({ _blog: null, blog: "WN2", markdownDE: "test3", collection: "col3", category: "catA", version: 1 });
          bddone();
        });
      });
    });
  });
  describe("findEmptyUserCollectedArticles", function() {
    before(function (bddone) {
      testutil.importData({
        clear: true,
        blog: [{ name: "WN1", exportedDE: true, status: "edit" },
          { name: "WNclosed", status: "closed" },
          { name: "WN2", status: "open" },
          { name: "WrongBlog", status: "open" }],
        article: [{ blog: "WN1", title: "first", id: 1 },
          { blog: "WN2", title: "second", categoryEN: "cat", markdownEN: "Hallole", id: 2 },
          { blog: "WNclosed", title: "third", id: 3 },
          { blog: "WN1", title: "forth", id: 4 },
          { blog: "WrongBlog", title: "fifth", categoryEN: "cat", id: 5 }],
        change: [{ blog: "WN1", property: "collection", user: "test", oid: 1, table: "article" },
          { blog: "WN2", property: "collection", user: "test", oid: 2, table: "article" },
          { blog: "WN2", property: "collection", user: "test", oid: 2, table: "article" },
          { blog: "WN2", property: "collection", user: "test", oid: 2, table: "article" },
          { blog: "WNclosed", property: "collection", user: "test", oid: 3, table: "article" },
          { blog: "WN2", property: "collection", user: "test2", oid: 4, table: "article" },
          { blog: "WrongBlog", property: "markdownDE", user: "test", oid: 5, table: "article" }]
      }, bddone);
    });
    it("should find all empty article for a user (DE)", function(bddone) {
      articleModule.findEmptyUserCollectedArticles("DE", "test", function(err, result) {
        should.not.exist(err);
        should(result.length).eql(1);
        should(result[0].title).eql("second");
        bddone();
      });
    });
    it("should find all empty article for a user (EN)", function(bddone) {
      articleModule.findEmptyUserCollectedArticles("EN", "test", function(err, result) {
        should.not.exist(err);
        should(result.length).eql(0);
        bddone();
      });
    });
  });
  describe("displayTitle", function() {
    let article;
    it("should return title first", function(bddone) {
      article = articleModule.create({ title: "Titel", markdownDE: "markdown" });
      should(article.displayTitle()).equal("Titel");

      article = articleModule.create({ title: "Very Long Title", markdownDE: "markdown" });
      should(article.displayTitle(10)).equal("Very Long ...");
      bddone();
    });
    it("should return markdown second", function(bddone) {
      article = articleModule.create({ markdownDE: "markdown", collection: "col", category: "CAT" });
      should(article.displayTitle()).equal("col");

      article = articleModule.create({ title: "", markdownDE: "markdown", collection: "col", category: "CAT" });
      should(article.displayTitle()).equal("col");

      article = articleModule.create({ title: "", markdownDE: "* This is more markdown text to test the default limit of charachter", collection: "col", category: "CAT" });
      should(article.displayTitle()).equal("col");
      bddone();
    });
    it("should return collection third", function(bddone) {
      article = articleModule.create({ markdownDE: "", collection: "col", category: "CAT" });
      should(article.displayTitle()).equal("col");

      article = articleModule.create({ title: "", collection: "col", category: "CAT" });
      should(article.displayTitle()).equal("col");

      article = articleModule.create({ collection: "Extrem shortening", category: "CAT" });
      should(article.displayTitle(2)).equal("Ex...");
      bddone();
    });
  });
  describe("calculateLinks", function() {
    let article;
    let link;
    it("should collect one link from collection", function(bddone) {
      article = articleModule.create({ collection: "https://www.google.de" });
      link = article.calculateLinks();
      should(link).eql(["https://www.google.de"]);

      article = articleModule.create({ collection: "Forum Article is good: http://forum.openstreetmap.org/thisIsALink?id=200" });
      link = article.calculateLinks();
      should(link).eql(["http://forum.openstreetmap.org/thisIsALink?id=200"]);
      return bddone();
    });
    it("should collect Multiple Links from markdown and collection without doubling", function(bddone) {
      article = articleModule.create(
        {
          collection: "Forum Article is good: http://forum.openstreetmap.org/thisIsALink?id=200 \
              but be aware of http://bing.de/subpage/relation and of ftp://test.de",
          markdownDE: "The [Forum Article](https://forum.openstreetmap.org/thisIsALink?id=200) \
                     reads nice, but have a look to [this](https://bing.de/subpage/relation) \
                     and [that](ftp://test.de)"
        });
      link = article.calculateLinks();
      should(link).eql(["http://forum.openstreetmap.org/thisIsALink?id=200",
        "http://bing.de/subpage/relation",
        "https://forum.openstreetmap.org/thisIsALink?id=200",
        "https://bing.de/subpage/relation"
      ]);
      return bddone();
    });
  });
  describe("remove", function() {
    let idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) { articleModule.createNewArticle({ blog: "WN1", markdownDE: "test1", collection: "col1", category: "catA" }, cb); },
        function c2(cb) { articleModule.createNewArticle({ blog: "WN1", markdownDE: "test2", collection: "col2", category: "catB" }, cb); },
        function c3(cb) {
          articleModule.createNewArticle({ blog: "WN2", markdownDE: "test3", collection: "col3", category: "catA" },
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
    it("should remove one article", function(bddone) {
      articleModule.findById(idToFindLater, function(err, article) {
        should.not.exist(err);
        should.exist(article);
        article.remove(function(err) {
          should.not.exist(err);
          articleModule.find({}, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            should(result.length).equal(2);
            bddone();
          });
        });
      });
    });
  });
  describe("calculateUsedLinks", function() {
    let idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) { articleModule.createNewArticle({ blog: "WN1", markdownDE: "test1 some [ping](https://link.to/hallo)", collection: "col1 http://link.to/hallo", categoryEN: "catA" }, cb); },
        function c02(cb) { articleModule.createNewArticle({ blog: "Trash", markdownDE: "test1 some [ping](https://link.to/hallo)", collection: "col1 http://link.to/hallo", categoryEN: "catA" }, cb); },
        function c01(cb) { articleModule.createNewArticle({ blog: "WN1", markdownDE: "test1 some [ping](https://link.to/hallo)", collection: "col1 http://link.to/hallo", categoryEN: "--unpublished--" }, cb); },
        function c2(cb) { articleModule.createNewArticle({ blog: "WN1", markdownDE: "test1 some [ping](https://link.to/hallo) http://www.osm.de/12345", collection: "http://www.osm.de/12345", categoryEN: "catB" }, cb); },
        function c2(cb) { articleModule.createNewArticle({ blog: "WN1", markdownDE: "test1 some [google](http://www.google.de)", collection: "http://www.osm.de/12345", categoryEN: "catB" }, cb); },
        function c3(cb) {
          articleModule.createNewArticle({ blog: "WN2", markdownDE: "test1 some [ping](https://link.to/hallo)", collection: "col3 http://www.google.de", categoryEN: "catA" },
            function(err, result) {
              should.not.exist(err);
              idToFindLater = result.id;
              cb(err);
            });
        }

      ], function(err) {
        should.not.exist(err);
        bddone();
      }
      );
    });
    it("should display the other Articles Links", function(bddone) {
      articleModule.findById(idToFindLater, function(err, article) {
        should.not.exist(err);
        article.calculateUsedLinks(function(err, result) {
          should.not.exist(err);
          should.exist(result);
          should(result.count).equal(3);
          should(result["https://link.to/hallo"].length).equal(2);
          should(result["http://www.google.de"].length).equal(1);

          bddone();
        });
      });
    });
    it("should display the other Articles Links and ignore Standards", function(bddone) {
      articleModule.findById(idToFindLater, function(err, article) {
        should.not.exist(err);
        article.calculateUsedLinks({ ignoreStandard: true }, function(err, result) {
          should.not.exist(err);
          should.exist(result);
          should(result.count).equal(2);
          should(result["https://link.to/hallo"].length).equal(2);
          should.not.exist(result["http://www.google.de"]);

          bddone();
        });
      });
    });
  });
  describe("fullTextSearch", function() {
    before(async function () {
      // Initialise some Test Data for the find functions
      await testutil.clearDB();
      await articleModule.createNewArticle({ blog: "1", markdownDE: "test1", collection: "Try this link https://www.test.at/link ?", category: "catA" });
      await articleModule.createNewArticle({ blog: "5", markdownDE: "[test](http://www.abc.net.au/news/2016-02-24/cyclone-winston-entire-villages-wiped-out-on-fiji's-koro-island/7195842)", collection: "text", category: "catA" });
      await articleModule.createNewArticle({ blog: "2", markdownEN: "See more special [here](https://www.test.at/link)", collection: "col1", category: "catA" });
      await articleModule.createNewArticle({ blog: "3", markdownDE: "test2", collection: "http://www.test.at/link", category: "catB" });
      await articleModule.createNewArticle({ blog: "4", markdownDE: "test3", collection: "https://simple.link/where", category: "catA" });
      await articleModule.createNewArticle({ blog: "5", markdownDE: "linktest1", collection: "https://simple.link/whereisit", category: "catA" });
      await articleModule.createNewArticle({ blog: "5", markdownDE: "linktest2", collection: "https://simple.link/whereisit/", category: "catA" });
      await articleModule.createNewArticle({ blog: "5", markdownDE: "linktest3", collection: "http://simple.link/whereisit", category: "catA" });
      await articleModule.createNewArticle({ blog: "5", markdownDE: "linktest4", collection: "http://simple.link/whereisit/", category: "catA" });
      await articleModule.createNewArticle({ blog: "5", markdownDE: "linktest5", markdownEN: "[link](http://simple.link/whereisit/)", category: "catA" });
      await articleModule.createNewArticle({ blog: "5", markdownDE: "linktest6 to short", markdownEN: "[link](http://simple.link/whereisi)", category: "catA" });
      await articleModule.createNewArticle({ blog: "5", markdownDE: "linktest7 to short", markdownEN: "[link](https://simple.link/whereisi)", category: "catA" });
    });
    it("should find the simple link", async function() {
      const result = await articleModule.fullTextSearch("https://simple.link/where", { column: "blog" });
      should(result.flatMap(x => x.markdownDE)).deepEqual(["test3"]);
    });
    it("should find the other link 3 times", async function() {
      const result = await articleModule.fullTextSearch("https://www.test.at/link", { column: "blog" });
      should(result.flatMap(x => x.blog)).deepEqual(["1", "2", "3"]);
    });
    it("should search links with apostroph in it", async function() {
      const result = await articleModule.fullTextSearch("http://www.abc.net.au/news/2016-02-24/cyclone-winston-entire-villages-wiped-out-on-fiji's-koro-island/7195842", { column: "blog" });
      should(result.flatMap(x => x.blog)).deepEqual(["5"]);
    });
    it("should search links independent from httpS or closing /", async function() {
      let result = await articleModule.fullTextSearch("https://simple.link/whereisit", { column: "blog" });
      should(result.flatMap(x => x.markdownDE)).deepEqual(["linktest1", "linktest2", "linktest3", "linktest4", "linktest5"]);

      result = await articleModule.fullTextSearch("https://simple.link/whereisit/", { column: "blog" });
      should(result.flatMap(x => x.markdownDE)).deepEqual(["linktest1", "linktest2", "linktest3", "linktest4", "linktest5"]);

      result = await articleModule.fullTextSearch("http://simple.link/whereisit", { column: "blog" });
      should(result.flatMap(x => x.markdownDE)).deepEqual(["linktest1", "linktest2", "linktest3", "linktest4", "linktest5"]);

      result = await articleModule.fullTextSearch("http://simple.link/whereisit/", { column: "blog" });
      should(result.flatMap(x => x.markdownDE)).deepEqual(["linktest1", "linktest2", "linktest3", "linktest4", "linktest5"]);
    });
  });
  describe("comments", function() {
    before(function (bddone) {
      mockdate.set(new Date("2016-05-25T20:00"));


      bddone();
    });
    after(function(bddone) {
      mockdate.reset();
      bddone();
    });
    it("should add a comment", function(bddone) {
      const timestamp = new Date();
      const timestampIso = timestamp.toISOString();
      const dataBefore = {
        clear: true,
        article: [{ blog: "WN1", collection: "something", title: "test" }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          id: "1",
          version: 2,
          commentList: [{ user: "Test", timestamp: timestampIso, text: "a comment" }],
          commentStatus: "open",
          commentRead: { Test: 0 }
        }],
        change: [{ blog: "WN1", oid: 1, table: "article", from: "", to: "a comment", user: "Test", timestamp: timestampIso }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.addCommentFunction({ OSMUser: "Test" }, "a comment", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should add a comment with article link", function(bddone) {
      const timestamp = new Date();
      const timestampIso = timestamp.toISOString();
      const dataBefore = {
        clear: true,
        article: [{ blog: "WN1", collection: "something", title: "test" }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          id: "1",
          version: 2,
          commentList: [{ user: "Test", timestamp: timestampIso, text: "a comment #99" }],
          commentStatus: "open",
          commentRead: { Test: 0 }
        }],
        change: [{ blog: "WN1", oid: 1, table: "article", from: "", to: "a comment #99", user: "Test", timestamp: timestampIso }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.addCommentFunction({ OSMUser: "Test" }, "a comment #99", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should not add a empty comment", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{ blog: "WN1", collection: "something", title: "test" }]
      };
      const dataAfter = {
        article: [{ blog: "WN1", collection: "something", title: "test" }],
        change: []
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.addCommentFunction({ OSMUser: "" }, "", function checkErr(err) {
            should.exist(err);
            should(err).eql(new Error("Empty Comment Added"));
            cb();
          });
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should add a second comment", function(bddone) {
      const timestamp = new Date();
      const timestampIso = new Date().toISOString();
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{ user: "Test", timestamp: timestamp, text: "a comment" }],
          commentRead: { Test: 0 }
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{ user: "Test", timestamp: timestampIso, text: "a comment" },
            { user: "Test2", timestamp: timestampIso, text: "a second comment" }],
          commentRead: { Test: 0, Test2: 1 }
        }
        ],
        change: [{ blog: "WN1", oid: 1, table: "article", from: "", to: "a second comment", user: "Test2", timestamp: timestampIso }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          article.addCommentFunction({ OSMUser: "Test2" }, "a second comment", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should edit a comment", function(bddone) {
      const timestamp = new Date();
      const timestamp2 = new Date();
      timestamp2.setTime(timestamp2.getTime());
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{ user: "Test", timestamp: timestamp, text: "a comment" }]
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{
            user: "Test",
            timestamp: timestamp.toISOString(),
            editstamp: timestamp2.toISOString(),
            text: "a changed comment"
          }]
        }],
        change: [{ blog: "WN1", oid: 1, table: "article", property: "comment0", from: "a comment", to: "a changed comment", user: "Test", timestamp: timestamp2.toISOString() }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          article.editComment({ OSMUser: "Test" }, 0, "a changed comment", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should edit a comment with article link", function(bddone) {
      const timestamp = new Date();
      const timestamp2 = new Date();
      timestamp2.setTime(timestamp2.getTime());
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{ user: "Test", timestamp: timestamp, text: "a comment" }]
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{
            user: "Test",
            timestamp: timestamp.toISOString(),
            editstamp: timestamp2.toISOString(),
            text: "a comment #99"
          }]
        }],
        change: [{ blog: "WN1", oid: 1, table: "article", property: "comment0", from: "a comment", to: "a comment #99", user: "Test", timestamp: timestamp2.toISOString() }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          article.editComment({ OSMUser: "Test" }, 0, "a comment #99", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should mark a comment as read", function(bddone) {
      const timestamp = new Date();
      const timestamp2 = new Date();
      timestamp2.setTime(timestamp2.getTime() + 200);
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{ user: "Test", timestamp: timestamp, text: "a comment" }, { user: "Test", timestamp: timestamp, text: "a second comment" }]
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{
            user: "Test",
            timestamp: timestamp.toISOString(),
            text: "a comment"
          }, {
            user: "Test",
            timestamp: timestamp.toISOString(),
            text: "a second comment"
          }],
          commentRead: { Test: 1 }
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          article.markCommentRead({ OSMUser: "Test" }, 1, cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should not edit a comment with blank", function(bddone) {
      const timestamp = new Date();
      const timestamp2 = new Date();
      timestamp2.setTime(timestamp2.getTime() + 200);
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{ user: "Test", timestamp: timestamp, text: "a comment" }]
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{
            user: "Test",
            timestamp: timestamp.toISOString(),
            text: "a comment"
          }]
        }],
        change: []
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          article.editComment({ OSMUser: "Test" }, 0, " ", function checkErr(err) {
            should.exist(err);
            should(err).eql(new Error("Empty Comment Added"));
            cb();
          }
          );
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should allow only user wrote a comment to edit a comment", function(bddone) {
      const timestamp = new Date();
      const timestampIso = timestamp.toISOString();
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{ user: "Test", timestamp: timestamp, text: "a comment" }]
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          commentList: [{ user: "Test", timestamp: timestampIso, text: "a comment" }]
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          article.editComment({ OSMUser: "Test2" }, 0, "a changed comment", function (err) {
            const e = new Error("Only Writer is allowed to change a commment");
            e.status = 409;
            should(err).eql(e);
            return cb();
          });
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
  });
  describe("tags & votes", function() {
    before(function (bddone) {
      mockdate.set(new Date("2016-05-25T20:00"));

      bddone();
    });
    after(function(bddone) {
      mockdate.reset();
      bddone();
    });
    it("should add a vote", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{ blog: "WN1", collection: "something", title: "test" }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          id: "1",
          version: 2,
          votes: { testtag: ["Test"] }
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.setVote({ OSMUser: "Test" }, "testtag", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should not add a already set vote", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{ blog: "WN1", collection: "something", title: "test", votes: { testtag: ["Test"] } }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          votes: { testtag: ["Test"] }
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.setVote({ OSMUser: "Test" }, "testtag", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should unset a vote", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          votes: { testtag: ["Test"] }
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          id: "1",
          version: 2,
          votes: { testtag: [] }
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.unsetVote({ OSMUser: "Test" }, "testtag", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should not unset a unset vote", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          votes: { testtag: ["Test"] }
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          votes: { testtag: ["Test"] }
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.unsetVote({ OSMUser: "Test" }, "testtag2", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });

    it("should add a tag", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{ blog: "WN1", collection: "something", title: "test" }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          id: "1",
          version: 2,
          tags: ["testtag"]
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.setTag({ OSMUser: "Test" }, "testtag", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should not add an added tag", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{ blog: "WN1", collection: "something", title: "test", tags: ["testtag"] }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          tags: ["testtag"]
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.setTag({ OSMUser: "Test" }, "testtag", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should remove a tag", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          tags: ["testtag"]
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          id: "1",
          version: 2,
          tags: []
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.unsetTag({ OSMUser: "Test" }, "testtag", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
    it("should not remove a removed tag", function(bddone) {
      const dataBefore = {
        clear: true,
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          tags: ["testtag"]
        }]
      };
      const dataAfter = {
        article: [{
          blog: "WN1",
          collection: "something",
          title: "test",
          tags: ["testtag"]
        }]
      };
      const testFunction = function testFunction(cb) {
        articleModule.findById(1, function(err, article) {
          should.not.exist(err);
          should.exist(article);
          article.unsetTag({ OSMUser: "Test" }, "testtag2", cb);
        });
      };
      testutil.doATest(dataBefore, testFunction, dataAfter, bddone);
    });
  });
  describe("isChangeAllowed", function() {
    it("should forbid editing of main attributes with one exported language", function(bddone) {
      const blog = blogModule.create({ name: "blog", exportedEN: true });
      const article =  articleModule.create({ blog: "blog", _blog: blog });
      should(article.isChangeAllowed("title")).be.false();
      should(article.isChangeAllowed("predecessorId")).be.false();
      should(article.isChangeAllowed("categoryEN")).be.false();
      bddone();
    });
    it("should forbid editing of main attributes with one closed language", function(bddone) {
      const blog =  blogModule.create({ name: "blog", closeEN: true });
      const article = articleModule.create({ blog: "blog", _blog: blog });
      should(article.isChangeAllowed("title")).be.false();
      should(article.isChangeAllowed("categoryEN")).be.false();
      should(article.isChangeAllowed("predecessorId")).be.false();
      bddone();
    });
    it("should forbid editing of markdown attributes with one closed language", function(bddone) {
      const blog =  blogModule.create({ name: "blog", closeEN: true });
      const article = articleModule.create({ blog: "blog", _blog: blog });
      should(article.isChangeAllowed("markdownEN")).be.false();
      should(article.isChangeAllowed("markdownDE")).be.true();
      should(article.isChangeAllowed("markdownES")).be.true();
      bddone();
    });
    it("should allow editing if language is closed, but article is no translation", function(bddone) {
      const blog =  blogModule.create({ name: "blog", closeEN: true, exportedDE: true });
      const article = articleModule.create({ blog: "blog", _blog: blog, markdownEN: "no translation", markdownDE: "no translation" });
      should(article.isChangeAllowed("markdownEN")).be.false();
      should(article.isChangeAllowed("markdownDE")).be.false();
      should(article.isChangeAllowed("markdownES")).be.true();
      should(article.isChangeAllowed("title")).be.true();
      should(article.isChangeAllowed("blog")).be.true();
      should(article.isChangeAllowed("predecessorId")).be.true();
      should(article.isChangeAllowed("categoryEN")).be.true();
      bddone();
    });
    it("should allow editing if nothing is closed / exported", function(bddone) {
      const blog = blogModule.create({ name: "blog" });
      const article =  articleModule.create({ blog: "blog", _blog: blog });
      should(article.isChangeAllowed("title")).be.true();
      should(article.isChangeAllowed("predecessor")).be.true();
      should(article.isChangeAllowed("categoryEN")).be.true();
      should(article.isChangeAllowed("markdownEN")).be.true();
      should(article.isChangeAllowed("markdownDE")).be.true();
      should(article.isChangeAllowed("markdownES")).be.true();
      bddone();
    });
  });
  describe("isMarkdown", function() {
    it("should not accept numbers and empty string as markdown", function(bddone) {
      should(articleModule.isMarkdown(5)).is.False();
      should(articleModule.isMarkdown(null)).is.False();
      should(articleModule.isMarkdown("")).is.False();
      bddone();
    });
    it("should not accept no translation as markdown", function(bddone) {
      should(articleModule.isMarkdown("no translation")).is.False();
      bddone();
    });
    it("should  accept markdown", function(bddone) {
      should(articleModule.isMarkdown("adsfas")).is.True();
      bddone();
    });
  });
  describe("Copy Articles", function() {
    before(function (bddone) {
      testutil.importData({
        clear: true,
        blog: [{ name: "WN1", exportedDE: true, status: "edit" },
          { name: "WNclosed", status: "closed" },
          { name: "WN2", status: "open" },
          { name: "CopyToBlog", status: "open" }],
        article: [{ blog: "WN1", title: "first", id: 1 },
          { blog: "WN2", title: "second", categoryEN: "cat", markdownEN: "ENMarkdown", markdownDE: "DEMarkdown", markdownES: "ESMarkdown", id: 2 },
          { blog: "WNclosed", title: "third", id: 3 },
          { blog: "WN1", title: "forth", id: 4 },
          { blog: "WrongBlog", title: "fifth", categoryEN: "cat", id: 5 }],
        change: [{ blog: "WN1", property: "collection", user: "test", oid: 1, table: "article" },
          { blog: "WN2", property: "collection", user: "test", oid: 2, table: "article" },
          { blog: "WN2", property: "collection", user: "test", oid: 2, table: "article" },
          { blog: "WN2", property: "collection", user: "test", oid: 2, table: "article" },
          { blog: "WNclosed", property: "collection", user: "test", oid: 3, table: "article" },
          { blog: "WN2", property: "collection", user: "test2", oid: 4, table: "article" },
          { blog: "WrongBlog", property: "markdownDE", user: "test", oid: 5, table: "article" }]
      }, bddone);
    });
    it("should copy an article to another blog", function(bddone) {
      articleModule.findById(2, function(err, article) {
        should.not.exist(err);
        article.copyToBlog("CopyToBlog", ["DE", "EN"], function(err) {
          should.not.exist(err);
          articleModule.findOne({ blog: "CopyToBlog" }, function(err, article) {
            should.not.exist(err);
            should(article).eql({
              id: "6",
              categoryEN: "cat",
              title: "second",
              originArticleId: "2",
              blog: "CopyToBlog",
              markdownDE: "Former Text:\n\nDEMarkdown",
              markdownEN: "Former Text:\n\nENMarkdown",
              version: 1
            });
            bddone();
          });
        });
      });
    });
  });
});
/* jshint ignore:end */
