"use strict;";

import util from "../../util/util.js";

import { By } from "selenium-webdriver";


import StandardPage from "./standardPage.js";

const osmbcLink = util.osmbcLink;

export default class BlogStatisticPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrlStartsWith(osmbcLink("stat.html"));
  }

  async clickStatisticItem(blog, user, datatype) {
    await this.assertPage();


    await (await this._driver.findElement(By.css("a[href='/article/list?blog=" + blog +
    "&user=" + user +
    "&property=" + datatype + "%']"))).click();
  }
}
