import { Mesh, IcosahedronGeometry, ShaderMaterial, DoubleSide } from 'three';

/**
 * Ground projected env map adapted from @react-three/drei.
 * https://github.com/pmndrs/drei/blob/master/src/core/Environment.tsx
 */
export class GroundedSkybox extends Mesh {

	constructor( texture, h,r, options ) {

		const isCubeMap = texture.isCubeTexture;
		const w =
			( isCubeMap ? texture.image[ 0 ]?.width : texture.image.width ) ?? 1024;
		const cubeSize = w / 4;
		const _lodMax = Math.floor( Math.log2( cubeSize ) );
		const _cubeSize = Math.pow( 2, _lodMax );
		const width = 3 * Math.max( _cubeSize, 16 * 7 );
		const height = 4 * _cubeSize;

		const defines = [
			isCubeMap ? '#define ENVMAP_TYPE_CUBE' : '',
			`#define CUBEUV_TEXEL_WIDTH ${1.0 / width}`,
			`#define CUBEUV_TEXEL_HEIGHT ${1.0 / height}`,
			`#define CUBEUV_MAX_MIP ${_lodMax}.0`,
		];

		const vertexShader = /* glsl */ `
        varying vec3 vWorldPosition;

        void main() 
        {

            vec4 worldPosition = ( modelMatrix * vec4( position, 1.0 ) );
            vWorldPosition = worldPosition.xyz;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
        `;
		const fragmentShader = defines.join( '\n' ) + /* glsl */ `
        #define ENVMAP_TYPE_CUBE_UV

        varying vec3 vWorldPosition;

        uniform float radius;
        uniform float height;
        uniform float angle;

        #ifdef ENVMAP_TYPE_CUBE

            uniform samplerCube map;

        #else

            uniform sampler2D map;

        #endif

        // From: https://www.shadertoy.com/view/4tsBD7
        float diskIntersectWithBackFaceCulling( vec3 ro, vec3 rd, vec3 c, vec3 n, float r ) 
        {

            float d = dot ( rd, n );
            
            if( d > 0.0 ) { return 1e6; }
            
            vec3  o = ro - c;
            float t = - dot( n, o ) / d;
            vec3  q = o + rd * t;
            
            return ( dot( q, q ) < r * r ) ? t : 1e6;

        }

        // From: https://www.iquilezles.org/www/articles/intersectors/intersectors.htm
        float sphereIntersect( vec3 ro, vec3 rd, vec3 ce, float ra ) 
        {

            vec3 oc = ro - ce;
            float b = dot( oc, rd );
            float c = dot( oc, oc ) - ra * ra;
            float h = b * b - c;
            
            if( h < 0.0 ) { return -1.0; }
            
            h = sqrt( h );
            
            return - b + h;

        }

        
        // From: https://gist.github.com/yiwenl/3f804e80d0930e34a0b33359259b556c
        mat4 rotationMatrix( vec3 axis, float angle ) 
        {
            
            axis = normalize( axis );
            float s = sin( angle );
            float c = cos( angle );
            float oc = 1.0 - c;
            
            return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                        oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                        0.0,                                0.0,                                0.0,                                1.0);
        
        }

        // From: https://gist.github.com/yiwenl/3f804e80d0930e34a0b33359259b556c
        vec3 rotate( vec3 v, vec3 axis, float angle ) 
        {
            
            mat4 m = rotationMatrix( axis, angle );
            return ( m * vec4( v, 1.0 ) ).xyz;

        }
        
        vec3 project() 
        {

            vec3 p = normalize( vWorldPosition );
            vec3 camPos = cameraPosition;
            camPos.y -= height;

            float intersection = sphereIntersect( camPos, p, vec3( 0.0 ), radius );
            if( intersection > 0.0 ) {
                
                vec3 h = vec3( 0.0, - height, 0.0 );
                float intersection2 = diskIntersectWithBackFaceCulling( camPos, p, h, vec3( 0.0, 1.0, 0.0 ), radius );
                p = ( camPos + min( intersection, intersection2 ) * p ) / radius;

            } else {

                p = vec3( 0.0, 1.0, 0.0 );

            }
            
            p = rotate(p, vec3(0.0, 1.0, 0.0), angle);

            return p;

        }

        #include <common>
        #include <cube_uv_reflection_fragment>

        void main() 
        {

            vec3 projectedWorldPosition = project();
            
            #ifdef ENVMAP_TYPE_CUBE

                vec3 outcolor = textureCube( map, projectedWorldPosition ).rgb;

            #else

                vec3 direction = normalize( projectedWorldPosition );
                vec2 uv = equirectUv( direction );
                vec3 outcolor = texture2D( map, uv ).rgb;

            #endif

            gl_FragColor = vec4( outcolor, 1.0 );
            #include <tonemapping_fragment>

        }
        `;

		const uniforms = {
			map: { value: texture },
			height: { value: h || 15 },
			radius: { value: r || 100 },
			angle: { value: options?.angle || 0 },
		};

		const geometry = new IcosahedronGeometry( 1, 16 );
		const material = new ShaderMaterial( {
			uniforms,
			fragmentShader,
			vertexShader,
			side: DoubleSide,
		} );

		super( geometry, material );

	}

	set radius( radius ) {

		this.material.uniforms.radius.value = radius;

	}

	get radius() {

		return this.material.uniforms.radius.value;

	}

	set height( height ) {

		this.material.uniforms.height.value = height;

	}

	get height() {

		return this.material.uniforms.height.value;

	}
	
    set angle( angle ) {

		this.material.uniforms.angle.value = angle;

	}

	get angle() {

		return this.material.uniforms.angle.value;

	}

}