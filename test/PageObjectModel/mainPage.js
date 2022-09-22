"use strict;";

const { By } = require("selenium-webdriver");
const { osmbcLink } = require("../../util/util.js");

const StandardPage = require("./standardPage.js");

class MainPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._checkUrl(osmbcLink("/index")));
  }

  async assertPage() {
    await this._assertUrl([osmbcLink("/index"), osmbcLink("/")]);
  }

  async getFirstHeader() {
    const header = await this._driver.findElement(By.css("h2.d-none.d-sm-block"));
    return await header.getText();
  }

  async clickLinkToAdminPage() {
    const link = await this._driver.findElement(By.id("adminlink"));
    await link.click();
  }

  async getMailAlertText() {
    const mailalert = await this._driver.findElement(By.css("#mailalert > p"));
    return await mailalert.getText();
  }

  async clickBlogInList(blog) {
    await (await this._driver.findElement(By.xpath("//td/a[text()='" + blog + "']"))).click();
  }

  async clickBlogList() {
    await (await this._driver.findElement(By.xpath("//a[text()='(more)']"))).click();
  }
}
module.exports = MainPage;
