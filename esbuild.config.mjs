import esbuild from "esbuild";
import { readFileSync } from "fs";

// pdfmake bringt gebündelte Polyfills mit, die Code per Function()/eval erzeugen.
// Obsidians Review lehnt das ab. Diese Stellen werden durch gleichwertigen,
// statischen Code ersetzt.
// Der Quellcode nutzt teils einfache, teils doppelte Anführungszeichen: ['"]
const REPLACEMENTS = [
  // globales Objekt ermitteln
  [/new Function\(['"]return this['"]\)\(\)/g, "globalThis"],
  [/(?<![.\w$])Function\(['"]return this['"]\)\(\)/g, "globalThis"],
  // Generator-Funktion erkennen
  [/(?<![.\w$])Function\(['"]return function\*\s*\(\)\s*\{\}['"]\)\(\)/g, "(function* () {})"],
  // get-intrinsic: Konstruktor von async/generator per Function ermitteln (optional, in try/catch)
  [/\$Function\([^\n]*expressionSyntax[^\n]*\)\(\)/g, "undefined"],
  // function-bind: gebundene Funktion
  [
    /bound = Function\(['"]binder['"],[^\n]*binder\.apply\(this,arguments\);[^\n]*\)\(binder\);/g,
    "bound = function () { return binder.apply(this, arguments); };",
  ],
];

const noDynamicCode = {
  name: "no-dynamic-code",
  setup(build) {
    build.onLoad({ filter: /node_modules[\\/].*\.js$/ }, (args) => {
      let src = readFileSync(args.path, "utf8");
      for (const [re, to] of REPLACEMENTS) src = src.replace(re, to);
      return { contents: src, loader: "js" };
    });
  },
};

const mode = process.argv[2];
if (mode === "test") {
  await esbuild.build({
    entryPoints: ["test/test.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: "test/out/test.cjs",
    external: ["jsdom"],
    plugins: [noDynamicCode],
  });
} else {
  await esbuild.build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    platform: "browser",
    format: "cjs",
    target: "es2018",
    external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
    outfile: "main.js",
    minify: true,
    logLevel: "info",
    plugins: [noDynamicCode],
  });
  const out = readFileSync("main.js", "utf8");
  const bad = out.match(/(?<![.\w$])(?:new Function|Function|eval)\s*\(/g);
  if (bad) {
    console.error("Dynamic code execution still present:", bad.length, "occurrence(s)");
    process.exit(1);
  }
}
