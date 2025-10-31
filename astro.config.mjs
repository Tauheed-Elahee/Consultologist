import node from "@astrojs/node";
import { defineConfig } from "astro/config";

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
