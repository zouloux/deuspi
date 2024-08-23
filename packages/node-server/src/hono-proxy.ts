import { Context, Hono } from 'hono'
import { leading, trailing } from '@zouloux/ecma-core'
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { promises as fs } from 'fs';

// TODO : To finish

/* USAGE
// In dev mode, we proxy app files to vite server
if ( args.flags.dev ) {
	print(`{d}Proxying vite on port ${args.flags.devServerPort}`)
	devProxy({
		app,
		upstream: 'http://localhost:' + args.flags.devServerPort
	})
}
else {
	print(`{d}Exposing client static files.`)
	prodStatic({
		// Target client public directory from dist/server
		app,
		root: path.join('../client')
	})
}
*/

interface IDevProxyOptions {
	app			:Hono,
	upstream	:string
}

export function devProxy ( options:IDevProxyOptions ) {
	const { app, upstream } = options
	app.use('*', async (c:Context, next) => {
		const { req } = c
		let requestPath = leading(req.path, true)
		// We need to map vite to app.html and not index.html
		// to avoid any non exiting url to respond to index.html ( spa mode )
		// Otherwise all non responding request will serve index.html
		// Please remove index.html and move to app.html in vite config
		if ( requestPath === "/" )
			requestPath = "/app.html"
		const proxyURL = trailing(upstream, false) + requestPath
		let proxyFetchRequest
		try {
			proxyFetchRequest = await fetch(proxyURL);
		}
		// Cannot contact proxiyed server, skip
		catch (e) {
			return await next()
		}
		if ( !proxyFetchRequest.ok )
			return await next()
		proxyFetchRequest.headers.forEach( (value, key) => c.header(key, value) )

		const blob = await proxyFetchRequest.blob()
		const arrayBuffer = await blob.arrayBuffer()
		// const d = new TextDecoder().decode(arrayBuffer)
		// console.log( d );
		return c.body( arrayBuffer )
	})
}

interface IProdProxyOptions {
	app			:Hono
	root		:string
}

export function prodStatic ( options:IProdProxyOptions ) {
	const { app, root } = options
	app.use('*', async (c, next) => {
		const requestedPath = c.req.path === '/' ? '/index.html' : c.req.path;
		const filePath = path.join(root, requestedPath);
		try {
			await fs.access(filePath);
			return serveStatic({ root, path: requestedPath })(c, next);
		} catch {
			return await next()
		}
	});
}