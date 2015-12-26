var weeklyDesign = '<p align="right"><i>##text##</i></p>';
var wnDesign = weeklyDesign;

var text = {
  "DE":"Diese Wochennotiz wurde erstellt von ##team##.",
  "EN":"This weekly was produced by ##team##.",
  "ES": "This weekly was produced by ##team##.",
  "FR": "This weekly was produced by ##team##.",
  "CZ": "This weekly was produced by ##team##.",
  "PT": "This weekly was produced by ##team##.",
  "RU": "This weekly was produced by ##team##.",
  "JP": "This weekly was produced by ##team##.",
  "ID": "This weekly was produced by ##team##.",
  "TR": "This weekly was produced by ##team##.",
};

var designedText = {};
for (var k in text) {
  if (k == "DE") designedText[k]=wnDesign.replace("##text##",text[k]);
  else designedText[k]=weeklyDesign.replace("##text##",text[k]);
}

module.exports = designedText;
