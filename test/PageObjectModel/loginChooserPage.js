"use strict;"

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

const {osmbcLink, sleep} = require("../../util/util.js");
  
const Page = require ('./page.js');
  
class LoginChooserPage extends Page{
  
    constructor(driver) { 
      super(driver);
    }
    async isPage() {
      return (await checkUrl(osmbcLink("/login")))
    }

    async assertPage() {
      await this._assertUrl(osmbcLink("/login"));
    }
    async clickHtAccessLogin() {
      const button = await this._driver.findElement(By.id('htaccesLoginButton'));
      await button.click();
    }
  }
module.exports = LoginChooserPage;