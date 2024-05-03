import './main.css'
import ui from './app.html?raw'

import Alpine from 'alpinejs'
import * as Tone from 'tone'

//Firebase Imports
import { initializeApp } from "firebase/app";
import { getDatabase, ref as ref_database, get, child } from "firebase/database";

//THREE IMPORTS
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { CSS2DRenderer, CSS2DObject } from './css.js';
import { Rhino3dmLoader } from './3dm.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { N8AOPostPass } from "n8ao";
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { envs, grounds, units } from './files';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KernelSize, BloomEffect, VignetteEffect, TiltShiftEffect, ChromaticAberrationEffect, GodRaysEffect, DepthOfFieldEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, BlendFunction } from "postprocessing";
import {EdgeDetectionMode} from 'postprocessing'
import { HalfFloatType } from "three";
import { createMultiMaterialObject } from 'three/addons/utils/SceneUtils.js';

import CameraControls from 'camera-controls';

import { TWEEN } from './lib/tween.module.min.js';
import {SplatLoader, Splat } from '@pmndrs/vanilla'

import { InteractionManager } from 'three.interactive';
import './lib/hold-event.min.js';

//GLOBAL VARIABLES 
window.Alpine = Alpine
CameraControls.install( { THREE: THREE } );

const firebaseConfig = {
apiKey: "AIzaSyDvOVjSw8UL6SLnPLScs1wRd-VqczWWAis",
authDomain: "foveate-app.firebaseapp.com",
projectId: "foveate-app",
storageBucket: "foveate-app.appspot.com",
messagingSenderId: "508763609721",
appId: "1:508763609721:web:143d5201309a03349892a8", 
measurementId: "G-5GVF0C1VM1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase();

//THREE SCENE VARIABLES
let scene,mask_scene, camera, composer, n8aopass, lightSphere, sun, sunGroup, bloomPass,godRaysEffect,chrome, dofMaterial, vignettePass, depthOfFieldEffect, bloomEffect, controls, renderer, mask_renderer, clock, cameraControls, light, ambient
let cubemapTexture

let labelRenderer, groundModel
let fov_tween, progress_tween
let playing = false
let first_load = false;

let dracoLoader = new DRACOLoader(); //DRACO Loader 
dracoLoader.setDecoderPath( 'https://www.gstatic.com/draco/v1/decoders/' );

let loader = new GLTFLoader()
const ktx2Loader = new KTX2Loader()

let interactionManager
let move = false
// ALPINE JS  
const alpineComponent = document.querySelector('[x-data]');

Alpine.data('app', () => ({
app_ui_state:{
	loading:false,
	help:false,
	momentsPanel:true,
	loaded:false,
	annotations:false,
	qr:false,
	arPanel:false
},
moment_label:{
	title:'',
	caption:'',
	url:'',
	order:1
},
moments_ui:{ 
	sharePanel:false,
	mobileMenu:true,
	minimize:false,
	ar:false,
	label:false,
	transition:true,
	position:false,
	media:false,
	tag:false,
	cameras:true,
	cssLabels: false,
	editCamera:false,
	editTarget:false,
	addMoment:false
},
mouse_hover:false,
embed:false,
labelSide:false,
momentEnded:false,
cameraHover:false,
mousedown:false,
arLoaded:false,
fps:false,
moveSpeed:0.1,
loading:false,
loadingProgress:0,
selectedMoment:'',
mute:false,
fullscreen:false,
arSupported:false,
sceneRendered:false,
keyControlsEnabled:true,
playing:false,
currentMoment:'',
sceneLoaded:false,
moment_order: new Array(),
moment_order_temp: new Array(),
annotations: new Map(),
asset_map: new Map(),
momentsDB: {},
assetList: {},
params:{},
animsFullList: new Array(),
environments: envs,
grounds: grounds,
window: window.data,
thumbnail:'',
async init(){

	console.log("App Starting...")
	document.getElementById('app').innerHTML = ui
	// document.title = this.window.title

	function decodeHtmlEntities(input) {
		const textarea = document.createElement('textarea');
		textarea.innerHTML = input;
		return textarea.value;
	}
	  
	// Example usage:
	const encodedString = this.window.title;
	const decodedString = decodeHtmlEntities(encodedString);
	console.log(decodedString)
	this.window.title = decodedString

	if(window.location.search>window.location.pathname){
		console.log("Local Dev")
		this.scene_id = window.location.search.substring(2,window.location.search.length)
		this.scene_share = 'https://foveate.com/share/'+this.scene_id
	}else{
		console.log("Firebase Server")
		this.scene_id = window.location.pathname.substring(7,window.location.pathname.length)
		this.scene_share = 'https://foveate.com/share/'+this.scene_id
	}

	Tone.start()

	//Load Scene
	const dbRef = ref_database(getDatabase());

	// Load 3D Scene Parameters Into AlpineJS
	get(child(dbRef, 'scenes/' + Alpine.$data(alpineComponent).scene_id + '/params')).then((snapshot) => {
		if (snapshot.exists()) {
			console.log('3D Scene Parameters Loaded');
			Alpine.$data(alpineComponent).params = snapshot.val()
			Alpine.$data(alpineComponent).trackFullscreen() 
			Alpine.$data(alpineComponent).init3D() 		
		} else {
		console.log("Scene Parameters Not Found");
		}
	}).catch((error) => {
		console.error(error);
	});

	// Load Assets Into Alpine
	get(child(dbRef, 'scenes/' + Alpine.$data(alpineComponent).scene_id + '/assets')).then((snapshot) => {
		if (snapshot.exists()) {
			Alpine.$data(alpineComponent).assetList = snapshot.val()	
			Alpine.$data(alpineComponent).loadAssets(snapshot.val())
		
			
		} else {
		console.log("Scene Parameters Not Found");
		}
	}).catch((error) => {
		console.error(error);
	});

	// Load Assets Into Alpine
	get(child(dbRef, 'scenes/' + Alpine.$data(alpineComponent).scene_id + '/moments')).then((snapshot) => {
		if (snapshot.exists()) {
			Alpine.$data(alpineComponent).momentsDB = snapshot.val()	
			
		} else {
			console.log("Scene Parameters Not Found");
		}
	}).catch((error) => {
		console.error(error);
	});

	get(child(dbRef, 'scenes/' + Alpine.$data(alpineComponent).scene_id + '/moment_order')).then((snapshot) => {
		if (snapshot.exists()) {
			Alpine.$data(alpineComponent).moment_order = snapshot.val()	
			// Alpine.$data(alpineComponent).currentMoment = Alpine.$data(alpineComponent).moment_order[0]
			// Alpine.$data(alpineComponent).selectedMoment = Alpine.$data(alpineComponent).moment_order[0]
			
		} else {
		console.log("Scene Parameters Not Found");
		}
	}).catch((error) => {
		console.error(error);
	});

	this.$watch('selectedMoment', (newValue) => {	
		this.tweenToMoment(newValue)
	})

	this.$watch('currentMoment', (newValue) => {	
		let moment = this.momentsDB[newValue]
		Alpine.$data(alpineComponent).moment_label.title = moment.title
		Alpine.$data(alpineComponent).moment_label.caption = moment.caption
		Alpine.$data(alpineComponent).moment_label.url = moment.url
	})
},
async init3D(){

	function mouseDown(){
		Alpine.$data(alpineComponent).mousedown = false		
	}
	let t = '' 
	
	document.addEventListener( 'pointerdown', () => {
		clearTimeout(t)
		if(!Alpine.$data(alpineComponent).cameraHover){
			Alpine.$data(alpineComponent).mousedown = true
		}
	});

	document.addEventListener( 'pointerup', () => {
		t = setTimeout(mouseDown, 3000);	
	});


	THREE.DefaultLoadingManager.onStart = function ( url, itemsLoaded, itemsTotal ) {
		console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
		Alpine.$data(alpineComponent).loadingProgress = 0
	};
	
	
	THREE.DefaultLoadingManager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
		Alpine.$data(alpineComponent).loadingProgress =  parseFloat(100*itemsLoaded/itemsTotal)
		Alpine.$data(alpineComponent).loading = true
	};
	
	//ONLOAD EVENT
	THREE.DefaultLoadingManager.onLoad = function ( ) {

		if(!first_load){
			let cam = {x:0,y:8,z:20}
			let target = {x:0,y:2,z:0}
			cameraControls.setLookAt( parseFloat(cam.x),parseFloat(cam.y),parseFloat(cam.z),parseFloat(target.x),parseFloat(target.y),parseFloat(target.z),false )
			
			// READ URL PARAMETERS 

			if(window.location.hash){

				const h = window.location.hash
				console.log(h)

				if(window.location.hash.toLowerCase().includes("_ar")){
					console.log("AUTO LAUNCH AR")
					Alpine.$data(alpineComponent).exportUSDZ(window.location.hash.slice(1,window.location.hash.length-3))		
					Alpine.$data(alpineComponent).embed = false
					
				}else if(window.location.hash.toLowerCase().includes("_embed")){
					let m = Alpine.$data(alpineComponent).extractStringFromHash(window.location.hash)
					m = m.slice(1,window.location.hash.length)

					console.log("EMBED",Alpine.$data(alpineComponent).extractStringFromHash(window.location.hash))

					if(m.length>0){
						Alpine.$data(alpineComponent).tweenToMoment(m)
						Alpine.$data(alpineComponent).currentMoment = m
						Alpine.$data(alpineComponent).embed = true
					}else{
						let first = Alpine.$data(alpineComponent).moment_order[0]
						Alpine.$data(alpineComponent).currentMoment = first
						Alpine.$data(alpineComponent).tweenToMoment(first,false)
						Alpine.$data(alpineComponent).embed = true
					}

				} else{
					let m = Alpine.$data(alpineComponent).extractStringFromHash(window.location.hash)
					m = m.slice(1,window.location.hash.length)

					console.log("EMBED",Alpine.$data(alpineComponent).extractStringFromHash(window.location.hash))

					if(m.length>0){
						Alpine.$data(alpineComponent).tweenToMoment(m)
						Alpine.$data(alpineComponent).currentMoment = m
				
					}else{
						let first = Alpine.$data(alpineComponent).moment_order[0]
						Alpine.$data(alpineComponent).currentMoment = first
						Alpine.$data(alpineComponent).tweenToMoment(first,false)
	
					}
				}
			
			}else{
				console.log("url does not have hash")
				let first = Alpine.$data(alpineComponent).moment_order[0]
				Alpine.$data(alpineComponent).tweenToMoment(first,false)
				Alpine.$data(alpineComponent).currentMoment = first 
				
			}


			Alpine.$data(alpineComponent).cameraKeyControls()
			Alpine.$data(alpineComponent).sceneLoaded = true

			Alpine.$data(alpineComponent).sceneRendered=true
			first_load = true
			render()
		}
	};
	
	//Create ThreeJS Foundation 
	scene = new THREE.Scene();
	mask_scene = new THREE.Scene()

	clock = new THREE.Clock();
	camera = new THREE.PerspectiveCamera( this.params.camera.fov , window.innerWidth / window.innerHeight, .1, 500000 );

	scene.add( camera );

	//WEBGL Renderer 
	renderer = new THREE.WebGLRenderer({antialias: true});

	if(this.params.ground.enabled){
		Alpine.$data(alpineComponent).loadGround() 		
	}

	document.getElementById('webgl').appendChild( renderer.domElement );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.VSMShadowMap;
	
	if(this.params.postProcessing.enabled){
		renderer.toneMapping = THREE.NoToneMapping;
	}else{
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
	}
	
	renderer.toneMappingExposure = this.params.hdr.exposure
	renderer.backgroundIntensity = this.params.hdr.exposure
	renderer.domElement.style.position = 'fixed';
	renderer.domElement.style.zIndex = 0;

    let clientWidth = window.innerWidth;
    let clientHeight = window.innerHeight;

	composer = new EffectComposer(renderer, {
		frameBufferType: HalfFloatType,
		multisampling: 4
	}); 

	n8aopass = new N8AOPostPass(
		scene,
		camera,
		clientWidth,
		clientHeight
	);

	if(this.params.ambientOcclusion.enabled ){
		n8aopass.configuration.renderMode = 0
		
	}else{
		n8aopass.configuration.renderMode = 2
	}

	n8aopass.configuration.intensity = this.params.ambientOcclusion.intensity
	n8aopass.configuration.aoRadius = this.params.ambientOcclusion.radius
	n8aopass.configuration.aoRdistanceFalloff = this.params.ambientOcclusion.falloff
	n8aopass.configuration.color = this.params.ambientOcclusion.color
	

	bloomPass = new BloomEffect({
			mipmapBlur: true,
			blendFunction: BlendFunction.ADD,
			luminanceThreshold: this.params.bloom.threshold,
			intensity: this.params.bloom.intensity
	});

	if(this.params.bloom.enabled ){
		bloomPass.intensity = this.params.bloom.intensity
		
	}else{
		bloomPass.intensity = 0
	}

	bloomPass.mipmapBlurPass.radius = this.params.bloom.radius

	const sunMaterial = new THREE.MeshBasicMaterial({
		color: 0xffddaa,
		transparent: true,
		fog: false
	});

	const sunGeometry = new THREE.SphereGeometry(0.5, 32, 32);

	const sunGeometry2 = new THREE.SphereGeometry(10.0, 32, 32);
	lightSphere = new THREE.Mesh(sunGeometry, sunMaterial);
	lightSphere.position.set(this.params.directionalLight.position.x,this.params.directionalLight.position.y,this.params.directionalLight.position.z)
	scene.add(lightSphere)
	lightSphere.visible = false

	sun = new THREE.Mesh(sunGeometry2, sunMaterial);
	sun.frustumCulled = false;
	sun.material.color = new THREE.Color(this.params.directionalLight.color)
	sun.matrixAutoUpdate = false;
	sunGroup = new THREE.Group();
	sunGroup.add(sun);
	sunGroup.position.set(this.params.godray.sun_position.x,this.params.godray.sun_position.y,this.params.godray.sun_position.z)

	const toneMappingEffect = new ToneMappingEffect({
		resolution: 256,
		whitePoint: 16.0,
		middleGrey: 0.6,
		minLuminance: 0.01,
		averageLuminance: 0.01,
		adaptationRate: 1.0
	});

	switch (parseInt(this.params.hdr.tonemappingType)) {
		case 0:
			renderer.toneMapping = THREE.AgXToneMapping;
			toneMappingEffect.mode = ToneMappingMode.AGX
			break;
		case 1:
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			toneMappingEffect.mode = ToneMappingMode.ACES_FILMIC
			break;
		case 2:
			renderer.toneMapping = THREE.ReinhardToneMapping;
			toneMappingEffect.mode = ToneMappingMode.REINHARD2_ADAPTIVE
			break;
		case 3:
			renderer.toneMapping = THREE.CineonToneMapping
			toneMappingEffect.mode = ToneMappingMode.OPTIMIZED_CINEON
			break;
			
		default:
			console.log("OLDER DATA")
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			toneMappingEffect.mode = ToneMappingMode.ACES_FILMIC
			break;
	}

	if(this.params.postProcessing.enabled){
		renderer.toneMapping = THREE.NoToneMapping
	}

	vignettePass = new VignetteEffect(scene,camera)

	if(this.params.vignette.enabled ){
		vignettePass.darkness = this.params.vignette.darkness	
	}else{
		vignettePass.darkness = 0
	}
	
	godRaysEffect = new GodRaysEffect(camera, sun, {
		height: 580,
		kernelSize: KernelSize.SMALL,
		density: this.params.godray.density,
		decay: 0.95,
		weight: this.params.godray.weight,
		exposure: 0.9,
		samples: 60,
		clampMax: 1.0
	});

	if(this.params.godray.enabled){
		godRaysEffect.godRaysMaterial.density = this.params.godray.density
	}else{
		godRaysEffect.godRaysMaterial.density = 0
	}
	
	depthOfFieldEffect = new DepthOfFieldEffect(camera, {
		worldFocusDistance: this.
		focus,
		worldFocusRange: this.params.depthOfField.length,
		bokehScale: this.params.depthOfField.scale,
		height: 480
	});

	if(this.params.depthOfField.enabled){
		depthOfFieldEffect.bokehScale = this.params.depthOfField.scale
	}else{
		depthOfFieldEffect.bokehScale = 0
	}

	dofMaterial = depthOfFieldEffect.circleOfConfusionMaterial;
	composer.addPass(new RenderPass(scene, camera));

	chrome = new ChromaticAberrationEffect({
		radialModulation:false,
		modulationOffset:0.5,
		offset: new THREE.Vector2( this.params.chromatic.offset, this.params.chromatic.offset  )
	})

	if(!this.params.chromatic.enabled){
		chrome.offset = new THREE.Vector2( 0 , 0 )
	}

	composer.addPass(
		new EffectPass( camera, depthOfFieldEffect, chrome, bloomPass, godRaysEffect, vignettePass,toneMappingEffect)
	);

	//Code for ao AFTER other effects
	n8aopass.configuration.gammaCorrection = false;
	composer.addPass(n8aopass);

	/* SMAA Recommended */
	composer.addPass(
		new EffectPass( new SMAAEffect({edgeDetectionMode: EdgeDetectionMode.DEPTH, preset: SMAAPreset.ULTRA}))
	);

	window.addEventListener("resize", () => {
        clientWidth = window.innerWidth;
        clientHeight = window.innerHeight;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight);
		composer.setSize(clientWidth, clientHeight);
		
    });

	n8aopass.configuration.aoRadius = this.params.ambientOcclusion.radius;
	n8aopass.configuration.distanceFalloff = this.params.ambientOcclusion.falloff;
	n8aopass.configuration.intensity = this.params.ambientOcclusion.intensity;
	n8aopass.configuration.color = new THREE.Color(this.params.ambientOcclusion.color); 

	// CSS 2D Label Renderer
	labelRenderer = new CSS2DRenderer();
	labelRenderer.setSize(window.innerWidth, window.innerHeight);
	labelRenderer.domElement.style.position = 'fixed';
	labelRenderer.domElement.style.top = '20px';

	document.body.appendChild(labelRenderer.domElement);
	//Raycasting and Click Handler Init
	interactionManager = new InteractionManager(
		renderer,
		camera,
		labelRenderer.domElement
	);

	//SCENE LIGHTING AMBIENT
	ambient = new THREE.HemisphereLight( this.params.ambientLight.skyColor, this.params.ambientLight.skyColor, this.params.ambientLight.intensity);

	scene.add(ambient)
	
	//SCENE LIGHTING SPOT LIGHT
	light = new THREE.DirectionalLight( this.params.directionalLight.color, this.params.directionalLight.intensity );

	light.position.set( this.params.directionalLight.position.x,this.params.directionalLight.position.y,this.params.directionalLight.position.z );
	light.castShadow = true;
	light.shadow.mapSize = new THREE.Vector2(1024, 1024);
	light.shadow.camera.top = 250;
	light.shadow.camera.bottom = - 250;
	light.shadow.camera.left = - 250;
	light.shadow.camera.right = 250;
	light.shadow.camera.near = 0.1;
	light.shadow.camera.far = 250;
	light.shadow.bias = this.denormalizeNumber(parseFloat(this.params.shadows.bias),-0.0009,-0.0001)
	if(this.params.directionalLight.enabled){
		scene.add(light)
		scene.add(light.target)	
	}

	THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replace( 'return shadow;', 'return max( 0.5, shadow );' );

	scene.backgroundIntensity = this.params.hdr.intensity

	if(this.params.background.type=='0'){
		scene.background = new THREE.Color( this.params.background.color );
	}else if(this.params.hdr.choice!='null'){
		let t = new THREE.TextureLoader().load(Alpine.$data(alpineComponent).environments[Alpine.$data(alpineComponent).params.hdr.choice].sphere)
		t.mapping = THREE.EquirectangularReflectionMapping;
		t.colorSpace = THREE.SRGBColorSpace
		scene.background = t
	}

	if(!this.params.hdr.custom && this.params.hdr.choice != 'null'){
		new RGBELoader().load( Alpine.$data(alpineComponent).environments[Alpine.$data(alpineComponent).params.hdr.choice].hdr, function ( texture) {
			cubemapTexture = texture
			cubemapTexture.mapping = THREE.EquirectangularReflectionMapping;
			scene.environment = cubemapTexture;
			mask_scene.environment = cubemapTexture;				
		});
	
	} else {

		new RGBELoader().load( this.params.hdr.customURL, function ( texture) {
			cubemapTexture = texture
			cubemapTexture.mapping = THREE.EquirectangularReflectionMapping;
			scene.environment = cubemapTexture;
		});
		console.log("CUSTOM HDR LOADED")
	}

	// CameraControls
	cameraControls = new CameraControls( camera, labelRenderer.domElement );
	cameraControls.draggingSmoothTime = parseFloat(1-this.params.navigation.damping)/4
	this.moveSpeed = this.denormalizeNumber(this.params.navigation.speed,.01,0.05)

	window.addEventListener( 'resize', this.onWindowResize );

	document.addEventListener("keydown", function( event ) {
		Alpine.$data(alpineComponent).uiKeyControls(event.code)
	})

},
loadAssets(assets){

	//Traverse All Assets
	for (const key in assets) {
		if (Object.hasOwnProperty.call(assets, key)) {
			const element = assets[key];
			this.currentLoading = element.name
	
			if(element.type=='model/gltf'){
				console.log(this.currentLoading)
				this.loadGLTF(element.name,element.url,element.position,element.rotation,element.scale,element.anim_selected,element.visible,element.id)
			}else if(element.type=='model/3dm'){
				this.load3DM(element.name,element.url,element.position,element.rotation,element.scale,element.visible,element.id)
			}else if(element.type=='model/ply'){
				this.loadPLY(element.name,element.url,element.position,element.rotation,element.scale,element.visible,element.pointSize,element.id)
			}else if(element.type=='model/fbx'){
				this.loadFBX(element.name,element.url,element.position,element.rotation,element.scale,element.anim_selected,element.visible,element.id)
			}else if(element.type=='model/splat'){
				this.loadSplat(element.name,element.url,element.position,element.rotation,element.scale,element.visible,element.alpha,element.id)
			}else if(element.type=='image'){
				this.loadImage(element.name,element.url,element.position,element.rotation,element.scale,key,element.curve,element.doubleSided,element.visible)
			}else if(element.type=='video'){
				this.loadVideo(element.name,element.url,element.position,element.rotation,element.scale,key,element.curve,element.doubleSided,element.visible,element.muted)
			}else if(element.type=='audio'){
				this.loadAudio(element.name,element.url,element.id,element.volume)
			}
			
		}
	}
},
load3DAnimations(){

	Alpine.$data(alpineComponent).animsFullList = []

	for (const key in this.assetList) {
		if (Object.hasOwnProperty.call(this.assetList, key)) {
			const element = this.assetList[key];
			if(element.type.includes('model')){

		
				if(Alpine.$data(alpineComponent).asset_map.get(key) && Alpine.$data(alpineComponent).asset_map.get(key).animation_list){
					
					Alpine.$data(alpineComponent).asset_map.get(key).animation_list.forEach((anim,index) => {
						Alpine.$data(alpineComponent).animsFullList.push({
							id:key,
							anim_index: index,
							name: element.name,
							anim_name: anim.name,
							anim: anim
						})
					});

				}
			}
		}
	}

},
loadGround(){

	ktx2Loader.setTranscoderPath( 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/basis/' );
	ktx2Loader.detectSupport( renderer );

	loader.setKTX2Loader( ktx2Loader );
	loader.setMeshoptDecoder( MeshoptDecoder );
	loader.setDRACOLoader( dracoLoader );
	loader.load( this.grounds[this.params.ground.choice].gltf , async function ( gltf ) {
		groundModel = gltf.scene
		groundModel.scale.set(Alpine.$data(alpineComponent).params.ground.scale,Alpine.$data(alpineComponent).params.ground.scale,Alpine.$data(alpineComponent).params.ground.scale,)
		groundModel.position.set(parseFloat(Alpine.$data(alpineComponent).params.ground.position.x),parseFloat(Alpine.$data(alpineComponent).params.ground.position.y),parseFloat(Alpine.$data(alpineComponent).params.ground.position.z))


		scene.add(gltf.scene)
		gltf.scene.traverse((o) => {
			if (o.isMesh){
				o.receiveShadow = true;
			}
		});
	})

},
getTextureURL(input){
	switch (input) {
		case 0:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/asphalt_01/Asphalt_basecolor_2K.webp'
			break;
		case 1:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/bricks_01/Bricks01_basecolor2_2K.webp'
			break;
		case 2:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/concrete_08/Concrete08_basecolor_2K.webp'
			break;
		case 3:
			return  'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/groundforest_01/GroundForest01_basecolor_2K.webp'
			break;
		case 4:
			return  'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/ice_03/Ice03_2K_basecolor_2K.webp'
			break;
		case 5:
			return  'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/marble_12/Marble12_basecolor_2K.webp'
			break;
		case 6:
			return  'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/metal_15/Metal015_basecolor_2K.webp'
			break;
		case 7:
			return  'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/wood_21/Wood021_basecolor_2K.webp'
			break;
		case 8:
			return  'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/woodfinedark_01/WoodFineDark004_basecolor_2K.webp'
			break;  
		case 9:
			return  'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/whiteplaster_01/Whiteplaster_basecolor_2K.webp'
			break;
		case 10:
			return  'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/ground_textures_2/mossyconcrete_26/Concrete026_baseolor_2K.webp'
			break;
		default:
			break;
	} 
},
onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
	labelRenderer.setSize( window.innerWidth, window.innerHeight );
},
cameraKeyControls(){
	//SECTION KEYBOARD EVENTS
		
		document.addEventListener('keyup', function(event) {
			if ( event.key === 'w' || event.code === 'KeyW' || event.key === 'a' || event.code === 'KeyA' || event.key === 's' || event.code === 'KeyS' || event.key === 'd' || event.code === 'KeyD' || event.key === 'e' || event.code === 'KeyE' || event.key === 'q' || event.code === 'KeyQ' ) {
			// "W" key was released
			setTimeout(() => {
				move = false
			}, 1000);
			// You can add your own code or function calls here
			}
		});

		document.addEventListener('keydown', function(event) {
			if ( event.key === 'w' || event.code === 'KeyW' || event.key === 'a' || event.code === 'KeyA' || event.key === 's' || event.code === 'KeyS' || event.key === 'd' || event.code === 'KeyD' || event.key === 'e' || event.code === 'KeyE' || event.key === 'q' || event.code === 'KeyQ'   ) {
			// "W" key was released
			move = true
			// You can add your own code or function calls here
			}
		});
	  
		const KEYCODE = {
			ESC: 27,
			R: 82,
			Q: 81,
			E: 69,
			W: 87,
			A: 65,
			S: 83,
			D: 68,
			ARROW_LEFT : 37,
			ARROW_UP   : 38,
			ARROW_RIGHT: 39,
			ARROW_DOWN : 40,
		};
		
		const wKey = new holdEvent.KeyboardKeyHold( KEYCODE.W, 16.666 );
		const aKey = new holdEvent.KeyboardKeyHold( KEYCODE.A, 16.666 );
		const sKey = new holdEvent.KeyboardKeyHold( KEYCODE.S, 16.666 );
		const dKey = new holdEvent.KeyboardKeyHold( KEYCODE.D, 16.666 );
		const qKey = new holdEvent.KeyboardKeyHold( KEYCODE.Q, 16.666 );
		const eKey = new holdEvent.KeyboardKeyHold( KEYCODE.E, 16.666 );

		qKey.addEventListener( 'holding', function( event ) { 
			if(!playing && Alpine.$data(alpineComponent).keyControlsEnabled){
				cameraControls.truck( 0,  +Alpine.$data(alpineComponent).moveSpeed * event.deltaTime, true)
			}
			} );
		eKey.addEventListener( 'holding', function( event ) { 
			if(!playing && Alpine.$data(alpineComponent).keyControlsEnabled){
				cameraControls.truck(  0,  -Alpine.$data(alpineComponent).moveSpeed * event.deltaTime, true)
			}
			} );
		aKey.addEventListener( 'holding', function( event ) { 
			if(!playing && Alpine.$data(alpineComponent).keyControlsEnabled){
				cameraControls.truck( -Alpine.$data(alpineComponent).moveSpeed * event.deltaTime, 0, true)
			} 
		} );
		dKey.addEventListener( 'holding', function( event ) {
			if(!playing && Alpine.$data(alpineComponent).keyControlsEnabled){
				cameraControls.truck( Alpine.$data(alpineComponent).moveSpeed * event.deltaTime, 0, true)
			} 
		} );

		wKey.addEventListener( 'holding', function( event ) { 
			if(!playing && Alpine.$data(alpineComponent).keyControlsEnabled){
				cameraControls.forward( Alpine.$data(alpineComponent).moveSpeed * event.deltaTime, true)
			}  
		} );
		sKey.addEventListener( 'holding', function( event ) { 
			if(!playing && Alpine.$data(alpineComponent).keyControlsEnabled){
				cameraControls.forward( -Alpine.$data(alpineComponent).moveSpeed * event.deltaTime, true)
			}  
		} );
	
},
getThumbnailURL(input){
	switch (input) {
		case 'null':
			return ''
			break;
		case 0:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/hdrs/CGiB/sea_morning_polyhaven/kloofendal_48d_partly_cloudy_puresky_1k1.webp'
			break;
		case 1:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/hdrs/CGiB/ocean_sunset_polyhaven/belfast_sunset_puresky_1k1.webp'
			break;
		case 2:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/polyhaven_assets/city_night.webp'
			break;
		default:
			break;
	}  
},
getSphereURL(input){
	switch (input) {
		case 'null':
			return ''
			break;
		case 0:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/hdrs/CGiB/sea_morning_polyhaven/kloofendal_48d_partly_cloudy_puresky.jpg'
			break;
		case 1:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/hdrs/CGiB/ocean_sunset_polyhaven/belfast_sunset_puresky.jpg'
			break;
		case 2:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/polyhaven_assets/city_night.webp'
			break;
		default:
			break;
	}  
},
getCubemapURL(input){
	switch (input) {
		case 'null':
			return ''
			break;
		case 0:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/hdrs/CGiB/sea_morning_polyhaven/kloofendal_48d_partly_cloudy_puresky_2k.hdr'
			break;
		case 1:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/foveate_site_prod_assets/hdrs/CGiB/ocean_sunset_polyhaven/belfast_sunset_puresky_2k.hdr'
			break;
		case 2:
			return 'https://foveate3dn.nyc3.cdn.digitaloceanspaces.com/polyhaven_assets/city_night_2k.hdr'
			break;
		default:
			break;
	}  
},
copyARLink(){
	this.app_ui_state.copying = true
	let id = this.scene_share + '#' + this.currentMoment + '_AR'
	navigator.clipboard.writeText(id)	
	setTimeout(() => {
		Alpine.$data(alpineComponent).app_ui_state.copying = false
	}, 1000);
},
copyShareLink(){
	this.app_ui_state.copying = true
	let id = this.scene_share + '#' + this.currentMoment
	navigator.clipboard.writeText(id)	
	setTimeout(() => {
		Alpine.$data(alpineComponent).app_ui_state.copying = false
	}, 1000);
},
momentTween(moment){

	Alpine.$data(alpineComponent).momentEnded = false

	if(fov_tween!=undefined){
		fov_tween.stop()
	}

	fov_tween = new TWEEN.Tween({fov:camera.fov}).to({
		fov: moment.fov,
		distance: parseFloat(moment.focalDistance),
		length: parseFloat(moment.focalLength)
	}, parseFloat(moment.length*1000)*.358)
	.onUpdate(function(object){
		Alpine.$data(alpineComponent).params.camera.fov = object.fov
		camera.fov = object.fov
		camera.updateProjectionMatrix()
	}).onComplete(function(object){
		console.log("moment finished")
	
	})
	.start()


	setTimeout(() => {
		Alpine.$data(alpineComponent).momentEnded = true
	}, (moment.length*1)*2000);

},
tweenToMoment(id,transition){
	window.location.hash = id
	console.log(window.location)
	let moment = this.momentsDB[id]

	if(transition==undefined){
		transition = true
	}

	if(moment){
		this.momentTween(moment)

		let cam = moment.camera_pos
		let target = moment.target_pos
	
		setTimeout(() => {
			cameraControls.smoothTime = moment.length /3	
			cameraControls.setLookAt( parseFloat(cam.x),parseFloat(cam.y),parseFloat(cam.z), parseFloat(target.x),parseFloat(target.y),parseFloat(target.z),transition)
		}, 10);
	}else{
		window.location.hash = ''
	}
	
},
showMoments(){
	console.log("SHOW MOMENTS ")	
	this.annotations = new Map()
	this.moment_order.forEach((element, index) => {
		console.log(this.momentsDB[element].title)

		let target = this.momentsDB[element].target_pos
		let moment_label
		let moment_text

		let t = {
			x: parseFloat(target.x),
			y: parseFloat(target.y),
			z: parseFloat(target.z)
		}
	
		//Create Moment HTML Label
		moment_text = document.createElement( 'div' );
		moment_text.style.backgroundColor = 'rgba(25,25,25,.8)'
		moment_text.style.backdropFilter = '2px'
		moment_text.style.color = 'rgb(255,255,255)';
		moment_text.style.padding = '10px';
		moment_text.style.borderRadius = '5px'
		moment_text.style.zIndex = '999'
		let title = this.momentsDB[element].title

		moment_text.innerHTML = `<span x-text="'${title}'" class="text-white pointer-events-none"></span>`

		//Create Moment Three CSS Object
		moment_label = new CSS2DObject( moment_text );
		
		this.annotations.set(element,moment_label)

		scene.add(moment_label)

		moment_label.position.x = t.x
		moment_label.position.y = t.y
		moment_label.position.z = t.z
		

		moment_text.addEventListener('mouseenter', () => { 
			moment_text.style.backgroundColor = 'rgba(0,136,255,.8)'
		})

		moment_text.addEventListener('mouseout', () => { 
			moment_text.style.backgroundColor = 'rgba(25,25,25,.8)'
		})

		moment_text.addEventListener('pointerdown', () => { 
			Alpine.$data(alpineComponent).tweenToMoment(element)
			
		})

	});
},
hideMoments(value){
	this.annotations.forEach((element, index) => {
		console.log(element)
		scene.remove(Alpine.raw(element))
	});	
},
transport(){
	if(this.playing){
		this.pause()
	}else{
		this.play()
	}
},
play(){	

	if(this.currentMoment==''){
		Alpine.$data(alpineComponent).currentMoment = Alpine.$data(alpineComponent).moment_order[0]
		Alpine.$data(alpineComponent).selectedMoment = Alpine.$data(alpineComponent).moment_order[0]	
	}

	console.log("PLAY MOMENT",this.currentMoment)

	Tone.start()

	this.moments_ui.label = true
	this.moments_ui.camera = false
	this.moments_ui.media = false
	this.moments_ui.transition = false
	
	if(this.momentsDB[this.currentMoment] != undefined){
		let moment = this.momentsDB[this.currentMoment]

		Alpine.$data(alpineComponent).moment_label.title = moment.title
		Alpine.$data(alpineComponent).moment_label.caption = moment.caption
		Alpine.$data(alpineComponent).moment_label.url = moment.url
		
		cameraControls.smoothTime = moment.length /3
		cameraControls.setLookAt( parseFloat(moment.camera_pos.x), parseFloat(moment.camera_pos.y), parseFloat(moment.camera_pos.z), parseFloat(moment.target_pos.x), parseFloat(moment.target_pos.y), parseFloat(moment.target_pos.z), true )

		let video = moment.videoSelection
		if(video!='null'){
			this.asset_map.get(video).video.play()
		}

		let audio = moment.audioSelection
		if(audio!='null'){
			Tone.start()
			Alpine.raw(this.asset_map.get(audio)).start()
		}

		this.momentTween(moment)

		//Play Autoplay Videos, Backing Track and 3D Animations
		for (const key in this.assetList) {
			if (Object.hasOwnProperty.call(this.assetList, key)) {
				const element = this.assetList[key];

				if(element.type=='video' && element.autoplay){
					this.asset_map.get(element.id).video.play()
				}

				if(element.type=='model/gltf' || element.type=='model/fbx'){
					if(moment.animSelection.includes(element.id)){ //Check if 3D Model is in Moment
						console.log("Play Anim from Moment")
						this.changeAnim(readAnim(moment.animSelection)[0],readAnim(moment.animSelection)[1])
					}else if(element.autoplay){ // Check if 3D Model has Autoplay Animations
						if(this.asset_map.get(element.id).animation_list){
							console.log("Play Anim from Autoplay")
							this.changeAnim(element.id,element.anim_selected)
						}
					}else{ // Disable Animations for 3D Asset
						if(this.asset_map.get(element.id).animation_list){
							console.log("Disable Anims on Asset",element.name)
							this.disableAnim(element.id)
						}
					}
				}

				if(element.type=='audio' && element.backingTrack){
					Tone.start()
					Alpine.raw(this.asset_map.get(element.id)).start()
				}

			} 
		}

	}else{
		//Play Autoplay Videos, Backing Track and 3D Animations
		for (const key in this.assetList) {
			if (Object.hasOwnProperty.call(this.assetList, key)) {
				const element = this.assetList[key];

				if(element.type=='video' && element.autoplay){
					this.asset_map.get(element.id).video.play()
				}

				if(element.type=='model/gltf' || element.type=='model/fbx'){
					if(element.autoplay){ // Check if 3D Model has Autoplay Animations
						if(this.asset_map.get(element.id).animation_list){
							console.log("Play Anim from Autoplay")
							this.changeAnim(element.id,element.anim_selected)
						}
					}else{ // Disable Animations for 3D Asset
						if(this.asset_map.get(element.id).animation_list){
							console.log("Disable Anims on Asset",element.name)
							this.disableAnim(element.id)
						}
					}
				}

				if(element.type=='audio' && element.backingTrack){
					Tone.start()
					Alpine.raw(this.asset_map.get(element.id)).start()
				}

			} 
		}
	}

	this.playing = true

},
pause(){ 

	clearInterval(progress_tween)
	Alpine.$data(alpineComponent).loadingProgress = 0

	cameraControls.smoothTime = 0.25
	for (const key in this.assetList) {
		if (Object.hasOwnProperty.call(this.assetList, key)) {
			const element = this.assetList[key]; 
			if(element.type=='video'){
				this.asset_map.get(element.id).video.pause()
			}else if(element.type=='audio'){
				Alpine.raw(this.asset_map.get(element.id)).stop()
			}
		}
	}
	this.playing = false

	if(fov_tween!=undefined){
		fov_tween.stop()
	}


	this.previewAnimation = {
		id:'',
		track:''
	}

},
nextFreeform(){

	this.arLoaded = false
	this.clearVideos()
	this.clearAudio() 

	let i = this.moment_order.indexOf(this.currentMoment)

	if(i+1>this.moment_order.length-1){
		i=0
	}else{
		i++
	}

	let next = this.moment_order[i]
	this.currentMoment = next
	this.selectedMoment = next

	let moment = this.momentsDB[next]
	this.tweenToMoment(moment)
	//Play Autoplay Videos, Backing Track and 3D Animations
	for (const key in this.assetList) {
		if (Object.hasOwnProperty.call(this.assetList, key)) {
			const element = this.assetList[key];

			if(element.type=='video' && element.autoplay){
				this.asset_map.get(element.id).video.play()
			}

			if(element.type=='model/gltf' || element.type=='model/fbx'){
				if(moment.animSelection.includes(element.id)){ //Check if 3D Model is in Moment
					console.log("Play Anim from Moment")
					this.changeAnim(readAnim(moment.animSelection)[0],readAnim(moment.animSelection)[1])
				}else if(element.autoplay){ // Check if 3D Model has Autoplay Animations
					if(this.asset_map.get(element.id).animation_list){
						console.log("Play Anim from Autoplay")
						this.changeAnim(element.id,element.anim_selected)
					}
				}else{ // Disable Animations for 3D Asset
					if(this.asset_map.get(element.id).animation_list){
						console.log("Disable Anims on Asset",element.name)
						this.disableAnim(element.id)
					}
				}
			}
		} 
	}

	let video = moment.videoSelection
	if(video!='null'){
		this.asset_map.get(video).video.play()
	}

	let audio = moment.audioSelection
	if(audio!='null'){
		Tone.start()
		Alpine.raw(this.asset_map.get(audio)).start()
	}
},
prevFreeform(){
	this.arLoaded = false
	this.clearVideos()
	this.clearAudio() 

	let i = this.moment_order.indexOf(this.currentMoment)

	if(i-1<0){
		i=this.moment_order.length-1
	}else{
		i--
	}

	let prev = this.moment_order[i]
	this.currentMoment = prev
	this.selectedMoment = prev

	let moment = this.momentsDB[prev]
	this.tweenToMoment(moment)
	//Play Autoplay Videos, Backing Track and 3D Animations
	for (const key in this.assetList) {
		if (Object.hasOwnProperty.call(this.assetList, key)) {
			const element = this.assetList[key];

			if(element.type=='video' && element.autoplay){
				this.asset_map.get(element.id).video.play()
			}

			if(element.type=='model/gltf' || element.type=='model/fbx'){
				if(moment.animSelection.includes(element.id)){ //Check if 3D Model is in Moment
					console.log("Play Anim from Moment")
					this.changeAnim(readAnim(moment.animSelection)[0],readAnim(moment.animSelection)[1])
				}else if(element.autoplay){ // Check if 3D Model has Autoplay Animations
					if(this.asset_map.get(element.id).animation_list){
						console.log("Play Anim from Autoplay")
						this.changeAnim(element.id,element.anim_selected)
					}
				}else{ // Disable Animations for 3D Asset
					if(this.asset_map.get(element.id).animation_list){
						console.log("Disable Anims on Asset",element.name)
						this.disableAnim(element.id)
					}
				}
			}
		} 
	}

	let video = moment.videoSelection
	if(video!='null'){
		this.asset_map.get(video).video.play()
	}

	let audio = moment.audioSelection
	if(audio!='null'){
		Tone.start()
		Alpine.raw(this.asset_map.get(audio)).start()
	}
},
loadAudio(name,url,id,volume){

	let player = new Tone.Player(url, function(){ 
		player.playbackRate = 1;
		player.autostart = false;
		player.volume.value = volume
	}).toDestination()

	Alpine.$data(alpineComponent).asset_map.set(id,player)

},
loadPLY(name,url,position,rotation,scale,visibility,pointSize,id) {
	const plyLoader = new PLYLoader();
	plyLoader.load(url, function ( geometry ) {

		let material = new THREE.PointsMaterial( { size: parseFloat(pointSize) } );
		material.vertexColors = true //if has colors
		material.sizeAttenuation = true
		var mesh = new THREE.Points(geometry, material)

		mesh.position.x = parseFloat(position.x)
		mesh.position.y = parseFloat(position.y)
		mesh.position.z = parseFloat(position.z)
		mesh.rotation.x = THREE.MathUtils.degToRad(rotation.x)
		mesh.rotation.y = THREE.MathUtils.degToRad(rotation.y)
		mesh.rotation.z = THREE.MathUtils.degToRad(rotation.z)
		mesh.scale.x = parseFloat(scale.x)
		mesh.scale.y = parseFloat(scale.y)
		mesh.scale.z = parseFloat(scale.z)
		mesh.visible = visibility
		mesh.castShadow = true 
		mesh.receiveShadow = true
		scene.add(mesh)	

		let model_obj = {
			name: name,
			position: position,
			scale: scale,
			visible: visibility,
			url: url,
			id:id,
			model: mesh,
		}
		Alpine.$data(alpineComponent).asset_map.set(id,model_obj)

	} );

	this.lastSelected = id
},
load3DM(name,url,position,rotation,scale,visibility,id) {
	console.log("load 3dm called")
	const rhinoLoader = new Rhino3dmLoader();
	rhinoLoader.setLibraryPath( 'https://unpkg.com/rhino3dm@8.0.1/' );
	rhinoLoader.load(url, function ( object ) {

		
		console.log(name," is using ",units[object.userData.settings.modelUnitSystem.value].name," Unit")
		console.log("Scale ",name," by ",units[object.userData.settings.modelUnitSystem.value].factor," On Load")

		let scale_factor = units[object.userData.settings.modelUnitSystem.value].factor

		console.log(scale_factor)
		console.log("incoming scale,",scale)
		console.log(object.scale)

		object.position.x = parseFloat(position.x)
		object.position.y = parseFloat(position.y)
		object.position.z = parseFloat(position.z)
		
		object.rotation.x = THREE.MathUtils.degToRad(rotation.x)
		object.rotation.y = THREE.MathUtils.degToRad(rotation.y)
		object.rotation.z = THREE.MathUtils.degToRad(rotation.z)
	
		object.scale.x = scale_factor * scale.x
		object.scale.y = scale_factor * scale.y
		object.scale.z = scale_factor * scale.z			

		object.visible = visibility

		const boundingBox = new THREE.Box3().setFromObject(object);``
		const dimensions = new THREE.Vector3();
		boundingBox.getSize(dimensions);
		const boxCenter = new THREE.Vector3();
		boundingBox.getCenter(boxCenter);

		const cubeGeometry = new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
		const material = new THREE.MeshBasicMaterial( {color: 0xffffff,transparent:true,opacity:.1,side:1} ); 
		const material_wire = new THREE.MeshBasicMaterial( {color: 0xffffff,wireframe: true,transparent:true,opacity:.1} ); 
		
		const mats = [material, material_wire] ; 

		const cube = createMultiMaterialObject( cubeGeometry, mats );
	
		cube.position.copy(boxCenter)		
		cube.visible = false
		
		scene.add(object)

		const helper = new THREE.Box3Helper( boundingBox, 0x00EE6F );
		helper.position.copy(cube.position)
		helper.rotation.copy(cube.rotation)
		helper.visible = false
		
		interactionManager.add(object);
		object.addEventListener('click', (event) => {

			event.stopPropagation();
			if(!Alpine.$data(alpineComponent).assetList[id].locked && Alpine.$data(alpineComponent).asset_map.get(id) && Alpine.$data(alpineComponent).transform.enabled && !Alpine.$data(alpineComponent).moments_ui.editTarget && !Alpine.$data(alpineComponent).moments_ui.editCamera ){
				helper.visible = true
				cube.visible = true
				Alpine.$data(alpineComponent).app_ui_state.assetsPanel = true	
				transformControl.attach(object)
				Alpine.$data(alpineComponent).selectedAsset = id
				Alpine.$data(alpineComponent).clearBoundingBoxes()	
			}
		})

		let model_obj = {
			name: name,
			position: position,
			scale: scale,
			visible: visibility,
			url: url,
			id:id,
			model: object,
			click: cube,
			bounds: helper,
			scaleFactor: scale_factor
		}


		Alpine.$data(alpineComponent).asset_map.set(id,model_obj)

	})
	
	this.lastSelected = id
},
loadFBX(name,data,position,rotation,scale,animationTrack,visibility,id) {

	const loader = new FBXLoader();
	loader.load( data , async function ( fbx ) {

		fbx.traverse( function ( child ) {
			if ( child.isMesh ) {
				child.castShadow = true;
				child.receiveShadow = true;  
			}

		} );

		fbx.position.x = parseFloat(position.x)
		fbx.position.y = parseFloat(position.y)
		fbx.position.z = parseFloat(position.z)
		fbx.rotation.x = THREE.MathUtils.degToRad(rotation.x)
		fbx.rotation.y = THREE.MathUtils.degToRad(rotation.y)
		fbx.rotation.z = THREE.MathUtils.degToRad(rotation.z)
		
		fbx.visible = visibility

		scene.add(fbx)	

		fbx.scale.x = parseFloat(scale.x)
		fbx.scale.y = parseFloat(scale.y)
		fbx.scale.z = parseFloat(scale.z)

	if(fbx.animations.length>0){
		
		let animation = new THREE.AnimationMixer( fbx)	
		let animation_clip = animation.clipAction( fbx.animations[ 0 ] )			
		animation_clip.play()

		//CREATE ASSET OBJ
		let model_obj = {
			animation_list: fbx.animations,
			animation_mixer: animation,
			animation_clip: animation_clip,
			name: name,
			position: position,
			scale: scale,
			visible: visibility,
			url: data,
			id:id,
			model: fbx,
			modelParent:fbx
		}

		Alpine.$data(alpineComponent).asset_map.set(id,model_obj)	
		Alpine.$data(alpineComponent).load3DAnimations()

	}else{

		let model_obj = {
			name: name,
			position: position,
			scale: scale,
			visible: visibility,
			url: data,
			id:id,
			model: fbx,
			modelParent:fbx,
			click: cube,
			bounds: helper
		}
		Alpine.$data(alpineComponent).asset_map.set(id,model_obj)
		Alpine.$data(alpineComponent).selectedAsset = id
		transformControl.attach(Alpine.$data(alpineComponent).asset_map.get(Alpine.$data(alpineComponent).selectedAsset).model)
	
	}
	
	})


},
loadSplat(name,url,position,rotation,scale,visibility,alpha,id) {
	console.log("load splat called",name,url)
	this.lastSelected = id

	const splatloader = new SplatLoader(renderer)
	splatloader.load( url, async function ( splat ) {

		let loadedSplat = new Splat(splat, camera, { alphaTest:parseFloat(alpha) })
		scene.add(loadedSplat)


		loadedSplat.position.x = parseFloat(position.x)
		loadedSplat.position.y = parseFloat(position.y)
		loadedSplat.position.z = parseFloat(position.z)
		
		loadedSplat.rotation.x = THREE.MathUtils.degToRad(rotation.x)
		loadedSplat.rotation.y = THREE.MathUtils.degToRad(rotation.y)
		loadedSplat.rotation.z = THREE.MathUtils.degToRad(rotation.z)
	
		loadedSplat.scale.x = scale.x
		loadedSplat.scale.y = scale.y
		loadedSplat.scale.z = scale.z			

		loadedSplat.visible = visibility

		const boundingBox = new THREE.Box3().setFromObject(loadedSplat);
		const dimensions = new THREE.Vector3();
		boundingBox.getSize(dimensions);
		const boxCenter = new THREE.Vector3();
		boundingBox.getCenter(boxCenter);

		const cubeGeometry = new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
		const material = new THREE.MeshBasicMaterial( {color: 0xffffff,transparent:true,opacity:.1,side:1} ); 
		const material_wire = new THREE.MeshBasicMaterial( {color: 0xffffff,wireframe: true,transparent:true,opacity:.1} ); 
		
		const mats = [material, material_wire] ; 

		const cube = createMultiMaterialObject( cubeGeometry, mats );
	
		cube.position.copy(boxCenter)		
		cube.visible = false
		
		const helper = new THREE.Box3Helper( boundingBox, 0x00EE6F );
		helper.position.copy(cube.position)
		helper.rotation.copy(cube.rotation)
		helper.visible = false

		
		
		interactionManager.add(loadedSplat);
		loadedSplat.addEventListener('click', (event) => {

			event.stopPropagation();
			if(!Alpine.$data(alpineComponent).assetList[id].locked && Alpine.$data(alpineComponent).asset_map.get(id) && Alpine.$data(alpineComponent).transform.enabled && !Alpine.$data(alpineComponent).moments_ui.editTarget && !Alpine.$data(alpineComponent).moments_ui.editCamera ){
				helper.visible = true
				cube.visible = true
				Alpine.$data(alpineComponent).app_ui_state.assetsPanel = true	
				transformControl.attach(loadedSplat)
				Alpine.$data(alpineComponent).selectedAsset = id
				Alpine.$data(alpineComponent).clearBoundingBoxes()	
			}
		})

		let model_obj = {
			name: name,
			position: position,
			scale: scale,
			visible: visibility,
			url: url,
			id:id,
			model: loadedSplat,
			click: cube,
			bounds: helper,
			scaleFactor: 1
		}

		console.log("DOES THIS WORK??????????")

		Alpine.$data(alpineComponent).asset_map.set(id,model_obj)

		console.log(Alpine.$data(alpineComponent).asset_map)

	})


},
loadGLTF(name,data,position,rotation,scale,animationTrack,visibility,id) {

	const dracoLoader = new DRACOLoader(); //DRACO Loader 
	dracoLoader.setDecoderPath( 'https://www.gstatic.com/draco/v1/decoders/' );
	loader = new GLTFLoader()
	let boundingBoxGroup = new THREE.Box3();
	loader.setKTX2Loader( ktx2Loader );
	loader.setMeshoptDecoder( MeshoptDecoder );
	loader.setDRACOLoader( dracoLoader );
	loader.load( data , async function ( gltf ) {

		//Traverse GLTF Materials
		gltf.scene.traverse((o) => {
			if (o.isMesh){
				o.castShadow = true;
				o.receiveShadow = true;
			}
		});

		//APPLY MODEL POSITIONS FROM DB
		gltf.scene.position.x = parseFloat(position.x)
		gltf.scene.position.y = parseFloat(position.y)
		gltf.scene.position.z = parseFloat(position.z)
		gltf.scene.rotation.x = THREE.MathUtils.degToRad(rotation.x)
		gltf.scene.rotation.y = THREE.MathUtils.degToRad(rotation.y)
		gltf.scene.rotation.z = THREE.MathUtils.degToRad(rotation.z)
	
		gltf.scene.visible = visibility

		scene.add(gltf.scene)	
		gltf.scene.scale.x = parseFloat(scale.x)
		gltf.scene.scale.y = parseFloat(scale.y)
		gltf.scene.scale.z = parseFloat(scale.z)
	
		if(gltf.animations.length>0){

			console.log(name,"gltf type 1 loaded")
			
			let animation = new THREE.AnimationMixer( gltf.scene)
		
			let animation_clip = animation.clipAction( gltf.animations[ animationTrack ] )			
			animation_clip.play()

			//CREATE ASSET OBJ
			let model_obj = {
				animation_list: gltf.animations,
				animation_mixer: animation,
				animation_clip: animation_clip,
				name: name,
				position: position,
				scale: scale,
				anim_selected: animationTrack,
				visible: visibility,
				url: data,
				id:id,
				model: gltf.scene,
				modelParent:gltf
			}
			Alpine.$data(alpineComponent).asset_map.set(id,model_obj)
			Alpine.$data(alpineComponent).load3DAnimations()
		}else{

			console.log(name,"gltf type 2 loaded")
		
			let model_obj = {
				name: name,
				position: position,
				scale: scale,
				anim_selected: animationTrack,
				visible: visibility,
				url: data,
				id:id,
				model: gltf.scene,
				modelParent:gltf
			}
			Alpine.$data(alpineComponent).asset_map.set(id,model_obj)
		
		}

	})

},
loadVideo(name,data,position,rotation,scale,id,curve,sides,visibility,muted) {

	let video = document.createElement('video');
	let geom = new THREE.PlaneGeometry(1,1,20,20);
	video.src = data
	video.muted = false
	video.autoplay = true
	video.playsInline = true
	video.loop = true
	video.crossOrigin = 'anonymous'
	video.currentTime = 1
	console.log(video)
	video.onloadeddata = function() {
	
		let texture = new THREE.VideoTexture( video );
		texture.encoding = THREE.sRGBEncoding

		let h = video.videoHeight/1000
		let w = video.videoWidth/1000

		let params ={
			bendDepth: 1
		}

		geom = new THREE.PlaneGeometry(w,h,20,20);
		let s = 0
		if(sides==undefined){
			s = 2
		}else if(sides){
			s = 2
		}else if(!sides){
			s = 0
		}
		let mat = new THREE.MeshBasicMaterial({envMap:scene.environment,reflectivity:0,map:texture, side: s});
		let o = new THREE.Mesh(geom, mat);
		planeCurve(o.geometry, curve); 

		o.castShadow = true

		function planeCurve(g, z){
			
			let p = g.parameters;
			let hw = p.width * 0.5;
			
			let a = new THREE.Vector2(-hw, 0);
			let b = new THREE.Vector2(0, z);
			let c = new THREE.Vector2(hw, 0);
			
			let ab = new THREE.Vector2().subVectors(a, b);
			let bc = new THREE.Vector2().subVectors(b, c);
			let ac = new THREE.Vector2().subVectors(a, c);
			
			let r = (ab.length() * bc.length() * ac.length()) / (2 * Math.abs(ab.cross(ac)));
			
			let center = new THREE.Vector2(0, z - r);
			let baseV = new THREE.Vector2().subVectors(a, center);
			let baseAngle = baseV.angle() - (Math.PI * 0.5);
			let arc = baseAngle * 2;
			
			let uv = g.attributes.uv;
			let pos = g.attributes.position;
			let mainV = new THREE.Vector2();
			for (let i = 0; i < uv.count; i++){
				let uvRatio = 1 - uv.getX(i);
				let y = pos.getY(i);
				mainV.copy(c).rotateAround(center, (arc * uvRatio));
				pos.setXYZ(i, mainV.x, y, -mainV.y);
			}
			
			pos.needsUpdate = true;
		
		}

		setTimeout(() => {
			video.pause()
		}, 50);
		
		o.position.x = position.x
		o.position.y = position.y
		o.position.z = position.z
		
		o.rotation.x = THREE.MathUtils.degToRad(rotation.x)
		o.rotation.y = THREE.MathUtils.degToRad(rotation.y)
		o.rotation.z = THREE.MathUtils.degToRad(rotation.z)

		o.scale.x = scale.x
		o.scale.y = scale.y
		o.scale.z = scale.z

		scene.add( o );
		o.visible = visibility 

		let video_obj = {
			video: video,
			model: o
		}
		Alpine.$data(alpineComponent).asset_map.set(id.toString(),video_obj)		
	}
},
loadImage(name,data,position,rotation,scale,id,curve,sides,visibility){

	new THREE.TextureLoader().load( data, function ( texture) {

		let h = texture.image.height/1000
		let w = texture.image.width/1000
		texture.encoding = THREE.sRGBEncoding

		let params ={
			bendDepth: 1
		}

		let geom = new THREE.PlaneGeometry(w,h,20,20);
		let s = 0
		if(sides==undefined){
			s = 2
		}else if(sides){
			s = 2
		}else if(!sides){
			s = 0
		}

		let mat = new THREE.MeshBasicMaterial({transparent:true,envMap:scene.environment,reflectivity:.01,map:texture, side: s});
		let plane = new THREE.Mesh(geom, mat);
		mat.needsUpdate = true

		planeCurve(plane.geometry, curve); 

		plane.castShadow = true

		function planeCurve(g, z){
			
			let p = g.parameters;
			let hw = p.width * 0.5;
			
			let a = new THREE.Vector2(-hw, 0);
			let b = new THREE.Vector2(0, z);
			let c = new THREE.Vector2(hw, 0);
			
			let ab = new THREE.Vector2().subVectors(a, b);
			let bc = new THREE.Vector2().subVectors(b, c);
			let ac = new THREE.Vector2().subVectors(a, c);
			
			let r = (ab.length() * bc.length() * ac.length()) / (2 * Math.abs(ab.cross(ac)));
			
			let center = new THREE.Vector2(0, z - r);
			let baseV = new THREE.Vector2().subVectors(a, center);
			let baseAngle = baseV.angle() - (Math.PI * 0.5);
			let arc = baseAngle * 2;
			
			let uv = g.attributes.uv;
			let pos = g.attributes.position;
			let mainV = new THREE.Vector2();
			for (let i = 0; i < uv.count; i++){
				let uvRatio = 1 - uv.getX(i);
				let y = pos.getY(i);
				mainV.copy(c).rotateAround(center, (arc * uvRatio));
				pos.setXYZ(i, mainV.x, y, -mainV.y);
			}
			
			pos.needsUpdate = true;
		
		}
		
		plane.position.x = position.x
		plane.position.y = position.y
		plane.position.z = position.z 
		
		plane.rotation.x = THREE.MathUtils.degToRad(rotation.x)
		plane.rotation.y = THREE.MathUtils.degToRad(rotation.y)
		plane.rotation.z = THREE.MathUtils.degToRad(rotation.z)

		plane.scale.x = scale.x
		plane.scale.y = scale.y
		plane.scale.z = scale.z

		scene.add( plane );
		plane.visible = visibility 

		let image_obj = {
			model: plane
		}
		Alpine.$data(alpineComponent).asset_map.set(id,image_obj)	
	
	});

	this.lastSelected = id

},
videoMuteHandler(state){

	let vid = Alpine.raw(this.asset_map.get(this.selectedAsset)).video
	vid.muted = state

},
videoAutoplayHandler(state){

	let vid = Alpine.raw(this.asset_map.get(this.selectedAsset)).video
	vid.autoplay = state

},
clearAudio(){
	for (const key in this.assetList) {
		if (Object.hasOwnProperty.call(this.assetList, key)) {
			const element = this.assetList[key]; 
			if(element.type=='audio' && !element.backingTrack){
				Alpine.raw(this.asset_map.get(element.id)).stop()
			}
		}
	}
},
clearVideos(){
	for (const key in this.assetList) {
		if (Object.hasOwnProperty.call(this.assetList, key)) {
			const element = this.assetList[key];
			if(element.type=='video'){
				this.asset_map.get(element.id).video.pause()
			}
		}
	}
},
changeAnim(asset,id){
	console.log("Play Anim from Asset",asset,"With ID = ",id)
	this.asset_map.get(asset).animation_clip.enabled = true
	this.asset_map.get(asset).animation_clip.stop()
	let newIndex = id
	this.asset_map.get(asset).animation_clip = this.asset_map.get(asset).animation_mixer.clipAction( this.asset_map.get(asset).modelParent.animations[newIndex] )
	this.asset_map.get(asset).animation_clip.play()
}, 
disableAnim(asset){
	console.log("Disable Anim from Asset",asset)
	this.asset_map.get(asset).animation_clip.enabled = false
	this.asset_map.get(asset).animation_clip.stop()
},
toggleFullscreen(){


	function makeFullscreen() {
		const body = document.querySelector('body');
		
		if (body.requestFullscreen) {
			body.requestFullscreen();
		} else if (body.mozRequestFullScreen) { // Firefox
			body.mozRequestFullScreen();
		} else if (body.webkitRequestFullscreen) { // Chrome, Safari and Opera
			body.webkitRequestFullscreen();
		} else if (body.msRequestFullscreen) { // IE/Edge
			body.msRequestFullscreen();
		}
	}

	function exitFullscreen() {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.mozCancelFullScreen) { // Firefox
			document.mozCancelFullScreen();
		} else if (document.webkitExitFullscreen) { // Chrome, Safari and Opera
			document.webkitExitFullscreen();
		} else if (document.msExitFullscreen) { // IE/Edge
			document.msExitFullscreen();
		}
	}

	if(this.fullscreen){
		makeFullscreen()
	}else{
		exitFullscreen()
	}

},
trackFullscreen(){
	let f = false
	document.addEventListener("fullscreenchange", (event) => {
	    f = !f
		Alpine.$data(alpineComponent).fullscreen = f
	});
},
toggleMute(){

	console.log("mute",this.mute)

	Tone.Destination.mute = this.mute

},
radToDeg(radians){
	return radians * (180 / Math.PI);
},
degToRad(degrees){
	return degrees * (Math.PI / 180);
},
async exportUSDZ(id){

	const a = document.createElement("a");
	if (a.relList.supports("ar")) {
		console.log("SETTING UP USDZ")
		let m = this.momentsDB[id].usdzSelection
	
		let asset = this.assetList[m]
		
		if(asset.type!='usdz'){
			console.log("SHOW CONVERTED USDZ")
			let model = Alpine.raw(this.asset_map.get(m)).model
	
			console.log(model)
	
			const exporter = new USDZExporter();
			const arraybuffer = await exporter.parse( model );
			const blob = new Blob( [ arraybuffer ], { type: 'application/octet-stream' } );
			const link = document.getElementById( 'ar_link' );
			link.href = URL.createObjectURL( blob );
			link.click()
	
		}else{
			console.log("SHOW NORMAL USDZ")
			let usdz = asset.url
			const link = document.getElementById( 'ar_link' );
			link.href = usdz
			link.click()
		}
	}else{

		this.app_ui_state.arPanel = true
		this.generateQRCode('ar')
	}


},
denormalizeNumber(normalizedValue, minRange, maxRange) {
	// Ensure the normalized value is within the range [0, 1]
	if (normalizedValue >= 0 && normalizedValue <= 1) {
	  // Denormalize the value to the original range
	  const denormalizedNumber = normalizedValue * (maxRange - minRange) + minRange;
	  
	  return denormalizedNumber;
	} else {
	  // Handle out-of-range values
	  console.error('Normalized value is not within the range [0, 1].');
	  return null;
	}
},
uiKeyControls(key){
	
	switch (key) {
		case 'KeyM':
			Alpine.$data(alpineComponent).app_ui_state.momentsPanel = !Alpine.$data(alpineComponent).app_ui_state.momentsPanel
			break;
		case 'Space':
			this.transport()
			break;
		case 'ArrowLeft':
			if(Alpine.$data(alpineComponent).playing && !Alpine.$data(alpineComponent).arPanel && !Alpine.$data(alpineComponent).sharePanel ){
				Alpine.$data(alpineComponent).generateQRCode(false)
				Alpine.$data(alpineComponent).prevFreeform()			
			}
			break;
		case 'ArrowRight':
			if(Alpine.$data(alpineComponent).playing && !Alpine.$data(alpineComponent).arPanel && !Alpine.$data(alpineComponent).sharePanel ){
				Alpine.$data(alpineComponent).generateQRCode(false)
				Alpine.$data(alpineComponent).nextFreeform()
			}
			break;				
		default:
			break;
	}

},
extractStringFromHash(hashString) {
    // Find the index of the underscore character
    const underscoreIndex = hashString.indexOf('_');
    
    // Extract the substring from the beginning to the underscore
    const resultString = underscoreIndex !== -1 ? hashString.substring(0, underscoreIndex) : hashString;
    
    return resultString;
},
generateQRCode(ar){
	let url = window.location.href

	if(ar=='ar'){
		url += '_AR'
	}

	document.getElementById('qrcode').innerHTML = ''
	document.getElementById('qrcode2').innerHTML = ''
	
	new QRCode(document.getElementById("qrcode"),{
			text: url,
			colorDark: "#191919",
			colorLight: "#ffffff",
			correctLevel: QRCode.CorrectLevel.H
	})

	new QRCode(document.getElementById("qrcode2"),{
		text: url,
		colorDark: "#191919",
		colorLight: "#ffffff",
		correctLevel: QRCode.CorrectLevel.H
})

},}))
Alpine.start()

