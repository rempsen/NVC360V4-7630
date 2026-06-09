import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite"
import path from "path";
import runableAnalyticsPlugin from "./vite/plugins/runable-analytics-plugin";
import honoDevPlugin from "./vite/plugins/hono-dev-plugin";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, root, '');
	Object.assign(process.env, env);

	return {
		plugins: [honoDevPlugin(), react(), runableAnalyticsPlugin(), tailwind()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src/web"),
			},
		},
		server: {
			allowedHosts: true,
			hmr: { overlay: false, },
			cors: false
		},
		build: {
			// Split ONLY heavy, self-contained libraries into their own chunks so
			// they load lazily on the routes that use them. Everything else
			// (React, ReactDOM, scheduler, router, query, and their dependents)
			// stays in a single `vendor` chunk.
			//
			// NOTE: do NOT hand-split the React ecosystem across multiple chunks.
			// Packages like @tanstack/react-query and wouter import React, and a
			// fragile path-based split can land a dependent in `vendor` while React
			// sits in `vendor-react`, producing a cross-chunk circular init that
			// throws "Cannot read properties of undefined (reading 'exports')" at
			// runtime — a fully blank page. Keeping them together guarantees a
			// correct, deterministic init order.
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (!id.includes("node_modules")) return;
						if (id.includes("leaflet")) return "vendor-maps";
						if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
						if (id.includes("pdf-lib")) return "vendor-pdf";
						return "vendor";
					},
				},
			},
			chunkSizeWarningLimit: 900,
		}
	};
});
