import { join } from "path";
import config from "../config.js";
import { strict as assert } from "assert";
import { existsSync } from "fs";
import { createTransport } from "nodemailer";
import pug from "pug";
import { validate } from "email-validator";

import messageCenter from "../notification/messageCenter.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";

import { convert } from "html-to-text";



import winston from "winston";
import "winston-daily-rotate-file";



import UserConfigFilter from "../notification/UserConfigFilter.js";
import { classifyArticleChange, userNotifyVia } from "../notification/articleChangeFilter.js";
import { createMattermostUserReceiver } from "../notification/mattermostUserReceiver.js";
import { suppressMigrationNotifications } from "../notification/migrationFilter.js";

import IteratorReceiver from "../notification/IteratorReceiver.js";
import _debug from "debug";
const debug = _debug("OSMBC:notification:mailReceiver");

let logDir = config.getValue("maillog_directory", { mustExist: true });
const logNamePrefix = config.getValue("maillog_prefix", { mustExist: true });
const logNameDateFormat = config.getValue("maillog_dateformat", { mustExist: true });
if (logDir === ".") logDir = join(config.getDirName(), "..");


if (!(existsSync(logDir))) {
  console.error("Missing Directory (maillog_directory) %s", logDir);
  process.exit(1);
}



const transport = new winston.transports.DailyRotateFile({
  filename: logNamePrefix,
  dirname: logDir,
  datePattern: logNameDateFormat,
  level: process.env.ENV === "development" ? "info" : "info"
});

const logger =  winston.createLogger({
  transports: [
    transport
  ]
});



const infoMailtemplateDir = join(config.getDirName(), "email", "infomail");
const infoMailBlogtemplateDir = join(config.getDirName(), "email", "infomailBlog");
const infoMailReviewtemplateDir = join(config.getDirName(), "email", "infomailReview");
const infoMailClosetemplateDir = join(config.getDirName(), "email", "infomailClose");
const welcomeMailtemplateDir = join(config.getDirName(), "email", "welcome");

const transporter = createTransport(config.getValue("SMTP"));

const layout = {
  htmlroot: config.htmlRoot(),
  url: config.getValue("url")
};

// Like Express' "view cache": compiled once in production. renderFile is
// synchronous, and a comment can send a mail to dozens of users, so
// compiling for every mail blocks the server for all other requests.
const cacheMailTemplates = process.env.NODE_ENV === "production";

function renderPugTemplate(templateDir, templateName, data) {
  const templatePath = join(templateDir, templateName);
  return Promise.resolve(pug.renderFile(templatePath, Object.assign({}, data, { cache: cacheMailTemplates })));
}





function sendMailWithLog(user, mailOptions, callback) {
  debug("sendMailWithLog");

  function logMail(error, info) {
    debug("logMail Error response");
    const logObject = {
      user: user.OSMUser,
      table: "mail",
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      error: error,
      response: (info) ? info.response : "no response"
    };

    logger.info({ user: logObject.user, to: logObject.to, message: logObject.subject, error: logObject.error, response: logObject.response });
    callback();
  }
  // for development Reasons, filter Mail Address
  const allowedMailAddresses = config.getValue("AllowedMailAddresses");
  if (allowedMailAddresses) {
    if (allowedMailAddresses.indexOf(mailOptions.to) < 0) return logMail(null, { response: "Blocked by " + config.getValue("AppName") });
  }

  const appName = config.getValue("AppName");
  if (appName) mailOptions.subject = "[" + appName + "] " + mailOptions.subject;
  transporter.sendMail(mailOptions, logMail);
}

class MailReceiver {
  constructor(user) {
    debug("MailReceiver");
    this.invalidMail = true;
    this.user = user;
    if (validate(user.email)) {
      this.invalidMail = false;
    }
  }

  /**
   * A changed user or configuration: no mail for it.
   * @param {object} data the change log entry
   * @param {function(Error=)} callback called at once
   */
  sendInfo(data, callback) {
    return callback();
  }

  sendWelcomeMail(inviter, callback) {
    debug("MailReceiver::sendWelcomeMail");

    const self = this;
    const data = { user: this.user, inviter: inviter, layout: layout };

    renderPugTemplate(welcomeMailtemplateDir, "welcome html.pug", data).then(function welcomemailRender(result) {
      debug("welcomemailRender");

      const text = convert(result, { tables: ["#valuetable"] });

      const mailOptions = {
        from: config.getValue("EmailSender"), // sender address
        to: self.user.emailInvalidation, // list of receivers
        subject: "Welcome to OSMBC", // Subject line
        text: text,
        html: result
      };

      // send mail with defined transport object
      sendMailWithLog(self.user, mailOptions, callback);
    }).catch(callback);
  }

