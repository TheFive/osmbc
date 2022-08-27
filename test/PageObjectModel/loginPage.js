"use strict;"

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const {osmbcLink, sleep} = require("../../util/util.js");
  
const Page = require ('../../test/PageObjectModel/page.js');
  
class LoginPage extends Page{
  
    constructor(driver) { 
      super(driver);
    }

    async isPage() {
      return (await this._checkUrl(osmbcLink("/htaccess/login")))
    }
    async assertPage() {
      await this._assertUrl(osmbcLink("/htaccess/login"));
    }
   
    async typeUsername(userName) {
      await this._driver.findElement(By.id("username")).sendKeys(userName);
    }
    async typePassword(password) {
      await this._driver.findElement(By.id("password")).sendKeys(password);
    }
    async clickOK() {
      await(await this._driver.findElement(By.id("submitbutton"))).click();
    }
  }
module.exports = LoginPage;