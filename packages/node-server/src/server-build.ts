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
	env 	?:any|((env:any) => any)
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
			_config.logger.clear();
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
let _config		:INodeServerConfig;
let _buildMode	:TBuildMode

// ----------------------------------------------------------------------------- DEV SERVER

let _serverInstance
let _onServerExitSignal = Signal()
let _serverBusyLocked = false

const onServerExit = () => new Promise<void>( resolve => {
	if (!_serverInstance) resolve();
	_onServerExitSignal.add( resolve )
})

async function startServer () {
	_serverBusyLocked = true;
	_config.logger.print(`{b/c}Spawning server {/}{d}- ${_config.dev.command}`)
	// Generate command and spawn a new sub-process
	const args = _config.dev.command.split(" ")
	_serverInstance = spawn(args.shift(), args, {
		// detached: false,
		cwd: _config.dev.cwd ?? process.cwd(),
		env: _config.env,
		stdio: 'inherit'
	});
	// Listen for server exit / crashes
	_serverInstance.once('exit', async ( code ) => {
		// Unlock server business
		_serverBusyLocked = false;
		// If there are no listeners yet, the process crashed at init
		if ( _onServerExitSignal.listeners.length === 0 )
			_config.logger.print(`{b/r}Server ${code === 0 ? 'stopped' : 'crashed'} at init ${ code === 0 ? 'without error code' : 'with code '+code}.`)
		// Dispatch for exit listeners and clean
		_onServerExitSignal.dispatch( code );
		_onServerExitSignal.clear();
		_serverInstance.removeAllListeners();
		_serverInstance = null
		// Wait for file changes to rebuild
		if ( _onServerExitSignal.listeners.length > 0 )
			_config.logger.print(`{b/c}Waiting for file change...`)
	})
	// TODO : Implement lock to avoid parallel serverInstances running
	_serverBusyLocked = false
}

function killServer () {
	// FIXME : Other signals to force exit ?
	// FIXME : 'SIGINT' // force ? "SIGKILL" : "SIGTERM"
	_serverInstance.kill( _config.dev.killSignal ?? 'SIGINT' );
}

async function stopServer () {
	if ( !_serverInstance ) return;
	_serverBusyLocked = true
	await new Promise<void>( resolve => {
		_config.logger.print("{b/c}Stopping server ...", { newLine: false });
		onServerExit().then( async code => {
			_config.logger.print(' {b/g}stopped')
			_serverBusyLocked = false
			resolve()
		})
		killServer();
	})
}

async function restartServer () {
	if ( _serverBusyLocked ) return;
	await stopServer()
	await startServer()
}

// ----------------------------------------------------------------------------- BUILD

let _buildContext:BuildContext

function buildFailed ( error, code = 1 ) {
	_config.logger.print(`{b/r}Build failed`)
	_config.logger.error( error )
	process.exit( code );
}

function buildResult ( result, isFirst = false ) {
	result.warnings.forEach( w => _config.logger.print(`{b/o}Warn > ${w}`) )
	result.errors.length === 0 && _config.logger.print(isFirst ? `{b/g} success`: `{b/g}Rebuilt ✨`);
}

/**
 * Build server in watch or build mode.
 */
export async function buildServer ( mode:TBuildMode ) {
	// Set config locally from global
	_buildMode = mode
	if ( !global._nodeServerConfig )
		throw new Error("Please use defineConfig in your server config file.")
	_config = global._nodeServerConfig
	// Print without line jump for the "success"
	_config.logger.print(`{b/c}Building server ...`, { newLine: false })
	// Build server
	try {
		const plugins = [
			keepNodeModulesPlugin,
			..._config.esPlugins,
		];
		if ( _buildMode === "dev" )
			plugins.push( watchPlugin )
		_buildContext = await context({
			target: 'node16',
			platform: 'node',
			format: 'esm',
			minify: false,
			bundle: true,
			logLevel: 'silent',
			plugins,
			// Inject custom es options before forced options
			..._config.esOptions,
			// Forced options (not available in config)
			entryPoints: [ _config.input ],
			outfile: _config.output,
		})
	}
	// Display errors
	catch ( error ) {
		newLine()
		buildFailed( error )
		return;
	}
	// Dev mode
	if ( _buildMode === "dev" ) {
		// Verify config, we need a dev command
		!_config.dev && nicePrint(`{b/r}Please set dev config to use dev mode.`, {
			code: 1
		})
		// Start watch ( watch plugin will start server )
		await _buildContext.watch()
	}
	// Build mode
	else {
		const results = await _buildContext.rebuild();
		buildResult( results, true )
		await _buildContext.dispose();
	}
}

// ----------------------------------------------------------------------------- DEFINE CONFIG

/**
 * Define node-server config.
 * Use the same pattern as vite config system.
 */
export function defineConfig ( configHandler:IConfigHandler ) {
	// Get user config
	let userConfig
	if ( typeof configHandler === "function" )
		userConfig = configHandler( _buildMode )
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
	const configBeforeExpose:Partial<INodeServerConfig> = {
		logger: createDefaultLogger( userConfig.logPrefix ?? "server" ),
		esOptions: {},
		esPlugins: [],
		...userConfig
	}
	// Compute default env from config
	if ( typeof configBeforeExpose.env === "undefined" )
		configBeforeExpose.env = process.env
	else if ( typeof configBeforeExpose.env === "function" )
		configBeforeExpose.env = configBeforeExpose.env( process.env )
	// Expose as global variable in node.
	// We need this because sometimes es2019 and es2022 are loaded from the same runtime
	global._nodeServerConfig = configBeforeExpose
}

