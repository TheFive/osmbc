

function MessageCenter() {
  this.receiverList = [];
}

function SlackReceiver() {

}
function ConsoleReceiver() {

}
ConsoleReceiver.prototype.sendInfo(object,cb) {
  console.log("Info Received");
  console.log(object);
  cb();
}

function FilterNewCollection(receiver) {
  this.receiver = receiver;
}

FilterNewCollection.prototype.sendInfo(object.cb) {
  if (object.property != "collection") return cb();
  if (object.from !== "") return cb();
  if (object.to !== "") return cb();
  this.receiver.sendInfo(object,cb);
}

function FilterAllComment(receiver) {
  this.receiver = receiver;
}

FilterAllComment.prototype.sendInfo(object.cb) {
  if (object.property != "comment") return cb();
  this.receiver.sendInfo(object,cb);
}

function FilterComment(what,receiver) {
  this.receiver = receiver;
  this.what = what;
}

FilterAllComment.prototype.sendInfo(object.cb) {
  if (object.property != "comment") return cb();
  if (object.to.indexOf("@"+this.what)<0) return cb();
  this.receiver.sendInfo(object,cb);
}


SlackReceiver.prototype.sendInfo(object,cb) {
  async.each(this.receiver,function sendIt(element,cb){
    element.sendInfo(object);
    cb();
  }),function final(err) {cb(err);});
}

MessageCenter.prototype.registerReceiver(receiver) {
  this.receiver.push(receiver);
}