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


function MailReceiver(user) {
  debug("MailReceiver::MailReceiver");
  this.user = user;
}

MailReceiver.prototype.sendInfo = function sendInfo(info,callback) {
  debug("MailReceiver::sendInfo");

  var subject;

  if (info.property === "collection") {
    if (info.from === "") {
      subject = info.blog + " added collection";
    }
    else {
      subject = info.blog + " changed collection";
    }
  }
  if (info.property.substring(0,8)==="markdown") {
    if (info.from === "") {
      subject = info.blog + " added markdown";
    }
    else {
      subject = info.blog + " changed markdown";
    }
  }
  if (info.property.substring(0,8)==="comment") {
    if (info.from === "") {
      subject = info.blog + " added comment";
    }
    else {
      subject = info.blog + " changed comment";
    }
  }
  var data = {user:this.user,change:info};
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


 
// setup e-mail data with unicode symbols 
