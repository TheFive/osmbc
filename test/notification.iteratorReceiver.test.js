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
        parsed.receiver.should.equal("failingReceiver");
        done();
      });
    });
  });

  it("should call back before any receiver gets the event", function(done) {
    const received = [];
    const receiver = new IteratorReceiver({
      a: { updateArticle(_user, _article, _change, cb) { received.push("a"); cb(); } }
    });
    receiver.updateArticle({}, {}, {}, function() {
      should(received).eql([]);
      setImmediate(function() {
        should(received).eql(["a"]);
        done();
      });
    });
  });

  it("should give the event to the next receivers when one calls back with an error", function(done) {
    sinon.stub(config.logger, "error");
    const received = [];
    const receiver = new IteratorReceiver({
      first: { addComment(_user, _article, _text, cb) { received.push("first"); cb(new Error("webhook down")); } },
      second: { addComment(_user, _article, _text, cb) { received.push("second"); cb(); } }
    });
    receiver.addComment({}, {}, "text", function() {
      setImmediate(function() {
        should(received).eql(["first", "second"]);
        done();
      });
    });
  });

  it("should log a receiver that throws and give the event to the next receivers", function(done) {
    const logger = sinon.stub(config.logger, "error");
    const received = [];
    const receiver = new IteratorReceiver({
      throwing: { sendCloseStatus() { throw new Error("broken receiver"); } },
      second: { sendCloseStatus(_user, _blog, _lang, _status, cb) { received.push("second"); cb(); } }
    });
    receiver.sendCloseStatus({}, {}, "DE", true, function() {
      setImmediate(function() {
        should(received).eql(["second"]);
        logger.calledOnce.should.be.True();
        const parsed = JSON.parse(String(logger.firstCall.args[0]));
        parsed.operation.should.equal("sendCloseStatus");
        parsed.receiver.should.equal("throwing");
        parsed.message.should.equal("broken receiver");
        done();
      });
    });
  });

  it("should continue once when a receiver calls back and throws afterwards", function(done) {
    sinon.stub(config.logger, "error");
    let secondCalls = 0;
    const receiver = new IteratorReceiver({
      callsBackAndThrows: { editComment(_user, _article, _index, _text, cb) { cb(); throw new Error("after callback"); } },
      second: { editComment(_user, _article, _index, _text, cb) { secondCalls++; cb(); } }
    });
    receiver.editComment({}, {}, 0, "text", function() {
      setImmediate(function() {
        should(secondCalls).eql(1);
        done();
      });
    });
  });

  it("should pass sendInfo on to the receivers", function(done) {
    const received = [];
    const receiver = new IteratorReceiver({
      a: { sendInfo(data, cb) { received.push(data); cb(); } }
    });
    receiver.sendInfo({ table: "usert" }, function() {
      setImmediate(function() {
        should(received).eql([{ table: "usert" }]);
        done();
      });
    });
  });
});