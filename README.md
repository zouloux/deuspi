
# 🗣️ Deu-spi

Opinionated vite plugin collection and presets for my front-end workflow.

## Packages

- [@zouloux/node-server](./packages/node-server)
  - Build and watch **node servers** with **esbuild** and **typescript**.
  - Plays well with **vite**.
  - Has a vite proxy for **Express** and **Fastify**
  - `npm i -D @zouloux/node-server`
- [@zouloux/vite-config-helpers](./packages/node-server)
  - Tiny helpers for vite config
  - Check [presets](./presets) to know more
  - `npm i -D @zouloux/vite-config-helpers`
- [vite-plugin-atomizer](./packages/vite-plugin-atomizer)
  - Export computed variables from less / sass / css-modules automatically
  - `npm i -D vite-plugin-atomizer`
- [vite-plugin-env](./packages/vite-plugin-env)
  - Inject custom envs into your vite bundle.
  - `npm i -D vite-plugin-env`
- [vite-plugin-stachtml](./packages/vite-plugin-stachtml)
  - Add [Stach](https://github.com/zouloux/stach) templating into loaded html files.
  - `npm i -D vite-plugin-stachtml`


## Presets

- [With node-server](./presets/node-server)
  - Integrated workflow with Express or Fastify server
  - Watch mode for server
  - Typescript for server
  - Vite proxy
  - No cors issue
- [Without server](./presets/without-server)
  - With your own server ( ex PHP )
  - Use to create an SPA without server