"use strict;"

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {osmbcLink, sleep} = require("../../util/util.js");
  
const Page = require ('./page.js');
  
class AdminPage extends Page{
  
    constructor(driver) { 
      super(driver);
    }
    async isPage() {
      return (await checkUrl(osmbcLink("/osmbc/admin")))
    }

    async assertPage() {
      await this._assertUrl(osmbcLink("/osmbc/admin"));
    }
    async getFirstHeader() {
      const header = await this._driver.findElement(By.css('h1'));
      return await header.getText();
    }
  }
module.exports = AdminPage;