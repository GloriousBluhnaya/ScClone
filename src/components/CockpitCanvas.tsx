import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ShipPhysicsState, TargetInfo, LaserBolt, ExplosionEffect, RemoteShip, TVIInfo, TVIMarker } from '../types';
import { normalizeVector3D, normalizeQuaternionD } from '../utils/shipNormalization';
import skyboxTextureUrl from '../assets/images/space_skybox_nebula_1788663162004.jpg';

interface CockpitCanvasProps {
  physicsState: ShipPhysicsState;
  targets: RemoteShip[];
  currentTargetId: string | null;
  onTargetSelect: (id: string | null) => void;
  localLasers: LaserBolt[];
  remoteLasers: LaserBolt[];
  explosions: ExplosionEffect[];
  isLockedLook: boolean;
  mouseVirtualStick: { x: number; y: number };
  onLeadPipCalculated: (targetInfo: TargetInfo | null) => void;
  onTviCalculated?: (tviInfo: TVIInfo | null) => void;
}

export const CockpitCanvas: React.FC<CockpitCanvasProps> = ({
  physicsState,
  targets,
  currentTargetId,
  localLasers,
  remoteLasers,
  explosions,
  mouseVirtualStick,
  onLeadPipCalculated,
  onTviCalculated,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // References to dynamic scene objects
  const shipRootRef = useRef<THREE.Group | null>(null);
  const cockpitFrameRef = useRef<THREE.Group | null>(null);
  const flightStickRef = useRef<THREE.Mesh | null>(null);
  const throttleLeverRef = useRef<THREE.Mesh | null>(null);
  const dustParticlesRef = useRef<THREE.Points | null>(null);
  const remoteShipMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const smoothShipsMap = useRef<Map<string, { pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Quaternion }>>(new Map());
  const laserMeshGroup = useRef<THREE.Group | null>(null);
  const explosionGroup = useRef<THREE.Group | null>(null);

  // Active explosion / shield impact meshes tracked frame-by-frame
  const activeExplosionMeshes = useRef<Map<string, { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial; startTime: number; duration: number; scale: number }>>(new Map());

  // Holographic 3D radar refs
  const radarGroupRef = useRef<THREE.Group | null>(null);
  const radarContactsRef = useRef<THREE.Group | null>(null);

  // Props refs for access inside requestAnimationFrame
  const physicsRef = useRef(physicsState);
  physicsRef.current = physicsState;

  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const currentTargetIdRef = useRef(currentTargetId);
  currentTargetIdRef.current = currentTargetId;

  const mouseStickRef = useRef(mouseVirtualStick);
  mouseStickRef.current = mouseVirtualStick;

  const explosionsRef = useRef(explosions);
  explosionsRef.current = explosions;

  const onLeadPipRef = useRef(onLeadPipCalculated);
  onLeadPipRef.current = onLeadPipCalculated;

  const onTviRef = useRef(onTviCalculated);
  onTviRef.current = onTviCalculated;

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth || 1280;
    const height = containerRef.current.clientHeight || window.innerHeight || 720;

    // 1. SCENE SETUP
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b1329, 0.0001); // Subtle deep blue-indigo space fog for maximum contrast
    sceneRef.current = scene;

    // 2. CAMERA SETUP
    const initialAspect = height > 0 ? width / height : 16 / 9;
    const camera = new THREE.PerspectiveCamera(75, initialAspect, 0.1, 25000);
    cameraRef.current = camera;

    // 3. RENDERER SETUP
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. SHIP ROOT OBJECT (Player vessel root)
    const shipRoot = new THREE.Group();
    scene.add(shipRoot);
    shipRootRef.current = shipRoot;

    // Camera sits inside cockpit eye point
    camera.position.set(0, 0.35, -0.1);
    shipRoot.add(camera);

    // 5. LIGHTING & ENVIRONMENT
    // Bright key ambient lighting to illuminate ships & cockpit
    const ambientLight = new THREE.AmbientLight(0x93c5fd, 0.85);
    scene.add(ambientLight);

    // Primary Distant Sun with strong specular highlights
    const distantSun = new THREE.DirectionalLight(0xfff7ed, 3.2);
    distantSun.position.set(6000, 4000, 5000);
    scene.add(distantSun);

    // Secondary fill keylight (Cool Purple/Magenta contrast light)
    const secondarySun = new THREE.DirectionalLight(0xa855f7, 1.8);
    secondarySun.position.set(-6000, -3000, -4000);
    scene.add(secondarySun);

    // Cockpit instrument panel point light
    const cockpitLight = new THREE.PointLight(0x38bdf8, 2.5, 4.5);
    cockpitLight.position.set(0, 0.25, 0.3);
    shipRoot.add(cockpitLight);

    // Cockpit ceiling warm ambient interior light
    const cockpitCeilingLight = new THREE.PointLight(0xffedd5, 1.2, 3.5);
    cockpitCeilingLight.position.set(0, 0.75, -0.1);
    shipRoot.add(cockpitCeilingLight);

    // 6. DEEP SPACE ENVIRONMENT (SKYBOX, NEBULAE & ASTEROID FIELD)
    // Load High-Contrast Space Skybox Texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(skyboxTextureUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      
      const skyGeo = new THREE.SphereGeometry(20000, 64, 32);
      const skyMat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const skyMesh = new THREE.Mesh(skyGeo, skyMat);
      scene.add(skyMesh);
    });

    // Volumetric Cosmic Nebula Cloud Planes
    const nebulaGroup = new THREE.Group();
    const nebulaColors = [0x00f0ff, 0xec4899, 0xa855f7, 0x38bdf8, 0xeab308];
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256;
    cloudCanvas.height = 256;
    const cloudCtx = cloudCanvas.getContext('2d');
    if (cloudCtx) {
      const grad = cloudCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.45)');
      grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      cloudCtx.fillStyle = grad;
      cloudCtx.fillRect(0, 0, 256, 256);
    }
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);

    for (let i = 0; i < 28; i++) {
      const color = nebulaColors[i % nebulaColors.length];
      const mat = new THREE.MeshBasicMaterial({
        map: cloudTexture,
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.18 + Math.random() * 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const geo = new THREE.PlaneGeometry(1200 + Math.random() * 1800, 1200 + Math.random() * 1800);
      const cloud = new THREE.Mesh(geo, mat);
      const r = 4000 + Math.random() * 6000;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.8;
      cloud.position.set(r * Math.cos(theta), r * Math.sin(phi), r * Math.sin(theta));
      cloud.lookAt(0, 0, 0);
      nebulaGroup.add(cloud);
    }
    scene.add(nebulaGroup);

    // Starfield
    const starCount = 3000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 12000 + Math.random() * 8000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = radius * Math.cos(phi);

      const colorVal = 0.6 + Math.random() * 0.4;
      const isBlue = Math.random() > 0.6;
      starColors[i * 3] = isBlue ? colorVal * 0.8 : colorVal;
      starColors[i * 3 + 1] = colorVal * 0.95;
      starColors[i * 3 + 2] = isBlue ? colorVal : colorVal * 0.85;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: false,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeo, starMat);
    starField.frustumCulled = false;
    scene.add(starField);

    // Distant Gas Giant Planet
    const planetGeo = new THREE.SphereGeometry(2400, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.6,
      metalness: 0.2,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.35,
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.set(8000, -1500, -14000);
    scene.add(planet);

    // Asteroid Field
    const asteroidCount = 45;
    const asteroidGroup = new THREE.Group();
    const asteroidGeo = new THREE.DodecahedronGeometry(1, 1);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.7,
      metalness: 0.3,
      flatShading: true,
    });

    for (let i = 0; i < asteroidCount; i++) {
      const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
      const dist = 350 + Math.random() * 1200;
      const angle = Math.random() * Math.PI * 2;
      const heightOffset = (Math.random() - 0.5) * 400;

      asteroid.position.set(Math.cos(angle) * dist, heightOffset, Math.sin(angle) * dist - 300);
      const scale = 15 + Math.random() * 50;
      asteroid.scale.set(scale, scale * (0.8 + Math.random() * 0.4), scale);
      asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      asteroidGroup.add(asteroid);
    }
    scene.add(asteroidGroup);

    // 7. SPACE DUST PARTICLES (Crucial for 6-DoF motion feedback!)
    const dustCount = 350;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 200;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.45,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    dustParticles.frustumCulled = false;
    scene.add(dustParticles);
    dustParticlesRef.current = dustParticles;

    // 8. 3D COCKPIT INTERIOR & CANOPY FRAME
    const cockpitGroup = new THREE.Group();
    shipRoot.add(cockpitGroup);
    cockpitFrameRef.current = cockpitGroup;

    // Dashboard console structure - Lighter brushed titanium slate
    const dashGeo = new THREE.BoxGeometry(1.6, 0.42, 0.85);
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Lighter Titanium Slate Blue (high contrast against space)
      metalness: 0.85,
      roughness: 0.25,
    });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(0, -0.15, -0.6);
    dash.rotation.x = 0.25;
    cockpitGroup.add(dash);

    // Dashboard console trim with illuminated LED status strips
    const dashTrimGeo = new THREE.BoxGeometry(1.58, 0.03, 0.04);
    const dashTrimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const dashTrim = new THREE.Mesh(dashTrimGeo, dashTrimMat);
    dashTrim.position.set(0, 0.18, 0.38);
    dash.add(dashTrim);

    // Cockpit Canopy Structural Struts - Lighter titanium frame with metallic sheen
    const strutMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Titanium Slate
      metalness: 0.9,
      roughness: 0.2,
    });

    // Metallic trim highlights along struts
    const strutTrimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Light metallic silver trim
      metalness: 0.95,
      roughness: 0.15,
    });

    // Left canopy arch
    const archGeo = new THREE.BoxGeometry(0.04, 0.05, 1.5);
    const leftArch = new THREE.Mesh(archGeo, strutMat);
    leftArch.position.set(-0.55, 0.45, -0.3);
    leftArch.rotation.set(-0.35, 0.2, 0.35);
    cockpitGroup.add(leftArch);

    const leftArchTrim = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.052, 1.48), strutTrimMat);
    leftArchTrim.position.set(-0.012, 0, 0);
    leftArch.add(leftArchTrim);

    // Right canopy arch
    const rightArch = new THREE.Mesh(archGeo, strutMat);
    rightArch.position.set(0.55, 0.45, -0.3);
    rightArch.rotation.set(-0.35, -0.2, -0.35);
    cockpitGroup.add(rightArch);

    const rightArchTrim = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.052, 1.48), strutTrimMat);
    rightArchTrim.position.set(0.012, 0, 0);
    rightArch.add(rightArchTrim);

    // Top crossbar
    const topBarGeo = new THREE.BoxGeometry(0.9, 0.04, 0.05);
    const topBar = new THREE.Mesh(topBarGeo, strutMat);
    topBar.position.set(0, 0.72, -0.35);
    cockpitGroup.add(topBar);

    // Center canopy frame strut
    const centerStrutGeo = new THREE.BoxGeometry(0.03, 0.04, 1.2);
    const centerStrut = new THREE.Mesh(centerStrutGeo, strutMat);
    centerStrut.position.set(0, 0.68, -0.7);
    centerStrut.rotation.x = -0.45;
    cockpitGroup.add(centerStrut);

    // 3D CANOPY WINDSHIELD GLASS WITH REFLECTION
    const glassGeo = new THREE.SphereGeometry(1.05, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    glassGeo.rotateX(Math.PI / 2);

    const glassCanvas = document.createElement('canvas');
    glassCanvas.width = 512;
    glassCanvas.height = 512;
    const gCtx = glassCanvas.getContext('2d');
    if (gCtx) {
      gCtx.fillStyle = 'rgba(15, 23, 42, 0.05)';
      gCtx.fillRect(0, 0, 512, 512);

      // Curved reflection highlights along glass top
      const glassGrad = gCtx.createLinearGradient(0, 0, 512, 512);
      glassGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      glassGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.22)');
      glassGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.06)');
      glassGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      gCtx.fillStyle = glassGrad;
      gCtx.fillRect(0, 0, 512, 256);

      // Hexagonal canopy grid HUD reflection pattern
      gCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      gCtx.lineWidth = 1;
      for (let x = 0; x < 512; x += 32) {
        gCtx.beginPath();
        gCtx.moveTo(x, 0);
        gCtx.lineTo(x + 16, 512);
        gCtx.stroke();
      }
    }
    const glassReflectionTexture = new THREE.CanvasTexture(glassCanvas);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.88,
      transparent: true,
      opacity: 0.25,
      map: glassReflectionTexture,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const windshieldGlass = new THREE.Mesh(glassGeo, glassMat);
    windshieldGlass.position.set(0, 0.2, -0.3);
    cockpitGroup.add(windshieldGlass);

    // Dynamic Flight Stick in Cockpit
    const stickBaseGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.04, 16);
    const stickGripGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
    const stickHeadGeo = new THREE.BoxGeometry(0.06, 0.09, 0.06);

    const stickBaseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });

    const stickBase = new THREE.Mesh(stickBaseGeo, stickBaseMat);
    stickBase.position.set(0.28, -0.12, -0.38);
    cockpitGroup.add(stickBase);

    const stickPivot = new THREE.Group();
    stickPivot.position.set(0.28, -0.1, -0.38);
    cockpitGroup.add(stickPivot);

    const stickGrip = new THREE.Mesh(stickGripGeo, stickMat);
    stickGrip.position.y = 0.16;
    stickPivot.add(stickGrip);

    const stickHead = new THREE.Mesh(stickHeadGeo, new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    stickHead.position.set(0, 0.32, 0);
    stickPivot.add(stickHead);
    flightStickRef.current = stickPivot as unknown as THREE.Mesh;

    // Dynamic Throttle Lever
    const throttlePivot = new THREE.Group();
    throttlePivot.position.set(-0.28, -0.1, -0.38);
    cockpitGroup.add(throttlePivot);

    const throttleLeverGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8);
    const throttleLever = new THREE.Mesh(throttleLeverGeo, stickMat);
    throttleLever.position.y = 0.12;
    throttlePivot.add(throttleLever);

    const throttleKnob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), stickMat);
    throttleKnob.position.set(0, 0.22, 0);
    throttlePivot.add(throttleKnob);
    throttleLeverRef.current = throttlePivot as unknown as THREE.Mesh;

    // 9. 3D HOLOGRAPHIC RADAR SPHERE IN COCKPIT CONSOLE
    const radarGroup = new THREE.Group();
    radarGroup.position.set(0, -0.05, -0.55);
    cockpitGroup.add(radarGroup);
    radarGroupRef.current = radarGroup;

    // Wireframe globe
    const radarWireGeo = new THREE.SphereGeometry(0.12, 12, 8);
    const radarWireMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const radarGlobe = new THREE.Mesh(radarWireGeo, radarWireMat);
    radarGroup.add(radarGlobe);

    // Polar plane circle
    const radarPlaneGeo = new THREE.RingGeometry(0.01, 0.12, 24);
    const radarPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const radarPlane = new THREE.Mesh(radarPlaneGeo, radarPlaneMat);
    radarPlane.rotation.x = Math.PI / 2;
    radarGroup.add(radarPlane);

    // Player blip in radar center
    const playerBlipGeo = new THREE.ConeGeometry(0.012, 0.025, 4);
    const playerBlipMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const playerBlip = new THREE.Mesh(playerBlipGeo, playerBlipMat);
    playerBlip.rotation.x = Math.PI / 2;
    radarGroup.add(playerBlip);

    // Target contacts in radar
    const radarContacts = new THREE.Group();
    radarGroup.add(radarContacts);
    radarContactsRef.current = radarContacts;

    // 10. GROUPS FOR LASERS & EXPLOSIONS
    const laserGroup = new THREE.Group();
    scene.add(laserGroup);
    laserMeshGroup.current = laserGroup;

    const explosionParent = new THREE.Group();
    scene.add(explosionParent);
    explosionGroup.current = explosionParent;

    // 11. RESIZE OBSERVER
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // 12. ANIMATION / RENDER LOOP
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Ensure aspect ratio is always valid and synced
      if (containerRef.current && renderer && camera) {
        const cw = containerRef.current.clientWidth || window.innerWidth;
        const ch = containerRef.current.clientHeight || window.innerHeight;
        if (cw > 0 && ch > 0) {
          const desiredAspect = cw / ch;
          if (!isFinite(camera.aspect) || Math.abs(camera.aspect - desiredAspect) > 0.005) {
            camera.aspect = desiredAspect;
            camera.updateProjectionMatrix();
            renderer.setSize(cw, ch);
          }
        }
      }

      const pState = physicsRef.current;
      const activeTargets = targetsRef.current;
      const lockedTargetId = currentTargetIdRef.current;
      const mouseStick = mouseStickRef.current;

      // Update Player Ship Position & Orientation in World
      if (shipRoot) {
        shipRoot.position.set(pState.position.x, pState.position.y, pState.position.z);
        shipRoot.quaternion.set(
          pState.rotation.x,
          pState.rotation.y,
          pState.rotation.z,
          pState.rotation.w
        );
      }

      // Subtle cockpit G-force head shake & stick animation
      if (flightStickRef.current) {
        flightStickRef.current.rotation.x = mouseStick.y * 0.35;
        flightStickRef.current.rotation.z = -mouseStick.x * 0.35;
      }
      if (throttleLeverRef.current) {
        throttleLeverRef.current.rotation.x = pState.throttle * 0.4;
      }

      // Space Dust Motion: Dust particles remain stationary in space; toroidal-wrap relative to ship position
      if (dustParticlesRef.current) {
        const dustPosAttr = dustParticlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const array = dustPosAttr.array as Float32Array;

        for (let i = 0; i < dustCount; i++) {
          const dx = array[i * 3] - pState.position.x;
          const dy = array[i * 3 + 1] - pState.position.y;
          const dz = array[i * 3 + 2] - pState.position.z;

          if (dx > 100) array[i * 3] -= 200;
          else if (dx < -100) array[i * 3] += 200;

          if (dy > 60) array[i * 3 + 1] -= 120;
          else if (dy < -60) array[i * 3 + 1] += 120;

          if (dz > 100) array[i * 3 + 2] -= 200;
          else if (dz < -100) array[i * 3 + 2] += 200;
        }
        dustPosAttr.needsUpdate = true;
      }

      // RENDER / UPDATE REMOTE & AI SHIPS WITH SMOOTH DEAD-RECKONING INTERPOLATION
      const existingMeshMap = remoteShipMeshes.current;
      const smoothMap = smoothShipsMap.current;
      const seenIds = new Set<string>();

      activeTargets.forEach((ship) => {
        seenIds.add(ship.id);
        let meshGroup = existingMeshMap.get(ship.id);

        if (!meshGroup) {
          meshGroup = createSpaceshipModel(ship.isAI, ship.callsign);
          scene.add(meshGroup);
          existingMeshMap.set(ship.id, meshGroup);
        }

        const safePos = normalizeVector3D(ship.position, { x: 0, y: 0, z: -500 });
        const safeRot = normalizeQuaternionD(ship.rotation, { x: 0, y: 0, z: 0, w: 1 });
        const safeVel = normalizeVector3D(ship.velocity, { x: 0, y: 0, z: 0 });

        let smoothState = smoothMap.get(ship.id);
        if (!smoothState) {
          smoothState = {
            pos: new THREE.Vector3(safePos.x, safePos.y, safePos.z),
            vel: new THREE.Vector3(safeVel.x, safeVel.y, safeVel.z),
            rot: new THREE.Quaternion(safeRot.x, safeRot.y, safeRot.z, safeRot.w),
            targetPos: new THREE.Vector3(safePos.x, safePos.y, safePos.z),
            targetVel: new THREE.Vector3(safeVel.x, safeVel.y, safeVel.z),
            targetRot: new THREE.Quaternion(safeRot.x, safeRot.y, safeRot.z, safeRot.w),
            lastUpdate: performance.now(),
          };
          smoothMap.set(ship.id, smoothState);
        } else {
          const incomingPos = new THREE.Vector3(safePos.x, safePos.y, safePos.z);
          const incomingVel = new THREE.Vector3(safeVel.x, safeVel.y, safeVel.z);
          const incomingRot = new THREE.Quaternion(safeRot.x, safeRot.y, safeRot.z, safeRot.w);

          // Detect new network packet
          if (!smoothState.targetPos || smoothState.targetPos.distanceToSquared(incomingPos) > 0.001) {
            smoothState.targetPos = incomingPos;
            smoothState.targetVel = incomingVel;
            smoothState.targetRot = incomingRot;
            smoothState.lastUpdate = performance.now();
          }

          // Extrapolate authoritative target position forward based on velocity & packet elapsed time
          const elapsedSec = Math.min(0.4, (performance.now() - (smoothState.lastUpdate || performance.now())) / 1000);
          const extrapolatedTargetPos = smoothState.targetPos.clone().addScaledVector(smoothState.targetVel, elapsedSec);

          // Smoothly lerp velocity
          const velBlend = 1 - Math.exp(-16 * dt);
          smoothState.vel.lerp(smoothState.targetVel, velBlend);

          // Smoothly lerp position towards predicted position (zero stutter)
          const distErr = smoothState.pos.distanceTo(extrapolatedTargetPos);
          if (distErr > 100) {
            smoothState.pos.copy(extrapolatedTargetPos);
          } else {
            const posBlend = 1 - Math.exp(-18 * dt);
            smoothState.pos.lerp(extrapolatedTargetPos, posBlend);
          }

          // Smoothly slerp rotation
          const rotBlend = 1 - Math.exp(-20 * dt);
          smoothState.rot.slerp(smoothState.targetRot, rotBlend);
        }

        // Apply smooth kinematic transform to 3D ship mesh
        meshGroup.position.copy(smoothState.pos);
        meshGroup.quaternion.copy(smoothState.rot);
        meshGroup.visible = ship.hull > 0;

        // Flaring thruster plume when ship has velocity
        const speed = smoothState.vel.length();
        const plumes = meshGroup.getObjectsByProperty('name', 'enginePlume');
        plumes.forEach((plume) => {
          const s = Math.min(2.5, 0.4 + speed / 80);
          plume.scale.set(s, s, s * (ship.boost ? 2.5 : 1.2));
        });

        // Dynamic shield aura hit flash on ship model (subtle impact glow)
        const shieldAuras = meshGroup.getObjectsByProperty('name', 'shieldAura');
        const nowMs = Date.now();
        const timeSinceHit = (nowMs - (ship.lastHit || 0)) / 1000;
        shieldAuras.forEach((auraObj) => {
          const auraMesh = auraObj as THREE.Mesh;
          const mat = auraMesh.material as THREE.MeshBasicMaterial;
          if (timeSinceHit < 0.25) {
            const flash = 1.0 - timeSinceHit / 0.25;
            auraMesh.scale.setScalar(1.0 + flash * 0.05);
            mat.opacity = (ship.shield > 0 ? 0.08 : 0.01) + flash * 0.18;
          } else {
            auraMesh.scale.setScalar(1.0);
            mat.opacity = ship.shield > 0 ? 0.08 : 0.01;
          }
        });
      });

      // Remove disconnected ship models & smooth state
      existingMeshMap.forEach((mesh, id) => {
        if (!seenIds.has(id)) {
          scene.remove(mesh);
          existingMeshMap.delete(id);
          smoothMap.delete(id);
        }
      });

      // UPDATE 3D HOLOGRAPHIC RADAR
      if (radarContactsRef.current) {
        // Clear previous blips
        while (radarContactsRef.current.children.length > 0) {
          radarContactsRef.current.remove(radarContactsRef.current.children[0]);
        }

        const radarRange = 1500; // meters represented by radar sphere
        const radarSphereRadius = 0.11;

        activeTargets.forEach((target) => {
          if (target.hull <= 0) return; // Skip radar contact for destroyed targets
          const smooth = smoothMap.get(target.id);
          const targetWorldPos = smooth ? smooth.pos : new THREE.Vector3(target.position.x, target.position.y, target.position.z);

          // Calculate relative vector in ship local space
          const worldRel = new THREE.Vector3(
            targetWorldPos.x - pState.position.x,
            targetWorldPos.y - pState.position.y,
            targetWorldPos.z - pState.position.z
          );

          // Rotate into ship local coordinate system
          const shipRotInverse = new THREE.Quaternion(
            pState.rotation.x,
            pState.rotation.y,
            pState.rotation.z,
            pState.rotation.w
          ).invert();
          const localRel = worldRel.clone().applyQuaternion(shipRotInverse);

          const distance = localRel.length();
          if (distance < radarRange) {
            const scaleFactor = radarSphereRadius / radarRange;
            const blipPos = localRel.multiplyScalar(scaleFactor);

            const isLocked = target.id === lockedTargetId;
            const blipGeo = new THREE.SphereGeometry(isLocked ? 0.007 : 0.004, 6, 6);
            const blipMat = new THREE.MeshBasicMaterial({
              color: isLocked ? 0xff0055 : target.isAI ? 0xf59e0b : 0x10b981,
            });
            const blipMesh = new THREE.Mesh(blipGeo, blipMat);
            blipMesh.position.copy(blipPos);
            radarContactsRef.current?.add(blipMesh);

            // Stalk line to equatorial plane
            const stalkGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(blipPos.x, 0, blipPos.z),
              blipPos,
            ]);
            const stalkMat = new THREE.LineBasicMaterial({
              color: isLocked ? 0xff0055 : 0x0284c7,
              transparent: true,
              opacity: 0.5,
            });
            const stalk = new THREE.Line(stalkGeo, stalkMat);
            radarContactsRef.current?.add(stalk);
          }
        });
      }

      // CALCULATE SCREEN-SPACE TARGET BRACKET AND PREDICTED IMPACT POINT (PIP)
      const currentTarget = activeTargets.find((t) => t.id === lockedTargetId && t.hull > 0);
      if (currentTarget && camera) {
        const smooth = smoothMap.get(currentTarget.id);
        const targetWorldPos = smooth
          ? smooth.pos.clone()
          : new THREE.Vector3(currentTarget.position.x, currentTarget.position.y, currentTarget.position.z);
        const targetWorldVel = smooth
          ? { x: smooth.vel.x, y: smooth.vel.y, z: smooth.vel.z }
          : currentTarget.velocity;

        // Project target center to screen
        const targetScreen = targetWorldPos.clone().project(camera);
        const isTargetInFront = targetScreen.z < 1.0;

        const screenW = containerRef.current?.clientWidth || window.innerWidth;
        const screenH = containerRef.current?.clientHeight || window.innerHeight;

        const isOnScreen = isTargetInFront && targetScreen.x >= -0.92 && targetScreen.x <= 0.92 && targetScreen.y >= -0.92 && targetScreen.y <= 0.92;

        const screenPos = {
          x: ((targetScreen.x + 1) / 2) * screenW,
          y: ((-targetScreen.y + 1) / 2) * screenH,
          visible: isOnScreen,
        };

        // Edge Indicator math for off-screen targeted ship
        const dirToTargetWorld = targetWorldPos.clone().sub(new THREE.Vector3(pState.position.x, pState.position.y, pState.position.z)).normalize();
        const targetDirCam = dirToTargetWorld.clone().transformDirection(camera.matrixWorldInverse);

        let targetDirX = targetDirCam.x;
        let targetDirY = -targetDirCam.y;
        if (Math.hypot(targetDirX, targetDirY) < 0.001) {
          targetDirY = -1.0; // Default to pointing up if target is perfectly on the central line
        }
        const targetEdgeAngle = Math.atan2(targetDirY, targetDirX);

        const halfW = screenW / 2;
        const halfH = screenH / 2;
        const targetMargin = 100; // keep it safe from side elements
        const targetEdgeRadiusX = halfW - targetMargin;
        const targetEdgeRadiusY = halfH - targetMargin;
        const targetCosA = Math.cos(targetEdgeAngle);
        const targetSinA = Math.sin(targetEdgeAngle);

        const targetScaleX = Math.abs(targetCosA) > 0.001 ? targetEdgeRadiusX / Math.abs(targetCosA) : 10000;
        const targetScaleY = Math.abs(targetSinA) > 0.001 ? targetEdgeRadiusY / Math.abs(targetSinA) : 10000;
        const targetScale = Math.min(targetScaleX, targetScaleY);
        const targetEdgeX = halfW + targetCosA * targetScale;
        const targetEdgeY = halfH + targetSinA * targetScale;

        // Angle between camera forward (0, 0, -1) and targetDirCam. Both are normalized.
        // Dot product is targetDirCam.dot(0, 0, -1) = -targetDirCam.z
        const offNoseAngleRad = Math.acos(Math.max(-1, Math.min(1, -targetDirCam.z)));
        const offNoseDegrees = Math.round((offNoseAngleRad * 180) / Math.PI);

        const offScreen = {
          isOnScreen,
          edgeX: targetEdgeX,
          edgeY: targetEdgeY,
          edgeAngle: targetEdgeAngle,
          offNoseDegrees,
        };

        // Solve Ballistic Quadratic Intercept (Lead PIP)
        const muzzleSpeed = 1250; // m/s
        const leadSolution = solveIntercept(
          pState.position,
          pState.velocity,
          { x: targetWorldPos.x, y: targetWorldPos.y, z: targetWorldPos.z },
          targetWorldVel,
          muzzleSpeed
        );

        let leadScreenPos: { x: number; y: number; visible: boolean } | undefined;

        if (leadSolution.leadPoint) {
          const leadWorld = new THREE.Vector3(
            leadSolution.leadPoint.x,
            leadSolution.leadPoint.y,
            leadSolution.leadPoint.z
          );
          const leadScreen = leadWorld.project(camera);
          const isLeadInFront = leadScreen.z < 1.0;

          leadScreenPos = {
            x: ((leadScreen.x + 1) / 2) * screenW,
            y: ((-leadScreen.y + 1) / 2) * screenH,
            visible: isLeadInFront,
          };
        }

        const distance = Math.hypot(
          targetWorldPos.x - pState.position.x,
          targetWorldPos.y - pState.position.y,
          targetWorldPos.z - pState.position.z
        );

        const relVelX = targetWorldVel.x - pState.velocity.x;
        const relVelY = targetWorldVel.y - pState.velocity.y;
        const relVelZ = targetWorldVel.z - pState.velocity.z;
        const relativeVelocity = Math.hypot(relVelX, relVelY, relVelZ);

        onLeadPipRef.current?.({
          id: currentTarget.id,
          callsign: currentTarget.callsign,
          isAI: currentTarget.isAI,
          position: { x: targetWorldPos.x, y: targetWorldPos.y, z: targetWorldPos.z },
          velocity: targetWorldVel,
          distance,
          relativeVelocity,
          shieldPercent: (currentTarget.shield / currentTarget.maxShield) * 100,
          hullPercent: (currentTarget.hull / currentTarget.maxHull) * 100,
          leadPoint: leadSolution.leadPoint,
          screenPos,
          leadScreenPos,
          inGimbalCone: isTargetInFront && Math.abs(targetScreen.x) < 0.6 && Math.abs(targetScreen.y) < 0.6,
          offScreen,
        });
      } else {
        onLeadPipRef.current?.(null);
      }

      // 7. TOTAL VECTOR INDICATOR (TVI) & ANTI-TVI CALCULATION
      const currentShipSpeed = Math.hypot(pState.velocity.x, pState.velocity.y, pState.velocity.z);
      if (currentShipSpeed > 0.3 && camera) {
        const screenW = containerRef.current?.clientWidth || window.innerWidth;
        const screenH = containerRef.current?.clientHeight || window.innerHeight;
        const halfW = screenW / 2;
        const halfH = screenH / 2;
        const margin = 48;

        const velWorld = new THREE.Vector3(
          pState.velocity.x,
          pState.velocity.y,
          pState.velocity.z
        ).divideScalar(currentShipSpeed);

        // Ship forward vector in world coordinates
        const shipForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
          shipRoot
            ? shipRoot.quaternion
            : new THREE.Quaternion(pState.rotation.x, pState.rotation.y, pState.rotation.z, pState.rotation.w)
        );
        const forwardDot = Math.max(-1, Math.min(1, shipForward.dot(velWorld)));
        const driftAngleDeg = Math.round((Math.acos(forwardDot) * 180) / Math.PI);

        const projectDirection = (dirWorld: THREE.Vector3): TVIMarker => {
          // Camera local direction
          const dirCam = dirWorld.clone().transformDirection(camera.matrixWorldInverse);
          const inFront = dirCam.z < -0.01;

          // Project point at distance along vector
          const pWorld = new THREE.Vector3(
            pState.position.x + dirWorld.x * 250,
            pState.position.y + dirWorld.y * 250,
            pState.position.z + dirWorld.z * 250
          );
          const pScreen = pWorld.project(camera);

          const screenX = ((pScreen.x + 1) / 2) * screenW;
          const screenY = ((-pScreen.y + 1) / 2) * screenH;

          // Inside visible HUD safe area
          const isOnScreen = inFront && pScreen.x >= -0.88 && pScreen.x <= 0.88 && pScreen.y >= -0.88 && pScreen.y <= 0.88;

          // 2D screen angle for clamped edge arrow
          let dirX = dirCam.x;
          let dirY = -dirCam.y;
          if (!inFront) {
            dirX = -dirCam.x;
            dirY = dirCam.y;
            if (Math.hypot(dirX, dirY) < 0.001) {
              dirY = 1.0;
            }
          }
          const edgeAngle = Math.atan2(dirY, dirX);

          // Clamped edge coordinates
          const edgeRadiusX = halfW - margin;
          const edgeRadiusY = halfH - margin;
          const cosA = Math.cos(edgeAngle);
          const sinA = Math.sin(edgeAngle);

          const scaleX = Math.abs(cosA) > 0.001 ? edgeRadiusX / Math.abs(cosA) : 10000;
          const scaleY = Math.abs(sinA) > 0.001 ? edgeRadiusY / Math.abs(sinA) : 10000;
          const scale = Math.min(scaleX, scaleY);
          const edgeX = halfW + cosA * scale;
          const edgeY = halfH + sinA * scale;

          return {
            screenX,
            screenY,
            inFront,
            isOnScreen,
            edgeX,
            edgeY,
            edgeAngle,
            worldDir: { x: dirWorld.x, y: dirWorld.y, z: dirWorld.z },
          };
        };

        const tviMarker = projectDirection(velWorld);
        const antiTviMarker = projectDirection(velWorld.clone().negate());

        onTviRef.current?.({
          speed: currentShipSpeed,
          tvi: tviMarker,
          antiTvi: antiTviMarker,
          driftAngleDeg,
        });
      } else {
        onTviRef.current?.(null);
      }

      // DYNAMIC EXPLOSION & SHIELD IMPACT PARTICLE UPDATE IN RENDER LOOP
      if (explosionGroup.current) {
        const activeExplosions = activeExplosionMeshes.current;
        const currentExpList = explosionsRef.current;
        const nowMs = Date.now();

        // 1. Spawn newly created hit impact effects into the Three.js scene
        currentExpList.forEach((exp) => {
          const age = (nowMs - exp.startTime) / 1000;
          if (age < exp.duration && !activeExplosions.has(exp.id)) {
            // Unit radius geometry (1.0 meter base)
            const geo = new THREE.IcosahedronGeometry(1.0, 1);
            const mat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(exp.color),
              wireframe: true,
              transparent: true,
              opacity: 0.35,
              blending: THREE.AdditiveBlending,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(exp.position.x, exp.position.y, exp.position.z);
            explosionGroup.current?.add(mesh);

            activeExplosions.set(exp.id, {
              mesh,
              geo,
              mat,
              startTime: exp.startTime,
              duration: exp.duration,
              scale: exp.scale,
            });
          }
        });

        // 2. Animate scale and opacity frame-by-frame, disposing expired meshes
        activeExplosions.forEach((data, id) => {
          const age = (nowMs - data.startTime) / 1000;
          if (age >= data.duration) {
            explosionGroup.current?.remove(data.mesh);
            data.geo.dispose();
            data.mat.dispose();
            activeExplosions.delete(id);
          } else {
            const progress = Math.min(1.0, age / data.duration);
            // Slight expansion from base scale to base scale * 1.3
            const currentScale = data.scale * (1.0 + progress * 0.3);
            data.mesh.scale.set(currentScale, currentScale, currentScale);
            // Low max opacity (0.35) fading quickly to zero
            const fade = Math.max(0, 1 - progress);
            data.mat.opacity = 0.35 * fade * fade;
          }
        });
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      activeExplosionMeshes.current.forEach((data) => {
        data.geo.dispose();
        data.mat.dispose();
      });
      activeExplosionMeshes.current.clear();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update dynamic laser bolts
  useEffect(() => {
    if (!laserMeshGroup.current) return;
    const group = laserMeshGroup.current;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const allLasers = [...localLasers, ...remoteLasers];
    const boltGeo = new THREE.CylinderGeometry(0.12, 0.12, 6.5, 6);
    boltGeo.rotateX(Math.PI / 2);

    allLasers.forEach((laser) => {
      const color = laser.color || '#00f0ff';
      const boltMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        blending: THREE.AdditiveBlending,
      });
      const boltMesh = new THREE.Mesh(boltGeo, boltMat);
      boltMesh.position.set(laser.position.x, laser.position.y, laser.position.z);

      const velVec = new THREE.Vector3(laser.velocity.x, laser.velocity.y, laser.velocity.z);
      if (velVec.lengthSq() > 0.1) {
        boltMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), velVec.normalize());
      }
      group.add(boltMesh);
    });
  }, [localLasers, remoteLasers]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-slate-950 cursor-crosshair"
    />
  );
};

