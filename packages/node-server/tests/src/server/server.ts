import fastify from "fastify";
import { parseArguments } from "@zouloux/cli";
import { viteProxy } from "../../../dist/vite-proxy.es2022.mjs";

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

const server = fastify()

if ( args.flags.dev ) {
	viteProxy( server, {
		upstream: 'http://localhost:' + args.flags.devServerPort
	})
}

await server.listen({ host: '0.0.0.0', port })

