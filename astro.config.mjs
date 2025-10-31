import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	output: "static",
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
