import HtmlRenderer from "./HtmlRenderer.js";
import MarkdownRenderer from "./MarkdownRenderer.js";
import HugoMarkdownRenderer from "./HugoMarkdownRenderer.js";

const blogRenderer = {
  HtmlRenderer: HtmlRenderer,
  MarkdownRenderer: MarkdownRenderer,
  HugoMarkdownRenderer: HugoMarkdownRenderer
};

export default blogRenderer;
