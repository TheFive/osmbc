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
    await this.assertPage();
    const header = await this._driver.findElement(By.css("h2.d-none.d-sm-block"));
    return await header.getText();
  }

  async clickLinkToAdminPage() {
    await this.assertPage();
    const link = await this._driver.findElement(By.id("adminlink"));
    await link.click();
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
    const mailalert = await this._driver.findElement(By.css("#mailalert > p"));
    return await mailalert.getText();
  }

  async clickBlogInList(blog) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath("//td/a[text()='" + blog + "']"))).click();
  }

  async clickBlogList() {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath("//a[text()='(more)']"))).click();
  }

  async   waitForInitialisation() {
    // await this.assertPage();
    // use language 2 element as indicator to have finished page load
    await this._driver.findElement(By.css("a#adminlink"));

  }
}
module.exports = MainPage;
