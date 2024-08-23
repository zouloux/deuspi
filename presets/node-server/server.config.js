import { defineConfig } from "@zouloux/node-server";
import { newLine } from "@zouloux/cli";
newLine()
defineConfig( mode => {
	return {
		input: 'src/server/server.ts',
		output: 'dist/server/server.js',
		dev: {
			command: 'node server.js --dev',
			cwd: 'dist/server'
		}
	}
})