const effectController = {
	aoSamples: 16.0,
	denoiseSamples: 8.0,
	denoiseRadius: 12.0,
	aoRadius: 5.0,
	distanceFalloff: 1.0,
	screenSpaceRadius: false,
	halfRes: false,
	depthAwareUpsampling: true,
	intensity: 5.0,
	renderMode: "Combined",
	color: [0, 0, 0],
	colorMultiply: true
};

function render(){ 

	labelRenderer.render( scene, camera );


	if(!Alpine.$data(alpineComponent).params.postProcessing.enabled){
		renderer.render( scene, camera );
	}else{
		composer.render();
	}
	const delta = clock.getDelta();
	const elapsed = clock.getElapsedTime();
	const updated = cameraControls.update( delta );

	TWEEN.update()

	if(Alpine.$data(alpineComponent).playing){
		let al = Alpine.$data(alpineComponent).assetList 
		let am = Alpine.$data(alpineComponent).asset_map 
		for (const key in al) {
			if (Object.hasOwnProperty.call(al, key)) {
				if(al[key].type=='model/gltf' || al[key].type=='model/fbx'   ){ // Go Through Asset List and find models
					if(am.get(al[key].id).animation_mixer!=undefined){ // Filter for Models with Animation Lists
						am.get(al[key].id).animation_mixer.update(delta * al[key].animationSpeed) // Start Animation Mixer per asset x Animation Speed
					}
				}
			}
		}

		if(Alpine.$data(alpineComponent).params.camera.shake && Alpine.$data(alpineComponent).momentEnded){
			cameraControls.elevate(Math.sin(elapsed)/1500*parseFloat(Alpine.$data(alpineComponent).params.camera.shakeSpeed), true)
		}
	
		if(Alpine.$data(alpineComponent).momentsDB[Alpine.$data(alpineComponent).currentMoment].rotate!=undefined && Alpine.$data(alpineComponent).momentsDB[Alpine.$data(alpineComponent).currentMoment].rotateSpeed!=undefined){
			if(!Alpine.$data(alpineComponent).mousedown && Alpine.$data(alpineComponent).momentsDB[Alpine.$data(alpineComponent).currentMoment].rotate && Alpine.$data(alpineComponent).momentEnded){
				cameraControls.azimuthAngle += (parseFloat(Alpine.$data(alpineComponent).momentsDB[Alpine.$data(alpineComponent).currentMoment].rotateSpeed) * 10)  * delta * THREE.MathUtils.DEG2RAD;
			}
		}else if(Alpine.$data(alpineComponent).momentsDB[Alpine.$data(alpineComponent).currentMoment].rotate && Alpine.$data(alpineComponent).momentsDB[Alpine.$data(alpineComponent).currentMoment].rotateSpeed==undefined){
			if(!Alpine.$data(alpineComponent).mousedown && Alpine.$data(alpineComponent).momentEnded){
				cameraControls.azimuthAngle += (10)  * delta * THREE.MathUtils.DEG2RAD;
			}
		}

	}

	requestAnimationFrame( render );
}

function readAnim(inputString) {
	// Define the regex pattern to split the string at the '=' character
	const regexPattern = /=/;
  
	// Use the `split` method to split the input string using the regex pattern
	const parts = inputString.split(regexPattern);
  
	// Ensure there are two parts
	if (parts.length === 2) {
	  return parts;
	} else {
	  // Handle the case where there are more than one '=' character in the string
	  return ["Invalid input"];
	}
}

function extractStringFromHash(hashString) {
    // Find the index of the underscore character
    const underscoreIndex = hashString.indexOf('_');
    
    // Extract the substring from the beginning to the underscore
    const resultString = underscoreIndex !== -1 ? hashString.substring(0, underscoreIndex) : hashString;
    
    return resultString;
}