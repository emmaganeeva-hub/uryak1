import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ══════════════════════════════════════════════════════════════
// PARAMS
// ══════════════════════════════════════════════════════════════
const P = {
    seed: 42,
    mouseSens: 0.7,
    distortAmt: 0.60, distortFreq: 3.2, distortSpeed: 0.75, distortType: 3,
    signOpacity: 0.85, travelSpeed: 1.0,
    particles: 10000, vignette: 0.7, grain: 0.25, glow: 0.7,
    keyLight: 2.5, rimLight: 3.5,
    renderMode: 'luminous'
};
const DEFAULTS = { ...P };
window._P = P;

// ── Shared state read by p5 sketch ────────────────────────────
const SIGN_DEFS = [
    { text: 'YARATAM',  angle: 0.00, hy: 1.00, dist: 1.30, sz: 1.1 },
    { text: 'SUGAR CRY',   angle: 0.79, hy: 0.75, dist: 1.25, sz: 1.1 },
    { text: 'MANGE BULSA', angle: 1.57, hy: 0.90, dist: 1.40, sz: 0.9 },
    { text: 'ИЛЬФАТ',  angle: 2.36, hy: 1.00, dist: 1.30, sz: 1.1 },
    { text: 'AUTISM',      angle: 3.14, hy: 0.65, dist: 1.20, sz: 1.5 },
    { text: 'СИНГУЛЯРНАЯ ЭМЕРГЕНЦИЯ',  angle: 3.93, hy: 1.00, dist: 1.30, sz: 0.4 },
    { text: 'КАЛИФОРНИЙСКОЕ ТОПЛИВО',  angle: 4.71, hy: 1.00, dist: 1.30, sz: 0.4 },
    { text: 'МИЦЕЛИЙ',  angle: 5.50, hy: 1.00, dist: 1.30, sz: 1.1 },
    { text: 'EGERME IKE', angle: 6.28, hy: 0.85, dist: 1.35, sz: 1.0 },
    { text: 'SHAU-SHU',      angle: 7.07, hy: 0.80, dist: 1.28, sz: 1.1 },
];

window.SHARED = { P, SIGN_DEFS, wpIdx: 0, wpPhase: 'travel', signAlpha: 0, total: 0, seed: P.seed };

function seededRng(s) {
    let h = s | 0;
    return () => { h = Math.imul(h^(h>>>16), 0x45d9f3b); h ^= h>>>16; return (h>>>0)/0xffffffff; };
}

// ══════════════════════════════════════════════════════════════
// RENDERER / SCENE / CAMERA
// ══════════════════════════════════════════════════════════════
const canvasEl = document.getElementById('three-canvas');
const statusEl = document.getElementById('status');
const area     = document.querySelector('.canvas-area');

function sz() { return { w: area.clientWidth, h: area.clientHeight }; }

const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

function resize() {
    const { w, h } = sz();
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.01);

const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 600);
camera.position.set(0, 3, 12);

// ══════════════════════════════════════════════════════════════
// LIGHTS
// ══════════════════════════════════════════════════════════════
scene.add(new THREE.AmbientLight(0x080c14, 0.8));
const kLight = new THREE.DirectionalLight(0xc0d8ff, P.keyLight);
kLight.position.set(3, 8, 5); scene.add(kLight);
const fill1 = new THREE.DirectionalLight(0xaa6655, 0.7);
fill1.position.set(-4, 2, -2);
scene.add(fill1);
const rLight = new THREE.DirectionalLight(0xffffff, P.rimLight);
rLight.position.set(-4, 8, -9); scene.add(rLight);
const fill2 = new THREE.DirectionalLight(0x7788ff, 2.0); fill2.position.set(6, 1, -9); scene.add(fill2);
const fill3 = new THREE.DirectionalLight(0x334466, 0.6); fill3.position.set(0, -6, 0); scene.add(fill3);
const redPoint = new THREE.PointLight(0xcc3344, 1.2);
redPoint.position.set(1, 2, 2);
scene.add(redPoint);
const redLight = new THREE.DirectionalLight(0xcc4455, 0.8);
redLight.position.set(2, 1, 3);
scene.add(redLight);

// ══════════════════════════════════════════════════════════════
// DISTORTION SHADER
// ══════════════════════════════════════════════════════════════
const DU = {
    uTime:  { value: 0 },
    uAmt:   { value: P.distortAmt },
    uFreq:  { value: P.distortFreq },
    uSpeed: { value: P.distortSpeed },
    uType:  { value: P.distortType },
};

