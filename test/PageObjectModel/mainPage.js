"use strict;";

import { By, until } from "selenium-webdriver";

import StandardPage from "./standardPage.js";
import util from "../../util/util.js";

const osmbcLink = util.osmbcLink;


class MainPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._checkUrl(osmbcLink("/index")));
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrl([osmbcLink("/index"), osmbcLink("/")]);
  }

  async getFirstHeader() {
    await this.assertPage();
    const header = await this._driver.findElement(By.css("h2.d-none.d-sm-block"));
    return await header.getText();
  }

  async clickLinkToAdminPage() {
    await this.assertPage();
    const link = await this._driver.findElement(By.id("adminlink"));
    await this._clickAndWaitForNavigation(link);
  }

  async hasLinkToAdminPage() {
    await this.assertPage();
    try {
      const link = await this._driver.findElement(By.id("adminlink"));
      if (link) return true;
      return false;
    } catch (err) {
      return false;
    }
  }


  async getMailAlertText() {
    await this.assertPage();
    const mailalert = await this._driver.findElement(By.css("#mailalert"));
    return await mailalert.getText();
  }

  async clickBlogInList(blog) {
    await this.assertPage();
    const blogButton = await this._driver.findElement(By.xpath("//td/a[text()='" + blog + "']"));
    await this._clickAndWaitForNavigation(blogButton);
  }

  async clickBlogList() {
    await this.assertPage();
    await this._clickAndWaitForNavigation(await this._driver.findElement(By.xpath("//a[text()='(more)']")));
  }

  async waitForInitialisation() {
    await this._driver.wait(until.elementLocated(By.css("a#adminlink")), 5000);
    await this.assertPage();
  }
}
export default MainPage;
