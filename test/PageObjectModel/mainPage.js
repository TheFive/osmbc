"use strict;"

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {osmbcLink, sleep} = require("../../util/util.js");
  
const Page = require ('./page.js');
  
class MainPage extends Page{
  
    constructor(driver) { 
      super(driver);
    }
    async isPage() {
      return (await checkUrl(osmbcLink("/index")))
    }

    async assertPage() {
      await this._assertUrl([osmbcLink("/index"), osmbcLink("/")]);
    }
    async getFirstHeader() {
      const header = await this._driver.findElement(By.css('h2.d-none.d-sm-block'));
      return await header.getText();
    }
    async clickLinkToAdminPage() { 
      const link = await this._driver.findElement(By.id('adminlink'));
      await link.click();
    }
  }
module.exports = MainPage;