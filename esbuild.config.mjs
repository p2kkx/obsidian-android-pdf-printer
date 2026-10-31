import esbuild from "esbuild";

const mode = process.argv[2];
if (mode === "test") {
  await esbuild.build({
    entryPoints: ["test/test.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: "test/out/test.cjs",
    external: ["jsdom"],
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
  });
}
