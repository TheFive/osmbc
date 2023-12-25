
import configModule from "../model/config.js";


// this is not turning down emojies, but turndown the individual emoji generation for the translation tool
const turndownItEmoji = function(turndownService) {
  turndownService.addRule("emoji",
    {
      filter: "emoji",
      replacement: function(content, node) {
        const shortcut = configModule.getConfig("languageflags").shortcut;
        const emoji =  node.getAttribute("src");
        if (shortcut[emoji]) {
          return shortcut[emoji];
        } else {
          return ":" + emoji + ":";
        }
      }
    });
};
export default turndownItEmoji;
