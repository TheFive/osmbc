
const AdminPage            = require("../../test/PageObjectModel/adminPage.js");
const MainPage             = require("../../test/PageObjectModel/mainPage.js");
const UserPage             = require("../../test/PageObjectModel/userPage.js");
const BlogPage             = require("../../test/PageObjectModel/blogPage.js");
const ArticlePage          = require("../../test/PageObjectModel/articlePage.js");
const BlogDetailPage       = require("../../test/PageObjectModel/blogDetailPage.js");
const ErrorPage            = require("../../test/PageObjectModel/errorPage.js");
const UserListPage         = require("../../test/PageObjectModel/userListPage.js");
const BlogListPage         = require("../../test/PageObjectModel/blogListPage.js");
const SearchAndCollectPage = require("../../test/PageObjectModel/searchAndCollectPage.js");
const InboxPage            = require("../../test/PageObjectModel/inboxPage.js");
const { osmbcLink }        = require("../../util/util.js");


module.exports = class OsmbcApp {
  constructor(driver) {
    this._driver = driver;
  }

  async openAdminPage() {
    await this._driver.get(osmbcLink("/osmbc/admin"));
  }

  async openMainPage() {
    await this._driver.get(osmbcLink("/osmbc"));
  }

  async openUserListPage(filter) {
    if (!filter) filter = "full";
    await this._driver.get(osmbcLink("/usert/list?access=" + filter));
  }


  getMainPage () {
    return new MainPage(this._driver);
  }

  getAdminPage () {
    return new AdminPage(this._driver);
  }

  getUserPage () {
    return new UserPage(this._driver);
  }

  getErrorPage () {
    return new ErrorPage(this._driver);
  }

  getUserListPage() {
    return new UserListPage(this._driver);
  }

  getBlogListPage() {
    return new BlogListPage(this._driver);
  }

  getBlogPage() {
    return new BlogPage(this._driver);
  }

  getBlogDetailPage() {
    return new BlogDetailPage(this._driver);
  }

  getSearchAndCollectPage() {
    return new SearchAndCollectPage(this._driver);
  }

  getArticlePage() {
    return new ArticlePage(this._driver);
  }

  getInboxPage() {
    return new InboxPage(this._driver);
  }
};
