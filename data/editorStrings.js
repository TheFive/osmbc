var weeklyDesign = '<p align="right"><i>##text##</i></p>';
var wnDesign = weeklyDesign;

var text = {
  "DE": "Diese Wochennotiz wurde erstellt von ##team##.",
  "EN": "This weekly was <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produced</a> by ##team##.",
  "ES": "This weekly was <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produced</a> by ##team##.",
  "FR": "This weekly was <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produced</a> by ##team##.",
  "CZ": "This weekly was <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produced</a> by ##team##.",
  "PT": "Este semanário foi <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produzido</a> por ##team##.",
  "RU": "This weekly was <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produced</a> by ##team##.",
  "JP": "This weekly was <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produced</a> by ##team##.",
  "ID": "This weekly was <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produced</a> by ##team##.",
  "TR": "This weekly was <a href=\"https://wiki.openstreetmap.org/wiki/WeeklyOSM#Languages\">produced</a> by ##team##.",
};

var designedText = {};
for (var k in text) {
  if (k == "DE") designedText[k]=wnDesign.replace("##text##",text[k]);
  else designedText[k]=weeklyDesign.replace("##text##",text[k]);
}

module.exports = designedText;
