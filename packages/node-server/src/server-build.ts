import { BuildContext, context, Plugin, BuildOptions } from "esbuild"
import { spawn } from "child_process"
import { Signal } from "@zouloux/signal"
import { newLine, nicePrint, clearScreen } from "@zouloux/cli";
import { delay } from "@zouloux/ecma-core";

/**
 * TODO : Add on signal in options ( build / fail / etc )
 * TODO : Add more options
 */

// ----------------------------------------------------------------------------- TYPES

export type TBuildMode = ("dev" | "build")

export interface INodeServerConfig
{
	// Bundle input and output
	input	: string;
	output	: string;
	// Dev mode
	dev	?: {
		command		: string
		cwd			?: string
		killSignal	?: string
	},
	// Es options
	esOptions	?:Partial<BuildOptions>
	esPlugins	?:Plugin[]
	// Logger
	logger	?:ILogger
	logPrefix ?:string
	// Env
	env 	?:any
}

export interface ILogger {
	prefix	?:string
	noPrefixOnNextLine ?: false
	print ( content, options? )
	error ( message, code? )
	clear ()
}

type IConfigHandler = INodeServerConfig | ((mode:TBuildMode) => INodeServerConfig)

// ----------------------------------------------------------------------------- PLUGIN

/**
 * Force node_modules imports to be kept in esbuild output.
 * Usually, node_modules are included into bundle or translated to something like
 * ../../node_modules/@zouloux/cli/dist/index.js
 * With this plugin, output will be kept as import("@zouloux/cli")
 */
export const keepNodeModulesPlugin:Plugin = {
	name: 'keep-node-modules',
	setup ( build ) {
		// Intercept resolution of node modules
		// ✅ child_process
		// ✅ minimist
		// ✅ @zouloux/cli
		// ❌ ./other-file.js
		// ❌ ../other-file.js
		build.onResolve({ filter: /^[a-zA-Z0-9_\-@](.*)/ }, async () => {
			// Force it to be an external resource
			return { external: true }
		})
	}
}

/**
 * Add watch plugin in dev mode only.
 * Will show build results and re-start node server when build is completed.
 */
export const watchPlugin:Plugin = {
	name: 'watch-plugin',
	setup ( build ) {
		let isFirst = true
		build.onEnd( async ( result ) => {
			buildResult( result, isFirst )
			isFirst = false
			// Restart dev server after rebuild
			await delay(.3)
			config.logger.clear();
			restartServer()
		})
	}
}

// ----------------------------------------------------------------------------- LOGGER

/**
 * Create default logger, compatible with vite-custom-logger
 */
function createDefaultLogger ( prefix ):ILogger {
	return {
		prefix: `{d}${prefix}{/} - `,
		noPrefixOnNextLine: false,
		print ( content, options? ) { // TODO : add type or level ( regular / important / warning / success / error / ... for styling )
			if ( !this.noPrefixOnNextLine )
				content = this.prefix + content
			nicePrint( content, options )
			this.noPrefixOnNextLine = ( options && !options.newLine )
		},
		error ( message, code ) {
			console.error( message )
		},
		clear () {
			clearScreen()
		}
	}
}

// ----------------------------------------------------------------------------- CONFIG

// Config and args are module scoped
let config		:INodeServerConfig;
let buildMode	:TBuildMode

// ----------------------------------------------------------------------------- DEV SERVER

let serverInstance
let onServerExitSignal = Signal()
let serverBusyLocked = false

const onServerExit = () => new Promise<void>( resolve => {
	if (!serverInstance) resolve();
	onServerExitSignal.add( resolve )
})

async function startServer () {
	serverBusyLocked = true;
	config.logger.print(`{b/c}Spawning server {/}{d}- ${config.dev.command}`)
	// Generate command and spawn a new sub-process
	const args = config.dev.command.split(" ")
	serverInstance = spawn(args.shift(), args, {
		// detached: false,
		cwd: config.dev.cwd ?? process.cwd(),
		env: config.env,
		stdio: 'inherit'
	});
	// Listen for server exit / crashes
	serverInstance.once('exit', async ( code ) => {
		// Unlock server business
		serverBusyLocked = false;
		// If there are no listeners yet, the process crashed at init
		if ( onServerExitSignal.listeners.length === 0 )
			config.logger.print(`{b/r}Server ${code === 0 ? 'stopped' : 'crashed'} at init ${ code === 0 ? 'without error code' : 'with code '+code}.`)
		// Dispatch for exit listeners and clean
		onServerExitSignal.dispatch( code );
		onServerExitSignal.clear();
		serverInstance.removeAllListeners();
		serverInstance = null
		// Wait for file changes to rebuild
		if ( onServerExitSignal.listeners.length > 0 )
			config.logger.print(`{b/c}Waiting for file change...`)
	})
	// TODO : Implement lock to avoid parallel serverInstances running
	serverBusyLocked = false
}

