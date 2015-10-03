/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.ColladaLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.ColladaLoader.prototype = {

	constructor: THREE.ColladaLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		function getBaseUrl( url ) {

			var parts = url.split( '/' );
			parts.pop();
			return ( parts.length < 1 ? '.' : parts.join( '/' ) ) + '/';

		}

		var scope = this;

		var loader = new THREE.XHRLoader( scope.manager );
		loader.setCrossOrigin( scope.crossOrigin );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text, getBaseUrl( url ) ) );

		}, onProgress, onError );

	},

	options: {

		set convertUpAxis ( value ) {
			console.log( 'ColladaLoder.options.convertUpAxis: TODO' );
		}

	},

	setCrossOrigin: function ( value ) {

		this.crossOrigin = value;

	},

	parse: function ( text, baseUrl ) {

		function parseFloats( text ) {

			var parts = text.trim().split( /\s+/ );
			var array = new Array( parts.length );

			for ( var i = 0, l = parts.length; i < l; i ++ ) {
				array[ i ] = parseFloat( parts[ i ] );
			}

			return array;

		}

		function parseInts( text ) {

			var parts = text.trim().split( /\s+/ );
			var array = new Array( parts.length );

			for ( var i = 0, l = parts.length; i < l; i ++ ) {
				array[ i ] = parseInt( parts[ i ] );
			}

			return array;

		}

		function parseId( text ) {

			return text.substring( 1 );

		}

		// library

		function buildLibrary( data, libraryName, nodeName, parser ) {

			var library = xml.getElementsByTagName( libraryName )[ 0 ];

			if ( library !== undefined ) {

				var elements = library.getElementsByTagName( nodeName );

				for ( var i = 0; i < elements.length; i ++ ) {

					var element = elements[ i ];
					data[ element.getAttribute( 'id' ) ] = parser( element );

				}

			}

		}

		// image

		var imageLoader = new THREE.ImageLoader();

		function parseImage( xml ) {

			var url = xml.getElementsByTagName( 'init_from' )[ 0 ].textContent;

			if ( baseUrl !== undefined ) url = baseUrl + url;

			return imageLoader.load( url );

		}

		// effect

		function parseEffect( xml ) {

			// console.log( xml );

		}

		// camera

		function parseCamera( xml ) {

			console.log( 'ColladaLoader.parseCamera: TODO')

			var camera = new THREE.PerspectiveCamera();
			camera.name = xml.getAttribute( 'name' );
			return camera;

		}

		// light

		function parseLight( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'technique_common':
						data = parseLightTechnique( child );
						break;

				}

			}

			//

			var light;

			switch ( data.technique ) {

				case 'directional':
					light = new THREE.DirectionalLight();
					break;

				case 'point':
					light = new THREE.PointLight();
					break;

				case 'spot':
					light = new THREE.SpotLight();
					break;

				case 'ambient':
					light = new THREE.AmbientLight();
					break;

			}

			if ( data.parameters.color ) light.color.copy( data.parameters.color );
			if ( data.parameters.distance ) light.distance = data.parameters.distance;

			return light;

		}

		function parseLightTechnique( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'directional':
					case 'point':
					case 'spot':
					case 'ambient':

						data.technique = child.nodeName;
						data.parameters = parseLightParameters( child );

				}

			}

			return data;

		}

		function parseLightParameters( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'color':
						var array = parseFloats( child.textContent );
						data.color = new THREE.Color().fromArray( array );
						break;

					case 'falloff_angle':
						data.falloffAngle = parseFloat( child.textContent );
						break;

					case 'quadratic_attenuation':
						var f = parseFloat( child.textContent );
						data.distance = f ? Math.sqrt( 1 / f ) : 0;
						break;

				}

			}

			return data;

		}

		// geometry

		var lineMaterial = new THREE.LineBasicMaterial();
		var meshMaterial = new THREE.MeshPhongMaterial();

		function parseGeometry( xml ) {

			var data = {
				id: xml.getAttribute( 'id' ),
				name: xml.getAttribute( 'name' ),
				sources: {},
				primitives: []
			};

			var mesh = xml.getElementsByTagName( 'mesh' )[ 0 ];

			for ( var i = 0; i < mesh.childNodes.length; i ++ ) {

				var child = mesh.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'source':
						data.sources[ child.getAttribute( 'id' ) ] = parseFloats( child.getElementsByTagName( 'float_array' )[ 0 ].textContent );
						break;

					case 'vertices':
						data.sources[ child.getAttribute( 'id' ) ] = data.sources[ parseId( child.getElementsByTagName( 'input' )[ 0 ].getAttribute( 'source' ) ) ];
						break;

					case 'polygons':
						console.log( 'ColladaLoader: Unsupported primitive type: ', child.nodeName );
						break;

					case 'lines':
					case 'linestrips':
					case 'polylist':
					case 'triangles':
						data.primitives.push( parseGeometryPrimitive( child ) );
						break;

					default:
						console.log( child );

				}

			}

			//

			var group = new THREE.Group();

			var sources = data.sources;
			var primitives = data.primitives;

			if ( primitives.length === 0 ) return group;

			for ( var p = 0; p < primitives.length; p ++ ) {

				var primitive = primitives[ p ];

				var inputs = primitive.inputs;
				var stride = primitive.stride;
				var vcount = primitive.vcount;

				var indices = primitive.p;
				var vcount = primitive.vcount;

				var maxcount = 0;

				var geometry = new THREE.BufferGeometry();
				if ( data.name ) geometry.name = data.name;

				for ( var name in inputs ) {

					var input = inputs[ name ];

					var source = sources[ input.id ];
					var offset = input.offset;

					var array = [];

					function pushVector( i ) {

						var index = indices[ i + offset ] * 3;
						array.push( source[ index + 0 ], source[ index + 1 ], source[ index + 2 ] );

					}

					if ( primitive.vcount !== undefined ) {

						var index = 0;

						for ( var i = 0, l = vcount.length; i < l; i ++ ) {

							var count = vcount[ i ];

							if ( count === 4 ) {

								var a = index + stride * 0;
								var b = index + stride * 1;
								var c = index + stride * 2;
								var d = index + stride * 3;

								pushVector( a ); pushVector( b ); pushVector( d );
								pushVector( b ); pushVector( c ); pushVector( d );

							} else if ( count === 3 ) {

								var a = index + stride * 0;
								var b = index + stride * 1;
								var c = index + stride * 2;

								pushVector( a ); pushVector( b ); pushVector( c );

							} else {

								maxcount = Math.max( maxcount, count );

							}

							index += stride * count;

						}

					} else {

						for ( var i = 0, l = indices.length; i < l; i += stride ) {

							pushVector( i );

						}

					}

					switch ( name )	{

						case 'VERTEX':
							geometry.addAttribute( 'position', new THREE.Float32Attribute( array, 3 ) );
							break;

						case 'NORMAL':
							geometry.addAttribute( 'normal', new THREE.Float32Attribute( array, 3 ) );
							break;

					}

				}

				if ( maxcount > 0 ) {

					console.log( 'ColladaLoader: Geometry', data.id, 'has faces with more than 4 vertices.' );

				}

				switch ( primitive.type ) {

					case 'lines':
						group.add( new THREE.LineSegments( geometry, lineMaterial ) );
						break;

					case 'linestrips':
						group.add( new THREE.Line( geometry, lineMaterial ) );
						break;

					case 'triangles':
					case 'polylist':
						group.add( new THREE.Mesh( geometry, meshMaterial ) );
						break;

				}

			}

			// flatten

			if ( group.children.length === 1 ) {

				return group.children[ 0 ];

			}

			return group;

		}

		function parseGeometryPrimitive( xml ) {

			var primitive = {
				type: xml.nodeName,
				inputs: {},
				stride: 0
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'input':
						var id = parseId( child.getAttribute( 'source' ) );
						var semantic = child.getAttribute( 'semantic' );
						var offset = parseInt( child.getAttribute( 'offset' ) );
						primitive.inputs[ semantic ] = { id: id, offset: offset };
						primitive.stride = Math.max( primitive.stride, offset + 1 );
						break;

					case 'vcount':
						primitive.vcount = parseInts( child.textContent );
						break;

					case 'p':
						primitive.p = parseInts( child.textContent );
						break;

				}

			}

			return primitive;

		}

		// nodes

		var matrix = new THREE.Matrix4();
		var vector = new THREE.Vector3();

		function parseNode( xml ) {

			var node = {
				name: xml.getAttribute( 'name' ),
				matrix: new THREE.Matrix4(),
				children: []
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'instance_camera':
						node.camera = library.cameras[ parseId( child.getAttribute( 'url' ) ) ];
						break;

					case 'instance_light':
						node.light = library.lights[ parseId( child.getAttribute( 'url' ) ) ];
						break;

					case 'instance_geometry':
						node.geometry = library.geometries[ parseId( child.getAttribute( 'url' ) ) ];
						break;

					case 'instance_node':
						node.children.push( library.nodes[ parseId( child.getAttribute( 'url' ) ) ] );
						break;

					case 'matrix':
						var array = parseFloats( child.textContent );
						node.matrix.multiply( matrix.fromArray( array ).transpose() ); // .transpose() when Z_UP?
						break;

					case 'node':
						node.children.push( parseNode( child ) );
						break;

					case 'translate':
						var array = parseFloats( child.textContent );
						vector.fromArray( array );
						node.matrix.multiply( matrix.makeTranslation( vector.x, vector.y, vector.z ) );
						break;

					case 'rotate':
						var array = parseFloats( child.textContent );
						var angle = THREE.Math.degToRad( array[ 3 ] );
						node.matrix.multiply( matrix.makeRotationAxis( vector.fromArray( array ), angle ) );
						break;

					case 'scale':
						var array = parseFloats( child.textContent );
						node.matrix.scale( vector.fromArray( array ) );
						break;

					case 'extra':
						break;

					default:
						console.log( child );
						break;

				}

			}

			//

			var object;

			if ( node.camera !== undefined ) {

				object = node.camera.clone();

			} else if ( node.light !== undefined) {

				object = node.light.clone();

			} else if ( node.geometry !== undefined ) {

				object = node.geometry.clone();

			} else {

				object = new THREE.Group();

			}

			object.name = node.name;
			node.matrix.decompose( object.position, object.quaternion, object.scale );

			var children = node.children;

			for ( var i = 0, l = children.length; i < l; i ++ ) {

				object.add( children[ i ] );

			}

			return object;

		}

		// visual scenes

		function parseVisualScene( xml ) {

			var group = new THREE.Group();
			group.name = xml.getAttribute( 'name' );

			var elements = xml.getElementsByTagName( 'node' );

			for ( var i = 0; i < elements.length; i ++ ) {

				var element = elements[ i ];
				group.add( parseNode( element ) );

			}

			return group;

		}

		// scenes

		function parseScene( xml ) {

			var scene = xml.getElementsByTagName( 'scene' )[ 0 ];
			var instance = scene.getElementsByTagName( 'instance_visual_scene' )[ 0 ];
			return library.visualScenes[ parseId( instance.getAttribute( 'url' ) ) ];

		}

		console.time( 'ColladaLoader' );

		console.time( 'ColladaLoader: DOMParser' );

		var xml = new DOMParser().parseFromString( text, 'text/xml' );

		console.timeEnd( 'ColladaLoader: DOMParser' );

		var library = {
			images: {},
			effects: {},
			cameras: {},
			lights: {},
			geometries: {},
			nodes: {},
			visualScenes: {}
		};

		buildLibrary( library.images, 'library_images', 'image', parseImage );
		buildLibrary( library.effects, 'library_effects', 'effect', parseEffect );
		buildLibrary( library.cameras, 'library_cameras', 'camera', parseCamera );
		buildLibrary( library.lights, 'library_lights', 'light', parseLight );
		buildLibrary( library.geometries, 'library_geometries', 'geometry', parseGeometry );
		buildLibrary( library.nodes, 'library_nodes', 'node', parseNode );
		buildLibrary( library.visualScenes, 'library_visual_scenes', 'visual_scene', parseVisualScene );

		var scene = parseScene( xml );

		console.timeEnd( 'ColladaLoader' );

		// console.log( scene );

		return {
			animations: [],
			kinematics: { joints: [] },
			scene: scene
		};

	}

};