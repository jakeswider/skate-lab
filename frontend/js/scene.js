import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SMOOTHING = 0.3;
const VIS_THRESHOLD = 0.35; 
let isPlaying = false;
let debugMode = false;
let isFreeCam = false;
let videoFPS = 30; 
let ghostFPS = 30;
let lastFrameIdx = -1; 

// --- Guide Modal ---
document.getElementById('closeGuideBtn').onclick = () => {
    document.getElementById('guideModal').style.display = 'none';
};

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd') debugMode = !debugMode;
});

// --- Scene Setup ---
const container = document.getElementById('canvasContainer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f0f);

const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 1.2, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio); 
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

scene.add(new THREE.GridHelper(10, 10, 0x333333, 0x111111));
scene.add(new THREE.AmbientLight(0xffffff, 3.0)); 
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(5, 10, 7.5);
scene.add(sun);

// --- Ledge Geometry ---
const ledgeGeometry = new THREE.BoxGeometry(1, 1, 1);
const ledgeMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
const ledgeMesh = new THREE.Mesh(ledgeGeometry, ledgeMaterial);
const edges = new THREE.EdgesGeometry(ledgeGeometry);
const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 }));
ledgeMesh.add(line);
scene.add(ledgeMesh);

const ledgeLength = document.getElementById('ledgeLength');
const ledgeHeight = document.getElementById('ledgeHeight');
const ledgeX = document.getElementById('ledgeX');
const ledgeY = document.getElementById('ledgeY');
const ledgeZ = document.getElementById('ledgeZ');
const toggleLedgeBtn = document.getElementById('toggleLedgeBtn');

function updateLedge() {
    const w = parseFloat(ledgeLength.value);
    const h = parseFloat(ledgeHeight.value);
    const yOffset = parseFloat(ledgeY.value);
    ledgeMesh.scale.set(w, h, 0.6);
    ledgeMesh.position.set(parseFloat(ledgeX.value), (h / 2) + yOffset, parseFloat(ledgeZ.value));
}
[ledgeLength, ledgeHeight, ledgeX, ledgeY, ledgeZ].forEach(slider => slider.addEventListener('input', updateLedge));
toggleLedgeBtn.onclick = () => { ledgeMesh.visible = !ledgeMesh.visible; };
updateLedge();


// --- Mannequin Generator Function ---
const skeletalTopology = [
    [11, 12], [11, 23], [12, 24], [23, 24], 
    [11, 13], [13, 15], [12, 14], [14, 16], 
    [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32]            
];

function createSkeleton(isGhost = false) {
    const matConfig = { transparent: true, opacity: isGhost ? 0.3 : 0.8, side: THREE.DoubleSide };
    
    const c_joint = isGhost ? 0x00ffff : 0x999999;
    const c_core  = isGhost ? 0x00ffff : 0xaaaaaa;
    const c_lArm  = isGhost ? 0x00ffff : 0x44aaff;
    const c_rArm  = isGhost ? 0x00ffff : 0xff44aa;
    const c_lLeg  = isGhost ? 0x00ffff : 0x44ffaa;
    const c_rLeg  = isGhost ? 0x00ffff : 0xffaa44;

    const jointMat = new THREE.MeshLambertMaterial({ color: c_joint, ...matConfig });
    const coreMat  = new THREE.MeshLambertMaterial({ color: c_core, ...matConfig }); 
    const limbData = [
        { conn: [11, 13], mat: new THREE.MeshLambertMaterial({ color: c_lArm, ...matConfig }), orig: c_lArm },
        { conn: [13, 15], mat: new THREE.MeshLambertMaterial({ color: c_lArm, ...matConfig }), orig: c_lArm },
        { conn: [12, 14], mat: new THREE.MeshLambertMaterial({ color: c_rArm, ...matConfig }), orig: c_rArm },
        { conn: [14, 16], mat: new THREE.MeshLambertMaterial({ color: c_rArm, ...matConfig }), orig: c_rArm },
        { conn: [23, 25], mat: new THREE.MeshLambertMaterial({ color: c_lLeg, ...matConfig }), orig: c_lLeg },
        { conn: [25, 27], mat: new THREE.MeshLambertMaterial({ color: c_lLeg, ...matConfig }), orig: c_lLeg },
        { conn: [24, 26], mat: new THREE.MeshLambertMaterial({ color: c_rLeg, ...matConfig }), orig: c_rLeg },
        { conn: [26, 28], mat: new THREE.MeshLambertMaterial({ color: c_rLeg, ...matConfig }), orig: c_rLeg }
    ];

    const points = [];
    for (let i = 0; i < 33; i++) {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(isGhost ? 0.015 : 0.02), jointMat.clone());
        sphere.userData.originalColor = c_joint;
        scene.add(sphere); points.push(sphere);
    }

    const innerWires = skeletalTopology.map(() => {
        const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c_core, transparent: true, opacity: isGhost ? 0.2 : 0.5 }));
        scene.add(line); return line;
    });

    const limbs = limbData.map(data => {
        const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(isGhost ? 0.03 : 0.04, 1, 4, 8), data.mat.clone());
        scene.add(mesh); return mesh;
    });

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), coreMat.clone()); scene.add(neckMesh);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(isGhost ? 0.08 : 0.09), coreMat.clone()); headMesh.scale.set(0.9, 1.2, 0.9); scene.add(headMesh);
    const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 16), coreMat.clone()); scene.add(torsoMesh);

    return { points, innerWires, limbs, limbData, neckMesh, headMesh, torsoMesh, isGhost };
}

