import { FastifyInstance } from "fastify";
import { default as fetch } from "node-fetch";
import { leading, trailing } from "@zouloux/ecma-core";

interface IDevProxyMiddlewareOptions {
	upstream:string
}

// TODO : Pass headers from client to server
// TODO : Manage other methods than GET
export function viteProxy ( server:FastifyInstance, options:IDevProxyMiddlewareOptions ) {
	server.addHook('onRequest', async (request, reply,) => {
		// Try to relay any request to the dev server
		const proxyURL = trailing( options.upstream, false ) + leading( request.url, true )
		let proxyFetchRequest
		try {
			proxyFetchRequest = await fetch( proxyURL )
		}
		// Cannot contact proxiyed server, skip
		catch (e) {
			return
		}
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