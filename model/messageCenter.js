var debug = require('debug')('OSMBC:model:messageCenter');
var async = require('async');
var path = require('path');
var should = require('should');
var config = require('../config.js');
var logModule = require('../model/logModule.js');
var messageFilter = require('../model/messageFilter.js');

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var EmailTemplate = require('email-templates').EmailTemplate;

config.initialise();
console.log(config.getValue("SMTP"));
// create reusable transporter object using the default SMTP transport 




var templateDir = path.join(__dirname, '..','email', 'welcome');

var welcome = new EmailTemplate(templateDir);
var data = {user:{displayName: 'TheFive'}};
welcome.render(data, function (err, results) {
  if (err) return console.dir(err);
  console.dir(results);

  var mailOptions = {
      from: ' <thefive.osm@gmail.com>', // sender address 
      to: 'thefive.osm@gmail.com', // list of receivers 
      subject: 'Welcome Mail', // Subject line 
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
var transporter = nodemailer.createTransport(smtpTransport(config.getValue("SMTP")));
 
// setup e-mail data with unicode symbols 


function MessageCenter() {
  debug('MessageCenter::MessageCenter');
  this.receiverList = [];
}

MessageCenter.prototype.sendInfo = function(object,callback) {
  debug('MessageCenter::sendInfo');
  async.each(this.receiverList,function sendIt(element,cb){
    element.sendInfo(object,cb);
  },function final(err) {callback(err);});
};

MessageCenter.prototype.updateArticle = function (user,article,change,callback) {
  debug('MessageCenter::updateArticle');
  async.each(this.receiverList,function sendIt(element,cb){
    element.updateArticle(user,article,change,cb);
  },function final(err) {callback(err);});
};


function ConsoleReceiver() {
  debug("ConsoleReceiver::ConsoleReceiver");

}
ConsoleReceiver.prototype.sendInfo = function(object,cb) {
  console.log("ConsoleReceiver::Info Received");
  console.dir(object);
  cb();
};

ConsoleReceiver.prototype.updateArticle = function(user,article,change,cb) { //jshint ignore:line
  console.log("Update Artcile was called");
  return cb();
};

function LogModuleReceiver() {}

LogModuleReceiver.prototype.sendInfo= function(object,cb) {
  debug('LogModuleReceiver::sendInfo');
  logModule.log(object,cb);
};

LogModuleReceiver.prototype.updateArticle= function(user,article,change,cb) {
  debug('LogModuleReceiver::sendInfo');
  should.exist(article.id);
  should(article.id).not.equal(0);
  var logblog = article.blog;
  if (change.blog) logblog = change.blog;
  async.forEachOf(change,function setAndSaveEachOf(value,key,cb_eachOf){
    // There is no Value for the key, so do nothing
    if (typeof(value)=='undefined') return cb_eachOf();

    // The Value to be set, is the same then in the object itself
    // so do nothing
    if (value == article[key]) return cb_eachOf();
    if (typeof(article[key])==='undefined' && value === '') return cb_eachOf();
    async.series ( [
        function(cb) {
           logModule.log({oid:article.id,blog:logblog,user:user.displayName,table:"article",property:key,from:article[key],to:value},cb);
        }
      ],function(err){
        cb_eachOf(err);
      });
  },function finalFunction(err) {cb(err);});
};


MessageCenter.prototype.registerReceiver = function(receiver) {
  debug('MessageCenter::registerReceiver');
  this.receiverList.push(receiver);
};

var messageCenter = new MessageCenter();

messageCenter.registerReceiver(new messageFilter.withParam.comment("TheFive",new ConsoleReceiver()));
messageCenter.registerReceiver(new messageFilter.global.newCollection(new ConsoleReceiver()));
messageCenter.registerReceiver(new LogModuleReceiver());


module.exports = messageCenter;