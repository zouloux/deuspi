import { defineConfig } from 'vite'
import { createCustomViteLogger } from "../dist/vite-custom-logger.es2022.mjs";
import { resolve } from "path"

export default defineConfig( viteConfig => {
	const isDev = viteConfig.mode === 'development'
	// We need a fixed port here because node server will proxy vite server
	const port = 5173
	return {
		// Use custom vite logger for node-server
		...createCustomViteLogger({ isDev }),
		server: {
			port,
			hmr: { port }
		},
		// Config build
		root: resolve('src/client/'),
		build: {
			outDir: resolve('dist/client/'),
			manifest: true,
			assetsDir: "./",
			rollupOptions: {
				input: [
					resolve('src/client/index.html')
				]
			},
		}
	}
})