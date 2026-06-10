import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const NEON = 0x00f0c0;
const NEON2 = 0x2de2ff;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ----- Renderer / scene / camera -----
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

// ----- The interactive object: faceted crystal + wireframe shell -----
const group = new THREE.Group();
scene.add(group);

const coreGeo = new THREE.IcosahedronGeometry(1.35, 1);
const coreMat = new THREE.MeshStandardMaterial({
  color: 0x07131a,
  emissive: NEON,
  emissiveIntensity: 0.12,
  metalness: 0.3,
  roughness: 0.5,
  flatShading: true
});
const core = new THREE.Mesh(coreGeo, coreMat);
group.add(core);

const shellGeo = new THREE.IcosahedronGeometry(1.55, 1);
const shell = new THREE.LineSegments(
  new THREE.WireframeGeometry(shellGeo),
  new THREE.LineBasicMaterial({ color: NEON2, transparent: true, opacity: 0.55 })
);
group.add(shell);

// ----- Particle field around the object -----
const COUNT = 600;
const positions = new Float32Array(COUNT * 3);
for (let i = 0; i < COUNT; i++) {
  // random point in a spherical shell, deterministic-ish spread
  const r = 3.2 + (i % 50) / 50 * 3.5;
  const theta = i * 2.399963; // golden angle
  const phi = Math.acos(1 - (2 * (i + 0.5)) / COUNT);
  positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  positions[i * 3 + 2] = r * Math.cos(phi);
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    color: NEON,
    size: 0.035,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
scene.add(particles);

// ----- Lights -----
scene.add(new THREE.AmbientLight(0x223040, 0.6));
const key = new THREE.PointLight(NEON, 16, 50);
key.position.set(4, 5, 5);
scene.add(key);
const rim = new THREE.PointLight(NEON2, 14, 50);
rim.position.set(-5, -3, 2);
scene.add(rim);

// ----- Post-processing bloom (the glow) -----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45,  // strength
  0.4,   // radius
  0.55   // threshold — only bright edges/particles glow, dark core stays readable
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ----- Interaction: drag to rotate -----
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableZoom = false;   // keep mouse-wheel scrolling the page
controls.enablePan = false;
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.9;
// touch: vertical swipe scrolls the page, horizontal swipe rotates the object
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.NONE };
renderer.domElement.style.touchAction = 'pan-y'; // OrbitControls sets 'none', which blocks scrolling

// ----- Animation loop -----
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  if (!reduceMotion) {
    group.position.y = Math.sin(t * 0.8) * 0.12; // gentle float
    particles.rotation.y = t * 0.04;
    shell.rotation.z = t * 0.05;
  }
  controls.update();
  composer.render();
}
animate();

// ----- Resize -----
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ----- Small page niceties -----
document.getElementById('year').textContent = new Date().getFullYear();

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-visible'); });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
