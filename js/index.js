var scene, aspect, camera, renderer, controls;
var model, plane, biteIndicator, bites;
var light, spotlight;
var mouse, raycaster, intersectFace, intersectObj, intersectPoint;
var clippingPlanes = [];

var init = function() {
  // init mouse/raycaster
  mouse = new THREE.Vector2();
  raycaster = new THREE.Raycaster();
  intersectPoint = new THREE.Vector3();

  // init scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  var fog = new THREE.Fog({ color: 0xffffff, near: 2, far: 5 });
  scene.fog = fog;

  // load apple
  clippingPlanes = cylindricalPlanes(5, 0.275);
  loadModel();
  
  // get aspect ratio
  aspect = window.innerWidth / window.innerHeight;

  // init camera
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 100);
  camera.position.z = 0.5;
  camera.position.y = 1;

  // init renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.localClippingEnabled = true;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMapSoft = true;
  document.body.appendChild(renderer.domElement);

  // init orbit controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 1;
  controls.maxDistance = 1.5;

  // init plane
  var planeGeometry = new THREE.PlaneBufferGeometry(100, 100);
  var planeMaterial = new THREE.MeshPhongMaterial({ color: 0x0afafaf, dithering: true, side: THREE.DoubleSide });
  plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.receiveShadow = true;
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.285;
  scene.add(plane);

  // init biteIndicator
  var bGeometry = new THREE.SphereGeometry(0.1, 32, 32);
  var bMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
  biteIndicator = new THREE.Mesh(bGeometry, bMaterial);
  scene.add(biteIndicator);

  // init bites
  bites = new THREE.Group();
  scene.add(bites);

  // init ambilight
  light = new THREE.AmbientLight(0xf0f0f0, 0.5);
  scene.add(light);

  // init spotlight
  spotlight = new THREE.SpotLight(0xf8f8dd, 0.5, 100, Math.PI / 6, 0.5, 5);
  spotlight.position.set(10, 10, 0);
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.width = 1024;
  spotlight.shadow.mapSize.height = 1024;
  spotlight.shadow.camera.near = 1;
  spotlight.shadow.camera.far = 2;
  spotlight.shadow.camera.fov = 30;
  scene.add(spotlight);
};

var render = function() {  
  requestAnimationFrame( render );
  controls.update();
  if (model) {
    model.children.forEach((child) => {
      child.material.clippingPlanes = clippingPlanes;
    });
  }
  renderer.render( scene, camera );
};

var loadModel = function() {
  var onLoad = (object) => {
    object.traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.name = 'apple';
        child.scale.x = 0.1;
        child.scale.y = 0.1;
        child.scale.z = 0.1;
        child.rotation.y = Math.PI;
        child.geometry.computeFaceNormals();
        child.geometry.computeVertexNormals();
        child.material.clipShadows = true;
      }
    });
    model = object;
    scene.add(model);
  };
  var onProgress = (xhr) => { console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' ); };
  var onError = (error) => { console.error(error); };

  new THREE.MTLLoader()
    .setPath('model/')
    .load('apple.mtl', function(materials) {
      materials.preload();
      new THREE.OBJLoader()
        .setMaterials(materials)
        .setPath('model/')
        .load('apple.obj', onLoad, onProgress, onError );
    });
};

var createPlanes = function(n) {
  // creates an array of n uninitialized plane objects
  var result = new Array( n );
  for ( var i = 0; i !== n; ++ i )
    result[ i ] = new THREE.Plane();
  return result;
};

var cylindricalPlanes = function(n, innerRadius) {
  var result = createPlanes( n );
  for ( var i = 0; i !== n; ++ i ) {
    var plane = result[ i ],
      angle = i * Math.PI * 2 / n;
    plane.normal.set(
      Math.cos( angle ), 0, Math.sin( angle ) );
    plane.constant = innerRadius;
  }
  return result;
};

var planesFromMesh = function(vertices, indices) {
  // creates a clipping volume from a convex triangular mesh
  // specified by the arrays 'vertices' and 'indices'
  var n = indices.length / 3, result = new Array(n);
  for (var i = 0, j = 0; i < n; ++ i, j += 3) {
    var a = vertices[ indices[ j ] ],
      b = vertices[ indices[ j + 1 ] ],
      c = vertices[ indices[ j + 2 ] ];
    result[ i ] = new THREE.Plane().setFromCoplanarPoints( a, b, c );
  }
  return result;
};

var getFaceNormal = function(_, face) {
  return face.normal;
};

var onMouseMove = function(event) {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  // update the picking ray with the camera and mouse position
	raycaster.setFromCamera(mouse, camera);

  // calculate objects intersecting the picking ray
  if (model) {
    var intersects = raycaster.intersectObjects(scene.children, true);
    var foundPoint = false;
    for (let i = 0; i < intersects.length && !foundPoint; i += 1) {
      var intersect = intersects[i];
      if (intersect.object.name !== 'apple') continue;
      biteIndicator.position.copy(intersects[i].point);
      intersectPoint.copy(intersects[i].point);
      intersectFace = intersects[i].face;
      intersectObj = intersects[i].object;
      foundPoint = true;
    }
  }
};

var onMouseClick = function(event) {
  event.preventDefault();
  var normal = new THREE.Vector3(0,0,0);
  if (intersectObj && intersectFace) {
    var normal = getFaceNormal(intersectObj, intersectFace);
  }
  var biteGeometry = new THREE.TetrahedronGeometry(0.1);
  var biteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
  var bite = new THREE.Mesh(biteGeometry, biteMaterial);
  bite.position.copy(biteIndicator.position);
  bite.lookAt(normal);
  var indices = [0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2];
  var planes = planesFromMesh(bite.geometry.vertices, indices);
  clippingPlanes.concat(planes);
};

window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mouseup', onMouseClick, false);

init();
render();