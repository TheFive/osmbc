"use strict;";

const should = require("should");

const { By } = require("selenium-webdriver");


const Page = require("./page.js");

class ErrorPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._driver.findElement(By.css("#errorTitle")) && await this._driver.findElement(By.css("#errorCode")));
  }

  async assertPage() {
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
module.exports = ErrorPage;
