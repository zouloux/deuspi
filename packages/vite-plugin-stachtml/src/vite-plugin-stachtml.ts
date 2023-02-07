import { Stach } from "stach"

type TAssociative = Record<string|number, string|number|boolean>
export type TStachtmlValues = ( TAssociative | (() => TAssociative) )

export function stachtml ( values:TStachtmlValues ) {
	let env;
	return {
		name: 'stachtml',
		configResolved ( config ) { env = config.env },
		transformIndexHtml ( html ) {
			// Call values if this is a build function
			if ( typeof values === "function" )
				values = values();
			// Check values validity
			if ( typeof values !== "object" || Array.isArray(values) )
				throw new Error(`${this.name} vite plugin error // values should be an associative object or a function returning an associative object.`)
			// Inject loaded envs into template values
			// Add custom values which are from plugin instanciation
			const variables = { ...env, ...values }
			return Stach( html, variables )
		}
	}
}
