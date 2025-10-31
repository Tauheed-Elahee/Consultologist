import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
	output: "static",
	adapter: node({
		mode: "standalone",
	}),
	server: {
		host: true,
		port: 4321,
	},
	vite: {
		assetsInclude: ["**/*.liquid"],
		json: {
			stringify: false,
		},
	},
});
