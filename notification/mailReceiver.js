"use strict";

var path          = require("path");
var config        = require("../config.js");
var should        = require("should");
var debug         = require("debug")("OSMBC:notification:mailReceiver");
var fs            = require("fs");
var nodemailer    = require("nodemailer");
var EmailTemplate = require("email-templates").EmailTemplate;
var emailValidator = require("email-validator");

var messageCenter = require("../notification/messageCenter.js");
var articleModule = require("../model/article.js");
var blogModule    = require("../model/blog.js");

var htmlToText    = require("html-to-text");



var winston = require("winston");
require("winston-daily-rotate-file");

let logDir = config.getValue("maillog_directory", {mustExist: true});
let logNamePrefix = config.getValue("maillog_prefix", {mustExist: true});
let logNameDateFormat = config.getValue("maillog_dateformat", {mustExist: true});
if (logDir === ".") logDir = path.join(__dirname, "..");


if (!(fs.existsSync(logDir))) {
  console.err("Missing Directory (maillog_directory) %s", logDir);
  process.exit(1);
}



var transport = new winston.transports.DailyRotateFile({
  filename: logNamePrefix,
  dirname: logDir,
  datePattern: logNameDateFormat,
  level: process.env.ENV === "development" ? "debug" : "info"
});

var logger = new (winston.Logger)({
  transports: [
    transport
  ]
});



var UserConfigFilter = require("../notification/UserConfigFilter.js");

var IteratorReceiver = require("../notification/IteratorReceiver.js");



var infoMailtemplateDir = path.join(__dirname, "..", "email", "infomail");
var infomail = new EmailTemplate(infoMailtemplateDir);

var infoMailBlogtemplateDir = path.join(__dirname, "..", "email", "infomailBlog");
var infomailBlog = new EmailTemplate(infoMailBlogtemplateDir);

var infoMailReviewtemplateDir = path.join(__dirname, "..", "email", "infomailReview");
var infomailReview = new EmailTemplate(infoMailReviewtemplateDir);

var infoMailClosetemplateDir = path.join(__dirname, "..", "email", "infomailClose");
var infomailClose = new EmailTemplate(infoMailClosetemplateDir);

var welcomeMailtemplateDir = path.join(__dirname, "..", "email", "welcome");
var welcomemail = new EmailTemplate(welcomeMailtemplateDir);

var transporter = nodemailer.createTransport(config.getValue("SMTP"));

var layout = {
  htmlroot: config.htmlRoot(),
  url: config.getValue("url")
};





function sendMailWithLog(user, mailOptions, callback) {
  debug("sendMailWithLog");

  function logMail(error, info) {
    debug("logMail Error response");
    var logObject = {
      user: user.OSMUser,
      table: "mail",
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      error: error,
      response: (info) ? info.response : "no response"
    };

    logger.info({user: logObject.user, to: logObject.to, message: logObject.subject, error: logObject.error, response: logObject.response});
    callback();
  }
  // for development Reasons, filter Mail Address
  var allowedMailAddresses = config.getValue("AllowedMailAddresses");
  if (allowedMailAddresses) {
    if (allowedMailAddresses.indexOf(mailOptions.to) < 0) return logMail(null, {response: "Blocked by " + config.getValue("AppName")});
  }

  var appName = config.getValue("AppName");
  if (appName) mailOptions.subject = "[" + appName + "] " + mailOptions.subject;
  transporter.sendMail(mailOptions, logMail);
}

function MailReceiver(user) {
  debug("MailReceiver");
  this.invalidMail = true;
  this.user = user;
  if (emailValidator.validate(user.email)) {
    this.invalidMail = false;
  }
}

MailReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter, callback) {
  debug("MailReceiver.prototype.sendWelcomeMail");

  var self = this;
  var data = {user: this.user, inviter: inviter, layout: layout};

  welcomemail.render(data, function welcomemailRender (err, results) {
    debug("welcomemailRender");
    if (err) return callback(err);

    results.text = htmlToText.fromString(results.html, {tables: ["#valuetable"]});

    var mailOptions = {
      from: config.getValue("EmailSender"), // sender address
      to: self.user.emailInvalidation, // list of receivers
      subject: "Welcome to OSMBC", // Subject line
      text: results.text,
      html: results.html
    };

    // send mail with defined transport object
    sendMailWithLog(self.user, mailOptions, callback);
  });
};

