var debug = require('debug')('OSMBC:model:messageCenter');
var async = require('async');
var logModule = require('../model/logModule.js');
var messageFilter = require('../model/messageFilter.js');

var nodemailer = require('nodemailer');
var templates = require('node-mailer-templates');

 
// create reusable transporter object using the default SMTP transport 
var transporter = nodemailer.createTransport('smtps://user%40gmail.com:pass@smtp.gmail.com');
 
// setup e-mail data with unicode symbols 
var mailOptions = {
    from: 'Fred Foo 👥 <foo@blurdybloop.com>', // sender address 
    to: 'bar@blurdybloop.com, baz@blurdybloop.com', // list of receivers 
    subject: 'Hello ✔', // Subject line 
    text: 'Hello world 🐴', // plaintext body 
    html: '<b>Hello world 🐴</b>' // html body 
};
 
// send mail with defined transport object 
transporter.sendMail(mailOptions, function(error, info){
    if(error){
        return console.log(error);
    }
    console.log('Message sent: ' + info.response);
});

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


function ConsoleReceiver() {
  debug("ConsoleReceiver::ConsoleReceiver");

}
ConsoleReceiver.prototype.sendInfo = function(object,cb) {
  console.log("ConsoleReceiver::Info Received");
  console.dir(object);
  cb();
};

function LogModuleReceiver() {}

LogModuleReceiver.prototype.sendInfo= function(object,cb) {
  debug('LogModuleReceiver::sendInfo');
  logModule.log(object,cb);
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