  sendReviewStatus(user, blog, lang, status, callback) {
    debug("MailReceiver::sendReviewStatus");
    if (this.invalidMail) return callback();
    const self = this;


    let subject = blog.name + "(" + lang + ") has been reviewed by user " + user.OSMUser;
    if (status === "startreview") {
      subject = blog.name + "(" + lang + ") is ready for proofreading";
    }
    if (status === "markexported") {
      subject = blog.name + "(" + lang + ") is exported to WordPress";
    }
    if (status === "reviewing...") return callback();

    const data = { user: user, blog: blog, status: status, lang: lang, layout: layout };

    renderPugTemplate(infoMailReviewtemplateDir, "infomailReview html.pug", data).then(function infomailRenderBlog(result) {
      debug("infomailRenderInfo");

      const text = convert(result, { tables: ["#valuetable"] });

      const mailOptions = {
        from: config.getValue("EmailSender"), // sender address
        to: self.user.email, // list of receivers
        subject: subject, // Subject line
        text: text,
        html: result
      };

      // send mail with defined transport object
      sendMailWithLog(self.user, mailOptions, callback);
    }).catch(callback);
  }

  /**
   * Auto Close could not close a reviewed language (issue #1130).
   * @param {object} user actor of the rule
   * @param {object} blog the blog
   * @param {string} lang language id
   * @param {string[]} problems messages for the editors
   * @param {function(Error=)} cb called when done
   */
  sendCloseBlocked(user, blog, lang, problems, cb) {
    debug("MailReceiver::sendCloseBlocked");
    return cb();
  }

  sendCloseStatus(user, blog, lang, status, callback) {
    debug("MailReceiver::sendCloseStatus");
    if (this.invalidMail) return callback();
    const self = this;


    let subject = blog.name + "(" + lang + ") has been closed by user " + user.OSMUser;
    if (status === false) {
      subject = blog.name + "(" + lang + ") has been reopened by " + user.OSMUser;
    }

    const data = { user: user, blog: blog, status: status, lang: lang, layout: layout };

    renderPugTemplate(infoMailClosetemplateDir, "infomailClose html.pug", data).then(function infomailRenderClose(result) {
      debug("infomailRenderClose");

      const text = convert(result, { tables: ["#valuetable"] });

      const mailOptions = {
        from: config.getValue("EmailSender"), // sender address
        to: self.user.email, // list of receivers
        subject: subject, // Subject line
        text: text,
        html: result
      };

      // send mail with defined transport object
      sendMailWithLog(self.user, mailOptions, callback);
    }).catch(callback);
  }

  updateArticle(user, article, change, callback) {
    debug("MailReceiver::updateArticle");
    if (this.invalidMail) return callback();
    assert(typeof (change) === "object");


    const self = this;
    const newArticle = articleModule.create();
    let k;
    for (k in article) {
      newArticle[k] = article[k];
      if (change[k]) newArticle[k] = change[k];
    }
    for (k in change) {
      newArticle[k] = change[k];
    }


    let subject;
    let logblog = article.blog;
    if (change.blog) logblog = change.blog;

    const kind = classifyArticleChange(user, article, change);
    if (kind.textLangs.length > 0) {
      subject = logblog + " text (" + kind.textLangs.join(", ") + ") changed: " + newArticle.title;
    }
    if (!article.collection && change.collection) {
      subject = logblog + " added: " + newArticle.title;
    }
    if (article.collection && change.collection) {
      subject = logblog + " changed: " + newArticle.title;
    }
    if (!subject) subject = logblog + " changed: " + newArticle.title;
    if (kind.byGuest) subject += " (guest " + user.OSMUser + ")";


    const data = { user: this.user, changeby: user, article: article, newArticle: newArticle, layout: layout, logblog: logblog };

    renderPugTemplate(infoMailtemplateDir, "infomail html.pug", data).then(function infomailRender(result) {
      debug("infomailRender");
      const text = convert(result, { tables: ["#valuetable"] });

      const mailOptions = {
        from: config.getValue("EmailSender"), // sender address
        to: self.user.email, // list of receivers
        subject: subject, // Subject line
        text: text,
        html: result
      };

      // send mail with defined transport object
      sendMailWithLog(self.user, mailOptions, callback);
    }).catch(callback);
  }

  addComment(user, article, text, callback) {
    debug("MailReceiver::addComment");
    if (this.invalidMail) return callback();
    assert(typeof (text) === "string");


    const self = this;
    const newArticle = articleModule.create();
    let k;
    for (k in article) {
      newArticle[k] = article[k];
    }

    const logblog = article.blog;
    const subject = logblog + " comment: " + newArticle.title;


    const data = { user: this.user, changeby: user, article: article, newArticle: newArticle, layout: layout, logblog: logblog, addedComment: text };

    renderPugTemplate(infoMailtemplateDir, "infomail html.pug", data).then(function infomailRender(result) {
      debug("infomailRender");
      const text = convert(result, { tables: ["#valuetable"] });

      const mailOptions = {
        from: config.getValue("EmailSender"), // sender address
        to: self.user.email, // list of receivers
        subject: subject, // Subject line
        text: text,
        html: result
      };

      // send mail with defined transport object
      sendMailWithLog(self.user, mailOptions, callback);
    }).catch(callback);
  }

