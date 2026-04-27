
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


const projectDir = path.dirname(fileURLToPath(import.meta.url));


function copy(srcpath, destpath) {
  const src = path.join(projectDir, "node_modules", srcpath);
  const dest = path.join(projectDir, "public", destpath);
  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    throw new Error(`postinstall copy failed: ${src} -> ${dest}: ${err.message}`);
  }
}

function createDir(dir) {
  const d = path.join(projectDir, "public", dir);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

createDir("fonts");
createDir("javascripts");
createDir("stylesheets");


copy("/bootstrap/dist/css/bootstrap.min.css", "/stylesheets/bootstrap.min.css");
copy("/bootstrap/dist/css/bootstrap.min.css.map", "/stylesheets/bootstrap.min.css.map");
copy("/bootstrap/dist/js/bootstrap.bundle.min.js", "/javascripts/bootstrap.bundle.min.js");
copy("/bootstrap/dist/js/bootstrap.bundle.min.js.map", "/javascripts/bootstrap.bundle.min.js.map");

copy("/jquery/dist/jquery.min.js", "/javascripts/jquery.min.js");

copy("/bootstrap-select/dist/css/bootstrap-select.min.css", "stylesheets/bootstrap-select.min.css");
copy("/bootstrap-select/dist/js/bootstrap-select.min.js", "/javascripts/bootstrap-select.min.js");
copy("/bootstrap-select/dist/js/bootstrap-select.min.js.map", "/javascripts/bootstrap-select.min.js.map");

copy("/font-awesome/css/font-awesome.min.css", "stylesheets/font-awesome.min.css");
copy("/font-awesome/fonts/fontawesome-webfont.woff2", "fonts/fontawesome-webfont.woff2");



copy("/markdown-it/dist/markdown-it.min.js", "javascripts/markdown-it.min.js");
copy("/markdown-it-imsize/dist/markdown-it-imsize.js", "javascripts/markdown-it-imsize.min.js");
copy("/markdown-it-link-attributes/dist/markdown-it-link-attributes.min.js", "javascripts/markdown-it-link-attributes.min.js");
copy("/markdown-it-sup/dist/markdown-it-sup.js", "javascripts/markdown-it-sup.min.js");
copy("/markdown-it-emoji/dist/markdown-it-emoji.min.js", "javascripts/markdown-it-emoji.min.js");


copy("/moment/min/moment.min.js", "/javascripts/moment.min.js");
copy("/moment/min/moment.min.js.map", "/javascripts/moment.min.js.map");



