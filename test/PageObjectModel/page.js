const should = require("should");
const { Key } = require("selenium-webdriver");

module.exports = class Page {
  constructor(driver) {
    this._driver = driver;
  }

  async _checkUrl(url) {
    return (await this._driver.getCurrentUrl() === url);
  }

  async _assertUrl(url) {
    if (typeof url === "string") {
      should(await this._driver.getCurrentUrl()).eql(url);
    } else {
      should(url).containEql(await this._driver.getCurrentUrl());
    }
  }

  async _assertUrlStartsWith(url) {
    const myUrl = await this._driver.getCurrentUrl();
    if (typeof url === "string") {
      url = [url];
    } else {
      url.forEach(url => { should(url).containEql(myUrl); });
    }
  }

  // to go to a URL
  async open (path) {
    return await this._driver.get(path);
  }

  async getCtrlA() {
    // await this._driver.getCapabilities().getPlatform().toString());
    // const cmdCtrl = await this._driver.getCapabilities().platformName.contains('mac') ? Key.COMMAND : Key.CONTROL;

    // Use Command for Mac, get decision based on platform with a similar solution than in the above comment.
    const cmdCtrl = Key.COMMAND;
    return Key.chord(cmdCtrl, "a");
  }

  async selectTextInField(field, from, to) {
    await field.sendKeys(this.getCtrlA());
    await field.sendKeys(Key.ARROW_LEFT);
    for (let i = 0; i < from; i++) {
      await field.sendKeys(Key.ARROW_RIGHT);
    }
    for (let i = from; i < to; i++) {
      await field.sendKeys(Key.chord(Key.SHIFT, Key.ARROW_RIGHT));
    }
  }
};
