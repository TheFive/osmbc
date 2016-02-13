"use strict";

var path          = require('path');
var config        = require('../config.js');
var should        = require('should');
var async         = require('async');
var debug         = require('debug')('OSMBC:notification:mailReceiver');
var nodemailer    = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var EmailTemplate = require('email-templates').EmailTemplate;

var messageCenter = require('../notification/messageCenter.js');
var messageFilter = require('../notification/messageFilter.js');
var articleModule = require('../model/article.js');
var blogModule = require('../model/blog.js');
var logModule  = require('../model/logModule.js');

var htmlToText = require('html-to-text');




var infoMailtemplateDir = path.join(__dirname, '..','email', 'infomail');
var infomail = new EmailTemplate(infoMailtemplateDir);

var infoMailBlogtemplateDir = path.join(__dirname, '..','email', 'infomailBlog');
var infomailBlog = new EmailTemplate(infoMailBlogtemplateDir);

var infoMailReviewtemplateDir = path.join(__dirname, '..','email', 'infomailInfo');
var infomailReview = new EmailTemplate(infoMailReviewtemplateDir);

var infoMailClosetemplateDir = path.join(__dirname, '..','email', 'infomailInfo');
var infomailClose = new EmailTemplate(infoMailClosetemplateDir);

var welcomeMailtemplateDir = path.join(__dirname, '..','email', 'welcome');
var welcomemail = new EmailTemplate(welcomeMailtemplateDir);

var transporter = nodemailer.createTransport(smtpTransport(config.getValue("SMTP")));

var layout = {
  htmlroot : config.getValue("htmlroot"),
  url: config.getValue("url")
};



function sendMailWithLog(user,mailOptions,callback) {
  debug("sendMailWithLog");

  var appName = config.getValue("AppName");
  if (appName)   mailOptions.subject = "["+appName+"] "+mailOptions.subject;
  transporter.sendMail(mailOptions,function logMail(error,info){
    debug("logMail Error %s response %s",error,info.response);
    var logObject = {
      user:user.OSMUser,
      table:"mail",
      to:mailOptions.to,
      subject:mailOptions.subject,
      text:mailOptions.text,
      error:error,
      response:(info)?info.response:"no response"
    };


    if (error) {
      logModule.log(logObject,function cb(){
        return callback();
      });
    } else {
      logModule.log(logObject,callback);
    }
  });
}
function MailReceiver(user) {
  debug("MailReceiver");
  this.user = user;
}

MailReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter,callback) {
  debug("MailReceiver.prototype.sendWelcomeMail");


  var self = this;
  var data = {user:this.user,inviter:inviter,layout:layout};

  welcomemail.render(data, function welcomemail_render (err, results) {
    debug("welcomemail_render");
    if (err) return callback(err);
    //console.dir(self.user);
    results.text = htmlToText.fromString(results.html); 

    var mailOptions = {
        from: config.getValue("EmailSender"), // sender address 
        to: self.user.emailInvalidation, // list of receivers 
        subject: "Welcome to OSMBC", // Subject line 
        text: results.text,
        html: results.html
    };
     
    // send mail with defined transport object 
    sendMailWithLog(self.user,mailOptions,callback);
  }); 
};

MailReceiver.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,callback) {
  debug("MailReceiver.prototype.sendLanguageStatus");

  var self = this;


  var subject = blog.name +"("+lang+") has been reviewed by user "+user.OSMUser;
  if (status === "startreview") {
    subject = blog.name +"("+lang+") review has been started";
  }
  if (status === "markexported") {
    subject = blog.name + "("+lang+") is exported to WordPress";
  }

  var data = {user:user,blog:blog,status:status,lang:lang,layout:layout};

  infomailReview.render(data, function infomailRenderBlog(err, results) {
    debug('infomailRenderInfo');
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html); 

    var mailOptions = {
        from: config.getValue("EmailSender"), // sender address 
        to: self.user.email, // list of receivers 
        subject: subject, // Subject line 
        text: results.text,
        html: results.html
    };
     
    // send mail with defined transport object 
    sendMailWithLog(self.user,mailOptions,callback);
  });
};

