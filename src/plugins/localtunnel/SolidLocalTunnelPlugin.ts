import { IBaseSolidPluginConfig, SolidPlugin } from "../../engine/SolidPlugin";
import { IExtendedAppOptions, TBuildMode } from "../../engine/SolidParcel";
import { nicePrint, printLoaderLine } from "@solid-js/cli";
import { delay } from "@solid-js/core";
const crypto = require('crypto');
// -----------------------------------------------------------------------------

interface ISolidLocalTunnelPluginConfig extends IBaseSolidPluginConfig
{
	port				?: number,
	subdomain 			?: "chimera"|string
	localTunnelOptions 	?: any
	showQR				?:boolean
}

const _defaultConfig:Partial<ISolidLocalTunnelPluginConfig> = {
	port		: 80,
	subdomain	: null,
	showQR		: false,
}

// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------

export class SolidLocalTunnelPlugin extends SolidPlugin <ISolidLocalTunnelPluginConfig>
{
	static init ( config:ISolidLocalTunnelPluginConfig ) {
		return new SolidLocalTunnelPlugin({ name: 'localtunnel', ..._defaultConfig, ...config })
	}

	protected _localTunnelModule;
	protected _localTunnelInstance;

	async prepare ( buildMode?:TBuildMode )
	{
		if ( buildMode != 'dev' ) return;
		try {
			this._localTunnelModule = require('localtunnel');
		}
		catch (e) {}
		!this._localTunnelModule && this.halt(`SolidLocalTunnelPlugin.beforeBuild`, `Please install npm package {u}localtunnel{/}`)
	}

	async beforeBuild ( buildMode?:TBuildMode, appOptions?:IExtendedAppOptions, envProps?:object, buildEvent?, buildError? )
	{
		if ( buildMode != 'dev' || !this._localTunnelModule ) return;
		if ( this._localTunnelInstance ) return;
		if ( buildError ) return;

		let startingLine = printLoaderLine(`Starting local tunnel ...`);

		let subdomain = this._config.subdomain;
		if ( subdomain == 'chimera' ) {
			const computerHostname = require('os').hostname();
			let computerHash = crypto.createHash('md5').update(computerHostname).digest('hex')
			computerHash = computerHash.substr(16, 8);
			subdomain = envProps['PACKAGE_NAME'] + '--' + computerHash
		}

		const options = {
			port: this._config.port,
			subdomain,
			...( this._config.localTunnelOptions ?? {} )
		}

		this._localTunnelInstance = await this._localTunnelModule( options )
		this._localTunnelInstance.on('close', () => {
			startingLine
			? startingLine(`Unable to open local tunnel`, 'error')
			: nicePrint('{o}Local tunnel closed.');
			this._localTunnelInstance = null;
		})

		await delay(.1);
		const { url } = this._localTunnelInstance
		startingLine(`Local tunnel opened at {b/u}${url}`)
		startingLine = null;

		if ( this._config.showQR ) {
			const qrTerminal = require('qrcode-terminal');
			qrTerminal.setErrorLevel('Q');
			qrTerminal.generate(url, { small: true });
		}
	}

	async exit (buildMode?:TBuildMode, appOptions?:IExtendedAppOptions, envProps?:object) {
		if ( !this._localTunnelInstance ) return;
		const closingLine = printLoaderLine(`Closing local tunnel ...`)
		this._localTunnelInstance.removeAllListeners();
		this._localTunnelInstance.close();
		this._localTunnelInstance = null;
		await delay(.1);
		closingLine(`Closed local tunnel`)
	}
}