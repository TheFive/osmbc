// scanTransitionalEra.js is the top-level orchestration script (no
// exports) - this test duplicates its small convertWpHtml() dispatch logic
// to lock in the behavior without needing to export internals from a
// script that's meant to be run, not imported.
import should from "should";
import { htmlToMarkdown } from "../backport/htmlToMarkdown.js";
import { htmlTableToMarkdown } from "../backport/htmlTableToMarkdown.js";

function convertWpHtml(html) {
  return /<tr[\s>]/i.test(html) ? htmlTableToMarkdown(html) : htmlToMarkdown(html);
}

describe("convertWpHtml (scanTransitionalEra.js's table-aware conversion)", function () {
  it("uses htmlTableToMarkdown for a table-shaped bullet (real case: WN275 article 10072's Wochenvorschau table)", function () {
    const html = `<thead><tr><th>Ort</th><th>Name</th></tr></thead><tbody><tr><td>Dortmund</td><td><a href="https://wiki.openstreetmap.org/wiki/Mappertreffen_Dortmund">Stammtisch</a></td></tr></tbody>`;
    const result = convertWpHtml(html);
    result.should.startWith("| Ort | Name |");
  });

  it("uses plain htmlToMarkdown for a normal prose bullet", function () {
    const html = 'Der <a href="https://example.com">Text</a> ist normale Prosa.';
    const result = convertWpHtml(html);
    result.should.not.containEql("|");
    result.should.containEql("[Text](https://example.com)");
  });
});
