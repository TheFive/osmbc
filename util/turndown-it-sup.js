

const turndownItSup = function(turndownService) {
  turndownService.addRule("superscript",
    {
      filter: "sup",
      replacement: function(content) {
        return "^" + content + "^";
      }
    });
};

export default turndownItSup;
