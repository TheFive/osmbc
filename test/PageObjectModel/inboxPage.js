"use strict;";

import { By, until } from "selenium-webdriver";

import StandardPage from "./standardPage.js";

import util from "../../util/util.js";

const osmbcLink = util.osmbcLink;


class InboxPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._checkUrl(osmbcLink("/usert/inbox")));
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrl([osmbcLink("/usert/inbox"), osmbcLink("/")]);
  }

  // small screens: the envelope of the first unread comment
  async clickMarkFirstCommentRead() {
    await this.assertPage();
    const envelope = await this._driver.findElement(By.css("a[aria-label='Mark as read']"));
    await this.tap(envelope);
    await this._driver.wait(until.stalenessOf(envelope), 3000, "inbox not reloaded");
  }

  async countUnreadComments() {
    return (await this._driver.findElements(By.css("a[aria-label='Mark as read']"))).length;
  }

  async clickFirstArticleShown() {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath("//i[contains(@class,'fa-edit')][1]"))).click();
  }
}
export default InboxPage;
