var debug = require ('debug')('OSMBC:util');



function shorten(string,maxlength) {
  debug("maxString");
  if (typeof(maxlength) == 'undefined') maxlength = 30;
  if (typeof(string)=='undefined') return "";
  if (!string) return ""; 
  var newstring = string;
  if (typeof(string)=='object') newstring = JSON.stringify(string);
  if (typeof(string)=='boolean') newstring = string.toString();

  if (newstring.length < maxlength) return newstring;
  return newstring.substring(0,maxlength)+"...";
}


// shorten shorten a string up to maxlength
// default is 30. If a string is shortenend, "..." is appendet
exports.shorten = shorten;