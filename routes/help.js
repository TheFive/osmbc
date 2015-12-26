var fs = require('fs');
var path = require('path');
var debug = require('debug')('OSMBC:routes:help');
var config = require('../config.js');

var markdown = require('markdown-it')();


var token = null;

function initToken() {
  debug("initToken");
  if (token) return;
  token = {
    "##osmbcroot##":config.getValue("htmlroot")
  };
}


function generateHelpText(filename) {
  debug("generateHelpText");
  initToken();
  var result = fs.readFileSync(path.resolve(__dirname,'..','help', filename),'UTF8');
  for (var t in token) {
    while (result.indexOf(t)>=0) {
      result = result.replace(t,token[t]);
    }
  }
  result = markdown.render(result);
  return result;
}

exports.getText = generateHelpText;