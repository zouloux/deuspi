import { buildServer } from "../dist/server-build.es2022.mjs";

buildServer( config => {
	// console.log( config );
	return {
		input: 'src/server/server.ts',
		output: 'dist/server/server.js',
		dev: {
			command: 'node server.js --dev',
			cwd: 'dist/server'
		},
	}
})