MailReceiver.prototype.sendReviewStatus = function sendReviewStatus(user, blog, lang, status, callback) {
  debug("MailReceiver.prototype.sendReviewStatus");
  if (this.invalidMail) return callback();
  var self = this;


  var subject = blog.name + "(" + lang + ") has been reviewed by user " + user.OSMUser;
  if (status === "startreview") {
    subject = blog.name + "(" + lang + ") is ready for proofreading";
  }
  if (status === "markexported") {
    subject = blog.name + "(" + lang + ") is exported to WordPress";
  }
  if (status === "reviewing...") return callback();

  var data = {user: user, blog: blog, status: status, lang: lang, layout: layout};

  infomailReview.render(data, function infomailRenderBlog(err, results) {
    debug("infomailRenderInfo");
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html, {tables: ["#valuetable"]});

    var mailOptions = {
      from: config.getValue("EmailSender"), // sender address
      to: self.user.email, // list of receivers
      subject: subject, // Subject line
      text: results.text,
      html: results.html
    };

    // send mail with defined transport object
    sendMailWithLog(self.user, mailOptions, callback);
  });
};

MailReceiver.prototype.sendCloseStatus = function sendCloseStatus(user, blog, lang, status, callback) {
  debug("MailReceiver.prototype.sendCloseStatus");
  if (this.invalidMail) return callback();
  var self = this;


  var subject = blog.name + "(" + lang + ") has been closed by user " + user.OSMUser;
  if (status === false) {
    subject = blog.name + "(" + lang + ") has been reopened by " + user.OSMUser;
  }

  var data = {user: user, blog: blog, status: status, lang: lang, layout: layout};

  infomailClose.render(data, function infomailRenderClose(err, results) {
    debug("infomailRenderClose");
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html, {tables: ["#valuetable"]});

    var mailOptions = {
      from: config.getValue("EmailSender"), // sender address
      to: self.user.email, // list of receivers
      subject: subject, // Subject line
      text: results.text,
      html: results.html
    };

    // send mail with defined transport object
    sendMailWithLog(self.user, mailOptions, callback);
  });
};

MailReceiver.prototype.updateArticle = function updateArticle(user, article, change, callback) {
  debug("MailReceiver.prototype.updateArticle");
  if (this.invalidMail) return callback();
  should(typeof (change)).eql("object");


  var self = this;
  var newArticle = articleModule.create();
  var k;
  for (k in article) {
    newArticle[k] = article[k];
    if (change[k]) newArticle[k] = change[k];
  }
  for (k in change) {
    newArticle[k] = change[k];
  }


  var subject;
  var logblog = article.blog;
  if (change.blog) logblog = change.blog;

  if (!article.collection && change.collection) {
    subject = logblog + " added: " + newArticle.title;
  }
  if (article.collection && change.collection) {
    subject = logblog + " changed: " + newArticle.title;
  }


  var data = {user: this.user, changeby: user, article: article, newArticle: newArticle, layout: layout, logblog: logblog};

  infomail.render(data, function infomailRender(err, results) {
    debug("infomailRender");
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html, {tables: ["#valuetable"]});

    var mailOptions = {
      from: config.getValue("EmailSender"), // sender address
      to: self.user.email, // list of receivers
      subject: subject, // Subject line
      text: results.text,
      html: results.html
    };

    // send mail with defined transport object
    sendMailWithLog(self.user, mailOptions, callback);
  });
};

MailReceiver.prototype.addComment = function addComment(user, article, text, callback) {
  debug("MailReceiver.prototype.addComment");
  if (this.invalidMail) return callback();
  should(typeof (text)).eql("string");


  var self = this;
  var newArticle = articleModule.create();
  var k;
  for (k in article) {
    newArticle[k] = article[k];
  }

  var logblog = article.blog;
  var subject = logblog + " comment: " + newArticle.title;


  var data = {user: this.user, changeby: user, article: article, newArticle: newArticle, layout: layout, logblog: logblog, addedComment: text};

  infomail.render(data, function infomailRender(err, results) {
    debug("infomailRender");
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html, {tables: ["#valuetable"]});

    var mailOptions = {
      from: config.getValue("EmailSender"), // sender address
      to: self.user.email, // list of receivers
      subject: subject, // Subject line
      text: results.text,
      html: results.html
    };

    // send mail with defined transport object
    sendMailWithLog(self.user, mailOptions, callback);
  });
};

MailReceiver.prototype.editComment = function editComment(user, article, index, text, callback) {
  debug("MailReceiver.prototype.addComment");
  if (this.invalidMail) return callback();
  should(typeof (text)).eql("string");


  var self = this;
  var newArticle = articleModule.create();
  var oldArticle = articleModule.create();
  var k;
  for (k in article) {
    newArticle[k] = article[k];
    oldArticle[k] = article[k];
  }

  var logblog = article.blog;
  var subject = logblog + " comment: " + newArticle.title;


  var data = {user: this.user, changeby: user, article: oldArticle, newArticle: newArticle, layout: layout, logblog: logblog, editedComment: text};

  infomail.render(data, function infomailRender(err, results) {
    debug("infomailRender");
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html, {tables: ["#valuetable"]});

    var mailOptions = {
      from: config.getValue("EmailSender"), // sender address
      to: self.user.email, // list of receivers
      subject: subject, // Subject line
      text: results.text,
      html: results.html
    };

    // send mail with defined transport object
    sendMailWithLog(self.user, mailOptions, callback);
  });
};

