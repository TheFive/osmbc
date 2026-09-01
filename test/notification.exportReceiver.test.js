


import should from "should";
import sinon from "sinon";

import ExportReceiver from "../notification/exportReceiver.js";
import { ExportLogWriterForTestOnly } from "../notification/exportLogWriter.js";

describe("notification/exportReceiver", function () {
  let receiver;
  let infoStub;

  beforeEach(function (bddone) {
    receiver = new ExportReceiver();
    infoStub = sinon.stub(ExportLogWriterForTestOnly.logger, "info");
    return bddone();
  });

  afterEach(function () {
    sinon.restore();
  });

  it("should log to the export log when the change touches exportedBy", function (bddone) {
    const user = { OSMUser: "apikey:hugoPipeline" };
    const blog = { name: "WN1234", exportedBy: {} };
    const change = { exportedBy: { HugoDownload: { DE: "2026-01-01T00:00:00.000Z" } } };

    receiver.updateBlog(user, blog, change, function (err) {
      should.not.exist(err);
      should(infoStub.calledOnce).be.True();
      const entry = infoStub.getCall(0).args[0];
      should(entry.user).equal("apikey:hugoPipeline");
      should(entry.blog).equal("WN1234");
      should(entry.exportProfile).equal("HugoDownload");
      should(entry.lang).equal("DE");
      bddone();
    });
  });

  it("should ignore changes that don't touch exportedBy", function (bddone) {
    const user = { OSMUser: "editor" };
    const blog = { name: "WN1234" };
    const change = { status: "edit" };

    receiver.updateBlog(user, blog, change, function (err) {
      should.not.exist(err);
      should(infoStub.called).be.False();
      bddone();
    });
  });

  it("should only log languages whose marker actually changed", function (bddone) {
    const user = { OSMUser: "apikey:hugoPipeline" };
    const blog = { name: "WN1234", exportedBy: { HugoDownload: { DE: "2025-01-01T00:00:00.000Z" } } };
    const change = { exportedBy: { HugoDownload: { DE: "2025-01-01T00:00:00.000Z", EN: "2026-01-01T00:00:00.000Z" } } };

    receiver.updateBlog(user, blog, change, function (err) {
      should.not.exist(err);
      should(infoStub.calledOnce).be.True();
      should(infoStub.getCall(0).args[0].lang).equal("EN");
      bddone();
    });
  });

  it("should no-op every other receiver method", function (bddone) {
    receiver.sendInfo({}, function (err) {
      should.not.exist(err);
      receiver.updateArticle({}, {}, {}, function (err) {
        should.not.exist(err);
        receiver.sendReviewStatus({}, {}, "DE", "ok", function (err) {
          should.not.exist(err);
          receiver.sendCloseStatus({}, {}, "DE", true, function (err) {
            should.not.exist(err);
            receiver.addComment({}, {}, "text", function (err) {
              should.not.exist(err);
              receiver.editComment({}, {}, 0, "text", function (err) {
                should.not.exist(err);
                bddone();
              });
            });
          });
        });
      });
    });
  });
});
