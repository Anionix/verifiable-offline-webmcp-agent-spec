// information_uuid_v5=91f57e50-0c81-5f33-a56f-86c15d65811a
// event_uuid_v7=01a04bd0-b895-776e-a3d3-a522fbd4b10b state_transition=HOTEL_SOURCE_READY -> MULTI_HOST_ARTIFACT_CONFIGURED occurred_at=2026-08-29T01:00:00Z
// machine-contract: one source build emits separate Sites server metadata and portable dist/client assets; the service registry is copied byte-for-byte.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vite";

const repositoryRoot = new URL(".", import.meta.url).pathname;
const registryPath = resolve(repositoryRoot, "metadata/service-integration-registry.json");

function emitServiceRegistry() {
  return {
    name: "emit-service-integration-registry",
    apply: "build",
    applyToEnvironment(environment) {
      return environment.name === "client";
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "service-integrations.json",
        source: await readFile(registryPath),
      });
    },
  };
}

export default defineConfig({
  publicDir: "examples/hotel-booking-demo/public",
  plugins: [emitServiceRegistry(), cloudflare(), sites()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  environments: {
    verifiable_offline_webmcp_agent_spec: {
      build: {
        outDir: "dist/server",
        rollupOptions: {
          output: {
            entryFileNames: "index.js",
            chunkFileNames: "[name].js",
            assetFileNames: "[name][extname]",
          },
        },
      },
    },
  },
});
