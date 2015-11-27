
// This page is delivering the calendar events
var wikiEventPage = "https://wiki.openstreetmap.org/w/api.php?action=query&titles=Template:Calendar&prop=revisions&rvprop=content&format=json"
//


var moment = require("moment");
var request = require("request");



// regex to parse the string interim:   \|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 1-9|]*)\}\} *\|\|(.*), *\[\[(.*)\]\].*

// Regex 2 to parste the string: \|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*), *\[\[(.*)\]\].*\[\[(.*)\]\].*

function parseWiki(string) {
  
}

regexList = [ {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*), *\[\[(.*)\]\].*\[\[(.*)\]\].*/gi,
               keys:[               "type",                "date",              "desc",         "town",       "country"]},
               {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*) *\[\[(.*)\]\].*\[\[(.*)\]\].*/gi,
               keys:[               "type",               "date",                "desc",        "town",       "country"]},
               {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*) *, *\[\[(.*)\]\] *, *\[\[(.*)\]\].*/gi,
               keys:[               "type",               "date",               "desc",        "town",          "country"]}, 
               {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*), *\[\[(.*)\]\].*/gi,
               keys:[               "type",               "date",                "desc",         "country"]},
               {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*)/gi,
               keys:[               "type",               "date",                "desc"]} ];



function nextDate(string) {
  if (!string) return null;
  var now = new Date();
  now.setDate(now.getDate()-50);
  var result = new Date(string);

  while (result.getTime() <= now.getTime()) {
    result = new Date(result.getFullYear()+1,result.getMonth(),result.getDate());
  }
  return result;
}


function parseStartDate(string) {

  var datestart=string;
  var dateend;
 
  if (string.indexOf("|")>=0) {
    dateend = datestart.substring(datestart.indexOf("|")+1,99999);
    datestart = datestart.substring(0,datestart.indexOf("|"));
  } 
  datestart = nextDate(datestart);
  //dateend = nextDate(dateend);
  return datestart;
}
function parseEndDate(string) {

  var datestart = string;
  var dateend;
 
  if (string.indexOf("|")>=0) {
    dateend = datestart.substring(datestart.indexOf("|")+1,99999);
    datestart = datestart.substring(0,datestart.indexOf("|"));
  } 
  datestart = nextDate(datestart);
  dateend = nextDate(dateend);
  if (dateend == null) dateend = datestart;
  return dateend;
}

function parseEventLine2(string) {
  for (var i=0;i<regexList.length;i++){
    var results = regexList[i].regex.exec(string);

    if (results) {
      var r={};
      for (var j=0;j<regexList[i].keys.length;j++){
        var value = results[j+1].trim();
        var list  = regexList[i].keys;
        if (list[j] == "date") {
          r.startDate = parseStartDate(value);
          r.endDate = parseEndDate(value);

        } else {
          r[list[j]]=value;
        }
      }
      return r;
    } 
  }
  return null;
}

exports.parseLine = parseEventLine2;



function parseWikiInfo(description) {
  console.log("Parse "+description);
  var result = ""
  while (description && description.trim()!="") {
    console.log(description);
    var next = description.indexOf("[[");
    var end = description.indexOf("]]");
    if (next >= 0 && end >= 0) {
      result += description.substring(0,next);
      var desc = description.substring(next+2,end);
      description = description.substring(end+2);
      var split = desc.indexOf("|");
      if (split < 0) {
        title = desc;
        link = "https://wiki.openstreetmap.org/wiki/"+desc;
      } else {
        title = desc.substring(split+1,desc.length);
        link = "https://wiki.openstreetmap.org/wiki/"+desc.substring(0,split);
      }
      while (link.indexOf(" ")>=0) link = link.replace(" ","%20");
      result += "["+title+"]("+link+")";
    } else {   
      next = description.indexOf("[");
      var end = description.indexOf("]");
      if (next >= 0 && end >= 0) {
        result += description.substring(0,next);
        var desc = description.substring(next+1,end);
        description = description.substring(end+1);
        var split = desc.indexOf(" ");
        if (split < 0) {
          title = desc.substring(0,desc.length);
          link = title;
        } else {
          title = desc.substring(split+1,desc.length);
          link = desc.substring(0,split);
        }
      } else {
        title = description;
        link = null;
        description = "";
      } 
      if(link) {
        while (link.indexOf(" ")>=0) link = link.replace(" ","%20");
        result += "["+title+"]("+link+")"; 
      } else result += title;
    } 
  }
  return result;
}

var empty = "                                                                                  ";
empty = empty+empty;
var lineString = "---------------------------------------------------";
lineString = lineString + lineString;
lineString = lineString + lineString;

function wl(string,length) {
    return (string + empty).substring(0,length);
}
function ll(length) {
  return lineString.substring(0,length);
}

function calenderToMarkdown(cb) {
  request(wikiEventPage, function(error, response, body) {
    var json = JSON.parse(body);
    //body = (json.query.pages[2567].revisions[0]["*"]);
    var body = json.query.pages;
    for (k in body) {
      body = body[k];
      break;
    }
    body = body.revisions[0]['*'];

    var point = body.indexOf("\n");

    var from = new Date();
    var to = new Date();

    // get all Events from today
    from.setDate(from.getDate());
    // until in two weeks
    to.setDate(to.getDate()+14);

    var events = [];

    while (point>= 0) {
   
      var line = body.substring(0,point);
      body = body.substring(point+1,999999999);
      point = body.indexOf("\n");
      result = parseEventLine2(line);
    


      if (result) {
        if (result.endDate >= from && result.startDate <= to) {
          events.push(result);
          result.markdown = parseWikiInfo(result.desc);

        }
      }
    }
      moment.locale("de");

    var townLength = 0;
    var descLength = 0;
    var dateLength = 0;
    var countryLength = 0;
    for (var i=0;i<events.length;i++) {
      var e = events[i];
      if (e.town) townLength = Math.max(e.town.length,townLength);
      if (e.markdown) descLength = Math.max(e.markdown.length,descLength);
      if (e.country) countryLength = Math.max(e.country.length,countryLength);
      var dateString
      if (e.startDate) {
       dateString = moment(e.startDate).format("l");
      }
      if (e.endDate) {
        if (!(e.startDate.getTime() === e.endDate.getTime())) {
          dateString = moment(e.startDate).format("l")+"-"+moment(e.endDate).format("l");
        }
      }
      e.dateString = dateString;
      dateLength = Math.max(dateLength,dateString.length)
    }
    var result = "";
    result += "|"+wl("Ort",townLength)+"|"+wl("Name",descLength)+"|"+wl("Datum",dateLength)+"|"+wl("Land",countryLength)+"|\n";
    result += "|"+ll(townLength)+"|"+ll(descLength)+"|"+ll(dateLength)+"|"+ll(countryLength)+"|\n";  
    for (var i=0;i<events.length;i++) {
      var t = events[i].town;
      if (!t) t= "";
      var c = events[i].country;
      if (!c) c="";
      result += "|"+wl(t,townLength)+"|"+wl(events[i].markdown,descLength)+"|"+wl(events[i].dateString,dateLength)+"|"+wl(c,countryLength)+"|\n";  
    }
    cb(null,result);
  });
}

exports.calenderToMarkdown = calenderToMarkdown;




