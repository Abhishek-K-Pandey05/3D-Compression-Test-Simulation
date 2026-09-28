/**
 * 3D Scene Manager, UTM Machine Rig, Laboratory Environment, WebXR,
 * and 3D Component Hover Inspector.
 * Powered by Three.js
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { VRButton } from 'three/addons/VRButton.js';
import { sound } from './audio.js';

export class LabScene {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // UTM moving parts references
    this.utmGroup = null;
    this.crossheadGroup = null;
    this.dialNeedle = null;
    this.dialPeakNeedle = null;
    this.safetyDoor = null;
    this.cleaningBrush = null;
    this.specimenRack = null;

    // Interactive Hover Raycaster for Component Inspection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-1000, -1000);
    this.hoveredObject = null;
    this.originalEmissive = new Map();
    this.inspectableObjects = [];

    // Animation state
    this.crossheadY = 3.5;
    this.maxDialAngle = (280 * Math.PI) / 180;
    this.peakLoad = 0;
    this.isDoorClosed = false;

    this.init();
    this.initInspectorDOM();
    this.bindHoverEvents();
  }

  init() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    // 1. Camera
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 3.2, 7.0);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Add VR Button
    const vrBtn = VRButton.createButton(this.renderer);
    vrBtn.id = 'webxr-vr-btn';
    vrBtn.className = 'btn-vr';
    document.body.appendChild(vrBtn);

    // 3. OrbitControls with full 360-degree rotation
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Full orbit view
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 20.0;
    this.controls.target.set(0, 2.2, 0);

    // 4. Lighting & Environment
    this.setupLighting();
    this.buildLabEnvironment();
    this.buildUTMMachine();

    // 5. Window Resize Handler
    window.addEventListener('resize', () => this.onWindowResize());
  }

  initInspectorDOM() {
    let tooltip = document.getElementById('scene-inspector-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'scene-inspector-tooltip';
      tooltip.className = 'scene-inspector-tooltip';
      tooltip.innerHTML = `
        <div class="insp-header">
          <span class="insp-tag" id="insp-category">UTM COMPONENT</span>
          <span class="insp-dot"></span>
        </div>
        <h4 class="insp-title" id="insp-name">Component Name</h4>
        <p class="insp-desc" id="insp-desc">Detailed engineering description and function of the hovered machine element.</p>
      `;
      document.body.appendChild(tooltip);
    }
    this.tooltipEl = tooltip;
  }

  bindHoverEvents() {
    const onMove = (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.screenMouseX = e.clientX;
      this.screenMouseY = e.clientY;
    };

    const onLeave = () => {
      this.mouse.x = -1000;
      this.mouse.y = -1000;
      this.hideTooltip();
    };

    this.renderer.domElement.addEventListener('mousemove', onMove);
    this.renderer.domElement.addEventListener('mouseleave', onLeave);
  }

  registerInspectable(mesh, metadata) {
    if (!mesh) return;
    mesh.userData.componentMeta = metadata;
    this.inspectableObjects.push(mesh);
  }

  updateHoverInspector() {
    if (this.mouse.x === -1000 || this.renderer.xr.isPresenting) {
      this.hideTooltip();
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.inspectableObjects, true);

    if (intersects.length > 0) {
      let targetObj = intersects[0].object;
      // Search up hierarchy for metadata
      while (targetObj && !targetObj.userData.componentMeta && targetObj.parent && targetObj.parent !== this.scene) {
        targetObj = targetObj.parent;
      }

      if (targetObj && targetObj.userData.componentMeta) {
        if (this.hoveredObject !== targetObj) {
          this.clearHoverHighlight();
          this.hoveredObject = targetObj;
          this.applyHoverHighlight(targetObj);
        }
        this.showTooltip(targetObj.userData.componentMeta, this.screenMouseX, this.screenMouseY);
        return;
      }
    }

    this.clearHoverHighlight();
    this.hideTooltip();
  }

  applyHoverHighlight(obj) {
    obj.traverse((child) => {
      if (child.isMesh && child.material) {
        if (!this.originalEmissive.has(child)) {
          this.originalEmissive.set(child, child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0, 0, 0));
        }
        if (child.material.emissive) {
          child.material.emissive.setHex(0x0284c7);
        }
      }
    });
  }

  clearHoverHighlight() {
    if (this.hoveredObject) {
      this.hoveredObject.traverse((child) => {
        if (child.isMesh && child.material && this.originalEmissive.has(child)) {
          if (child.material.emissive) {
            child.material.emissive.copy(this.originalEmissive.get(child));
          }
        }
      });
      this.hoveredObject = null;
    }
  }

  showTooltip(meta, screenX, screenY) {
    if (!this.tooltipEl) return;
    const catEl = document.getElementById('insp-category');
    const nameEl = document.getElementById('insp-name');
    const descEl = document.getElementById('insp-desc');

    if (catEl) catEl.textContent = meta.category || 'UTM COMPONENT';
    if (nameEl) nameEl.textContent = meta.name || 'Component';
    if (descEl) descEl.textContent = meta.description || '';

    let left = screenX + 18;
    let top = screenY - 30;
    if (left + 280 > window.innerWidth) left = screenX - 290;
    if (top < 10) top = 10;
    if (top + 140 > window.innerHeight) top = window.innerHeight - 150;

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.classList.add('visible');
  }

  hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.classList.remove('visible');
    }
    this.clearHoverHighlight();
  }

  setupLighting() {
    this.scene.background = new THREE.Color(0x0c1017);
    this.scene.fog = new THREE.FogExp2(0x0c1017, 0.035);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xfff8f0, 3.0);
    spotLight.position.set(0, 7.5, 2.5);
    spotLight.target.position.set(0, 1.8, 0);
    spotLight.angle = Math.PI / 4.5;
    spotLight.penumbra = 0.6;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.bias = -0.0005;
    this.scene.add(spotLight);
    this.scene.add(spotLight.target);

    const dirLight = new THREE.DirectionalLight(0xdbeafe, 1.2);
    dirLight.position.set(4, 6, 5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    rimLight.position.set(-4, 4, -4);
    this.scene.add(rimLight);

    const benchPoint = new THREE.PointLight(0xfef08a, 1.3, 8);
    benchPoint.position.set(-3.2, 3.2, 0.5);
    this.scene.add(benchPoint);
  }

  buildLabEnvironment() {
    // 1. Epoxy Floor with safety boundary
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 1024;
    floorCanvas.height = 1024;
    const fctx = floorCanvas.getContext('2d');

    fctx.fillStyle = '#171c26';
    fctx.fillRect(0, 0, 1024, 1024);

    fctx.strokeStyle = '#222b3a';
    fctx.lineWidth = 2;
    for (let x = 0; x <= 1024; x += 128) {
      fctx.beginPath(); fctx.moveTo(x, 0); fctx.lineTo(x, 1024); fctx.stroke();
      fctx.beginPath(); fctx.moveTo(0, x); fctx.lineTo(1024, x); fctx.stroke();
    }

    fctx.strokeStyle = '#f59e0b';
    fctx.lineWidth = 12;
    fctx.strokeRect(384, 384, 256, 256);

    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.25, metalness: 0.15 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. Back Lab Wall
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 10),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 })
    );
    backWall.position.set(0, 5, -6);
    this.scene.add(backWall);

    // 3. Side Workbench
    this.buildWorkbench();

    // 4. Hydraulic Power Unit Cabinet
    this.buildHPUCabinet();

    // 5. Operator Computer Desk
    this.buildOperatorDesk();
  }

  buildWorkbench() {
    const benchGroup = new THREE.Group();
    benchGroup.position.set(-3.2, 0, 0.5);

    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.12, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.7 })
    );
    tableTop.position.y = 1.6;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    benchGroup.add(tableTop);

    const legGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 16);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    [[-0.9, 0.8, -0.5], [0.9, 0.8, -0.5], [-0.9, 0.8, 0.5], [0.9, 0.8, 0.5]].forEach(p => {
      const leg = new THREE.Mesh(legGeom, legMat);
      leg.position.set(p[0], p[1], p[2]);
      leg.castShadow = true;
      benchGroup.add(leg);
    });

    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.04, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.9 })
    );
    tray.position.set(-0.35, 1.68, 0.1);
    benchGroup.add(tray);

    const caliperModel = this.createBenchCaliperMesh();
    caliperModel.position.set(-0.35, 1.71, 0.1);
    caliperModel.rotation.y = 0.15;
    benchGroup.add(caliperModel);

    // Register Caliper workbench inspectable
    this.registerInspectable(benchGroup, {
      category: 'METROLOGY STATION',
      name: 'Precision Vernier Caliper Inspection Workbench',
      description: 'Dedicated metrology area for measuring specimen initial dimensions (d₀, h₀) with 0.02 mm resolution.'
    });

    // Specimen Storage Rack
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.06, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 })
    );
    rack.position.set(0.55, 1.68, 0.1);
    benchGroup.add(rack);

    const sampleColors = [
      { col: 0x88919b, name: 'Mild Steel (Ductile)', desc: 'Exhibits yielding and severe barrelling without brittle snapping.', x: 0.35 },
      { col: 0x4b5056, name: 'Grey Cast Iron (Brittle)', desc: 'High compressive strength failing along ~52° shear slip plane.', x: 0.48 },
      { col: 0x9c968c, name: 'Concrete (M40 Mix)', desc: 'Quasi-brittle aggregate matrix showing crushing and surface spalling.', x: 0.61 },
      { col: 0xa6723e, name: 'Hardwood Oak (Cellular)', desc: 'Undergoes fiber micro-buckling and kink-band cleavage.', x: 0.74 }
    ];
    const sGeom = new THREE.CylinderGeometry(0.075, 0.075, 0.3, 24);
    sampleColors.forEach(s => {
      const sMat = new THREE.MeshStandardMaterial({ color: s.col, roughness: 0.4, metalness: (s.col === 0x88919b ? 0.8 : 0.2) });
      const sm = new THREE.Mesh(sGeom, sMat);
      sm.position.set(s.x, 1.86, 0.1);
      sm.castShadow = true;
      this.registerInspectable(sm, {
        category: 'TEST SPECIMEN',
        name: `${s.name} Cylindrical Sample`,
        description: s.desc
      });
      benchGroup.add(sm);
    });

    this.scene.add(benchGroup);
  }

  createBenchCaliperMesh() {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.015, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 })
    );
    group.add(beam);

    const jawGeom = new THREE.BoxGeometry(0.03, 0.018, 0.18);
    const fixedJaw = new THREE.Mesh(jawGeom, beam.material);
    fixedJaw.position.set(-0.35, 0, 0.06);
    group.add(fixedJaw);

    const slidingJaw = new THREE.Mesh(jawGeom, beam.material);
    slidingJaw.position.set(-0.15, 0, 0.06);
    group.add(slidingJaw);

    return group;
  }

  buildHPUCabinet() {
    const hpuGroup = new THREE.Group();
    hpuGroup.position.set(3.2, 0, -0.5);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 })
    );
    body.position.y = 1.1;
    body.castShadow = true;
    hpuGroup.add(body);

    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.8, 24),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 })
    );
    tank.position.set(-0.25, 2.6, 0);
    hpuGroup.add(tank);

    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.7, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
    );
    motor.rotation.z = Math.PI / 2;
    motor.position.set(0.25, 2.45, 0);
    hpuGroup.add(motor);

    this.registerInspectable(hpuGroup, {
      category: 'HYDRAULIC POWER UNIT',
      name: 'Hydraulic Power Unit (HPU) & Reservoir',
      description: 'Generates up to 350 bar hydraulic pressure driving the crosshead actuators with servo-valve displacement flow rate control.'
    });

    this.scene.add(hpuGroup);
  }

  buildOperatorDesk() {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(-1.8, 0, 3.2);
    deskGroup.rotation.y = 0.55;

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.1, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 })
    );
    desk.position.y = 1.4;
    deskGroup.add(desk);

    const monGeom = new THREE.BoxGeometry(0.65, 0.45, 0.03);
    const monMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    
    const scrCanvas = document.createElement('canvas');
    scrCanvas.width = 512;
    scrCanvas.height = 350;
    const sctx = scrCanvas.getContext('2d');
    sctx.fillStyle = '#090d14';
    sctx.fillRect(0, 0, 512, 350);
    sctx.fillStyle = '#38bdf8';
    sctx.font = 'bold 24px monospace';
    sctx.fillText('UTM TELEMETRY v4.2', 30, 50);
    sctx.fillStyle = '#22c55e';
    sctx.font = '18px monospace';
    sctx.fillText('HYDRAULIC PUMP: READY', 30, 90);
    sctx.fillText('LOAD CELL CALIBRATED', 30, 120);

    const screen1 = new THREE.Mesh(monGeom, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(scrCanvas) }));
    screen1.position.set(-0.35, 1.78, 0);
    screen1.rotation.y = 0.15;
    deskGroup.add(screen1);

    const screen2 = new THREE.Mesh(monGeom, monMat);
    screen2.position.set(0.35, 1.78, -0.05);
    screen2.rotation.y = -0.2;
    deskGroup.add(screen2);

    this.registerInspectable(deskGroup, {
      category: 'CONTROL CONSOLE',
      name: 'Real-Time Telemetry & DAQ Computer Workstation',
      description: 'Acquires load cell and LVDT sensor signals at 1 kHz, dynamically plotting Stress-Strain curves.'
    });

    this.scene.add(deskGroup);
  }

  buildUTMMachine() {
    this.utmGroup = new THREE.Group();
    this.utmGroup.position.set(0, 0, 0);

    // 1. Heavy Base Plinth
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.5, metalness: 0.7 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.8), baseMat);
    base.position.y = 0.4;
    base.castShadow = true;
    base.receiveShadow = true;
    this.utmGroup.add(base);

    this.registerInspectable(base, {
      category: 'MACHINE FRAME',
      name: 'Heavy Cast-Iron Base Plinth',
      description: 'Provides ultra-rigid foundation for 1000 kN reaction forces and houses lower hydraulic rams.'
    });

    // 2. Fixed Lower Platen with Concentric Centering Circles
    const ringCanvas = document.createElement('canvas');
    ringCanvas.width = 512;
    ringCanvas.height = 512;
    const rctx = ringCanvas.getContext('2d');
    rctx.fillStyle = '#cbd5e1';
    rctx.fillRect(0, 0, 512, 512);
    rctx.strokeStyle = '#0f172a';
    rctx.lineWidth = 3;
    [30, 60, 90, 130, 170, 210].forEach(r => {
      rctx.beginPath(); rctx.arc(256, 256, r, 0, Math.PI * 2); rctx.stroke();
    });
    rctx.beginPath();
    rctx.moveTo(256, 30); rctx.lineTo(256, 482);
    rctx.moveTo(30, 256); rctx.lineTo(482, 256);
    rctx.stroke();

    const lowerPlatenMat = new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(ringCanvas),
      metalness: 0.9,
      roughness: 0.2
    });
    const lowerPlaten = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.25, 48), lowerPlatenMat);
    lowerPlaten.position.y = 0.925;
    lowerPlaten.castShadow = true;
    lowerPlaten.receiveShadow = true;
    this.utmGroup.add(lowerPlaten);

    this.registerInspectable(lowerPlaten, {
      category: 'COMPRESSION TOOLING',
      name: 'Fixed Lower Platen with Concentric Centering Rings',
      description: 'Hardened tool steel platen with laser-etched concentric alignment rings ensuring axial centering within ±0.2 mm to eliminate eccentric bending moments.'
    });

    // 3. Chromed Guide Columns
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
    const colGeom = new THREE.CylinderGeometry(0.12, 0.12, 4.2, 32);

    const leftCol = new THREE.Mesh(colGeom, chromeMat);
    leftCol.position.set(-0.85, 2.9, 0);
    leftCol.castShadow = true;
    this.utmGroup.add(leftCol);

    const rightCol = new THREE.Mesh(colGeom, chromeMat);
    rightCol.position.set(0.85, 2.9, 0);
    rightCol.castShadow = true;
    this.utmGroup.add(rightCol);

    this.registerInspectable(leftCol, {
      category: 'MACHINE FRAME',
      name: 'High-Tensile Hard-Chromed Guide Columns',
      description: 'Precision ground dual columns maintaining vertical axial travel and lateral structural stiffness.'
    });

    // 4. Fixed Top Crosshead Beam
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.65, 1.2), baseMat);
    topBeam.position.y = 5.0;
    topBeam.castShadow = true;
    this.utmGroup.add(topBeam);

    this.registerInspectable(topBeam, {
      category: 'MACHINE FRAME',
      name: 'Top Fixed Reaction Beam',
      description: 'Rigid top beam sustaining upper tensile reaction forces during downward compression.'
    });

    // 5. Movable Upper Crosshead Assembly
    this.crossheadGroup = new THREE.Group();
    this.crossheadGroup.position.y = 4.2;

    const crossheadBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 0.9), baseMat);
    crossheadBody.castShadow = true;
    this.crossheadGroup.add(crossheadBody);

    // Spherical seated Upper Compression Platen
    const upperPlaten = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.25, 48),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 })
    );
    upperPlaten.position.y = -0.375;
    upperPlaten.castShadow = true;
    this.crossheadGroup.add(upperPlaten);

    // Load Cell
    const loadCell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32),
      new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.3 })
    );
    loadCell.position.y = -0.15;
    this.crossheadGroup.add(loadCell);

    this.registerInspectable(this.crossheadGroup, {
      category: 'CROSSHEAD ASSEMBLY',
      name: 'Movable Hydraulic Crosshead & Spherical Seated Platen',
      description: 'Translates vertically to compress the specimen. Spherical seating compensates for non-parallel sample faces to ensure pure uniaxial compressive loading.'
    });

    this.registerInspectable(loadCell, {
      category: 'SENSOR TRANSDUCER',
      name: 'Precision 1000 kN Strain-Gauge Load Cell',
      description: 'Wheatstone bridge load cell measuring instantaneous compressive force P with ±0.1 kN precision.'
    });

    this.utmGroup.add(this.crossheadGroup);

    // 6. Analog Dial Gauge
    this.buildDialGauge(this.utmGroup);

    // 7. Safety Shield
    this.buildSafetyShield(this.utmGroup);

    this.scene.add(this.utmGroup);
  }

  buildDialGauge(parentGroup) {
    const dialGroup = new THREE.Group();
    dialGroup.position.set(1.15, 3.2, 0.25);
    dialGroup.rotation.y = -0.35;

    const casing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.5, 0.14, 48),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 })
    );
    casing.geometry.rotateX(Math.PI / 2);
    dialGroup.add(casing);

    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.03, 16, 48),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 })
    );
    bezel.position.z = 0.07;
    dialGroup.add(bezel);

    const dialCanvas = document.createElement('canvas');
    dialCanvas.width = 1024;
    dialCanvas.height = 1024;
    const dctx = dialCanvas.getContext('2d');
    dctx.fillStyle = '#f8fafc';
    dctx.beginPath(); dctx.arc(512, 512, 500, 0, Math.PI * 2); dctx.fill();

    const startAngle = (140 * Math.PI) / 180;
    const sweep = (260 * Math.PI) / 180;
    const maxKn = 1000;
    dctx.textAlign = 'center';
    dctx.textBaseline = 'middle';
    dctx.fillStyle = '#0f172a';

    for (let kn = 0; kn <= maxKn; kn += 20) {
      const frac = kn / maxKn;
      const angle = startAngle + frac * sweep;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rOuter = 460;
      let rInner = (kn % 100 === 0) ? 390 : (kn % 50 === 0 ? 410 : 430);
      let lineW = (kn % 100 === 0) ? 7 : (kn % 50 === 0 ? 5 : 3);

      if (kn % 100 === 0) {
        dctx.font = 'bold 38px Inter, sans-serif';
        dctx.fillText(kn.toString(), 512 + 340 * cos, 512 + 340 * sin);
      }

      dctx.beginPath();
      dctx.moveTo(512 + rOuter * cos, 512 + rOuter * sin);
      dctx.lineTo(512 + rInner * cos, 512 + rInner * sin);
      dctx.strokeStyle = '#0f172a';
      dctx.lineWidth = lineW;
      dctx.stroke();
    }

    dctx.fillStyle = '#0f172a';
    dctx.font = 'bold 44px Inter, sans-serif';
    dctx.fillText('COMPRESSIVE LOAD', 512, 640);
    dctx.font = 'bold 34px monospace';
    dctx.fillStyle = '#0284c7';
    dctx.fillText('CAPACITY 1000 kN × 5 kN', 512, 690);

    const dialFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 48),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dialCanvas) })
    );
    dialFace.position.z = 0.072;
    dialGroup.add(dialFace);

    const needleGeom = new THREE.BoxGeometry(0.014, 0.38, 0.005);
    needleGeom.translate(0, 0.16, 0);
    this.dialNeedle = new THREE.Mesh(needleGeom, new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    this.dialNeedle.position.z = 0.076;
    dialGroup.add(this.dialNeedle);

    const peakGeom = new THREE.BoxGeometry(0.01, 0.38, 0.004);
    peakGeom.translate(0, 0.16, 0);
    this.dialPeakNeedle = new THREE.Mesh(peakGeom, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    this.dialPeakNeedle.position.z = 0.078;
    dialGroup.add(this.dialPeakNeedle);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.02, 24),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 })
    );
    hub.geometry.rotateX(Math.PI / 2);
    hub.position.z = 0.082;
    dialGroup.add(hub);

    parentGroup.add(dialGroup);

    this.registerInspectable(dialGroup, {
      category: 'ANALOG READOUT',
      name: '1000 kN Mechanical Dial Gauge & Peak Follower',
      description: 'Displays live load (black needle) and remembers the maximum ultimate compressive load (red follower needle).'
    });

    this.setDialLoad(0);
  }

  buildSafetyShield(parentGroup) {
    this.safetyDoor = new THREE.Group();
    this.safetyDoor.position.set(0, 2.5, 0.65);

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.3, 0.02),
      new THREE.MeshPhysicalMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.4, transmission: 0.85 })
    );
    this.safetyDoor.add(glass);

    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.35, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 })
    );
    handle.position.set(0.65, 0, 0.04);
    this.safetyDoor.add(handle);

    this.safetyDoor.position.x = 1.35;
    this.isDoorClosed = false;

    this.registerInspectable(this.safetyDoor, {
      category: 'SAFETY INTERLOCK',
      name: 'Polycarbonate Blast Safety Interlock Shield',
      description: 'High-strength shatterproof barrier that slides closed to protect the operator against explosive brittle fracture fragments.'
    });

    parentGroup.add(this.safetyDoor);
  }

  setSafetyDoor(closed) {
    this.isDoorClosed = closed;
    this.safetyDoor.position.x = closed ? 0 : 1.35;
  }

  setDialLoad(loadKN) {
    const clampedLoad = Math.max(0, Math.min(1000, loadKN));
    const sweep = (260 * Math.PI) / 180;
    const baseAngle = -(130 * Math.PI) / 180;
    const targetAngle = baseAngle + (clampedLoad / 1000.0) * sweep;

    if (this.dialNeedle) {
      this.dialNeedle.rotation.z = -targetAngle;
    }

    if (clampedLoad > this.peakLoad) {
      this.peakLoad = clampedLoad;
      if (this.dialPeakNeedle) {
        this.dialPeakNeedle.rotation.z = -targetAngle;
      }
    }
  }

  resetDialPeak() {
    this.peakLoad = 0;
    if (this.dialPeakNeedle && this.dialNeedle) {
      this.dialPeakNeedle.rotation.z = this.dialNeedle.rotation.z;
    }
  }

  setCrossheadHeight(heightMm) {
    const worldHeight = 0.925 + (heightMm * 0.1) + 0.375;
    if (this.crossheadGroup) {
      this.crossheadGroup.position.y = worldHeight;
    }
  }

  setCameraPreset(presetName) {
    if (!this.camera || !this.controls) return;

    let targetPos = new THREE.Vector3(0, 3.2, 7.0);
    let targetLook = new THREE.Vector3(0, 2.2, 0);

    switch (presetName) {
      case 'specimen':
        targetPos.set(0, 1.3, 2.0);
        targetLook.set(0, 1.1, 0);
        break;
      case 'dial':
        targetPos.set(1.4, 3.2, 1.8);
        targetLook.set(1.15, 3.2, 0.25);
        break;
      case 'caliper':
        targetPos.set(-3.2, 3.0, 2.2);
        targetLook.set(-3.2, 1.7, 0.5);
        break;
      case 'console':
        targetPos.set(-1.8, 2.6, 4.8);
        targetLook.set(-1.8, 1.8, 3.2);
        break;
      case 'top':
        targetPos.set(0, 7.5, 0.1);
        targetLook.set(0, 1.5, 0);
        break;
      case 'overview':
      default:
        targetPos.set(0, 3.2, 7.0);
        targetLook.set(0, 2.2, 0);
        break;
    }

    this.animateCamera(targetPos, targetLook);
  }

  animateCamera(toPos, toLook) {
    const startPos = this.camera.position.clone();
    const startLook = this.controls.target.clone();
    let progress = 0;

    const step = () => {
      progress += 0.04;
      if (progress >= 1.0) {
        this.camera.position.copy(toPos);
        this.controls.target.copy(toLook);
        this.controls.update();
        return;
      }

      const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      this.camera.position.lerpVectors(startPos, toPos, t);
      this.controls.target.lerpVectors(startLook, toLook, t);
      this.controls.update();

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render(callback) {
    this.renderer.setAnimationLoop((time) => {
      this.controls.update();
      this.updateHoverInspector();
      if (callback) callback(time);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
