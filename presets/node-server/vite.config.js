import { defineConfig } from 'vite'
import { readJSON, F, viteCssModuleConfig, viteCssLessConfig } from "@zouloux/vite-config-helpers";
import { atomizer } from "vite-plugin-atomizer"
import { ViteMinifyPlugin } from 'vite-plugin-minify'
import { stachtml } from "vite-plugin-stachtml";
import { env } from "vite-plugin-env";
import checker from "vite-plugin-checker";
import { createCustomViteLogger } from "@zouloux/node-server";
// import prefresh from '@prefresh/vite';

export default defineConfig( viteConfig => {
	const isDev = viteConfig.mode === 'development'
	// We need a fixed port here because node server will proxy vite server
	const port = 5173
	// console.log(checker())
	return {
		// Use custom vite logger for server-build
		...createCustomViteLogger({ isDev, prefix: "deuspi" }),
		// Configure vite server and HMR
		server: {
			port,
			hmr: { port }
		},
		// Inject envs starting with
		envDir: F('./'),
		envPrefix: ['MY_APP_'],
		// Config build
		root: F('src/client/'),
		build: {
			outDir: F('dist/client/'),
			manifest: true,
			assetsDir: "./",
			rollupOptions: {
				input: F([
					// Do not name it index.html, otherwise proxy will return
					// any not found to index.html
					'src/client/app.html'
				]),
			},
		},
		// Config less & css modules
		css: {
			...viteCssModuleConfig( isDev ),
			...viteCssLessConfig(),
		},
		// Enable JSX for Preact and Reflex
		esbuild: {
			jsxFactory: 'h'
		},
		plugins: [
			// Minify HTML in production
			!isDev && ViteMinifyPlugin(),
			// Enable typescript checker
			checker({
				typescript: true, 	enableBuild: true,
				overlay: isDev, 	terminal: !isDev,
			}),
			// typeCheck({}),
			// Atomize variables of all less modules
			atomizer({
				files: ['**/*.module.less'],
			}),
			// Inject custom envs into bundle ( import.meta.env.* )
			env({
				VERSION: readJSON("package.json").version
			}),
			// Stach templating in HTML files
			stachtml({
				title: "Page title"
			})
		]
	}
})
