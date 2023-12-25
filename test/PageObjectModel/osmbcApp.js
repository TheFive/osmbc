
import AdminPage from "../../test/PageObjectModel/adminPage.js";
import MainPage from "../../test/PageObjectModel/mainPage.js";
import UserPage from "../../test/PageObjectModel/userPage.js";
import BlogPage from "../../test/PageObjectModel/blogPage.js";
import ArticlePage from "../../test/PageObjectModel/articlePage.js";
import BlogDetailPage from "../../test/PageObjectModel/blogDetailPage.js";
import ErrorPage from "../../test/PageObjectModel/errorPage.js";
import UserListPage from "../../test/PageObjectModel/userListPage.js";
import BlogListPage from "../../test/PageObjectModel/blogListPage.js";
import SearchAndCollectPage from "../../test/PageObjectModel/searchAndCollectPage.js";
import InboxPage from "../../test/PageObjectModel/inboxPage.js";
import util from "../../util/util.js";

const osmbcLink = util.osmbcLink;


export default class OsmbcApp {
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
