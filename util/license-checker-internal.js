import fs from "fs";
import path from "path";

function extractNameFromPath(packagePath) {
  const marker = "node_modules/";
  const idx = packagePath.lastIndexOf(marker);
  if (idx === -1) return null;
  return packagePath.slice(idx + marker.length);
}

function normalizeLicense(raw) {
  if (!raw) return "UNKNOWN";

  if (typeof raw === "string") {
    return raw;
  }

  if (Array.isArray(raw)) {
    const mapped = raw
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.type === "string") return entry.type;
        return null;
      })
      .filter(Boolean);
    if (mapped.length > 0) return mapped;
    return "UNKNOWN";
  }

  if (typeof raw === "object") {
    if (typeof raw.type === "string") return raw.type;
    return "UNKNOWN";
  }

  return "UNKNOWN";
}

function detectLicenseFromText(text) {
  const source = String(text || "").toUpperCase();
  if (!source) return null;

  if (/\bLICENSE\b[\s\S]{0,120}\bMIT\b/.test(source)) return "MIT";
  if (source.includes("MIT LICENSE") || source.includes("(THE MIT LICENSE)") || source.includes("PERMISSION IS HEREBY GRANTED")) return "MIT";
  if (source.includes("THIS IS FREE AND UNENCUMBERED SOFTWARE") || source.includes("UNLICENSE.ORG")) return "Unlicense";
  if (source.includes("BSD-3-CLAUSE") || source.includes("REDISTRIBUTION AND USE IN SOURCE AND BINARY FORMS")) return "BSD-3-Clause";
  if (source.includes("BSD-2-CLAUSE")) return "BSD-2-Clause";
  if (source.includes("BSD LICENSE")) return "BSD";
  if (source.includes("APACHE LICENSE") && source.includes("VERSION 2")) return "Apache-2.0";
  if (source.includes("ISC LICENSE")) return "ISC";

  return null;
}

function detectLicenseFromFiles(packageDir) {
  const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "Readme.md", "README.md", "README"];

  try {
    const dirEntries = fs.readdirSync(packageDir);
    for (const entry of dirEntries) {
      if (/^(license|copying)(\.|$)/i.test(entry) && !candidates.includes(entry)) {
        candidates.unshift(entry);
      }
      if (/^readme(\.|$)/i.test(entry) && !candidates.includes(entry)) {
        candidates.push(entry);
      }
    }
  } catch {
    // Keep default candidates if directory read fails.
  }

  for (const file of candidates) {
    const filePath = path.join(packageDir, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      const content = fs.readFileSync(filePath, "utf8").slice(0, 12000);
      const detected = detectLicenseFromText(content);
      if (detected) return detected;
    } catch {
      // Ignore unreadable files and continue with next candidate.
    }
  }

  return "UNKNOWN";
}

function shouldIncludePackage(pkg, opts) {
  if (opts.production) {
    return pkg.dev !== true;
  }

  return true;
}

export function init(options, callback) {
  try {
    const startDir = options?.start || process.cwd();
    const lockfilePath = path.join(startDir, "package-lock.json");

    if (!fs.existsSync(lockfilePath)) {
      callback(new Error("package-lock.json not found"));
      return;
    }

    const lockfile = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
    const packages = lockfile.packages || {};
    const result = {};

    for (const [packagePath, pkg] of Object.entries(packages)) {
      if (!packagePath || !pkg || !pkg.version) continue;
      if (!shouldIncludePackage(pkg, options || {})) continue;

      const name = pkg.name || extractNameFromPath(packagePath);
      if (!name) continue;

      const key = `${name}@${pkg.version}`;
      let normalized = normalizeLicense(pkg.license || pkg.licenses);
      if (normalized === "UNKNOWN") {
        normalized = detectLicenseFromFiles(path.join(startDir, packagePath));
      }

      result[key] = {
        licenses: normalized
      };
    }

    callback(null, result);
  } catch (error) {
    callback(error);
  }
}
