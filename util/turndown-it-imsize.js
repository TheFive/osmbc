


function cleanAttribute (attribute) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
}


// this is not turning down emojies, but turndown the individual emoji generation for the translation tool
const turndownItImsize = function(turndownService) {
  turndownService.addRule("image",
    {
      filter: "img",
      replacement: function (content, node) {
        const alt = cleanAttribute(node.getAttribute("alt"));
        const width = cleanAttribute(node.getAttribute("width"));
        const height = cleanAttribute(node.getAttribute("height"));
        let sizeAppend = "";
        if (width !== "" || height !== "") sizeAppend = " =" + width + "x" + height;
        const src = node.getAttribute("src") || "";
        const title = cleanAttribute(node.getAttribute("title"));
        const titlePart = title ? ' "' + title + '"' : "";
        return src ? "![" + alt + "]" + "(" + src + titlePart + sizeAppend + ")" : "";
      }
    });
};

export default turndownItImsize;
