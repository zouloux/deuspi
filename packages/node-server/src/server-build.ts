import { build } from "esbuild"
import { spawn } from "child_process"
import { Signal } from "@zouloux/signal"
import { newLine, nicePrint, oraTask, parseArguments, clearScreen } from "@zouloux/cli";
import { delay } from "@zouloux/ecma-core";

/**
 * TODO : Faire un joli packet npm de tout ça
 * @zouloux/node-server
 * server.config.js
 * TODO : Add on signal ( build / fail / etc )
 */

// ----------------------------------------------------------------------------- PLUGIN

/**
 * Force node_modules imports to be kept in esbuild output.
 * Usually, node_modules are included into bundle or translated to something like
 * ../../node_modules/@zouloux/cli/dist/index.js
 * With this plugin, output will be kept as import("@zouloux/cli")
 */
const keepNodeModulesPlugin = {
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

// ----------------------------------------------------------------------------- LOGGER

// TODO : To CLI with an interface ?
const defaultLogger = {
	prefix: '{d}server{/} - ',
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

// ----------------------------------------------------------------------------- CONFIG

// Config and args are module scoped
let config;
let args;

// ----------------------------------------------------------------------------- DEV SERVER

let serverInstance
let onServerExitSignal = Signal()
let serverBusyLocked = false
let builder

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

async function stopServer () {
	if ( !serverInstance ) return;
	serverBusyLocked = true
	//await delay(1)
	await oraTask(`Stopping server`, t => new Promise<void>( resolve => {
		onServerExit().then( async code => {
			t.success('Server stopped')
			serverBusyLocked = false
			resolve()
		})
		// FIXME : Other signals to force exit ?
		// FIXME : 'SIGINT' // force ? "SIGKILL" : "SIGTERM"
		serverInstance.kill( config.dev.killSignal ?? 'SIGINT' );
	}))
}

async function restartServer () {
	if ( serverBusyLocked ) return;
	await stopServer()
	await startServer()
}

// ----------------------------------------------------------------------------- BUILD

function buildFailed ( error, code = 1 ) {
	config.logger.print(`{b/r}Build failed`)
	config.logger.error( error )
	process.exit( code );
}

function buildResult ( result, isFirst = false ) {
	result.warnings.forEach( w => config.logger.print(`{b/o}Warn > ${w}`) )
	result.errors.length === 0 && config.logger.print(isFirst ? `{b/g} success`: `{b/g}Build success`);
}

export async function buildServer ( configHandler ) {

	defineBuildConfig( configHandler )

	// Print without line jump for the "success"
	config.logger.print(`{b/c}Building server ...`, { newLine: false })
	// console.log( config );
	// process.exit();
	// Build server
	try {
		builder = await build({
			target: 'node16',
			platform: 'node',
			format: 'esm',
			minify: false,
			bundle: true,
			incremental: args.flags.dev,
			// FIXME
			logLevel: 'warning',
			plugins: [ keepNodeModulesPlugin ],
			// Inject custom es options before forced options
			...config.esOptions,
			// Forced options (not available in config)
			entryPoints: [ config.input ],
			outfile: config.output,
			watch: !args.flags.dev ? null : {
				async onRebuild ( error, result ) {
					// Halt on build error
					if ( error )
						buildFailed( error )
					else
						buildResult( builder )
					// Restart dev server after rebuild
					await delay(.5)
					config.logger.clear();
					restartServer()
				},
			}
		})
		buildResult( builder, true )
	}
		// Display errors
	catch ( error ) {
		newLine()
		buildFailed( error )
	}
	// Start dev server in dev mode
	if ( args.flags.dev ) {
		!config.dev && nicePrint(`{b/r}Please set dev config to use dev mode.`, {
			code: 1
		})
		startServer()
	}
}


// ----------------------------------------------------------------------------- START

function defineBuildConfig ( configHandler ) {
	// Parse arguments and store in module scope
	args = parseArguments({
		flagAliases: {
			d: 'dev'
		},
		defaultFlags: {
			dev: false
		}
	})
	// Get user config
	let userConfig
	if ( typeof configHandler === "function" )
		userConfig = configHandler({
			dev: args.flags.dev
		})
	else if ( typeof configHandler === "object" && !Array.isArray(configHandler) ) {
		userConfig = configHandler
	}
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
		logger: defaultLogger,
		esOptions: {},
		...userConfig
	}
	// Compute default env from config
	if ( typeof config.env === "undefined" )
		config.env = process.env
	else if ( typeof config.env === "function" )
		config.env = config.env()
}

