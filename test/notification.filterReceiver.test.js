


import should from "should";

import FilterReceiver from "../notification/FilterReceiver.js";

describe("notification/FilterReceiver", function () {
  let dummy;
  let called;
  beforeEach(function (bddone) {
    called = null;
    dummy = {
      updateBlog: function (user, blog, change, callback) {
        called = { user, blog, change };
        callback();
      }
    };
    return bddone();
  });

  it("should forward to the wrapped receiver when the filter returns true", function (bddone) {
    const fr = new FilterReceiver(dummy, { updateBlog: () => true });
    fr.updateBlog({ OSMUser: "test" }, { name: "WN1" }, { status: "edit" }, function (err) {
      should.not.exist(err);
      should.exist(called);
      should(called.change).eql({ status: "edit" });
      bddone();
    });
  });

  it("should skip the wrapped receiver when the filter returns false", function (bddone) {
    const fr = new FilterReceiver(dummy, { updateBlog: () => false });
    fr.updateBlog({ OSMUser: "test" }, { name: "WN1" }, { status: "edit" }, function (err) {
      should.not.exist(err);
      should(called).be.null();
      bddone();
    });
  });

  it("should pass the actual event arguments to the filter predicate", function (bddone) {
    let receivedArgs = null;
    const fr = new FilterReceiver(dummy, {
      updateBlog: (...args) => {
        receivedArgs = args;
        return true;
      }
    });
    fr.updateBlog({ OSMUser: "test" }, { name: "WN1" }, { status: "edit" }, function (err) {
      should.not.exist(err);
      should(receivedArgs.length).equal(3);
      should(receivedArgs[2]).eql({ status: "edit" });
      bddone();
    });
  });

  it("should pass methods without a configured filter through unfiltered", function (bddone) {
    dummy.sendInfo = function (object, callback) {
      called = { object };
      callback();
    };
    const fr = new FilterReceiver(dummy, { updateBlog: () => false });
    fr.sendInfo({ some: "data" }, function (err) {
      should.not.exist(err);
      should.exist(called);
      should(called.object).eql({ some: "data" });
      bddone();
    });
  });
});
