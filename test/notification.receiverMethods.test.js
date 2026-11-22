import should from "should";

import { RECEIVER_METHODS } from "../notification/FilterReceiver.js";
import FilterReceiver from "../notification/FilterReceiver.js";
import IteratorReceiver from "../notification/IteratorReceiver.js";
import ConfigFilter from "../notification/ConfigFilter.js";
import UserConfigFilter from "../notification/UserConfigFilter.js";
import BlogStatusFilter from "../notification/BlogStatusFilter.js";
import ArticleCollectFilter from "../notification/ArticleCollectFilter.js";
import LogModuleReceiver from "../notification/LogModuleReceiver.js";
import ExportReceiver from "../notification/exportReceiver.js";
import { MailReceiver } from "../notification/mailReceiver.js";
import { SlackReceiver } from "../notification/slackReceiver.js";
import messageCenter from "../notification/messageCenter.js";


// docs/architecture.md: every messageCenter receiver implements all
// receiver methods (no-op stubs allowed). A missing one only shows when an
// event of that kind reaches the receiver, so check the classes here.
describe("notification receivers", function() {
  const receiverClasses = {
    FilterReceiver,
    IteratorReceiver,
    ConfigFilter,
    UserConfigFilter,
    BlogStatusFilter,
    ArticleCollectFilter,
    LogModuleReceiver,
    ExportReceiver,
    MailReceiver,
    SlackReceiver
  };
  for (const [name, cls] of Object.entries(receiverClasses)) {
    it(`${name} should implement every receiver method`, function() {
      const missing = RECEIVER_METHODS.filter((m) => typeof cls.prototype[m] !== "function");
      should(missing).eql([]);
    });
  }

  describe("MessageCenter", function() {
    let MessageCenter;
    before(function() {
      messageCenter.initialise();
      MessageCenter = messageCenter.global.constructor;
    });

    it("should implement every receiver method", function() {
      const missing = RECEIVER_METHODS.filter((m) => typeof MessageCenter.prototype[m] !== "function");
      should(missing).eql([]);
    });

    it("should give the event to every receiver and call back with the first error", function(done) {
      const center = new MessageCenter();
      const received = [];
      center.registerReceiver({ updateBlog(_u, _b, _c, cb) { received.push("first"); cb(new Error("first failed")); } });
      center.registerReceiver({ updateBlog(_u, _b, _c, cb) { received.push("second"); cb(new Error("second failed")); } });
      center.registerReceiver({ updateBlog(_u, _b, _c, cb) { setImmediate(function() { received.push("third"); cb(); }); } });
      center.updateBlog({}, {}, {}, function(err) {
        should(received).eql(["first", "second", "third"]);
        should(err.message).eql("first failed");
        done();
      });
    });

    it("should call back without error when every receiver succeeds", function(done) {
      const center = new MessageCenter();
      center.registerReceiver({ sendInfo(_data, cb) { cb(); } });
      center.sendInfo({}, function(err) {
        should(err).be.null();
        done();
      });
    });
  });
});
