import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the MCP Apps UI (ui/index.html + ui/src) into a single
// self-contained HTML file at dist/ui/index.html. The server reads that
// file at runtime and serves it as the ui://rakuten-mcp/item-search
// resource. Run AFTER the server build (tsup --clean wipes dist/).
export default defineConfig({
  root: "ui",
  plugins: [viteSingleFile()],
  build: {
    outDir: "../dist/ui",
    emptyOutDir: true,
  },
});
