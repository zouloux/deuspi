# Node-server

Node-server will build your node based server with esbuild, and proxy your vite dev assets.

More info on [deuspi](https://github.com/zouloux/deuspi)

## Features

#### Super fast
Build with esbuild

#### No module build.
Will keep all imported modules into node_modules directory.
Transfert `dist/` and `node_modules/` to your server.

#### Watch mode.
Will restart your server everytime you change the source-code.

#### Play well with vite
Includes a vite-proxy for dev mode.

## Server config

Config file can be named `server.config.js` to get along `vite.config.js`.

```javascript
import { buildServer } from "@zouloux/node-server";

buildServer( c => {
	return {
		input: 'src/server/server.ts',
		output: 'dist/server/server.js',
		dev: {
			command: 'node server.js --dev',
			cwd: 'dist/server'
		},
	}
})
```

#### More options
```typescript
export interface INodeServerConfig
{
	// Bundle input and output
	input: string;
	output: string;
	// Dev mode
	dev?: {
		command: string
		cwd?: string
		killSignal?: string
	},
	// Es options
	esOptions?:Partial<BuildOptions>
	esPlugins?:Plugin[]
	// Logger
	logger?:ILogger
	logPrefix?:string
	// Env
	env?:any
}
```

### Start server in dev mode
`node server.config.js dev`

### Build for production
`node server.config.js build`

## With vite

Node-server plays well with vite.
It will proxy vite assets from your Express / Fastify server in dev mode.
In build mode, you can serve generated assets as static resources with Express / Fastify.

`vite.config.js`

```javascript
import { defineConfig } from 'vite'
import { createCustomViteLogger } from "@zouloux/node-server/dist/vite-custom-logger.es2022.mjs";

export default defineConfig( viteConfig => {
	const isDev = viteConfig.mode === 'development'
	// We need a fixed port here because node server will proxy vite server
	const port = 5173
	return {
		// [ ... config ...]
		// Use custom vite logger for server-build
		...createCustomViteLogger({ isDev }),
	}
})
```

`server.ts`

```typescript
import fastify from "fastify";
import { fastifyStatic } from "@fastify/static";
import { viteProxy } from "@zouloux/node-server/dist/vite-proxy.es2022.mjs";
// Create server
const server = fastify()
// Proxy vite in dev mode
if ( dev ) {
	viteProxy( server, {
		upstream: 'http://localhost:5173'
	})
// Serve vite generated assets in build mode
} else {
	server.register(fastifyStatic, {
		root: '../client',
		prefix: '/',
		list: false,
		dotfiles: 'deny'
	})
}
// Start server
server.listen({
	host: '0.0.0.0',
	port: 80
})
```