import { defineConfig } from "vitest/config";

// node:sqlite is not yet in Node's builtinModules list, so Vite/vite-node strips
// the "node:" prefix and tries to resolve "sqlite" as an npm package — failing.
// Work-around: intercept both "node:sqlite" and "sqlite" via a virtual module
// that uses createRequire (which CAN load node: built-ins) to bridge the gap.

const VIRTUAL_SQLITE = "\0virtual:node-sqlite";

export default defineConfig({
  plugins: [
    {
      name: "node-sqlite-compat",
      enforce: "pre",
      resolveId(id) {
        if (id === "node:sqlite" || id === "sqlite") {
          return VIRTUAL_SQLITE;
        }
      },
      load(id) {
        if (id === VIRTUAL_SQLITE) {
          const base = JSON.stringify(process.cwd().split("\\").join("/") + "/");
          return [
            'import { createRequire } from "node:module";',
            `const _req = createRequire(${base});`,
            'export const DatabaseSync = _req("node:sqlite").DatabaseSync;',
          ].join("\n");
        }
      },
    },
  ],
  test: {
    environment: "node",
  },
});
