const should = require("should");
     
module.exports = class Page {
    
    constructor(driver) {
      this._driver = driver;
    }
    async _checkUrl(url) {
      return (await this._driver.getCurrentUrl() == url);
    }
    async _assertUrl(url) {
      if (typeof url === "string") {
        should( await this._driver.getCurrentUrl()).eql(url);
      } else {
        should(url).containEql(await this._driver.getCurrentUrl());
      }
    }
    //to go to a URL 
    async open (path) {
        return await driver.get(path);
    }
}