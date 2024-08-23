import { nicePrint, clearScreen } from "@zouloux/cli";

/**
 * TODO : Allow custom info / error / warn
 */

interface ICustomLoggerOptions
{
	prefix	?:string|boolean
	isDev	?:boolean
}

export function createCustomViteLogger ( options:ICustomLoggerOptions ) {
	options = {
		isDev : false,
		...options,
		prefix : options.prefix === false ? '' : `{d}${options.prefix ?? "vite"}{/} - `,
	}

	let firstMessage = true
	options.isDev && nicePrint(`${options.prefix}{b/c}Starting vite ... `, { newLine: false })

	return {
		logLevel: options.isDev ? 'silent' : null,
		clearScreen: false,
		customLogger: {
			info ( msg, params ) {
				if ( !options.isDev ) {
					nicePrint( options.prefix + msg )
					return;
				}
				// || msg.indexOf('localhost') !== -1
				if ( params && params.clear  ) {
					msg = msg.trim()
					if ( !firstMessage )
						msg = options.prefix + msg
					firstMessage = false
					nicePrint( msg )
				}
			},
			error( msg, params ) {
				nicePrint(`{b/r}Vite error`)
				console.error( msg )
			},
			warn( msg, params ) {
				nicePrint(`{b/o}${msg}`)
			},
			clearScreen: () => clearScreen( false )
		}
	}
}