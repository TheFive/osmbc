"use strict;";

import { By } from "selenium-webdriver";

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
    await this._assertUrl([osmbcLink("/usert/inbox"), osmbcLink("/")]);
  }

  async clickFirstArticleShown() {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath("//i[contains(@class,'fa-edit')][1]"))).click();
  }
}
export default InboxPage;
