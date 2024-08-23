import { default as fetch } from "node-fetch";
import { leading, trailing } from "@zouloux/ecma-core";


interface IServeFrontEndOptions {
	fastifyStatic	:any
	server			:any
	index			?:string
	isDev			:boolean
	upstream		:string
	root			:string
}

export function serveFrontEnd ( options:IServeFrontEndOptions ) {
	const { server, fastifyStatic, isDev, upstream, root, index = "/index.html" } = options
	if ( isDev ) {
		server.addHook('onRequest', async (request, reply) => {
			let requestPath = leading( request.url, true )
			if ( requestPath === "/" )
				requestPath = index
			// Try to relay any request to the dev server
			const proxyURL = trailing( upstream, false ) + requestPath
			let proxyFetchRequest
			try {
				proxyFetchRequest = await fetch( proxyURL )
			}
			// Cannot contact proxiyed server, skip
			catch (e) { return }
			// Fetch worked, but we got an HTTP error
			// Continue with other route handlers
			if ( !proxyFetchRequest.ok )
				return
			// Send back request to client with header
			reply.headers( proxyFetchRequest.headers.raw() )
			// Read fetched content as blob
			const blob:Blob = await proxyFetchRequest.blob()
			// Convert to array buffer
			const arrayBuffer = await blob.arrayBuffer()
			// Convert to buffer and send back to client
			const buffer = Buffer.from( arrayBuffer )
			reply.send( buffer )
		})
	}
	else {
		server.register(fastifyStatic, {
			root,
			prefix: '/',
			list: false,
			dotfiles: 'deny'
		})
	}
}