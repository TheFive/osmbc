"use strict;";

import { By } from "selenium-webdriver";
import { untilStale } from "./page.js";
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
    await this._clickAndWaitForNavigation(await this._driver.findElement(By.id("edit")));
  }

  async selectStatus(status) {
    await this.assertPage();
    await (await this._driver.findElement(By.id("status"))).click();
    await (await this._driver.findElement(By.css(`option[value='${status}']`))).click();
  }

  async clickOK() {
    await this.assertPage();
    const input = await this._driver.findElement(By.css("input[value='OK']"));
    await (input).click();
    await this._driver.wait(untilStale(input));
  }
}

export default BlogDetailPage;
