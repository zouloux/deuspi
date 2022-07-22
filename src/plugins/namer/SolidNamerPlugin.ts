import { IBaseSolidPluginConfig, ICommand, ISolidMiddleware, SolidPlugin } from "../../engine/SolidPlugin";
import { IAppOptions, IExtendedAppOptions, TBuildMode } from "../../engine/SolidParcel";
import path from "path"

// -----------------------------------------------------------------------------

// ~ich interface copy from Parcel Bundle class/interface
interface IParcelBundle
{
	type			:string
	id				:string
	hashReference	:string
	needsStableName	:boolean
	env				:any
	isSplittable	:boolean

	target: {
		distEntry	:string
		distDir		:string
		env			:any;
		publicUrl	:string;
		loc			:any
	}
}

type assetTypes = 'audio'|'document'|'font'|'image'|'script'|'style'|'video'

// -----------------------------------------------------------------------------

interface ISolidNamerPluginConfig extends IBaseSolidPluginConfig
{
	rename: (filePath?:string, fileName?:string, bundle?:IParcelBundle, bundleGraph?:any, appOptions?:IAppOptions) => string|null
}

const _defaultConfig:Partial<ISolidNamerPluginConfig> = {}

// -----------------------------------------------------------------------------

const globalPrivateKey = '__ParcelNamerFunctions__'

export class SolidNamerPlugin extends SolidPlugin <ISolidNamerPluginConfig>
{
	static assetExtensions = {
		// https://developer.mozilla.org/fr/docs/orphaned/Web/HTML/Preloading_content
		audio: ['wav', 'mp3', 'ogg', 'aac', 'flac'],
		document: ['html', 'htm'],
		//embed
		//fetch
		font: ['woff', 'woff2', 'ttf', 'otf', 'eot'],
		image: ['jpg', 'jpeg', 'gif', 'png', 'apng', 'svg', 'avif', 'webp', 'ico', 'bmp'],
		//object
		script: ['js'],
		style: ['css'],
		//track
		//worker
		video: ['mp4', 'webm', 'flv', 'avi', 'mov', 'mkv', 'ogv'],
	}

	/**
	 * Use predefined functional renamers.
	 * Usage :
	 *	SolidNamerPlugin.init({
	 *		rename: SolidNamerPlugin.renamers.createAllAssetsInDirectoryRenamer('static/')
	 *	})
	 */
	static renamers = {
		/**
		 * All assets, but html documents, will be in put inside directory parameter.
		 */
		createAllAssetsInDirectoryRenamer : ( directory = 'assets' ) => {
			return function allAssetsInDirectoryRenamer ( filePath, fileName, bundle, bundleGraph, appOptions ) {
				let name = ''
				Object.keys( SolidNamerPlugin.assetExtensions ).map( assetType => {
					if ( assetType == 'document' ) return;
					if ( SolidNamerPlugin.assetExtensions[assetType].includes( bundle.type ) )
						name = directory
				})
				return path.join(name, fileName);
			}
		},
		/**
		 * All assets are put inside their type directory.
		 * Ex : audio/track.mp3, video/help.mp4, images/flower.jpg ...
		 */
		createAssetsByTypeRenamer : () => {
			return function assetsInDirectoryByTypeRenamer ( filePath, fileName, bundle, bundleGraph, appOptions ) {
				let name = ''
				Object.keys( SolidNamerPlugin.assetExtensions ).map( assetType => {
					if ( assetType == 'document' ) return;
					if ( SolidNamerPlugin.assetExtensions[assetType].includes( bundle.type ) )
						name += assetType + 's'
				})
				return path.join(name, fileName);
			}
		}
	}

	static init ( config:ISolidNamerPluginConfig ) {
		return new SolidNamerPlugin({ name: 'namer', ..._defaultConfig, ...config })
	}

	async prepare ( buildMode:TBuildMode, appOptions?:IExtendedAppOptions ) {
		// Init global scope as an array for parcel-namer-functional
		if ( !(globalPrivateKey in global) )
			global[ globalPrivateKey ] = []

		// Add a rename function in global scope
		global[ globalPrivateKey ].push(
			( filePath, fileName, bundle, bundleGraph, config, options ) => {
				// Target file output
				const bundleGroup = bundleGraph.getBundleGroupsContainingBundle( bundle )[0]
				const bundleDistDir = bundleGroup.target.distDir
				const appOutput = path.resolve(appOptions.output)

				// Do not use this renamer if given file is not in this app
				if ( bundleDistDir != appOutput )
					return null

				return this._config.rename(filePath, fileName, bundle, bundleGraph, appOptions)
			}
		);
	}
}