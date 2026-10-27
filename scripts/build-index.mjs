// index.ts is index.d.ts with every top-level declaration exported, for code
// that imports the types by name instead of listing the package in `types`
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const source = readFileSync(new URL("../index.d.ts", import.meta.url), "utf8");

// An export would turn index.d.ts from global declarations into a module
const exported = source.split("\n").filter((line) => /^export\b/.test(line));
if (exported.length) {
  throw new Error(
    `index.d.ts declares globals and exports nothing:\n${exported.join("\n")}`,
  );
}

const output = source.replace(
  /^(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|function|const|let|var|enum|namespace)\b/gm,
  (declaration) => `export ${declaration}`,
);

// A top-level form the pattern does not cover, such as `declare module`,
// would otherwise reach index.ts unexported
const unexported = output
  .split("\n")
  .filter((line) => /^[A-Za-z_$]/.test(line) && !line.startsWith("export "));
if (unexported.length) {
  throw new Error(
    `index.ts would not export these top-level lines of index.d.ts:\n${unexported.join("\n")}`,
  );
}

const target = new URL("../index.ts", import.meta.url);

if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== output) {
    console.error(
      "index.ts differs from what `npm run build` writes from index.d.ts",
    );
    process.exit(1);
  }
} else {
  writeFileSync(target, output);
}