MailReceiver.prototype.updateBlog = function updateBlog(user, blog, change, callback) {
  debug("MailReceiver.prototype.updateBlog");
  if (this.invalidMail) return callback();

  var self = this;
  var newBlog = blogModule.create();
  var k;
  for (k in blog) {
    newBlog[k] = blog[k];
    if (change[k]) newBlog[k] = change[k];
  }
  for (k in change) {
    newBlog[k] = change[k];
  }


  var subject;
  var blogName = blog.name;
  if (change.name) blogName = change.name;

  if (!blog.name && change.name) {
    subject = blogName + " was created";
  } else {
    subject = blogName + " changed status to " + newBlog.status;
  }


  var data = {user: this.user, changeby: user, blog: blog, newBlog: newBlog, layout: layout, blogName: blogName};

  infomailBlog.render(data, function infomailRenderBlog(err, results) {
    debug("infomailRenderBlog");
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html, {tables: ["#valuetable"]});

    var mailOptions = {
      from: config.getValue("EmailSender"), // sender address
      to: self.user.email, // list of receivers
      subject: subject, // Subject line
      text: results.text,
      html: results.html
    };

    // send mail with defined transport object
    sendMailWithLog(self.user, mailOptions, callback);
  });
};
var iteratorReceiver = new IteratorReceiver({});
var userReceiverMap = {};

/*
function MailUserReceiver() {
  debug('MailUserReceiver');
}

MailUserReceiver.prototype.sendReviewStatus = function sendReviewStatus(user,blog,lang,status,callback) {
  debug('MailUserReceiver.prototype.sendReviewStatus');
  async.forEachOf(userReceiverMap,function(value,key,cb) {
    value.sendReviewStatus(user,blog,lang,status,cb);
  },function(err) {
    return callback(err);
  });
};

MailUserReceiver.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,callback) {
  debug('MailUserReceiver.prototype.sendCloseStatus');
  async.forEachOf(userReceiverMap,function(value,key,cb) {
    value.sendCloseStatus(user,blog,lang,status,cb);
  },function(err) {
    return callback(err);
  });
};

MailUserReceiver.prototype.updateArticle = function murUpdateArticle(user,article,change,callback) {
  debug('MailUserReceiver.prototype.updateArticle');
  async.forEachOf(userReceiverMap,function(value,key,cb) {
    debug('forEachOf'+key);
    value.updateArticle(user,article,change,cb);
  },function(err) {
    return callback(err);
  });
};
MailUserReceiver.prototype.addComment = function addComment(user,article,comment,callback) {
  debug('MailUserReceiver.prototype.addComment');
  async.forEachOf(userReceiverMap,function(value,key,cb) {
    debug('forEachOf'+key);
    value.addComment(user,article,comment,cb);
  },function(err) {
    return callback(err);
  });
};
MailUserReceiver.prototype.editComment = function editComment(user,article,index,comment,callback) {
  debug('MailUserReceiver.prototype.editComment');
  async.forEachOf(userReceiverMap,function(value,key,cb) {
    debug('forEachOf'+key);
    value.editComment(user,article,index,comment,cb);
  },function(err) {
    return callback(err);
  });
};
MailUserReceiver.prototype.updateBlog = function murUpdateBlog(user,blog,change,callback) {
  debug('MailUserReceiver.prototype.updateBlog');
  async.forEachOf(userReceiverMap,function(value,key,cb) {
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

var registered = false;

function initialise(userList) {
  debug("initialise");
  messageCenter.initialise();
  userReceiverMap = {};
  for (var i = 0; i < userList.length; i++) {
    var u = userList[i];
    updateUser(u);
  }
  should.exist(messageCenter.global);
  if (!registered) {
    messageCenter.global.registerReceiver(iteratorReceiver);
    registered = true;
  }
}


function updateUser(user) {
  debug("updateUser");
  delete userReceiverMap[user.OSMUser];
  if (user.access !== "full" && user.access !== "guest") return;
  if (!user.email) return;
  if (user.email.trim() === "") return;
  userReceiverMap[user.OSMUser] = new UserConfigFilter(user, new MailReceiver(user));
  iteratorReceiver.receiverMap = userReceiverMap;
}


module.exports.MailReceiver = MailReceiver;
module.exports.initialise = initialise;
module.exports.updateUser = updateUser;

module.exports.for_test_only = {transporter: transporter, logger: logger};


// setup e-mail data with unicode symbols
