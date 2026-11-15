import markdownIt from "markdown-it";
import should from "should";

import wikiMarkdownPlugin, { slugify, resolveWikiLink, resolveWikiMedia } from "../wiki/wikiMarkdown.js";

describe("wiki/wikiMarkdown", function() {
  const md = markdownIt().use(wikiMarkdownPlugin, { basePath: "/root/wiki" });
  const existing = new Set(["start", "osmbc/start", "osmbc/review"]);
  function render(text, currentId = "osmbc/start") {
    const env = { wiki: { currentId, exists: (id) => existing.has(id) } };
    return { html: md.render(text, env), toc: env.toc };
  }

  it("should slugify headings", function() {
    should(slugify("Vision & Rules (EN)")).eql("vision-rules-en");
    should(slugify("Grundsätze zur Formulierung")).eql("grundsätze-zur-formulierung");
    should(slugify("!!!")).eql("section");
  });

  it("should give headings unique ids and collect the table of contents", function() {
    const { html, toc } = render("# Title\n## Part\n## Part\n### `code` here\n");
    should(html).containEql("<h1 id=\"title\">Title</h1>");
    should(html).containEql("<h2 id=\"part-2\">Part</h2>");
    should(toc).eql([
      { level: 1, id: "title", text: "Title" },
      { level: 2, id: "part", text: "Part" },
      { level: 2, id: "part-2", text: "Part" },
      { level: 3, id: "code-here", text: "code here" }
    ]);
  });

  it("should resolve wiki links against the base path and the current namespace", function() {
    should(resolveWikiLink("/wiki/osmbc/review", "/root/wiki", "start")).eql({ href: "/root/wiki/osmbc/review", pageId: "osmbc/review" });
    should(resolveWikiLink("review#rules", "/root/wiki", "osmbc/start")).eql({ href: "/root/wiki/osmbc/review#rules", pageId: "osmbc/review" });
    should(resolveWikiLink("../start", "/root/wiki", "osmbc/start")).eql({ href: "/root/wiki/start", pageId: "start" });
    should(resolveWikiLink("Onboarding", "/root/wiki", "meetings/x")).eql({ href: "/root/wiki/meetings/onboarding", pageId: "meetings/onboarding" });
    should(resolveWikiLink("/wiki/osmbc/My%20Page", "/root/wiki", "x")).eql({ href: "/root/wiki/osmbc/my_page", pageId: "osmbc/my_page" });
    should(resolveWikiLink("/wiki", "/root/wiki", "x")).eql({ href: "/root/wiki", pageId: null });
    should(resolveWikiLink("/wiki/_search?q=x", "/root/wiki", "x")).eql({ href: "/root/wiki/_search?q=x", pageId: null });
    for (const href of ["https://osm.org", "mailto:a@b.c", "//example.com/x", "#anchor", "/blog/WN850", "../../x", ""]) {
      should(resolveWikiLink(href, "/root/wiki", "osmbc/start") === null).be.true(href);
    }
  });

  it("should mark links to missing pages", function() {
    const { html } = render("[ok](/wiki/osmbc/review) [missing](new_page) [bad](/wiki/Bad.Name) [ext](https://osm.org)");
    should(html).containEql("<a href=\"/root/wiki/osmbc/review\">ok</a>");
    should(html).containEql("<a href=\"/root/wiki/osmbc/new_page\" class=\"osmbc-wiki-missing\">missing</a>");
    should(html).containEql("<a href=\"/root/wiki/bad.name\" class=\"osmbc-wiki-missing\">bad</a>");
    should(html).containEql("<a href=\"https://osm.org\">ext</a>");
  });

  it("should rewrite media paths", function() {
    should(resolveWikiMedia("/wiki/_media/osmbc/shot.png", "/root/wiki", "x")).eql("/root/wiki/_media/osmbc/shot.png");
    should(resolveWikiMedia("media/logo.svg", "/root/wiki", "osmbc/start")).eql("/root/wiki/_media/logo.svg");
    should(resolveWikiMedia("shot.png", "/root/wiki", "osmbc/start")).eql("/root/wiki/_media/osmbc/shot.png");
    should(resolveWikiMedia("https://example.com/a.png", "/root/wiki", "x")).eql("https://example.com/a.png");
    should(resolveWikiMedia("/images/a.png", "/root/wiki", "x")).eql("/images/a.png");
    should(render("![logo](media/logo.svg)").html).containEql("<img src=\"/root/wiki/_media/logo.svg\" alt=\"logo\">");
  });

  it("should keep raw HTML escaped", function() {
    should(render("<script>alert(1)</script>\n\n[x](javascript:alert(1))").html).not.containEql("<script>");
    should(render("[x](javascript:alert(1))").html).not.containEql("href=\"javascript");
  });

  it("should work without page context", function() {
    should(md.render("[a](/wiki/start)")).containEql("href=\"/root/wiki/start\"");
  });
});
