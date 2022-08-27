"use strict;"

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');

const {osmbcLink, sleep} = require("../../util/util.js");
  
const Page = require ('./page.js');
  
class ErrorPage extends Page{
  
    constructor(driver) { 
      super(driver);
    }
    async isPage() {
      return (await checkUrl(osmbcLink("/error")))
    }

    async assertPage() {
      await this._assertUrl(osmbcLink("/error"));
    }
    async getErrorText() {
      const header = await this._driver.findElement(By.css('h1'));
      return await header.getText();
    }
   
  }
module.exports = ErrorPage;