
# Vite plugin StachTML

**StachTML** is a vite plugin to add [stach](https://github.com/zouloux/stach) templating into loaded HTML files.


### `vite.config.js`
```typescript
import { resolve } from "path"
import { stachtml } from "vite-plugin-stachtml"
export default defineConfig( viteConfig => {
	return {
		build: {
			rollupOptions: {
				input: [ resolve('src/index.html') ]
			},
			outDir: resolve('dist'),
		},
		plugins: {
			stachtml({
				pageTitle: "Page title",
				mainTitle: "Hello from stachTML",
			})
		}
	}
})
```


### `src/index.html`
```html
<html>
	<head>
		<title>{{ pageTitle }}</title>
	</head>
	<body>
		<h1>{{ mainTitle }}</h1>
        <p>{{ MY_DOT_ENV_VALUE }}</p>
	</body>
</html>
```

### `.env`

> Dot envs are also available as template vars. Please check that your env is correctly loaded with vite requirements.

```dotenv
MY_DOT_ENV_VALUE=Value from dot env
```