  editComment(user, article, index, text, callback) {
    debug("MailReceiver::addComment");
    if (this.invalidMail) return callback();
    assert(typeof (text) === "string");


    const self = this;
    const newArticle = articleModule.create();
    const oldArticle = articleModule.create();
    let k;
    for (k in article) {
      newArticle[k] = article[k];
      oldArticle[k] = article[k];
    }

    const logblog = article.blog;
    const subject = logblog + " comment: " + newArticle.title;


    const data = { user: this.user, changeby: user, article: oldArticle, newArticle: newArticle, layout: layout, logblog: logblog, editedComment: text };

    renderPugTemplate(infoMailtemplateDir, "infomail html.pug", data).then(function infomailRender(result) {
      debug("infomailRender");
      const text = convert(result, { tables: ["#valuetable"] });

      const mailOptions = {
        from: config.getValue("EmailSender"), // sender address
        to: self.user.email, // list of receivers
        subject: subject, // Subject line
        text: text,
        html: result
      };

      // send mail with defined transport object
      sendMailWithLog(self.user, mailOptions, callback);
    }).catch(callback);
  }

  updateBlog(user, blog, change, callback) {
    debug("MailReceiver::updateBlog");
    if (this.invalidMail) return callback();

    const self = this;
    const newBlog = blogModule.create();
    let k;
    for (k in blog) {
      newBlog[k] = blog[k];
      if (change[k]) newBlog[k] = change[k];
    }
    for (k in change) {
      newBlog[k] = change[k];
    }


    let subject;
    let blogName = blog.name;
    if (change.name) blogName = change.name;

    if (!blog.name && change.name) {
      subject = blogName + " was created";
    } else {
      subject = blogName + " changed status to " + newBlog.status;
    }


    const data = { user: this.user, changeby: user, blog: blog, newBlog: newBlog, layout: layout, blogName: blogName };

    renderPugTemplate(infoMailBlogtemplateDir, "infomailBlog html.pug", data).then(function infomailRenderBlog(result) {
      debug("infomailRenderBlog");
      const text = convert(result, { tables: ["#valuetable"] });

      const mailOptions = {
        from: config.getValue("EmailSender"), // sender address
        to: self.user.email, // list of receivers
        subject: subject, // Subject line
        text: text,
        html: result
      };

      // send mail with defined transport object
      sendMailWithLog(self.user, mailOptions, callback);
    }).catch(callback);
  }
}


const iteratorReceiver = new IteratorReceiver({});
let userReceiverMap = {};
let registered = false;

function initialise(userList) {
  debug("initialise");
  messageCenter.initialise();
  userReceiverMap = {};
  // Ensure old receiver references are dropped immediately.
  iteratorReceiver.receiverMap = userReceiverMap;
  for (let i = 0; i < userList.length; i++) {
    const u = userList[i];
    mailReceiverUpdateUser(u);
  }
  assert(messageCenter.global);
  if (!registered) {
    messageCenter.global.registerReceiver(suppressMigrationNotifications(iteratorReceiver));
    registered = true;
  }
}


/**
 * (Re)creates the notification receivers of one user after a change of
 * the user: mail (to the mail address) and Mattermost direct message (to
 * the Mattermost User), as chosen in notifyVia (issue #1170).
 * @param {object} user the saved user
 */
export function mailReceiverUpdateUser(user) {
  debug("mailReceiverUpdateUser");
  delete userReceiverMap[user.OSMUser];
  delete userReceiverMap[user.OSMUser + " (Mattermost)"];
  iteratorReceiver.receiverMap = userReceiverMap;
  if (user.access !== "full" && user.access !== "guest") return;
  const mattermost = createMattermostUserReceiver(user);
  if (mattermost) userReceiverMap[user.OSMUser + " (Mattermost)"] = mattermost;
  if (!userNotifyVia(user).mail) return;
  if (!user.email) return;
  if (user.email.trim() === "") return;
  userReceiverMap[user.OSMUser] = new UserConfigFilter(user, new MailReceiver(user));
}


const _MailReceiver = MailReceiver;
export { _MailReceiver as MailReceiver };
export { initialise as initialiseMailReceiver };

export const MailReceiverForTestOnly = { transporter: transporter, logger: config.logger };


// setup e-mail data with unicode symbols