// --- Skeleton Visibility Helper ---
function setSkeletonVisibility(skeletonObj, isVisible) {
    skeletonObj.points.forEach(p => p.visible = isVisible);
    skeletonObj.innerWires.forEach(w => w.visible = isVisible);
    skeletonObj.limbs.forEach(l => l.visible = isVisible);
    skeletonObj.neckMesh.visible = isVisible;
    skeletonObj.headMesh.visible = isVisible;
    skeletonObj.torsoMesh.visible = isVisible;
}

const baseSkeleton = createSkeleton(false);
const ghostSkeleton = createSkeleton(true);

setSkeletonVisibility(baseSkeleton, false);
setSkeletonVisibility(ghostSkeleton, false);


// --- Pipeline & Hooks ---
let baseData = null;
let ghostData = null;

const slider = document.getElementById('frameSlider');
const display = document.getElementById('frameDisplay');
const playBtn = document.getElementById('playBtn');
const uploadBtn = document.getElementById('uploadBtn');
const demoBtn = document.getElementById('demoBtn');
const uploadGhostBtn = document.getElementById('uploadGhostBtn');
const videoUpload = document.getElementById('videoUpload');
const ghostUpload = document.getElementById('ghostUpload');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

const sourceVideo = document.getElementById('sourceVideo');
const ghostVideo = document.getElementById('ghostVideo'); 
const cameraToggleBtn = document.getElementById('cameraToggleBtn');
const ghostTimeSlider = document.getElementById('ghostTimeOffset'); 

// Demo Modal Elements
const demoModal = document.getElementById('demoVideoModal');
const demoPlayer = document.getElementById('demoPlayer');
const closeDemoBtn = document.getElementById('closeDemoBtn');

cameraToggleBtn.onclick = () => {
    isFreeCam = !isFreeCam;
    cameraToggleBtn.innerText = isFreeCam ? "Freecam: ON" : "Freecam: OFF";
    if (isFreeCam) cameraToggleBtn.style.color = "var(--accent)";
    else cameraToggleBtn.style.color = "#ececec";
};

playBtn.onclick = () => {
    if (!baseData) return;
    isPlaying = !isPlaying;
    playBtn.innerText = isPlaying ? "Pause" : "Play";
};

uploadBtn.onclick = () => videoUpload.click();
uploadGhostBtn.onclick = () => ghostUpload.click();

demoBtn.onclick = () => {
    demoPlayer.src = '/demo_video'; 
    demoModal.style.display = 'flex';
    demoPlayer.play();
};

closeDemoBtn.onclick = () => {
    demoPlayer.pause();
    demoPlayer.currentTime = 0; 
    demoModal.style.display = 'none';
};

