var debug = require('debug')('OSMBC:model:mailReceiver');
var path = require('path');
var config = require('../config.js');

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var EmailTemplate = require('email-templates').EmailTemplate;

config.initialise();


var templateDir = path.join(__dirname, '..','email', 'infomail');
var infomail = new EmailTemplate(templateDir);
var transporter = nodemailer.createTransport(smtpTransport(config.getValue("SMTP")));

var layout = {
  htmlroot : config.getValue("htmlroot"),
  url: config.getValue("url")
}
function MailReceiver(user) {
  debug("MailReceiver::MailReceiver");
  this.user = user;
}

MailReceiver.prototype.sendInfo = function sendInfo(info,callback) {
  debug("MailReceiver::sendInfo");
  return callback();
}

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

module.exports = MailReceiver;
 
// setup e-mail data with unicode symbols 
