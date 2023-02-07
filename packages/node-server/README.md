# Node-server

Node-server will build your node based server with esbuild, and proxy your vite dev assets.

More info on [deuspi](https://github.com/zouloux/deuspi)

## Install

`npm i -D @zouloux/node-server`

## Features

#### Super fast
Will build your server with [esbuild](https://esbuild.github.io/), so typescript included.

#### No module build.
Will keep all imported modules into `node_modules` directory without compiling them.
This is easier to manage and avoid a lot of useless typescript errors.

#### Watch mode.
Will restart your server everytime you change the source-code of your server.

#### Plays well with vite
Includes a vite-proxy for dev mode ! ( continue reading bellow )

## Server config

Config file can be named `server.config.js` to get along `vite.config.js`.

```javascript
import { defineConfig } from "@zouloux/node-server";

defineConfig( () => {
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
- `node-server dev`

### Build for production
- `node-server build`

### Custom config file
- `node-server build --config custom.server.config.js`

## With vite

Node-server plays well with vite.
It will proxy vite assets from your Express / Fastify server in dev mode.
In build mode, you can serve generated assets as static resources with Express / Fastify.

`vite.config.js`

```javascript
import { defineConfig } from 'vite'
import { createCustomViteLogger } from "@zouloux/node-server";

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
import { viteProxy } from "@zouloux/node-server";
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

## Package config

Here are some npm scripts to configure node-server and vite.

`package.json`

```json
{
  "scripts": {
    "-- VITE --": "",
    "vite-dev": "vite dev --host",
    "vite-build": "vite build --emptyOutDir",
    "vite-clean": "rm -rf node_modules/.vite dist/client/* && echo Vite cache cleaned",
    "-- SERVER --": "",
    "server-dev": "node-server dev",
    "server-build": "node-server build",
    "server-start": "cd dist/server/ && node server.js",
    "-- BOTH --": "",
    "dev": "clear && (npm run vite-dev --silent & (sleep .6 && npm run server-dev --silent) & wait)",
    "build": "clear && npm run vite-build --silent && npm run server-build --silent",
    "preview": "npm run build --silent && npm run server-start --silent"
  }
}
```