// Helper: Build modular low-poly Star Citizen spacecraft models for enemy / remote vessels
function createSpaceshipModel(isAI: boolean, callsign: string = ''): THREE.Group {
  const ship = new THREE.Group();
  const name = callsign.toUpperCase();

  const isCutlass = name.includes('CUTLASS') || name.includes('DRAKE') || name.includes('VANGUARD');
  const isArrow = name.includes('ARROW') || name.includes('ANVIL');
  const isSabre = name.includes('SABRE') || name.includes('GLADIUS') || name.includes('AEGIS');

  // Materials with tailored colorways
  let primaryColor = 0x0284c7; // Default cyan/blue for human players
  let accentColor = 0x0f172a;
  let cockpitColor = 0x0ea5e9;
  let plumeColor = 0x38bdf8;

  if (isAI) {
    if (isCutlass) {
      primaryColor = 0xc2410c; // Industrial Drake Rust / Hazard Orange
      accentColor = 0x1c1917;
      cockpitColor = 0xf59e0b;
      plumeColor = 0xf97316;
    } else if (isArrow) {
      primaryColor = 0xd97706; // Anvil Gold / Gunmetal
      accentColor = 0x292524;
      cockpitColor = 0x38bdf8;
      plumeColor = 0xfbbf24;
    } else {
      primaryColor = 0xb91c1c; // Aegis Crimson / Navy
      accentColor = 0x1e293b;
      cockpitColor = 0x06b6d4;
      plumeColor = 0xef4444;
    }
  }

  const hullMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    metalness: 0.85,
    roughness: 0.35,
    emissive: primaryColor,
    emissiveIntensity: 0.35,
  });

  const armorMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    metalness: 0.9,
    roughness: 0.4,
    emissive: accentColor,
    emissiveIntensity: 0.15,
  });

  const canopyMat = new THREE.MeshStandardMaterial({
    color: cockpitColor,
    metalness: 0.95,
    roughness: 0.1,
    emissive: cockpitColor,
    emissiveIntensity: 0.9,
  });

  const plumeMat = new THREE.MeshBasicMaterial({
    color: plumeColor,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  });

  // High-visibility Shield/Sensor Aura to make ships pop against the dark background at distance
  const auraGeo = new THREE.SphereGeometry(7.5, 12, 12);
  const auraMat = new THREE.MeshBasicMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 0.12,
    wireframe: true,
    blending: THREE.AdditiveBlending,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.name = 'shieldAura';
  ship.add(aura);

  // Intense glowing core navigation light for extreme distance visibility
  const navLightGeo = new THREE.SphereGeometry(1.5, 8, 8);
  const navLightMat = new THREE.MeshBasicMaterial({
    color: cockpitColor,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
  });
  const navLight = new THREE.Mesh(navLightGeo, navLightMat);
  ship.add(navLight);


  if (isCutlass) {
    // DRAKE CUTLASS STYLE: Heavy chassis, dual articulated nacelles, upper turret
    // Main heavy fuselage
    const bodyGeo = new THREE.BoxGeometry(2.4, 1.4, 7.8);
    const body = new THREE.Mesh(bodyGeo, hullMat);
    ship.add(body);

    // Chiseled nose section
    const noseGeo = new THREE.ConeGeometry(1.6, 3.2, 4);
    noseGeo.rotateX(-Math.PI / 2);
    noseGeo.rotateY(Math.PI / 4);
    const nose = new THREE.Mesh(noseGeo, armorMat);
    nose.position.set(0, -0.1, -4.8);
    ship.add(nose);

    // Elevated cockpit canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 2.6), canopyMat);
    canopy.position.set(0, 0.8, -2.2);
    canopy.rotation.x = -0.1;
    ship.add(canopy);

    // Top dorsal turret
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.5, 8), armorMat);
    turret.position.set(0, 0.95, 0.8);
    ship.add(turret);

    // Dual Outrigger Engine Nacelles
    const nacelleGeo = new THREE.BoxGeometry(0.9, 1.1, 4.8);
    const leftNacelle = new THREE.Mesh(nacelleGeo, armorMat);
    leftNacelle.position.set(-2.4, 0.2, 1.2);
    ship.add(leftNacelle);

    const rightNacelle = new THREE.Mesh(nacelleGeo, armorMat);
    rightNacelle.position.set(2.4, 0.2, 1.2);
    ship.add(rightNacelle);

    // Main Engine Plumes (Dual heavy exhausts)
    const plumeGeo = new THREE.ConeGeometry(0.55, 3.8, 8);
    plumeGeo.rotateX(Math.PI / 2);

    const plumeL = new THREE.Mesh(plumeGeo, plumeMat);
    plumeL.name = 'enginePlume';
    plumeL.position.set(-2.4, 0.2, 4.4);
    ship.add(plumeL);

    const plumeR = new THREE.Mesh(plumeGeo, plumeMat);
    plumeR.name = 'enginePlume';
    plumeR.position.set(2.4, 0.2, 4.4);
    ship.add(plumeR);
  } else if (isArrow) {
    // ANVIL ARROW STYLE: Ultra sleek triangle, razor sharp forward swept strakes
    const fuselageGeo = new THREE.ConeGeometry(1.1, 7.2, 3);
    fuselageGeo.rotateX(-Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
    fuselage.scale.set(1.4, 0.7, 1);
    ship.add(fuselage);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 2.0), canopyMat);
    canopy.position.set(0, 0.35, -0.4);
    ship.add(canopy);

    // Swept delta wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(4.6, -1.2);
    wingShape.lineTo(4.2, -2.8);
    wingShape.lineTo(0, -2.2);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 });
    wingGeo.rotateX(Math.PI / 2);

    const wingR = new THREE.Mesh(wingGeo, armorMat);
    wingR.position.set(0.4, 0, 0.8);
    ship.add(wingR);

    const wingL = new THREE.Mesh(wingGeo, armorMat);
    wingL.scale.set(-1, 1, 1);
    wingL.position.set(-0.4, 0, 0.8);
    ship.add(wingL);

    // Twin Wingtip Repeaters
    const gunGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
    gunGeo.rotateX(Math.PI / 2);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });

    const gunR = new THREE.Mesh(gunGeo, gunMat);
    gunR.position.set(4.4, 0, -0.2);
    ship.add(gunR);

    const gunL = new THREE.Mesh(gunGeo, gunMat);
    gunL.position.set(-4.4, 0, -0.2);
    ship.add(gunL);

    // Single Powerful Central Engine Plume
    const plumeGeo = new THREE.ConeGeometry(0.5, 3.4, 8);
    plumeGeo.rotateX(Math.PI / 2);
    const plume = new THREE.Mesh(plumeGeo, plumeMat);
    plume.name = 'enginePlume';
    plume.position.set(0, 0, 3.6);
    ship.add(plume);
  } else {
    // AEGIS GLADIUS / SABRE STYLE: Military space fighter with twin tail rudders
    const fuselageGeo = new THREE.ConeGeometry(1.3, 7.6, 6);
    fuselageGeo.rotateX(-Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
    ship.add(fuselage);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 2.3), canopyMat);
    canopy.position.set(0, 0.45, 0.1);
    ship.add(canopy);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(4.0, -1.6);
    wingShape.lineTo(3.8, -3.0);
    wingShape.lineTo(0, -2.4);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 });
    wingGeo.rotateX(Math.PI / 2);

    const rightWing = new THREE.Mesh(wingGeo, armorMat);
    rightWing.position.set(0.5, 0, 1.0);
    ship.add(rightWing);

    const leftWing = new THREE.Mesh(wingGeo, armorMat);
    leftWing.scale.set(-1, 1, 1);
    leftWing.position.set(-0.5, 0, 1.0);
    ship.add(leftWing);

    // Twin Canting Tail Rudders
    const finGeo = new THREE.BoxGeometry(0.08, 1.2, 1.5);
    const finR = new THREE.Mesh(finGeo, armorMat);
    finR.position.set(0.8, 0.8, 2.4);
    finR.rotation.z = -0.25;
    ship.add(finR);

    const finL = new THREE.Mesh(finGeo, armorMat);
    finL.position.set(-0.8, 0.8, 2.4);
    finL.rotation.z = 0.25;
    ship.add(finL);

    // Twin Engine Plumes
    const plumeGeo = new THREE.ConeGeometry(0.42, 2.9, 8);
    plumeGeo.rotateX(Math.PI / 2);

    const plumeR = new THREE.Mesh(plumeGeo, plumeMat);
    plumeR.name = 'enginePlume';
    plumeR.position.set(0.6, 0, 3.8);
    ship.add(plumeR);

    const plumeL = new THREE.Mesh(plumeGeo, plumeMat);
    plumeL.name = 'enginePlume';
    plumeL.position.set(-0.6, 0, 3.8);
    ship.add(plumeL);
  }

  return ship;
}

