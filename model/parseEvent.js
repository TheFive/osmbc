
// This page is delivering the calendar events
var wikiEventPage = "https://wiki.openstreetmap.org/w/api.php?action=query&titles=Template:Calendar&prop=revisions&rvprop=content&format=json"
//


var request = require("request");



// regex to parse the string interim:   \|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 1-9|]*)\}\} *\|\|(.*), *\[\[(.*)\]\].*

// Regex 2 to parste the string: \|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*), *\[\[(.*)\]\].*\[\[(.*)\]\].*

function parseWiki(string) {
  
}

regexList = [ {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*), *\[\[(.*)\]\].*\[\[(.*)\]\].*/gi,
               keys:["type","date","desc","town","country"]} ];



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
    //console.log(regexList[i].regex);
    var results = regexList[i].regex.exec(string);
    console.log("String:"+string);
    console.dir(results);

    if (results) {
      var r={};
      for (var j=0;j<regexList[i].keys.length;j++){
        var value = results[j+1];
        var list = regexList[i].keys;
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


/*

function parseWikiInfo(description) {

  var title;
  var link;
  var next = description.indexOf("[[");
  var end = description.indexOf("]]");
  if (next >= 0 && end >= 0) {
    description = description.substring(next,end+2);
    var split = description.indexOf("|");
    if (split < 0) {
      title = description.substring(2,description.length-2);
      link = "https://wiki.openstreetmap.org/wiki/"+title;
    } else {
      title = description.substring(split+1,description.length-2);
      link = "https://wiki.openstreetmap.org/wiki/"+description.substring(2,split);
    }
  } else {   
    next = description.indexOf("[");
    var end = description.indexOf("]");
    if (next >= 0 && end >= 0) {
      description = description.substring(next,end+1);
      var split = description.indexOf(" ");
      if (split < 0) {
        title = description.substring(1,description.length-2);
        link = title;
      } else {
        title = description.substring(split+1,description.length-1);
        link = description.substring(1,split);
      }
    } else {
      title = description;
      link = null;
    }   
  } 
  return {title:title,link:link};
}


function parseEventLine(string) {

  console.log(string);
  var next = string.indexOf("{{cal|");
  var type;
  if (next >= 0) {
    string = string.substring(next+6,99999);
    next = string.indexOf("}}");
    type = string.substring(0,next);
    string = string.substring(next+2,99999);
  } 
  var next = string.indexOf("{{dm|");
  var datestart;
  var dateend;
  if (next >= 0) {
    string = string.substring(next+5,99999);
    next = string.indexOf("}}");
    datestart = string.substring(0,next);
    string = string.substring(next+2,99999);
  } else return null;
  if (datestart.indexOf("|")>=0) {
    dateend = datestart.substring(datestart.indexOf("|")+1,99999);
    datestart = datestart.substring(0,datestart.indexOf("|"));
  } 
  datestart = nextDate(datestart);
  dateend = nextDate(dateend);

  var next = string.indexOf("||");
  if (next >= 0) {
    string = string.substring(next+2,99999);
    next = string.indexOf(",");
    if (next >=0) {
      description = string.substring(0,next);
      string = string.substring(next+1,99999)
    }
    else string = "";
  } 
  var desc = parseWikiInfo(description);

 
  

  return {type:type,datestart:datestart,dateend:dateend,desc:desc};
}
*/

/*

request(wikiEventPage, function(error, response, body) {
  
  
  var json = JSON.parse(body);
  body = (json.query.pages[2567].revisions[0]["*"]);
  var point = body.indexOf("\n");

  while (point>= 0) {
 
    var line = body.substring(0,point);
    body = body.substring(point+1,999999999);
    point = body.indexOf("\n");
    result = parseEventLine(line);
    if (result) {
      console.log()
    }
  }


});

*/
//var result = parseEventLine("{{cal|social}} || {{dm|Nov 25}} || [[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]], [[Germany]] {{SmallFlag|Germany}}");

//console.log(result);

//result = parseEventLine("| {{cal|conference}} || {{dm|Aug 24|Aug 26}} || <big>'''[http://2016.foss4g.org/ FOSS4G 2016]'''</big>, [[Bonn]], [[Germany]] {{SmallFlag|Germany}}");
//console.log(result);