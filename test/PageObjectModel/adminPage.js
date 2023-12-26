"use strict;";

import { By } from "selenium-webdriver";
import util from "../../util/util.js";
import should from "should";

import Page from "./page.js";

class AdminPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._checkUrl(util.osmbcLink("/osmbc/admin")));
  }

  async assertPage() {
    await this._assertUrl(util.osmbcLink("/osmbc/admin"));
  }

  async getFirstHeader() {
    await this.assertPage();
    const header = await this._driver.findElement(By.css("h1"));
    return await header.getText();
  }

  async clickCreateUserMenu() {
    await this.assertPage();
    // User List Menu
    const menu = await this._driver.findElement(By.xpath('//*[@id="navbarSupportedContent"]/ul[1]/li[1]'));
    await menu.click();
    const link = await this._driver.findElement(By.id("createUser"));
    await link.click();
  }

  async clickCreateBlogMenu(options) {
    await this.assertPage();
    should.exist(options.confirm);
    should(await this.isPage());
    // Tools Menu
    const menu = await this._driver.findElement(By.xpath('//*[@id="navbarSupportedContent"]/ul[1]/li[2]'));
    await menu.click();
    const link = await this._driver.findElement(By.css("a#createblog"));
    await link.click();
    if (options.confirm) {
      const link = await this._driver.findElement(By.id("createBlog"));
      await link.click();
    }
  }
}
export default AdminPage;