const DISTORT_VERT_DECL = `
uniform float uTime; uniform float uAmt; uniform float uFreq;
uniform float uSpeed; uniform int uType;

float hash1(float n) {
    return fract(sin(n) * 43758.5453123);
}

float hash3(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y * p.z);
}

vec3 randCenter(float id, float t) {
    float phase = t * 0.22 + id * 11.73;
    float seg = floor(phase);
    float k = smoothstep(0.18, 0.82, fract(phase));

    vec3 a = vec3(
        mix(-1.1, 1.1, hash1(id * 13.1 + seg + 1.0)),
        mix(-1.8, 1.6, hash1(id * 17.7 + seg + 2.0)),
        mix(-0.9, 0.9, hash1(id * 19.3 + seg + 3.0))
    );

    vec3 b = vec3(
        mix(-1.1, 1.1, hash1(id * 13.1 + seg + 11.0)),
        mix(-1.8, 1.6, hash1(id * 17.7 + seg + 12.0)),
        mix(-0.9, 0.9, hash1(id * 19.3 + seg + 13.0))
    );

    return mix(a, b, k);
}

float localBlob(vec3 p, vec3 c, float r) {
    float d = length((p - c) * vec3(1.0, 1.15, 1.0));
    return 1.0 - smoothstep(r * 0.65, r, d);
}

float organicField(vec3 p, float t) {
    float sum = 0.0;

    for (int i = 0; i < 8; i++) {
        float id = float(i);
        vec3 c = randCenter(id, t);
        float r = mix(0.45, 0.95, hash1(id * 23.17 + 4.0));
        float blob = localBlob(p, c, r);

        float pulse = 0.55 + 0.45 * sin(t * 2.1 + id * 2.7);
        float detail =
            sin((p.x - c.x) * uFreq * 1.4 + t * 1.2 + id * 1.7) *
            cos((p.y - c.y) * uFreq * 0.9 - t * 0.8 + id * 0.9) *
            sin((p.z - c.z) * uFreq * 1.1 + t * 1.4 + id * 1.3);

        sum += blob * detail * pulse;
    }

    return (sum / 8.0) * 1.35;
}

float distortDisp(vec3 p) {
    float t = uTime * uSpeed;

    if (uType == 0) {
        return sin(p.x*uFreq+t)*cos(p.y*uFreq*0.73+t*0.8)*sin(p.z*uFreq*1.17+t*1.1);
    }
    else if (uType == 1) {
        float r = length(p);
        return sin(r*uFreq*1.5-t*3.0)*cos(p.y*uFreq*0.5+t*0.4);
    }
    else if (uType == 2) {
        float r = length(p.xz);
        return sin(r*uFreq*2.0-t*4.0)*cos(p.y*uFreq*0.4+t*0.3)*0.8;
    }
    else if (uType == 3) {
        return organicField(p, t);
    }
    else if (uType == 4) {
        return -abs(sin(p.x*uFreq+t)*cos(p.y*uFreq*0.73+t*0.8)*sin(p.z*uFreq*1.17+t*1.1));
    }

    else if (uType == 4) {
        float h = hash3(p);
        return (h*2.0-1.0)*(0.5+0.5*sin(t*1.1+h*6.28));
    }
}
`;
function makeDistortedMat(base) {
    base.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, DU);
        sh.vertexShader = DISTORT_VERT_DECL + sh.vertexShader;
        sh.vertexShader = sh.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            float d = distortDisp(position) * uAmt;
            transformed += normal * d;`
        );
    };
    base.customProgramCacheKey = () => 'distort-v3-' + P.distortType;
    return base;
}

// ══════════════════════════════════════════════════════════════
// STARFIELD
// ══════════════════════════════════════════════════════════════

function createLayeredGrid() {
    for (let i = 0; i < 3; i++) {
        const grid = new THREE.GridHelper(20, 40, 0x3a3a3a, 0x1a1a1a);

        grid.material.transparent = true;
        grid.material.opacity = 1 - i * 0.03;

        grid.position.y = -2 - i * 1.5;

        scene.add(grid);
    }
}
createLayeredGrid();

// ══════════════════════════════════════════════════════════════
// MODEL
// ══════════════════════════════════════════════════════════════
let modelRadius = 2.5, meshCount = 0;
const mats = { original:[], luminous:[], wireframe:[], xray:[] };

const loader = new GLTFLoader();
loader.load('./model.glb',
    gltf => {
        const mdl = gltf.scene;
        const bb  = new THREE.Box3().setFromObject(mdl);
        const ctr = bb.getCenter(new THREE.Vector3());
        const sz2 = bb.getSize(new THREE.Vector3());
        modelRadius = Math.max(sz2.x, sz2.y, sz2.z) * 0.5;
        mdl.position.sub(ctr);
        const sc = 5 / sz2.y;
        mdl.scale.setScalar(sc);
        modelRadius *= sc;

        mdl.traverse(obj => {
            if (!obj.isMesh) return;
            meshCount++;
            mats.original.push({ m: obj, mat: obj.material });
            mats.luminous.push({ m: obj, mat: makeDistortedMat(new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x2a2a2a),
                emissive: new THREE.Color(0x111111),
                emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.8
            }))});
            mats.wireframe.push({ m: obj, mat: new THREE.MeshBasicMaterial({
                color:0xffffff, wireframe:true, transparent:true, opacity:0.45
            })});
            mats.xray.push({ m: obj, mat: new THREE.MeshPhongMaterial({
                color:0x5588ff, transparent:true, opacity:0.13,
                side:THREE.DoubleSide, depthWrite:false
            })});
        });

        scene.add(mdl);
        statusEl.style.opacity = '0';
        setTimeout(() => statusEl.style.display='none', 700);
        buildParticles();
        applyRenderMode();
    },
    p => { statusEl.textContent = `Loading… ${Math.round(p.loaded/p.total*100)}%`; },
    err => { statusEl.textContent = 'Error loading model.'; console.error(err); }
);

function applyRenderMode() {
    const list = mats[P.renderMode] || mats.luminous;
    list.forEach(({m, mat}) => m.material = mat);
}
window.setRenderMode = (mode) => {
    P.renderMode = mode;
    document.querySelectorAll('.chip[id^=rm-]').forEach(b => b.classList.remove('on'));
    document.getElementById('rm-'+mode)?.classList.add('on');
    applyRenderMode();
};
window.setDistortType = (t) => {
    P.distortType = t;
    DU.uType.value = t;
    ['wave','pulse','ripple','chaos','shrink','dissolve'].forEach((n,i) =>
        document.getElementById('dt-'+n)?.classList.toggle('on', i===t));
    mats.luminous.forEach(({m,mat}) => { mat.needsUpdate = true; });
};

// ══════════════════════════════════════════════════════════════
// PARTICLES
// ══════════════════════════════════════════════════════════════
let ptcls = null;
function buildParticles() {
    if (ptcls) { scene.remove(ptcls); ptcls.geometry.dispose(); ptcls.material.dispose(); ptcls = null; }
    const n = P.particles | 0;
    if (!n) return;
    const rng = seededRng(P.seed + 77);
    const pos = new Float32Array(n*3), vel = new Float32Array(n*3), life = new Float32Array(n);
    for (let i=0;i<n;i++) resetP(pos,vel,life,i,rng);
    life.forEach((_,i) => life[i]=rng()*4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo._v=vel; geo._l=life; geo._r=rng; geo._n=n;
    ptcls = new THREE.Points(geo, new THREE.PointsMaterial({
        color:0x7799ff, size:0.01, sizeAttenuation:true,
        transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false
    }));
    scene.add(ptcls);
}
function resetP(pos,vel,life,i,rng) {
    const R=modelRadius, th=rng()*Math.PI*2, ph=(rng()-0.5)*Math.PI, r=R*(0.4+rng()*0.8);
    pos[i*3]=r*Math.cos(ph)*Math.cos(th); pos[i*3+1]=R*(rng()-0.4)+r*Math.sin(ph); pos[i*3+2]=r*Math.cos(ph)*Math.sin(th);
    const sp=0.003+rng()*0.004;
    vel[i*3]=(rng()-0.5)*sp; vel[i*3+1]=sp*(0.5+rng()*0.7); vel[i*3+2]=(rng()-0.5)*sp;
    life[i]=2+rng()*3.5;
}
function tickParticles() {
    if (!ptcls) return;
    const geo=ptcls.geometry, pos=geo.attributes.position.array;
    const {_v:vel,_l:life,_r:rng,_n:n}=geo;
    for(let i=0;i<n;i++){
        life[i]-=0.016;
        if(life[i]<=0){resetP(pos,vel,life,i,rng);continue;}
        pos[i*3]+=vel[i*3]; pos[i*3+1]+=vel[i*3+1]; pos[i*3+2]+=vel[i*3+2];
    }
    geo.attributes.position.needsUpdate=true;
    ptcls.material.opacity = P.glow * 0.38;
}

// ══════════════════════════════════════════════════════════════
// CAMERA — waypoint travel + mouse nudge
// ══════════════════════════════════════════════════════════════
let smX=0, smY=0, tgtX=0, tgtY=0;
let wpIdx=0, wpT=0, wpPhase='travel';
let signAlpha=0;
const WP_TRAVEL=4.5, WP_PAUSE=1.5;

area.addEventListener('mousemove', e => {
    const r = area.getBoundingClientRect();
    tgtX = ((e.clientX-r.left)/r.width  - 0.5)*3;
    tgtY = ((e.clientY-r.top) /r.height - 0.5)*3;
});
area.addEventListener('mouseleave', () => { tgtX=0; tgtY=0; });

function easeIO(t) { return t<0.5 ? 2*t*t : -1+(4-2*t)*t; }

function wpCamPos(def, R) {
    const angle = def.angle;
    // Параметры спирали
    const radiusMin = 1.2;   // минимальный радиус (в единицах R)
    const radiusMax = 2.2;   // максимальный радиус
    const heightMin = 0.2;   // минимальная высота (в единицах R)
    const heightMax = 1.8;   // максимальная высота
    
    // Предполагаем, что угол изменяется от 0 до maxAngle (здесь 7.07)
    const maxAngle = 7.07;
    const t = angle / maxAngle;   // от 0 до 1
    
    const radius = R * (radiusMin + t * (radiusMax - radiusMin));
    const height = R * (heightMin + t * (heightMax - heightMin));
    
    return new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
    );
}

function updateCamera(dt) {
    smX += (tgtX-smX)*0.5;
    smY += (tgtY-smY)*0.5;
    wpT += dt * P.travelSpeed;
    const N=SIGN_DEFS.length, R=modelRadius;
    const lookY = R * 0.55; // always focus on face/upper area

    if (wpPhase === 'pause') {
        const wp  = SIGN_DEFS[wpIdx];
        const tgt = wpCamPos(wp, R);
        tgt.x += smX * R * 0.10;
        tgt.y += smY * R * 0.06;
        camera.position.lerp(tgt, 0.04);
        camera.lookAt(smX*R*0.04, lookY, 0);
        if (wpT > WP_PAUSE) { wpPhase='travel'; wpT=0; }
    } else {
        const next = (wpIdx+1) % N;
        const t    = Math.min(wpT/WP_TRAVEL, 1);
        const e    = easeIO(t);
        camera.position.lerpVectors(wpCamPos(SIGN_DEFS[wpIdx],R), wpCamPos(SIGN_DEFS[next],R), e);
        camera.lookAt(0, lookY, 0);
        if (t >= 1) { wpIdx=next; wpPhase='pause'; wpT=0; }
    }

    // Sign alpha: fade in while paused, out when travel starts
    const tgt = wpPhase==='pause'
        ? P.signOpacity * Math.min(1, wpT/0.5)
        : P.signOpacity * Math.max(0, 1-wpT*3);
    signAlpha += (tgt-signAlpha)*0.08;
}

// ══════════════════════════════════════════════════════════════
// DEV PANEL
// ══════════════════════════════════════════════════════════════
const fpsH = [];
let devOpen = false;
window.toggleDev = () => {
    devOpen = !devOpen;
    document.getElementById('dev-panel').classList.toggle('hidden', !devOpen);
    document.getElementById('dev-btn').classList.toggle('open', devOpen);
    document.getElementById('dev-btn').textContent = devOpen ? 'DEV ×' : 'DEV';
};
function tickDev(dt, tot) {
    if (!devOpen) return;
    const fps = dt>0 ? 1/dt : 60;
    fpsH.push(fps); if(fpsH.length>30) fpsH.shift();
    const avg = fpsH.reduce((a,b)=>a+b,0)/fpsH.length;
    document.getElementById('d-fps').textContent  = avg.toFixed(1);
    document.getElementById('d-fps').className    = 'dv '+(avg>50?'g':avg>30?'w':'');
    document.getElementById('d-dt').textContent   = (dt*1000).toFixed(1)+'ms';
    const mm=Math.floor(tot/60), ss=(tot%60).toFixed(1);
    document.getElementById('d-time').textContent = `${String(mm).padStart(2,'0')}:${ss.padStart(4,'0')}`;
    document.getElementById('d-fps-bar').style.width = Math.min(avg/60*100,100)+'%';
    document.getElementById('d-cx').textContent   = camera.position.x.toFixed(2);
    document.getElementById('d-cy').textContent   = camera.position.y.toFixed(2);
    document.getElementById('d-cz').textContent   = camera.position.z.toFixed(2);
    document.getElementById('d-fov').textContent  = camera.fov.toFixed(1)+'°';
    document.getElementById('d-mouse').textContent= `${smX.toFixed(2)}, ${smY.toFixed(2)}`;
    document.getElementById('d-meshes').textContent = meshCount;
    document.getElementById('d-ptcl').textContent = P.particles;
    document.getElementById('d-dist').textContent =
        ['wave','pulse','ripple','chaos','shrink','dissolve'][P.distortType]+'×'+P.distortAmt.toFixed(2);
    document.getElementById('d-mode').textContent = P.renderMode;
    document.getElementById('d-seed').textContent = P.seed;
}

// ══════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ══════════════════════════════════════════════════════════════
let paused=false, lastTs=null, total=0;

function animate(ts) {
    requestAnimationFrame(animate);
    if (lastTs===null) lastTs=ts;
    const dt = Math.min((ts-lastTs)/10, 0.05);
    lastTs=ts;

    if (!paused) {
        total += dt;
        DU.uTime.value  = total;
        DU.uAmt.value   = P.distortAmt;
        DU.uFreq.value  = P.distortFreq;
        DU.uSpeed.value = P.distortSpeed;
        DU.uType.value  = P.distortType;
        updateCamera(dt);
        tickParticles();
    }

    const center = new THREE.Vector3(0, 0, 0);
    const dist = camera.position.distanceTo(center);
    const minDist = 1.0;
    const maxDist = 12.0;
    let factor = (maxDist - dist) / (maxDist - minDist);
    factor = Math.min(Math.max(factor, 0.2), 2.0);
    DU.uAmt.value = P.distortAmt * factor;
    renderer.render(scene, camera);

    // Sync shared state for p5 sketch
    const S = window.SHARED;
    S.wpIdx    = wpIdx;
    S.wpPhase  = wpPhase;
    S.signAlpha= signAlpha;
    S.total    = total;
    S.seed     = P.seed;

    tickDev(dt, total);
}

resize();
requestAnimationFrame(animate);
new ResizeObserver(resize).observe(area);

// ══════════════════════════════════════════════════════════════
// UI HANDLERS
// ══════════════════════════════════════════════════════════════
window.sp = function(key, val) {
    const v = parseFloat(val);
    P[key] = v;
    const disp = document.getElementById('v-'+key);
    if (disp) disp.textContent = key==='particles' ? String(v|0) : v.toFixed(2);
    if (key==='keyLight')  kLight.intensity = v;
    if (key==='rimLight')  rLight.intensity = v;
    if (key==='particles') buildParticles();
};

window.togglePause = () => {
    paused = !paused;
    document.getElementById('pause-btn').textContent = paused ? '▶ Resume' : '⏸ Pause';
};

function syncSeed() { document.getElementById('seed-input').value = P.seed; }
window.updateSeed = () => {
    const v = parseInt(document.getElementById('seed-input').value);
    if (v>0) { P.seed=v; createLayeredGrid(); buildParticles(); }
    else syncSeed();
};
window.prevSeed = () => { P.seed=Math.max(1,P.seed-1); syncSeed(); createLayeredGrid(); buildParticles(); };
window.nextSeed = () => { P.seed++; syncSeed(); createLayeredGrid(); buildParticles(); };
window.rndSeed  = () => { P.seed=(Math.random()*999999+1)|0; syncSeed(); createLayeredGrid(); buildParticles(); };

window.resetAll = () => {
    Object.assign(P, DEFAULTS);
    ['mouseSens','distortAmt','distortFreq','distortSpeed',
     'signOpacity','travelSpeed','particles','vignette','grain','glow','keyLight','rimLight']
    .forEach(k => { const el=document.getElementById(k); if(el){el.value=P[k]; window.sp(k,P[k]);} });
    window.setRenderMode('luminous');
    window.setDistortType(4);
    syncSeed();
};

window.addEventListener('load', syncSeed);
