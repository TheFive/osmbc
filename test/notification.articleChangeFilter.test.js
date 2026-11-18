import should from "should";

import filter from "../notification/articleChangeFilter.js";

const editor = { OSMUser: "Editor", access: "full" };
const guest = { OSMUser: "Guest", access: "guest" };

describe("notification/articleChangeFilter (#1170)", function() {
  describe("classifyArticleChange", function() {
    it("should see a new submission", function() {
      should(filter.classifyArticleChange(guest, {}, { collection: "link" })).eql({
        newSubmission: true, collectionChange: false, textLangs: [], byGuest: true
      });
    });
    it("should see a collection change by an editor", function() {
      should(filter.classifyArticleChange(editor, { collection: "old" }, { collection: "new" })).eql({
        newSubmission: false, collectionChange: true, textLangs: [], byGuest: false
      });
    });
    it("should ignore an unchanged collection", function() {
      const kind = filter.classifyArticleChange(editor, { collection: "same" }, { collection: "same" });
      should(kind.newSubmission).be.False();
      should(kind.collectionChange).be.False();
    });
    it("should list the languages of changed texts", function() {
      const kind = filter.classifyArticleChange(guest, { markdownDE: "alt", markdownEN: "same" }, { markdownDE: "neu", markdownEN: "same", markdownES: "nuevo" });
      should(kind.textLangs).eql(["DE", "ES"]);
    });
    it("should not take a missing actor for a guest", function() {
      should(filter.classifyArticleChange(undefined, {}, { collection: "x" }).byGuest).be.False();
    });
  });
  describe("normaliseLevel", function() {
    it("should accept form and channel values", function() {
      should(filter.normaliseLevel("all")).eql("all");
      should(filter.normaliseLevel(true)).eql("all");
      should(filter.normaliseLevel("true")).eql("all");
      should(filter.normaliseLevel("guest")).eql("guest");
      should(filter.normaliseLevel("editor")).eql("editor");
      should(filter.normaliseLevel(false)).eql("off");
      should(filter.normaliseLevel("nonsense")).eql("off");
    });
    it("should use the fallback for a missing value only", function() {
      should(filter.normaliseLevel(undefined, true)).eql("all");
      should(filter.normaliseLevel("", "guest")).eql("guest");
      should(filter.normaliseLevel("off", true)).eql("off");
      should(filter.normaliseLevel(undefined)).eql("off");
    });
  });
  describe("articleChangeWanted", function() {
    const submissionByGuest = { newSubmission: true, collectionChange: false, textLangs: [], byGuest: true };
    const submissionByEditor = { newSubmission: true, collectionChange: false, textLangs: [], byGuest: false };
    const changeByEditor = { newSubmission: false, collectionChange: true, textLangs: [], byGuest: false };
    const textByGuest = { newSubmission: false, collectionChange: false, textLangs: ["DE"], byGuest: true };
    const textByEditor = { newSubmission: false, collectionChange: false, textLangs: ["DE"], byGuest: false };
    it("should filter submissions by level", function() {
      const onlyGuests = { newSubmission: "guest", collectionChange: "off", guestTextChange: false };
      should(filter.articleChangeWanted(submissionByGuest, onlyGuests)).be.True();
      should(filter.articleChangeWanted(submissionByEditor, onlyGuests)).be.False();
      should(filter.articleChangeWanted(changeByEditor, onlyGuests)).be.False();
    });
    it("should filter editor-only submissions and changes", function() {
      const onlyEditors = { newSubmission: "editor", collectionChange: "editor", guestTextChange: false };
      should(filter.articleChangeWanted(submissionByEditor, onlyEditors)).be.True();
      should(filter.articleChangeWanted(submissionByGuest, onlyEditors)).be.False();
      should(filter.articleChangeWanted(changeByEditor, onlyEditors)).be.True();
      should(filter.articleChangeWanted({ ...changeByEditor, byGuest: true }, onlyEditors)).be.False();
    });
    it("should keep submission and change apart", function() {
      const onlyNew = { newSubmission: "all", collectionChange: "off", guestTextChange: false };
      should(filter.articleChangeWanted(submissionByEditor, onlyNew)).be.True();
      should(filter.articleChangeWanted(changeByEditor, onlyNew)).be.False();
      const onlyChanges = { newSubmission: "off", collectionChange: "all", guestTextChange: false };
      should(filter.articleChangeWanted(submissionByEditor, onlyChanges)).be.False();
      should(filter.articleChangeWanted(changeByEditor, onlyChanges)).be.True();
    });
    it("should report text changes of guests only", function() {
      const texts = { newSubmission: "off", collectionChange: "off", guestTextChange: true };
      should(filter.articleChangeWanted(textByGuest, texts)).be.True();
      should(filter.articleChangeWanted(textByEditor, texts)).be.False();
      should(filter.articleChangeWanted(textByGuest, { newSubmission: "all", collectionChange: "all", guestTextChange: false })).be.False();
    });
  });
  describe("settings", function() {
    it("should keep the meaning of the old user setting mailNewCollection", function() {
      should(filter.userArticleSettings({ mailNewCollection: "true" })).eql({ newSubmission: "all", collectionChange: "all", guestTextChange: false });
      should(filter.userArticleSettings({ mailNewCollection: "false" })).eql({ newSubmission: "off", collectionChange: "off", guestTextChange: false });
      should(filter.userArticleSettings({})).eql({ newSubmission: "off", collectionChange: "off", guestTextChange: false });
    });
    it("should prefer the new user settings", function() {
      should(filter.userArticleSettings({ mailNewCollection: "true", notifyNewCollection: "guest", notifyCollectionChange: "off", notifyGuestTextChange: "true" }))
        .eql({ newSubmission: "guest", collectionChange: "off", guestTextChange: true });
    });
    it("should let a channel's collection changes follow notifyNewCollection", function() {
      should(filter.channelArticleSettings({ notifyNewCollection: true })).eql({ newSubmission: "all", collectionChange: "all", guestTextChange: false });
      should(filter.channelArticleSettings({ notifyNewCollection: true, notifyCollectionChange: false })).eql({ newSubmission: "all", collectionChange: "off", guestTextChange: false });
      should(filter.channelArticleSettings({ notifyNewCollection: "guest", notifyGuestTextChange: true })).eql({ newSubmission: "guest", collectionChange: "guest", guestTextChange: true });
    });
    it("should read where a user wants the notifications", function() {
      should(filter.userNotifyVia({})).eql({ mail: true, mattermost: false });
      should(filter.userNotifyVia({ notifyVia: "mattermost" })).eql({ mail: false, mattermost: true });
      should(filter.userNotifyVia({ notifyVia: "both" })).eql({ mail: true, mattermost: true });
    });
  });
});
