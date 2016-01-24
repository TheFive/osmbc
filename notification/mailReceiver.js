var path          = require('path');
var config        = require('../config.js');
var async         = require('async');
var debug         = require('debug')('OSMBC:notification:mailReceiver');
var nodemailer    = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var EmailTemplate = require('email-templates').EmailTemplate;

var messageCenter = require('../notification/messageCenter.js');
var messageFilter = require('../notification/messageFilter.js');
var articleModule = require('../model/article.js');



var infoMailtemplateDir = path.join(__dirname, '..','email', 'infomail');
var infomail = new EmailTemplate(infoMailtemplateDir);
var welcomeMailtemplateDir = path.join(__dirname, '..','email', 'welcome');
var welcomemail = new EmailTemplate(welcomeMailtemplateDir);
var transporter = nodemailer.createTransport(smtpTransport(config.getValue("SMTP")));

var layout = {
  htmlroot : config.getValue("htmlroot"),
  url: config.getValue("url")
};
function MailReceiver(user) {
  debug("MailReceiver::MailReceiver");
  this.user = user;
}

MailReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter,callback) {
  debug("MailReceiver::sendWelcomeMail");


  var self = this;
  var data = {user:this.user,inviter:inviter,layout:layout};

  welcomemail.render(data, function (err, results) {
    if (err) return console.dir(err);
    console.dir(self.user);

    var mailOptions = {
        from: config.getValue("EmailSender"), // sender address 
        to: self.user.emailInvalidation, // list of receivers 
        subject: "Welcome to OSMBC", // Subject line 
        text: results.text,
        html: results.html
    };
     
    // send mail with defined transport object 
    transporter.sendMail(mailOptions, function(error, info){
        if(error){
          console.log("Connection Error while send Welcome Email to "+self.user.displayName);
          console.log(error);
        } else {
          console.log('Welcome Mail send to '+self.user.displayName + " "+info.response);
        }
        return callback();
    });
  }); 
};

MailReceiver.prototype.sendInfo = function sendInfo(info,callback) {
  debug("MailReceiver::sendInfo");
  return callback();
};

MailReceiver.prototype.updateArticle = function updateArticle(user,article,change,callback) {
  debug("MailReceiver::updateArticle");

  var subject;
  var logblog = article.blog;
  if (change.blog) logblog = change.blog;

  if (!article.collection && change.collection) {
     subject = logblog + " added collection";
  }
  if (article.collection && change.collection) {
     subject = logblog + " changed collection";
  }
  if (!article.comment && change.comment) {
     subject = logblog + " added comment";
  }
  if (article.comment && change.comment) {
     subject = logblog + " changed comment";
  }
  var newArticle = articleModule.create();
  for (var k in article) {
    newArticle[k] = article[k];
    if (change[k]) newArticle = change[k];
  }


  var data = {user:this.user,changeby:user,article:article,newArticle:newArticle,layout:layout,logblog:logblog};

  infomail.render(data, function (err, results) {
    if (err) return console.dir(err);

    var mailOptions = {
        from: ' <noreply@gmail.com>', // sender address 
        to: 'thefive.osm@gmail.com', // list of receivers 
        subject: subject, // Subject line 
        text: results.text,
        html: results.html
    };
     
    // send mail with defined transport object 
    transporter.sendMail(mailOptions, function(error, info){
        if(error){
          console.log("Connection Error");
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
  });
  callback();
};

var userReceiverMap = {};


function MailUserReceiver() {
  debug('MailUserReceiver::MailUserReceiver');
}

MailUserReceiver.prototype.sendInfo = function murSendInfo(object,callback) {
  debug('MailUserReceiver.prototype.sendInfo');
  async.forEachOf(userReceiverMap,function(value,key,cb) {
    value.sendInfo(object,cb);
  },function(err) {
    return callback(err);
  });
};
MailUserReceiver.prototype.updateArticle = function murUpdateArticle(user,article,change,callback) {
  debug('MailUserReceiver.prototype.updateArticle');
  for (k in userReceiverMap) console.log(k);
  async.forEachOf(userReceiverMap,function(value,key,cb) {
    debug('forEachOf'+key);
    value.updateArticle(user,article,change,cb);
  },function(err) {
    return callback(err);
  });
};


function initialise(userList) {
  debug('initialise');
  for (var i=0;i<userList.length;i++) {
    var u = userList[i];
    if (u.access !== "full") continue;
    userReceiverMap[u.OSMUser] = new messageFilter.UserConfigFilter(u,new MailReceiver(u));
  }
  messageCenter.global.registerReceiver(new MailUserReceiver());
}

function updateUser(user) {
  debug('updateUser');
  delete userReceiverMap[user.OSMUser];
  if (user.access !== "full") return;
  userReceiverMap[user.OSMUser] = new messageFilter.UserConfigFilter(user,new MailReceiver(user));
}


module.exports.MailReceiver = MailReceiver;
module.exports.initialise = initialise;
module.exports.updateUser = updateUser;

module.exports.for_test_only= {transporter:transporter};
 
// setup e-mail data with unicode symbols 
