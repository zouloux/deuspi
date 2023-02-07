
/**
 * TODO TODO
 * GOAL : Use tsc watch mode to use less CPU, better battery.
 * - Config to be able ton configure watch, more or less precise.
 * - Only show errors in terminal, clean a bit TS errors if possible
 * - Add sound option !
 */

import { relative, resolve, dirname } from "path"
import { existsSync } from "fs"
import { spawn } from "child_process"

interface ITypeCheckConfig
{
	// Path to tsconfig file, relative to vite config file
	tsconfig	?:string

	// Add flags after the tsc command
	// @see https://www.typescriptlang.org/docs/handbook/compiler-options.html
	flags		?:string[]
}

export function typeCheck ( pluginConfig:ITypeCheckConfig ) {
	return {}
	pluginConfig = {
		tsconfig: './tsconfig.json',
		flags: [],
		...pluginConfig
	}
	let _viteConfig
	let _tscProcess;
	return {
		name: "type-check",
		configResolved ( config ) {
			// console.log(config)
			_viteConfig = config;
		},
		async buildStart () {
			if ( _tscProcess ) return;
			console.log("BUILD START")
			// Target typescript compiler from node_modules
			const tscBinPath = "./node_modules/.bin/tsc"
			if ( !existsSync(tscBinPath) )
				_viteConfig.logger.error(`${this.name} - TSC binary not found. Please install typescript locally.`);
			// Target tsconfig project file from vite config
			const projectPath = resolve(
				relative(
					dirname(_viteConfig.configFile), pluginConfig.tsconfig
				)
			);
			// Generate command
			const commands = [ tscBinPath ]
			// Use tsconfig.json if it exists next to
			if ( existsSync(projectPath) )
				commands.push( "--project", projectPath )
			else {
				commands.push(`${_viteConfig.root}/**/*.(ts|tsx|d.ts)`)
				_viteConfig.logger.warn(`${this.name} - tsconfig.json not found. Auto-mode.`)
			}
			// Add mandatory flags
			// commands.push("--noEmit", "--watch", "--preserveWatchOutput")
			commands.push("--noEmit", "--preserveWatchOutput")
			// Add custom flags
			commands.push( ...pluginConfig.flags )

			// console.log()
			const command = commands.shift();
			// console.log(command, commands)

			_tscProcess = spawn( command, commands, {
				// detached: true,
				// stdio: [ null, null, null ],
				stdio: "pipe",

				cwd: process.cwd(),
				// stdio: "inherit",
				// env: localEnv,
				shell: true

			})

			return new Promise( resolve => {

			})

			_tscProcess.on("exit", (code) => {
				console.log("EXIT", code)
				// if (code !== null && code !== 0) {
				// 	resolve(code);
				// } else {
				// 	resolve(0);
				// }
			});


			/*_tscProcess.stdout.on('data', function(data) {
				console.log("OUT", data.length)
				return null;
				// process.stdout.write( data )
			});
			_tscProcess.stderr.on('data', function(data) {
				console.log("ERR", data.length)
				return null;

			})*/
		}
	}
	// const r = execSync(``)
}