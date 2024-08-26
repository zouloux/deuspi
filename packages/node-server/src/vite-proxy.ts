import { default as fetch } from "node-fetch"
import { leading, trailing } from "@zouloux/ecma-core"
import * as fs from "node:fs"
import path from "path"

interface IServeFrontEndOptions {
	fastifyStatic	:any
	server			:any
	index			?:string
	isDev			:boolean
	upstream		:string
	root			:string
	// Do not deliver those static files
	// Have to return false if fastify.get(requestPath, ...) exists somewhere in the app !
	beforeFilter	?:( requestPath:string, request, reply) => boolean
}

export function serveFrontEnd(options:IServeFrontEndOptions) {
	const { server, fastifyStatic, isDev, upstream, root, index = "/index.html", beforeFilter } = options
	// Dev mode
	if ( isDev ) {
		// Get a request from vite server and proxy it to our client
		async function replyProxiedRequest ( requestPath, reply ) {
			if (requestPath === "/")
				requestPath = index
			// Try to relay any request to the dev server
			const proxyURL = trailing(upstream, false) + requestPath
			let proxyFetchRequest
			try {
				proxyFetchRequest = await fetch(proxyURL)
			}
				// Cannot contact proxiyed server, skip
			catch (e) {
				return false
			}
			// Fetch worked, but we got an HTTP error
			// Continue with other route handlers
			if (!proxyFetchRequest.ok)
				return false
			// Send back request to client with header
			reply.headers(proxyFetchRequest.headers.raw())
			// Read fetched content as blob
			const blob = await proxyFetchRequest.blob()
			// Convert to array buffer
			const arrayBuffer = await blob.arrayBuffer()
			// Convert to buffer and send back to client
			const buffer = Buffer.from(arrayBuffer)
			return reply.send(buffer)
		}
		// Proxy all requests to vite
		server.addHook('onRequest', async (request, reply) => {
			let requestPath = leading(request.url, true)
			if ( beforeFilter && !beforeFilter(requestPath, request, reply) )
				return
			// Try to proxy from vite, otherwise continue
			await replyProxiedRequest( requestPath, reply )
		});
		// Return a function to show a specific static file from vite dev
		return async ( reply, requestPath = index ) => {
			requestPath = leading(requestPath, true)
			return await replyProxiedRequest( requestPath, reply )
		}
	}
	// Production mode
	else {
		// Register fastify static with no serving ( we do the file serve bellow )
		// To allow manual override of all static files.
		server.register(fastifyStatic, {
			root,
			prefix: '/',
			list: false,
			dotfiles: 'deny',
			// Those 2 are important to disable the static responder inside fastifyStatic
			wildcard: false,
			serve: false,
		})
		// Reply a static file in the root directory if it exists
		async function replyStaticFile ( requestPath, reply ) {
			const filePath = path.join( root, requestPath )
			requestPath = leading( requestPath, false )
			if ( !fs.existsSync( filePath ) || !fs.statSync(filePath).isFile() )
				return false
			return reply.sendFile( requestPath )
		}
		// Check all existing files in the root directory
		server.addHook('onRequest', async (request, reply) => {
			let requestPath = leading(request.url, true)
			if ( beforeFilter && !beforeFilter(requestPath, request, reply) )
				return
			// Try to load and send file, otherwise continue
			await replyStaticFile( requestPath, reply )
		});
		// Return a function to show a specific static file from compiled assets
		return ( reply, requestPath = index ) => {
			requestPath = leading(requestPath, true)
			return replyStaticFile( requestPath, reply )
		}
	}
}