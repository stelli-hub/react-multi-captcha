import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Resolve `react-multi-captcha` to the local `src/` so the demo always uses the
// in-repo source — no need to rebuild the library between edits.
const libEntry = new URL("../src/index.ts", import.meta.url).pathname;

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"react-multi-captcha": libEntry,
		},
		dedupe: ["react", "react-dom"],
	},
	server: {
		port: 5173,
		host: "localhost",
	},
});
