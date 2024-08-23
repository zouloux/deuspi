import fastify from "fastify";
import { fastifyStatic } from "@fastify/static";
import { nicePrint, parseArguments } from "@zouloux/cli";
import { serveFrontEnd } from "@zouloux/node-server/dist/vite-proxy.es2022.mjs";
import { resolve } from "path";

// TODO : Do an utils in @zouloux/cli -> prefixedNicePrint ( prefix ) => ( message, options ) => void
const printPrefix = "server"
const print = ( message:string, options ?:object ) => nicePrint(`{d}${printPrefix}{/} - ${message}`, options)

// Parse argv
const args = parseArguments({
	flagAliases: {
		p: 'port',
		d: 'dev'
	},
	defaultFlags: {
		devServerPort: 5173
	}
})

// Default port from argv
const port = ( args.flags.port ?? ( args.flags.dev ? 3000 : 80 ) ) as number

// Create fastify server
const server = fastify()

server.get('/service.json', (request, reply) => {
	reply.send({ text: "Hello from server" })
})

serveFrontEnd({
	isDev: args.flags.dev,
	fastifyStatic, server,
	index: '/app.html',
	upstream: 'http://localhost:' + args.flags.devServerPort,
	// Target public dir from server dist
	root: resolve('../client'),
})

// Start Fastify server
async function startServer () {
	try {
		await server.listen({ host: '0.0.0.0', port })
		print(`{b/g}Server started on port {w/b}${port}`)
	}
	catch ( e ) {
		print(`Port ${port} already in use ...`)
	}
}

startServer();