const turndown = require("turndown");


module.exports = function(turndownService) {
  turndownService.addRule("superscript",
  {
    filter: "sup",
    replacement: function(content) {
      return "^" + content + "^";
    }
  });
}
