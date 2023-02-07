import fs from "fs";
import { resolve, relative } from "path";

export function readJSON ( filePath ) {
	return JSON.parse( fs.readFileSync( filePath )+'' )
}

export const F = filePath => (
	Array.isArray(filePath)
	? filePath.map( F )
	: resolve( relative(process.cwd(), filePath) )
)

export function viteCssModuleConfig ( isDev, modulesConfigOverride = {} ) {
	return {
		modules: {
			generateScopedName: (
				// Keep css modules names visible in dev mode
				isDev
				? "[name]__[local]__[hash:base64:5]"
				: "[hash:base64:5]"
			),
			...modulesConfigOverride
		}
	}
}

export function viteCssLessConfig ( lessConfigOverride = {} ) {
	return {
		preprocessorOptions: {
			less: {
				math: 'always',
				...lessConfigOverride
			}
		}
	}
}