function killServer () {
	// FIXME : Other signals to force exit ?
	// FIXME : 'SIGINT' // force ? "SIGKILL" : "SIGTERM"
	serverInstance.kill( config.dev.killSignal ?? 'SIGINT' );
}

async function stopServer () {
	if ( !serverInstance ) return;
	serverBusyLocked = true
	await new Promise<void>( resolve => {
		config.logger.print("{b/c}Stopping server ...", { newLine: false });
		onServerExit().then( async code => {
			config.logger.print(' {b/g}stopped')
			serverBusyLocked = false
			resolve()
		})
		killServer();
	})
}

async function restartServer () {
	if ( serverBusyLocked ) return;
	await stopServer()
	await startServer()
}

// ----------------------------------------------------------------------------- BUILD

let buildContext:BuildContext

function buildFailed ( error, code = 1 ) {
	config.logger.print(`{b/r}Build failed`)
	config.logger.error( error )
	process.exit( code );
}

function buildResult ( result, isFirst = false ) {
	result.warnings.forEach( w => config.logger.print(`{b/o}Warn > ${w}`) )
	result.errors.length === 0 && config.logger.print(isFirst ? `{b/g} success`: `{b/g}Rebuilt ✨`);
}

/**
 * Build server in watch or build mode.
 */
export async function buildServer ( mode:TBuildMode ) {
	buildMode = mode
	if ( !config )
		throw new Error("Please use defineConfig in your server config file.")
	// Print without line jump for the "success"
	config.logger.print(`{b/c}Building server ...`, { newLine: false })
	// Build server
	try {
		const plugins = [
			keepNodeModulesPlugin,
			...config.esPlugins,
		];
		if ( buildMode === "dev" )
			plugins.push( watchPlugin )
		buildContext = await context({
			target: 'node16',
			platform: 'node',
			format: 'esm',
			minify: false,
			bundle: true,
			logLevel: 'silent',
			plugins,
			// Inject custom es options before forced options
			...config.esOptions,
			// Forced options (not available in config)
			entryPoints: [ config.input ],
			outfile: config.output,
		})
	}
	// Display errors
	catch ( error ) {
		newLine()
		buildFailed( error )
		return;
	}
	// Dev mode
	if ( buildMode === "dev" ) {
		// Verify config, we need a dev command
		!config.dev && nicePrint(`{b/r}Please set dev config to use dev mode.`, {
			code: 1
		})
		// Start watch ( watch plugin will start server )
		await buildContext.watch()
	}
	// Build mode
	else {
		const results = await buildContext.rebuild();
		buildResult( results, true )
		await buildContext.dispose();
	}
}

// ----------------------------------------------------------------------------- DEFINE CONFIG

export function defineConfig ( configHandler ) {
	// Get user config
	let userConfig
	if ( typeof configHandler === "function" )
		userConfig = configHandler({ mode: buildMode })
	else if ( typeof configHandler === "object" && !Array.isArray(configHandler) )
		userConfig = configHandler
	else {
		nicePrint(`{b/r}Invalid config ${configHandler}`)
		process.exit(1)
	}
	if ( !userConfig.input || !userConfig.output ) {
		nicePrint(`{b/r}Invalid config ${configHandler}, missing parameters.`)
		process.exit(2)
	}
	// Compute config from default and user config
	// Store in module scope
	config = {
		logger: createDefaultLogger( userConfig.logPrefix ?? "server" ),
		esOptions: {},
		esPlugins: [],
		...userConfig
	}
	// Compute default env from config
	if ( typeof config.env === "undefined" )
		config.env = process.env
	else if ( typeof config.env === "function" )
		config.env = config.env()
}

