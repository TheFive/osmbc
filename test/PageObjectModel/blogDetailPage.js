"use strict;";

import { By, until} from "selenium-webdriver";
import util from "../../util/util.js";

import StandardPage from "./standardPage.js";

class BlogDetailPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrlStartsWith(util.osmbcLink("/blog/edit"));
  }

  async clickEdit() {
    await this.assertPage();
    await (await this._driver.findElement(By.id("edit"))).click();
  }

  async selectStatus(status) {
    await this.assertPage();
    await (await this._driver.findElement(By.id("status"))).click();
    await (await this._driver.findElement(By.css("option[value='edit']"))).click();
  }

  async clickOK() {
    await this.assertPage();
    const input = await this._driver.findElement(By.css("input[value='OK']"));
    await (input).click();
    await this._driver.wait(until.stalenessOf(input));
  }
}

export default BlogDetailPage;
