import fs from "node:fs";
import path from "node:path";

const reportPath = process.argv[2] || "coverage/lcov.info";
const includePrefix = (process.argv[3] || "").replaceAll("\\", "/");

if (!fs.existsSync(reportPath)) {
  console.error(`Coverage report not found: ${reportPath}`);
  process.exit(1);
}

const content = fs.readFileSync(reportPath, "utf8").split("\n");
let currentFile = "";
const functionLines = new Map();
const uncoveredByFile = new Map();

for (const rawLine of content) {
  const line = rawLine.trim();

  if (line.startsWith("SF:")) {
    const lcovFile = line.slice(3).replaceAll("\\", "/");
    currentFile = path.relative(process.cwd(), lcovFile).replaceAll("\\", "/");
    continue;
  }

  if (!currentFile) {
    continue;
  }

  if (includePrefix && !currentFile.startsWith(includePrefix)) {
    continue;
  }

  if (line.startsWith("FN:")) {
    const value = line.slice(3);
    const separatorIndex = value.indexOf(",");
    const fnLine = Number(value.slice(0, separatorIndex));
    const fnName = value.slice(separatorIndex + 1);
    functionLines.set(`${currentFile}::${fnName}`, Number.isNaN(fnLine) ? "?" : fnLine);
    continue;
  }

  if (line.startsWith("FNDA:")) {
    const value = line.slice(5);
    const separatorIndex = value.indexOf(",");
    const hitCount = Number(value.slice(0, separatorIndex));
    const fnName = value.slice(separatorIndex + 1);

    if (hitCount === 0) {
      const fnLine = functionLines.get(`${currentFile}::${fnName}`) ?? "?";
      if (!uncoveredByFile.has(currentFile)) {
        uncoveredByFile.set(currentFile, []);
      }
      uncoveredByFile.get(currentFile).push({ name: fnName, line: fnLine });
    }
  }
}

if (uncoveredByFile.size === 0) {
  console.log("No uncovered functions found for current filter.");
  process.exit(0);
}

console.log("Uncovered functions (FNDA:0):");
for (const file of [...uncoveredByFile.keys()].sort()) {
  console.log(`\n${file}`);
  const rows = uncoveredByFile.get(file).sort((a, b) => {
    const lineA = typeof a.line === "number" ? a.line : Number.MAX_SAFE_INTEGER;
    const lineB = typeof b.line === "number" ? b.line : Number.MAX_SAFE_INTEGER;
    return lineA - lineB;
  });

  for (const row of rows) {
    console.log(`  L${row.line}: ${row.name}`);
  }
}
