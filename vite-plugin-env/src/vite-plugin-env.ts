type TAssociative = Record<string|number, string|number|boolean>
export type TEnvValues = ( TAssociative | (() => TAssociative) )

export function env ( envs:TEnvValues ) {
	return {
		name: 'env',
		enforce: 'pre',
		config () {
			if ( typeof envs === "function" )
				envs = envs();
			// Check values validity
			if ( typeof envs !== "object" || Array.isArray(envs) )
				throw new Error(`${this.name} vite plugin error // values should be an associative object or a function returning an associative object.`)
			const define = {}
			Object.keys( envs ).forEach( key => {
				define[`import.meta.env.${key}`] = JSON.stringify( envs[key] )
			})
			return { define }
		},
	}
}