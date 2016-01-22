var debug = require('debug')('OSMBC:model:mailReceiver');
var path = require('path');
var config = require('../config.js');

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var EmailTemplate = require('email-templates').EmailTemplate;

var messageCenter = require('../notification/messageCenter.js');
var messageFilter = require('../notification/messageFilter.js');
config.initialise();


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
        from: ' <noreply@gmail.com>', // sender address 
        to: self.user.emailAddressValidating, // list of receivers 
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
        if (callback) callback();
        return;
    });
  }); 
};

MailReceiver.prototype.sendInfo = function sendInfo(info,callback) {
  debug("MailReceiver::sendInfo");
  return callback();
};

MailReceiver.prototype.updateArticle = function sendInfo(user,article,change,callback) {
  debug("MailReceiver::sendInfo");

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


  var data = {user:this.user,changeby:user,article:article,change:change,layout:layout,logblog:logblog};

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

function MailUserReceiver(user) {
  debug('MailUserReceiver::MailUserReceiver');
  this.user = user;
  // No Access No Mail.
  if (this.user.access !=="full") return;

  this.mc = new messageCenter.Class();
  // ONE Receiver for all mails !!
  var receiver = new MailReceiver(this.user);
  if (user.getNotificationStatus("mail","allComment")) {
    this.mc.registerReceiver(new messageFilter.global.allComment(receiver));
  }
  if (user.getNotificationStatus("mail","newCollection")) {
    this.mc.registerReceiver(new messageFilter.global.newCollection(receiver));
  }
  var u = user.getNotificationStatus("mail","comment");
  if (u) {
    this.mc.registerReceiver(new messageFilter.paramFilterList.comment(u,receiver));
  }
}

var userReceiverMap = {};
function initialise(userList) {
  for (var i=0;i<userList;i++) {
    var u = userList[i];
    if (u.access !== "full") continue;
    userReceiverMap[u.displayName] = new MailUserReceiver(u);
  }
}

function updateUser(user) {
  delete userReceiverMap[user.displayName];
  if (user.access !== "full") return;
  userReceiverMap[user.displayName] = new MailUserReceiver(user);
}

module.exports.MailReceiver = MailReceiver;
module.exports.initialise = initialise;
module.exports.updateUser = updateUser;
 
// setup e-mail data with unicode symbols 
