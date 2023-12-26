import { join } from "path";
import config from "../config.js";
import { strict as assert } from "assert";
import { existsSync } from "fs";
import { createTransport } from "nodemailer";
import Email from "email-templates";
import { validate } from "email-validator";

import messageCenter from "../notification/messageCenter.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";

import { convert } from "html-to-text";



import winston from "winston";
import "winston-daily-rotate-file";



import UserConfigFilter from "../notification/UserConfigFilter.js";

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
const infomail = new Email({
  views: { root: infoMailtemplateDir }
});

const infoMailBlogtemplateDir = join(config.getDirName(), "email", "infomailBlog");
const infomailBlog = new Email({ views: { root: infoMailBlogtemplateDir } });

const infoMailReviewtemplateDir = join(config.getDirName(), "email", "infomailReview");
const infomailReview = new Email({ views: { root: infoMailReviewtemplateDir } });

const infoMailClosetemplateDir = join(config.getDirName(), "email", "infomailClose");
const infomailClose = new Email({ views: { root: infoMailClosetemplateDir } });

const welcomeMailtemplateDir = join(config.getDirName(), "email", "welcome");
const welcomemail = new Email({ views: { root: welcomeMailtemplateDir } });

const transporter = createTransport(config.getValue("SMTP"));

const layout = {
  htmlroot: config.htmlRoot(),
  url: config.getValue("url")
};





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

function MailReceiver(user) {
  debug("MailReceiver");
  this.invalidMail = true;
  this.user = user;
  if (validate(user.email)) {
    this.invalidMail = false;
  }
}

MailReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter, callback) {
  debug("MailReceiver.prototype.sendWelcomeMail");

  const self = this;
  const data = { user: this.user, inviter: inviter, layout: layout };

  welcomemail.render("welcome html.pug", data).then(function welcomemailRender(result) {
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
};

MailReceiver.prototype.sendReviewStatus = function sendReviewStatus(user, blog, lang, status, callback) {
  debug("MailReceiver.prototype.sendReviewStatus");
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

  infomailReview.render("infomailReview html.pug", data).then(function infomailRenderBlog(result) {
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
};

MailReceiver.prototype.sendCloseStatus = function sendCloseStatus(user, blog, lang, status, callback) {
  debug("MailReceiver.prototype.sendCloseStatus");
  if (this.invalidMail) return callback();
  const self = this;


  let subject = blog.name + "(" + lang + ") has been closed by user " + user.OSMUser;
  if (status === false) {
    subject = blog.name + "(" + lang + ") has been reopened by " + user.OSMUser;
  }

  const data = { user: user, blog: blog, status: status, lang: lang, layout: layout };

  infomailClose.render("infomailClose html.pug", data).then(function infomailRenderClose(result) {
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
};

MailReceiver.prototype.updateArticle = function updateArticle(user, article, change, callback) {
  debug("MailReceiver.prototype.updateArticle");
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

  if (!article.collection && change.collection) {
    subject = logblog + " added: " + newArticle.title;
  }
  if (article.collection && change.collection) {
    subject = logblog + " changed: " + newArticle.title;
  }


  const data = { user: this.user, changeby: user, article: article, newArticle: newArticle, layout: layout, logblog: logblog };

  infomail.render("infomail html.pug", data).then(function infomailRender(result) {
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
};

MailReceiver.prototype.addComment = function addComment(user, article, text, callback) {
  debug("MailReceiver.prototype.addComment");
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

  infomail.render("infomail html.pug", data).then(function infomailRender(result) {
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
};

MailReceiver.prototype.editComment = function editComment(user, article, index, text, callback) {
  debug("MailReceiver.prototype.addComment");
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

  infomail.render("infomail html.pug", data).then(function infomailRender(result) {
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
};

MailReceiver.prototype.updateBlog = function updateBlog(user, blog, change, callback) {
  debug("MailReceiver.prototype.updateBlog");
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

  infomailBlog.render("infomailBlog html.pug", data).then(function infomailRenderBlog(result) {
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
};
const iteratorReceiver = new IteratorReceiver({});
let userReceiverMap = {};

/*
function MailUserReceiver() {
  debug('MailUserReceiver');
}

MailUserReceiver.prototype.sendReviewStatus = function sendReviewStatus(user,blog,lang,status,callback) {
  debug('MailUserReceiver.prototype.sendReviewStatus');
  async.eachOf(userReceiverMap,function(value,key,cb) {
    value.sendReviewStatus(user,blog,lang,status,cb);
  },function(err) {
    return callback(err);
  });
};

MailUserReceiver.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,callback) {
  debug('MailUserReceiver.prototype.sendCloseStatus');
  async.eachOf(userReceiverMap,function(value,key,cb) {
    value.sendCloseStatus(user,blog,lang,status,cb);
  },function(err) {
    return callback(err);
  });
};

MailUserReceiver.prototype.updateArticle = function murUpdateArticle(user,article,change,callback) {
  debug('MailUserReceiver.prototype.updateArticle');
  async.eachOf(userReceiverMap,function(value,key,cb) {
    debug('forEachOf'+key);
    value.updateArticle(user,article,change,cb);
  },function(err) {
    return callback(err);
  });
};
MailUserReceiver.prototype.addComment = function addComment(user,article,comment,callback) {
  debug('MailUserReceiver.prototype.addComment');
  async.eachOf(userReceiverMap,function(value,key,cb) {
    debug('forEachOf'+key);
    value.addComment(user,article,comment,cb);
  },function(err) {
    return callback(err);
  });
};
MailUserReceiver.prototype.editComment = function editComment(user,article,index,comment,callback) {
  debug('MailUserReceiver.prototype.editComment');
  async.eachOf(userReceiverMap,function(value,key,cb) {
    debug('forEachOf'+key);
    value.editComment(user,article,index,comment,cb);
  },function(err) {
    return callback(err);
  });
};
MailUserReceiver.prototype.updateBlog = function murUpdateBlog(user,blog,change,callback) {
  debug('MailUserReceiver.prototype.updateBlog');
  async.eachOf(userReceiverMap,function(value,key,cb) {
    debug('forEachOf'+key);
    value.updateBlog(user,blog,change,cb);
  },function(err) {
    return callback(err);
  });
};

MailUserReceiver.prototype.sendInfo = function sendInfo(data,cb) {
  debug("MailUserReceiver.prototype.sendInfo");
  return cb();
}; */

let registered = false;

function initialise(userList) {
  debug("initialise");
  messageCenter.initialise();
  userReceiverMap = {};
  for (let i = 0; i < userList.length; i++) {
    const u = userList[i];
    mailReceiverUpdateUser(u);
  }
  assert(messageCenter.global);
  if (!registered) {
    messageCenter.global.registerReceiver(iteratorReceiver);
    registered = true;
  }
}


export function mailReceiverUpdateUser(user) {
  debug("mailReceiverUpdateUser");
  delete userReceiverMap[user.OSMUser];
  if (user.access !== "full" && user.access !== "guest") return;
  if (!user.email) return;
  if (user.email.trim() === "") return;
  userReceiverMap[user.OSMUser] = new UserConfigFilter(user, new MailReceiver(user));
  iteratorReceiver.receiverMap = userReceiverMap;
}


const _MailReceiver = MailReceiver;
export { _MailReceiver as MailReceiver };
export { initialise as initialiseMailReceiver };

export const MailReceiverForTestOnly = { transporter: transporter, logger: config.logger };


// setup e-mail data with unicode symbols
