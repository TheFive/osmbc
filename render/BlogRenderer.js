import HtmlRenderer from "./HtmlRenderer.js";
import MarkdownRenderer from "./MarkdownRenderer.js";
import HugoMarkdownRenderer from "./HugoMarkdownRenderer.js";

/**
 * Creates a renderer instance based on a case-insensitive type.
 * Supported values: HTML, MARKDOWN, HUGO, HUGOMARKDOWN.
 *
 * Notes on options:
 * - HTML: options are forwarded and used by the markdown rendering setup.
 * - MARKDOWN/HUGO: options are accepted for API consistency, but currently not used.
 *
 * @param {string} type - Renderer type identifier.
 * @param {object} [blog=null] - Blog model passed to the renderer.
 * @param {object} [options] - Optional renderer options.
 * @returns {HtmlRenderer|MarkdownRenderer|HugoMarkdownRenderer}
 */
function createRenderer(type, blog = null, options = undefined) {
  const normalized = String(type || "").trim().toUpperCase();

  if (normalized === "HTML") {
    return new HtmlRenderer(blog, options);
  }
  if (normalized === "MARKDOWN") {
    return new MarkdownRenderer(blog, options);
  }
  if (normalized === "HUGO" || normalized === "HUGOMARKDOWN") {
    return new HugoMarkdownRenderer(blog, options);
  }

  throw new Error(`Unknown renderer type: ${type}`);
}

const blogRenderer = {
  // Keep class exports for backward compatibility; prefer createRenderer().
  HtmlRenderer: HtmlRenderer,
  MarkdownRenderer: MarkdownRenderer,
  HugoMarkdownRenderer: HugoMarkdownRenderer,
  createRenderer: createRenderer
};

export default blogRenderer;
