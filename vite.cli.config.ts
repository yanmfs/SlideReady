import { defineConfig } from "vite";

// Bundles the command line tool into one file that runs on plain Node, with the same core as the app.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: "src/cli/main.ts",
    outDir: "dist-cli",
    emptyOutDir: true,
    target: "node20",
    rollupOptions: {
      output: { entryFileNames: "slideready.mjs", banner: "#!/usr/bin/env node" },
    },
  },
  ssr: { noExternal: true, target: "node" },
});
