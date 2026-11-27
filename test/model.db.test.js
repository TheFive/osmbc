import should from "should";
import db from "../model/db.js";

describe("model/db", function() {
  describe("valuesForLog", function() {
    it("should show plain values", function() {
      should(db.valuesForLog(["WN100", 3])).eql('["WN100",3]');
    });
    it("should mask secret fields of saved objects", function() {
      const user = { OSMUser: "TheFive", apiKey: "secret", email: "a@b.c", emailValidationKey: "k" };
      should(db.valuesForLog(["1", user])).eql('["1",{"OSMUser":"TheFive","apiKey":"(hidden)","email":"(hidden)","emailValidationKey":"(hidden)"}]');
    });
    it("should leave out values marked hideInLog", function() {
      const values = ["secret"];
      values.hideInLog = true;
      should(db.valuesForLog(values)).eql("(hidden)");
    });
  });
});