// Intercept solver for Lead PIP
function solveIntercept(
  shooterPos: { x: number; y: number; z: number },
  shooterVel: { x: number; y: number; z: number },
  targetPos: { x: number; y: number; z: number },
  targetVel: { x: number; y: number; z: number },
  muzzleSpeed: number
): { leadPoint: { x: number; y: number; z: number } | null; impactPoint: { x: number; y: number; z: number } | null; time: number } {
  const Dx = targetPos.x - shooterPos.x;
  const Dy = targetPos.y - shooterPos.y;
  const Dz = targetPos.z - shooterPos.z;
  const dist = Math.hypot(Dx, Dy, Dz);

  if (dist < 0.1) {
    return { leadPoint: targetPos, impactPoint: targetPos, time: 0 };
  }

  const Vrx = targetVel.x - shooterVel.x;
  const Vry = targetVel.y - shooterVel.y;
  const Vrz = targetVel.z - shooterVel.z;

  const A = (Vrx * Vrx + Vry * Vry + Vrz * Vrz) - (muzzleSpeed * muzzleSpeed);
  const B = 2 * (Dx * Vrx + Dy * Vry + Dz * Vrz);
  const C = Dx * Dx + Dy * Dy + Dz * Dz;

  const disc = B * B - 4 * A * C;
  if (disc < 0) return { leadPoint: null, impactPoint: null, time: 0 };

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-B - sqrtDisc) / (2 * A);
  const t2 = (-B + sqrtDisc) / (2 * A);

  let t = -1;
  if (t1 > 0 && t2 > 0) t = Math.min(t1, t2);
  else if (t1 > 0) t = t1;
  else if (t2 > 0) t = t2;

  if (t <= 0 || !isFinite(t) || t > 10.0) return { leadPoint: null, impactPoint: null, time: 0 };

  // Future target position when hit
  const impactPoint = {
    x: targetPos.x + targetVel.x * t,
    y: targetPos.y + targetVel.y * t,
    z: targetPos.z + targetVel.z * t,
  };

  // Required projectile relative muzzle direction (u)
  const aimVecX = Dx + Vrx * t;
  const aimVecY = Dy + Vry * t;
  const aimVecZ = Dz + Vrz * t;
  const aimLen = Math.hypot(aimVecX, aimVecY, aimVecZ);

  if (aimLen < 0.0001) {
    return { leadPoint: impactPoint, impactPoint, time: t };
  }

  const ux = aimVecX / aimLen;
  const uy = aimVecY / aimLen;
  const uz = aimVecZ / aimLen;

  // Aim point along line of sight at target distance R:
  const leadPoint = {
    x: shooterPos.x + ux * dist,
    y: shooterPos.y + uy * dist,
    z: shooterPos.z + uz * dist,
  };

  return {
    leadPoint,
    impactPoint,
    time: t,
  };
}