MailReceiver.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,callback) {
  debug("MailReceiver.prototype.sendCloseStatus");

  var self = this;


  var subject = blog.name +"("+lang+") has been closed by user "+user.OSMUser;
  if (status === "false") {
    subject = blog.name +"("+lang+") has been reopened by "+user.OSMUser;
  }

  var data = {user:user,blog:blog,status:status,lang:lang,layout:layout};

  infomailClose.render(data, function infomailRenderClose(err, results) {
    debug('infomailRenderClose');
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html); 

    var mailOptions = {
        from: config.getValue("EmailSender"), // sender address 
        to: self.user.email, // list of receivers 
        subject: subject, // Subject line 
        text: results.text,
        html: results.html
    };
     
    // send mail with defined transport object 
    sendMailWithLog(self.user,mailOptions,callback);
  });
};

MailReceiver.prototype.updateArticle = function updateArticle(user,article,change,callback) {
  debug("MailReceiver.prototype.updateArticle");

  should(typeof(change)).eql("object");
 

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
     subject = logblog + " added: "+newArticle.title;
  }
  if (article.collection && change.collection) {
     subject = logblog + " changed: "+newArticle.title;
  }
  if (!article.comment && change.comment) {
     subject = logblog + " comment: "+newArticle.title;
  }
  if (article.comment && change.comment) {
     subject = logblog + " comment: "+newArticle.title;
  }


  var data = {user:this.user,changeby:user,article:article,newArticle:newArticle,layout:layout,logblog:logblog};

  infomail.render(data, function infomailRender(err, results) {
    debug('infomailRender');
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html); 

    var mailOptions = {
        from: config.getValue("EmailSender"), // sender address 
        to: self.user.email, // list of receivers 
        subject: subject, // Subject line 
        text: results.text,
        html: results.html
    };
     
    // send mail with defined transport object 
    sendMailWithLog(self.user,mailOptions,callback);
  });
};


MailReceiver.prototype.updateBlog = function updateBlog(user,blog,change,callback) {
  debug("MailReceiver.prototype.updateBlog");


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
  } else  {
     subject = blogName + " changed status to "+newBlog.status;
  }
 

  var data = {user:this.user,changeby:user,blog:blog,newBlog:newBlog,layout:layout,blogName:blogName};

  infomailBlog.render(data, function infomailRenderBlog(err, results) {
    debug('infomailRenderBlog');
    if (err) return callback(err);
    results.text = htmlToText.fromString(results.html); 

    var mailOptions = {
        from: config.getValue("EmailSender"), // sender address 
        to: self.user.email, // list of receivers 
        subject: subject, // Subject line 
        text: results.text,
        html: results.html
    };
     
    // send mail with defined transport object 
    sendMailWithLog(self.user,mailOptions,callback);
  });
};
var userReceiverMap = {};


function MailUserReceiver() {
  debug('MailUserReceiver');
}

MailUserReceiver.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,callback) {
  debug('MailUserReceiver.prototype.sendLanguageStatus');
  async.forEachOf(userReceiverMap,function(value,key,cb) {
    value.sendLanguageStatus(user,blog,lang,status,cb);
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
};


function initialise(userList) {
  debug('initialise');
  userReceiverMap = {};
  for (var i=0;i<userList.length;i++) {
    var u = userList[i];
    updateUser(u);
  }
}

messageCenter.global.registerReceiver(new MailUserReceiver());

function updateUser(user) {
  debug('updateUser');
  delete userReceiverMap[user.OSMUser];
  if (user.access !== "full") return;
  if (!user.email) return;
  if (user.email === "") return;
  userReceiverMap[user.OSMUser] = new messageFilter.UserConfigFilter(user,new MailReceiver(user));
}


module.exports.MailReceiver = MailReceiver;
module.exports.initialise = initialise;
module.exports.updateUser = updateUser;

module.exports.for_test_only= {transporter:transporter};

 
// setup e-mail data with unicode symbols 
