



import should from "should";

import UserConfigFilter from "../notification/UserConfigFilter.js";






describe("notification/messagefilter", function() {
  describe("UserConfigFilter", function() {
    let dummy;
    let called;
    beforeEach(function (bddone) {
      called = false;
      dummy = {
        addComment: function (user, article, comment, callback) {
          called = true;
          callback();
        },
        editComment: function (user, article, index, comment, callback) {
          called = true;
          callback();
        }
      };
      return bddone();
    });

    describe("addComment", function () {
      it("should filter comments that are addressed (Language) full access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "full" }, dummy);
        ucf.addComment({ OSMUser: "TheFive" }, {}, "Comment for @DE ", function (err) {
          should.not.exist(err);
          should(called).be.True();
          bddone();
        });
      });
      it("should filter comments that are addressed (Language) guest access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.addComment({ OSMUser: "TheFive" }, {}, "Comment for @DE ", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
      it("should filter comments that are addressed (user) guest access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.addComment({ OSMUser: "TheFive" }, { firstCollector: "olli" }, "Comment for @TheFive test", function (err) {
          should.not.exist(err);
          should(called).be.True();
          bddone();
        });
      });
      it("should filter comments that are not addressed full access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "full" }, dummy);
        ucf.addComment({ OSMUser: "TheFive" }, {}, "Comment for @tester test", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
      it("should filter comments that are not addressed guest access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.addComment({ OSMUser: "TheFour" }, {}, "Comment for @tester test", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
      it("should filter comments that start with search key full access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "full" }, dummy);
        ucf.addComment({ OSMUser: "TheFive" }, {}, "Comment for @derTom test", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
      it("should filter comments that start with search key guest access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.addComment({ OSMUser: "TheFive" }, {}, "Comment for @derTom test", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
    });
    describe("editComment", function () {
      it("should filter comments that are addressed (Language) V2 full access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "full" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, {}, 0, "Comment for @DE ", function (err) {
          should.not.exist(err);
          should(called).be.True();
          bddone();
        });
      });
      it("should filter comments that are addressed (Language) V2 guest access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, {}, 0, "Comment for @DE ", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
      it("should filter comments that are addressed (user) V2 full access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "full" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, {}, 0, "Comment for @TheFive test", function (err) {
          should.not.exist(err);
          should(called).be.True();
          bddone();
        });
      });
      it("should filter comments that are addressed (user) V2 guest access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, { firstCollector: "TheFive" }, 0, "Comment for @TheFive test", function (err) {
          should.not.exist(err);
          should(called).be.True();
          bddone();
        });
      });
      it("should filter comments that are addressed (user) V2 guest access another edit", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, { firstCollector: "olli" }, 0, "Comment for @TheFive test", function (err) {
          should.not.exist(err);
          should(called).be.True();
          bddone();
        });
      });
      it("should filter comments that are not addressed V2 full access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "full" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, {}, 0, "Comment for @tester test", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
      it("should filter comments that are not addressed V2 guest access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, {}, 0, "Comment for @tester test", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
      it("should filter comments that start with search key V2 full access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "full" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, {}, 0, "Comment for @derTom test", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
      it("should filter comments that start with search key V2 guest access", function (bddone) {
        const ucf = new UserConfigFilter({ mailComment: ["DE", "TheFive"], OSMUser: "TheFive", access: "guest" }, dummy);
        ucf.editComment({ OSMUser: "TheFive" }, {}, 0, "Comment for @derTom test", function (err) {
          should.not.exist(err);
          should(called).be.False();
          bddone();
        });
      });
    });
  });
});
