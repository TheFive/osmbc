import should from "should";
import { htmlTableToMarkdown } from "../backport/htmlTableToMarkdown.js";

describe("htmlTableToMarkdown", function () {
  it("converts a real table fragment (WN275 Wochenvorschau excerpt) into a proper Markdown table, not flattened text", function () {
    const html = `
<thead>
<tr><th>Ort</th><th>Name</th><th>Datum</th></tr>
</thead>
<tbody>
<tr><td>Dortmund</td><td><a href="https://wiki.openstreetmap.org/wiki/Mappertreffen_Dortmund">Stammtisch</a></td><td>01.11.2015</td></tr>
<tr><td>Rostock</td><td><a href="http://wiki.openstreetmap.org/wiki/Rostocker_Treffen">Stammtisch</a></td><td>03.11.2015</td></tr>
</tbody>`;
    const md = htmlTableToMarkdown(html);
    const lines = md.split("\r\n");
    lines[0].should.equal("| Ort | Name | Datum |");
    lines[1].should.equal("| --- | --- | --- |");
    lines[2].should.equal("| Dortmund | [Stammtisch](https://wiki.openstreetmap.org/wiki/Mappertreffen_Dortmund) | 01.11.2015 |");
    lines[3].should.equal("| Rostock | [Stammtisch](http://wiki.openstreetmap.org/wiki/Rostocker_Treffen) | 03.11.2015 |");
  });

  it("falls back to using the first body row as the header when there is no <thead>", function () {
    const html = `
<tbody>
<tr><td>Software</td><td>Version</td></tr>
<tr><td>iD</td><td>1.9.2</td></tr>
</tbody>`;
    const md = htmlTableToMarkdown(html);
    const lines = md.split("\r\n");
    lines[0].should.equal("| Software | Version |");
    lines[1].should.equal("| --- | --- |");
    lines[2].should.equal("| iD | 1.9.2 |");
  });

  it("escapes a literal pipe character inside a cell so it doesn't break the table", function () {
    const html = `<thead><tr><th>A</th></tr></thead><tbody><tr><td>a | b</td></tr></tbody>`;
    const md = htmlTableToMarkdown(html);
    md.split("\r\n")[2].should.equal("| a \\| b |");
  });
});
