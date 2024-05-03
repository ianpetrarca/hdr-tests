import './main.css'
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRJPGLoader } from '@monogrid/gainmap-js';
import {environments} from './environments'
import {GroundedSkybox} from './ground.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';


const SHADOW_MAP_WIDTH = 2048, SHADOW_MAP_HEIGHT = 1024;

const state = {
	shadow: {
		blur: 3.5,
		darkness: 1,
		opacity: 1,
	},
	plane: {
		color: '#ffffff',
		opacity: 1,
	},
	showWireframe: false,
};

let shadowGroup, renderTarget, renderTargetBlur, shadowCamera, cameraHelper, depthMaterial, horizontalBlurMaterial, verticalBlurMaterial;

let plane, blurPlane, fillPlane;

function extractNames(obj) {
	return Object.values(obj).map(item => item.name);
}

let selectedEnvironment = 7

let envNames = extractNames(environments);
let params = {
	environment: envNames[selectedEnvironment],
	resolution:'4k',
	blur:0,
	exposure:1,
	fov:50,
	height: environments[selectedEnvironment].height,
	radius: environments[selectedEnvironment].radius,
	shadowIntensity: 1,
};


let container, stats;
let camera, scene, renderer, controls;
let hdrj, skybox, loader

init();
animate();

function init() {

	container = document.createElement( 'div' );
	document.body.appendChild( container );

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 500 );
	camera.position.set( 0, 25, - 35 );
	camera.fov = 50
	scene = new THREE.Scene();
	renderer = new THREE.WebGLRenderer();
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
	

	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	document.body.appendChild( renderer.domElement );
	stats = new Stats();

	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.y = 2
	window.addEventListener( 'resize', onWindowResize );

	const gui = new GUI();
	gui.add( params, 'environment', envNames  ).onChange( changeEnvironment ).listen();
	gui.add( params, 'exposure', 0, 10, 0.01 ).onChange( changeExposure ).listen();
	gui.add( params, 'resolution', [ '2k','4k', '8k' ] ).onChange( changeEnvironment ).listen();
	gui.add( params, 'height', 0, 100, 0.01 ).onChange( changeHeight ).listen();
	gui.add( params, 'radius', 0, 1000, 0.01 ).onChange( changeRadius ).listen();
	gui.add( params, 'fov', 1, 100, 0.01 ).onChange( changeFOV ).listen();
	gui.add( params, 'shadowIntensity', .01, 1, 0.01 ).onChange( changeShadow ).listen();
	gui.open();

	const light = new THREE.DirectionalLight( 0xffffff, 1 );
	light.position.set( 0, 100, 10 ); //default; light shining from top
	light.castShadow = true; // default false
	scene.add( light );
	
	light.shadow.camera.near = 0.1;
	light.shadow.camera.far = 500;
	light.shadow.camera.right = 17;
	light.shadow.camera.left = - 17;
	light.shadow.camera.top	= 17;
	light.shadow.camera.bottom = - 17;
	light.shadow.mapSize.width = 512;
	light.shadow.mapSize.height = 512;
	//Create a plane that receives shadows (but does not cast them)
	const planeGeometry = new THREE.PlaneGeometry( 2000, 2000, 32, 32 );
	const planeMaterial = new THREE.ShadowMaterial( { color: 0x000000,opacity:1 } )
	const plane = new THREE.Mesh( planeGeometry, planeMaterial );
	plane.receiveShadow = true;
	scene.add( plane );
	plane.rotateX( - Math.PI / 2 );

	changeEnvironment()

	const dracoLoader = new DRACOLoader(); //DRACO Loader 
	dracoLoader.setDecoderPath( 'https://www.gstatic.com/draco/v1/decoders/' );
	loader = new GLTFLoader()
	loader.setDRACOLoader( dracoLoader );
	loader.load( '/moto1.glb' , async function ( gltf ) {	
		scene.add(gltf.scene)	
		gltf.scene.scale.set(10,10,10)
		gltf.scene.traverse((o) => {
			if (o.isMesh){
				o.castShadow = true;
			}
		});
	})

	function changeHeight(){
		skybox.height = params.height
	}

	function changeRadius(){
		skybox.radius = params.radius
	}

	function changeExposure(){
		console.log(params.exposure)
		renderer.toneMappingExposure = params.exposure
	}

	function changeEnvironment(){
		
		let url = ''
		if(params.resolution=='2k'){
			url = environments[envNames.indexOf(params.environment)].hdrjpg2k
			console.log("Loading 2K HDR ",url)
		}else if(params.resolution=='4k'){	
			url = environments[envNames.indexOf(params.environment)].hdrjpg4k
			console.log("Loading 4K HDR ",url)
		}else if(params.resolution=='8k'){
			url = environments[envNames.indexOf(params.environment)].hdrjpg8k
			console.log("Loading 8K HDR ",url)
		}

		console.log(environments[envNames.indexOf(params.environment)])
	
		let hdrJpg = new HDRJPGLoader(renderer).load( url, function ( ) {

			hdrj = hdrJpg.renderTarget.texture;
			hdrj.mapping = THREE.EquirectangularReflectionMapping;
			hdrj.needsUpdate = true;
			hdrJpg.dispose();
		
			scene.background = new THREE.Color(0x00000)
			scene.environment = hdrj
			
			skybox = new GroundedSkybox( hdrj, parseFloat(environments[envNames.indexOf(params.environment)].height), parseFloat(environments[envNames.indexOf(params.environment)].radius));
			scene.add( skybox );
			skybox.receiveShadow = true
			skybox.scale.setScalar(100)
			
			params.height = environments[envNames.indexOf(params.environment)].height
			params.radius = environments[envNames.indexOf(params.environment)].radius
			
		});
	}

	function changeFOV(){
		camera.fov = parseInt(params.fov)
		camera.updateProjectionMatrix()
	}

	function changeShadow(){
		plane.material.opacity = params.shadowIntensity
		plane.material.needsUpdate = true
	}
	
}

function onWindowResize() {
	const width = window.innerWidth;
	const height = window.innerHeight;
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	renderer.setSize( width, height );
}

function animate() {
	requestAnimationFrame( animate );
	render();
}

function render() {
	scene.background = hdrj;
	scene.environment = hdrj;
	controls.update()
	renderer.render( scene, camera );

	
}