#!/usr/bin/env node

import * as path from "path";
import { nicePrint, parseArguments } from "@zouloux/cli";
import { buildServer, TBuildMode } from "./server-build";

// Parse and check CLI arguments
const args = parseArguments({
	defaultFlags: {
		config: 'server.config.js'
	}
});
if ( args.arguments.length < 1  ) {
	nicePrint(`
		{b/r}Invalid usage of node-server. Missing build mode {b/w}dev{b/r} or {b/w}build
		{d}Usage : {b/w}node-server dev
		{d}Usage : {b/w}node-server build
		{d}Usage : {b/w}node-server dev --config custom.server.config.js
	`, {
		code: 1,
	})
}

// Get build mode from args
const buildMode = args.arguments[0] as TBuildMode
if ( buildMode !== "dev" && buildMode !== "build" )
	nicePrint(`{b/r}Invalid build mode. {b/w}dev{b/r} or {b/w}build{b/r} modes are accepted.`, { code: 1 })

// Load config file
async function loadConfig () {
	try {
		await import( path.join( process.cwd(), args.flags.config as string) )
		buildServer( buildMode )
	}
	catch ( e ) {
		nicePrint(`{b/r}Error while loading config`)
		console.error( e )
		process.exit(2)
	}
}
loadConfig()