async function processUpload(file, isGhostTarget) {
    if (!file) return;
    loadingOverlay.style.display = 'flex';
    loadingText.innerText = isGhostTarget ? "Extracting Ghost Skeleton..." : "Extracting Main Trick...";
    isPlaying = false;
    playBtn.innerText = "Play";

    const formData = new FormData();
    formData.append('video', file);

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Server error`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        if (isGhostTarget) {
            ghostData = data.frames;
            ghostFPS = data.fps || 30;
            ghostVideo.src = URL.createObjectURL(file);
            ghostVideo.style.display = 'block'; 
            uploadGhostBtn.innerText = "Ghost Loaded";
            uploadGhostBtn.style.color = "var(--accent)";
            setSkeletonVisibility(ghostSkeleton, true);
        } else {
            baseData = data.frames;
            videoFPS = data.fps || 30;
            sourceVideo.src = URL.createObjectURL(file); 
            slider.max = baseData.length - 1;
            slider.value = 0;
            display.innerText = `Frame: 0`;
            lastFrameIdx = -1; 
            setSkeletonVisibility(baseSkeleton, true);
        }
        loadingOverlay.style.display = 'none';
        updateAllSkeletons(); 
    } catch (error) {
        alert("Failed to process video.");
        loadingOverlay.style.display = 'none';
    }
}

videoUpload.onchange = (e) => processUpload(e.target.files[0], false);
ghostUpload.onchange = (e) => processUpload(e.target.files[0], true);


// --- Animation Engine ---
function updateSkeletonPose(skeletonObj, frameData, xOffset = 0, yOffset = 0, zOffset = 0, isSnapping = false) {
    if (!frameData || frameData.length === 0) return null;
    const { points, innerWires, limbs, limbData, neckMesh, headMesh, torsoMesh, isGhost } = skeletonObj;

    const currentSmooth = isSnapping ? 1.0 : SMOOTHING;

    frameData.forEach(target => {
        const sphere = points[target.id];
        const isConfident = target.visibility >= VIS_THRESHOLD;
        
        const targetX = target.x + xOffset; 
        const targetY = target.y + yOffset;
        const targetZ = target.z + zOffset;

        if (isSnapping) {
            sphere.position.set(targetX, targetY, targetZ);
        } else {
            sphere.position.x += (targetX - sphere.position.x) * currentSmooth;
            sphere.position.y += (targetY - sphere.position.y) * currentSmooth;
            sphere.position.z += (targetZ - sphere.position.z) * currentSmooth;
        }
        
        if (isConfident) {
            sphere.material.opacity = isGhost ? 0.4 : (debugMode ? 1.0 : 1.0);
            if (debugMode && !isGhost) sphere.material.color.setHex(0x00ff00);
            else sphere.material.color.setHex(sphere.userData.originalColor);
        } else {
            sphere.material.opacity = isGhost ? 0.0 : (debugMode ? 1.0 : 0.1);
            if (debugMode && !isGhost) sphere.material.color.setHex(0xff0000);
            else sphere.material.color.setHex(sphere.userData.originalColor);
        }
    });

    skeletalTopology.forEach((conn, i) => {
        const p1 = points[conn[0]].position; const p2 = points[conn[1]].position;
        innerWires[i].geometry.setFromPoints([p1, p2]);
        const avgVis = (frameData[conn[0]].visibility + frameData[conn[1]].visibility) / 2;
        innerWires[i].material.opacity = (avgVis >= VIS_THRESHOLD && !debugMode) ? (isGhost ? 0.2 : 0.5) : 0.0;
    });

    limbs.forEach((limb, i) => {
        const p1 = points[limbData[i].conn[0]].position; const p2 = points[limbData[i].conn[1]].position;
        limb.position.copy(p1).lerp(p2, 0.5);
        const dist = p1.distanceTo(p2);
        limb.scale.set(1, dist, 1);
        if (dist > 0.001) limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());

        const avgVis = (frameData[limbData[i].conn[0]].visibility + frameData[limbData[i].conn[1]].visibility) / 2;
        if (avgVis >= VIS_THRESHOLD) {
            limb.material.opacity = isGhost ? 0.3 : (debugMode ? 0.9 : 0.8);
            if (debugMode && !isGhost) limb.material.color.setHex(0x00ff00);
            else limb.material.color.setHex(limbData[i].origColor);
        } else {
            limb.material.opacity = isGhost ? 0.0 : (debugMode ? 0.9 : 0.1);
            if (debugMode && !isGhost) limb.material.color.setHex(0xff0000);
            else limb.material.color.setHex(limbData[i].origColor);
        }
    });

    const p11 = points[11].position; const p12 = points[12].position;
    const p23 = points[23].position; const p24 = points[24].position;
    const earL = points[7].position; const earR = points[8].position;
    
    const headCenter = new THREE.Vector3().copy(earL).lerp(earR, 0.5);
    const shoulderCenter = new THREE.Vector3().copy(p11).lerp(p12, 0.5);
    const hipCenter = new THREE.Vector3().copy(p23).lerp(p24, 0.5);

    headMesh.position.copy(headCenter);
    neckMesh.position.copy(shoulderCenter).lerp(headCenter, 0.5);
    const neckHeight = shoulderCenter.distanceTo(headCenter);
    neckMesh.scale.set(1, neckHeight, 1);
    if (neckHeight > 0.001) neckMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), headCenter.clone().sub(shoulderCenter).normalize());

    const torsoHeight = shoulderCenter.distanceTo(hipCenter);
    torsoMesh.geometry.dispose();
    torsoMesh.geometry = new THREE.CylinderGeometry((p11.distanceTo(p12) / 2) * 1.1, (p23.distanceTo(p24) / 2) * 0.9, 1, 16, 1, false);
    torsoMesh.position.copy(shoulderCenter).lerp(hipCenter, 0.5);
    torsoMesh.scale.set(1, torsoHeight, 1);
    if (torsoHeight > 0.001) torsoMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shoulderCenter.clone().sub(hipCenter).normalize());

    return hipCenter; 
}

function updateAllSkeletons() {
    const frameIdx = parseInt(slider.value);
    
    const isSnapping = Math.abs(frameIdx - lastFrameIdx) > 1;
    lastFrameIdx = frameIdx;
    
    if (sourceVideo.readyState >= 2) {
        sourceVideo.currentTime = frameIdx / videoFPS;
    }

    if (baseData) {
        const hipCenter = updateSkeletonPose(baseSkeleton, baseData[frameIdx], 0, 0, 0, isSnapping);
        
        if (ghostData) {
            const timeOffset = parseInt(ghostTimeSlider.value);
            const xOffset = parseFloat(document.getElementById('ghostXOffset').value);
            const yOffset = parseFloat(document.getElementById('ghostYOffset').value);
            const zOffset = parseFloat(document.getElementById('ghostZOffset').value);
            const ghostIdx = Math.max(0, Math.min(ghostData.length - 1, frameIdx + timeOffset));
            
            updateSkeletonPose(ghostSkeleton, ghostData[ghostIdx], xOffset, yOffset, zOffset, isSnapping);
            
            if (ghostVideo.readyState >= 2) {
                ghostVideo.currentTime = ghostIdx / ghostFPS;
            }
        }

        if (!isFreeCam && hipCenter) {
            if (isSnapping) {
                const deltaX = hipCenter.x - controls.target.x;
                const deltaZ = hipCenter.z - controls.target.z;
                camera.position.x += deltaX;
                camera.position.z += deltaZ;
                controls.target.copy(hipCenter);
            } else {
                const prevTarget = controls.target.clone();
                controls.target.lerp(hipCenter, SMOOTHING);
                const deltaX = controls.target.x - prevTarget.x;
                const deltaZ = controls.target.z - prevTarget.z;
                camera.position.x += deltaX;
                camera.position.z += deltaZ;
            }
        }
    }
}

ghostTimeSlider.addEventListener('input', () => {
    if (!isPlaying) updateAllSkeletons();
});

function animate() {
    requestAnimationFrame(animate);
    if (isPlaying && baseData) {
        let nextFrame = (parseInt(slider.value) + 1) % baseData.length;
        slider.value = nextFrame;
        display.innerText = `Frame: ${nextFrame}`;
    }
    updateAllSkeletons(); 
    controls.update(); 
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

animate();