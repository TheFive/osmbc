"use strict;";

import should from "should";

import { By } from "selenium-webdriver";


import Page from "./page.js";

class ErrorPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._driver.findElement(By.css("#errorTitle")) && await this._driver.findElement(By.css("#errorCode")));
  }

  async assertPage() {
    await super.assertPage();
    should(this.isPage());
  }

  async getErrorTitle() {
    const header = await this._driver.findElement(By.css("#errorTitle"));
    return await header.getText();
  }

  async getErrorCode() {
    const header = await this._driver.findElement(By.css("#errorCode"));
    return await header.getText();
  }
}

export default ErrorPage;
