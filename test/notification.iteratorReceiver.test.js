import should from "should";
import sinon from "sinon";

import config from "../config.js";
import IteratorReceiver from "../notification/IteratorReceiver.js";


describe("notification/IteratorReceiver", function() {
  afterEach(function() {
    sinon.restore();
  });

  it("should log compact operation specific errors", function(done) {
    const logger = sinon.stub(config.logger, "error");
    const receiver = new IteratorReceiver({
      failingReceiver: {
        updateBlog(_user, _blog, _change, cb) {
          cb({ message: "Too Many Requests", code: "ERR_BAD_RESPONSE", request: { nativeProtocols: true } });
        }
      }
    });

    receiver.updateBlog({}, {}, {}, function() {
      setImmediate(function() {
        logger.calledOnce.should.be.True();
        const line = String(logger.firstCall.args[0]);

        const parsed = JSON.parse(line);
        parsed.operation.should.equal("updateBlog");
        parsed.message.should.equal("Too Many Requests");
        parsed.code.should.equal("ERR_BAD_RESPONSE");
        should(parsed.name).be.undefined();
        line.should.not.match(/nativeProtocols|\[Circular\]/);
        done();
      });
    });
  });
});