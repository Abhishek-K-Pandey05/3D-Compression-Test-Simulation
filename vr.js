/**
 * Full WebXR VR Interactive Subsystem
 * Provides 6-DOF Controller Tracking, Laser Raycasting, In-World 3D Holographic HUD,
 * 3D Button Interactivity, Room-Scale Teleportation, and VR Haptics.
 */

import * as THREE from 'three';
import { sound } from './audio.js';

export class VRManager {
  constructor(sceneInstance, appInstance) {
    this.sceneManager = sceneInstance;
    this.app = appInstance;
    this.scene = sceneInstance.scene;
    this.renderer = sceneInstance.renderer;
    this.camera = sceneInstance.camera;

    this.isVRPresenting = false;
    this.cameraRig = new THREE.Group();
    this.scene.add(this.cameraRig);

    // Controllers
    this.controllers = [];
    this.controllerGrips = [];
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.intersected = [];

    // Interactive 3D VR Objects list
    this.vrInteractables = [];

    // In-VR Floating Holographic HUD
    this.vrHUDMesh = null;
    this.vrHUDCanvas = null;
    this.vrHUDCtx = null;
    this.vrHUDTexture = null;

    // Teleportation
    this.teleportMarker = null;
    this.isTeleportActive = false;
    this.teleportTarget = new THREE.Vector3();

    this.initXR();
  }

  initXR() {
    if (!this.renderer.xr) return;

    // Set reference space
    this.renderer.xr.setReferenceSpaceType('local-floor');

    // Add camera to camera rig
    this.cameraRig.position.set(0, 0, 1.8);
    this.cameraRig.add(this.camera);

    // Setup Session Listeners
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isVRPresenting = true;
      this.cameraRig.position.set(0, 0, 1.8);
      if (this.vrHUDMesh) this.vrHUDMesh.visible = true;
      sound.playSafetySuccess();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.isVRPresenting = false;
      if (this.vrHUDMesh) this.vrHUDMesh.visible = false;
    });

    // Build Controllers
    this.setupControllers();

    // Build In-VR 3D Holographic HUD Screen
    this.buildVRHUD();

    // Build Teleportation Marker
    this.buildTeleportMarker();

    // Setup 3D Interactive World Elements
    this.setupWorldInteractables();
  }

  setupControllers() {
    const laserGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -4)
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      linewidth: 2
    });

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('selectstart', (e) => this.onSelectStart(e));
      controller.addEventListener('selectend', (e) => this.onSelectEnd(e));
      controller.addEventListener('squeezestart', (e) => this.onSqueezeStart(e));
      controller.addEventListener('squeezeend', (e) => this.onSqueezeEnd(e));
      
      this.cameraRig.add(controller);
      this.controllers.push(controller);

      // Laser Ray
      const laser = new THREE.Line(laserGeom, laserMat.clone());
      laser.name = 'laser';
      controller.add(laser);

      // Ray Reticle Dot
      const dotGeom = new THREE.SphereGeometry(0.015, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.z = -4;
      dot.name = 'dot';
      controller.add(dot);

      // Controller Grip Visual
      const grip = this.renderer.xr.getControllerGrip(i);
      const gripMesh = this.createControllerMesh();
      grip.add(gripMesh);
      this.cameraRig.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  createControllerMesh() {
    const group = new THREE.Group();
    // Modern VR controller handle
    const handleGeom = new THREE.CylinderGeometry(0.018, 0.022, 0.12, 16);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
    const handle = new THREE.Mesh(handleGeom, handleMat);
    handle.rotation.x = Math.PI / 4;
    group.add(handle);

    // Tracking Ring
    const ringGeom = new THREE.TorusGeometry(0.045, 0.008, 12, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.9 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.set(0, 0.04, -0.04);
    ring.rotation.x = -Math.PI / 6;
    group.add(ring);

    return group;
  }

  buildTeleportMarker() {
    const geom = new THREE.RingGeometry(0.2, 0.26, 32);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.teleportMarker = new THREE.Mesh(geom, mat);
    this.teleportMarker.position.y = 0.02;
    this.teleportMarker.visible = false;
    this.scene.add(this.teleportMarker);
  }

  buildVRHUD() {
    // Canvas for in-VR dynamic HUD
    this.vrHUDCanvas = document.createElement('canvas');
    this.vrHUDCanvas.width = 1024;
    this.vrHUDCanvas.height = 768;
    this.vrHUDCtx = this.vrHUDCanvas.getContext('2d');

    this.vrHUDTexture = new THREE.CanvasTexture(this.vrHUDCanvas);
    this.vrHUDTexture.minFilter = THREE.LinearFilter;

    // Curved/Angled 3D Panel standing beside the UTM
    const panelGeom = new THREE.PlaneGeometry(1.6, 1.2);
    const panelMat = new THREE.MeshBasicMaterial({
      map: this.vrHUDTexture,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.vrHUDMesh = new THREE.Mesh(panelGeom, panelMat);
    this.vrHUDMesh.position.set(-1.4, 2.0, 0.8);
    this.vrHUDMesh.rotation.y = 0.45; // Angled towards user
    this.vrHUDMesh.name = 'vr_hud_panel';

    // Backing glass frame
    const frameGeom = new THREE.BoxGeometry(1.64, 1.24, 0.02);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.z = -0.015;
    this.vrHUDMesh.add(frame);

    this.scene.add(this.vrHUDMesh);

    // Secondary Interactive Row (Tare, Capture, Next Material)
    this.registerVRButton(this.vrHUDMesh, 'hud_tare', { xMin: 0.05, xMax: 0.35, yMin: 0.70, yMax: 0.80 }, () => {
      this.app.actionTareGauges();
    });
    this.registerVRButton(this.vrHUDMesh, 'hud_capture', { xMin: 0.38, xMax: 0.68, yMin: 0.70, yMax: 0.80 }, () => {
      this.app.captureDataPoint();
    });
    this.registerVRButton(this.vrHUDMesh, 'hud_next_mat', { xMin: 0.72, xMax: 0.95, yMin: 0.70, yMax: 0.80 }, () => {
      this.cycleNextMaterial();
    });

    // Manual Load In-VR Step Buttons
    this.registerVRButton(this.vrHUDMesh, 'hud_plus10', { xMin: 0.05, xMax: 0.26, yMin: 0.58, yMax: 0.68 }, () => {
      this.app.applyManualLoad(this.app.currentLoad + 10);
    });
    this.registerVRButton(this.vrHUDMesh, 'hud_plus25', { xMin: 0.28, xMax: 0.49, yMin: 0.58, yMax: 0.68 }, () => {
      this.app.applyManualLoad(this.app.currentLoad + 25);
    });
    this.registerVRButton(this.vrHUDMesh, 'hud_plus50', { xMin: 0.51, xMax: 0.72, yMin: 0.58, yMax: 0.68 }, () => {
      this.app.applyManualLoad(this.app.currentLoad + 50);
    });
    this.registerVRButton(this.vrHUDMesh, 'hud_minus10', { xMin: 0.74, xMax: 0.95, yMin: 0.58, yMax: 0.68 }, () => {
      this.app.applyManualLoad(Math.max(0, this.app.currentLoad - 10));
    });

    this.vrInteractables.push(this.vrHUDMesh);
  }

  registerVRButton(mesh, name, uvBounds, action) {
    if (!mesh.userData.buttons) mesh.userData.buttons = [];
    mesh.userData.buttons.push({ name, uvBounds, action });
  }

  cycleNextMaterial() {
    const keys = ['mild_steel', 'cast_iron', 'concrete', 'timber', 'aluminium'];
    const currentKey = this.app.currentMaterial.id;
    const nextIdx = (keys.indexOf(currentKey) + 1) % keys.length;
    this.app.selectMaterial(keys[nextIdx]);
    const sel = document.getElementById('material-select');
    if (sel) sel.value = keys[nextIdx];
  }

  setupWorldInteractables() {
    // Make 3D specimen clickable in VR
    if (this.sceneManager.specimenRack) {
      this.vrInteractables.push(this.sceneManager.specimenRack);
    }
  }

  onSelectStart(event) {
    const controller = event.target;
    this.triggerHaptic(controller, 0.4, 30);

    const intersection = this.getControllerIntersection(controller);
    if (intersection) {
      sound.playClick();
      const obj = intersection.object;

      // Check if VR HUD was clicked
      if (obj.name === 'vr_hud_panel' || (obj.parent && obj.parent.name === 'vr_hud_panel')) {
        const uv = intersection.uv;
        if (uv && this.vrHUDMesh.userData.buttons) {
          // Check which button area was touched (uv.y is inverted in canvas: canvasY = 1.0 - uv.y)
          const cy = 1.0 - uv.y;
          const cx = uv.x;
          for (const btn of this.vrHUDMesh.userData.buttons) {
            const b = btn.uvBounds;
            if (cx >= b.xMin && cx <= b.xMax && cy >= b.yMin && cy <= b.yMax) {
              this.triggerHaptic(controller, 0.8, 60);
              btn.action();
              break;
            }
          }
        }
      }
    }
  }

  onSelectEnd(event) {
    // Squeeze or select end
  }

  onSqueezeStart(event) {
    // Teleport mode activate
    const controller = event.target;
    this.isTeleportActive = true;
    this.activeTeleportController = controller;
    if (this.teleportMarker) this.teleportMarker.visible = true;
  }

  onSqueezeEnd(event) {
    if (this.isTeleportActive && this.teleportMarker && this.teleportMarker.visible) {
      // Teleport camera rig
      sound.playSafetySuccess();
      this.triggerHaptic(event.target, 0.6, 50);
      this.cameraRig.position.x = this.teleportTarget.x;
      this.cameraRig.position.z = this.teleportTarget.z;
    }
    this.isTeleportActive = false;
    if (this.teleportMarker) this.teleportMarker.visible = false;
  }

  triggerHaptic(controller, intensity = 0.5, durationMs = 40) {
    if (controller.gamepad && controller.gamepad.hapticActuators && controller.gamepad.hapticActuators.length > 0) {
      try {
        controller.gamepad.hapticActuators[0].pulse(intensity, durationMs);
      } catch (e) {}
    }
  }

  getControllerIntersection(controller) {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    const intersects = this.raycaster.intersectObjects(this.vrInteractables, true);
    return (intersects.length > 0) ? intersects[0] : null;
  }

  update(dt) {
    if (!this.isVRPresenting) return;

    // Update in-VR HUD dynamic texture
    this.renderVRHUDCanvas();
    if (this.vrHUDTexture) this.vrHUDTexture.needsUpdate = true;

    // Update Controller Laser Ray and Reticle Position
    for (const controller of this.controllers) {
      const laser = controller.getObjectByName('laser');
      const dot = controller.getObjectByName('dot');

      if (this.isTeleportActive && controller === this.activeTeleportController) {
        // Floor Raycasting for teleportation
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        // Intersect with ground plane (Y = 0)
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(plane, target)) {
          // Clamp inside lab boundary
          target.x = Math.max(-5, Math.min(5, target.x));
          target.z = Math.max(-4, Math.min(6, target.z));

          this.teleportTarget.copy(target);
          if (this.teleportMarker) {
            this.teleportMarker.position.set(target.x, 0.02, target.z);
            this.teleportMarker.visible = true;
          }

          if (dot) dot.position.z = -this.raycaster.ray.origin.distanceTo(target);
        }
      } else {
        const intersection = this.getControllerIntersection(controller);
        if (intersection) {
          if (dot) dot.position.z = -intersection.distance;
        } else {
          if (dot) dot.position.z = -4;
        }
      }
    }
  }

  renderVRHUDCanvas() {
    if (!this.vrHUDCtx || !this.vrHUDCanvas) return;
    const ctx = this.vrHUDCtx;
    const w = this.vrHUDCanvas.width;
    const h = this.vrHUDCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background Glass HUD card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 24);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Title & Status
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🥽 VR UTM TELEMETRY HUD', 40, 55);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`MATERIAL: ${this.app.currentMaterial.name.toUpperCase()}`, 40, 95);

    // Digital Gauge Values Grid
    const load = this.app.currentLoad.toFixed(2);
    const disp = this.app.currentDisplacement.toFixed(3);
    const stress = this.app.currentStress.toFixed(1);
    const strain = (this.app.currentStrain * 100).toFixed(2);

    // Tile 1: Load
    this.drawVRMetricTile(ctx, 40, 120, 220, 90, 'COMPRESSIVE LOAD', `${load} kN`, '#38bdf8');
    // Tile 2: Stress
    this.drawVRMetricTile(ctx, 280, 120, 220, 90, 'ENGINEERING STRESS', `${stress} MPa`, '#f59e0b');
    // Tile 3: Displacement
    this.drawVRMetricTile(ctx, 520, 120, 220, 90, 'DISPLACEMENT ΔL', `${disp} mm`, '#ffffff');
    // Tile 4: Strain
    this.drawVRMetricTile(ctx, 760, 120, 220, 90, 'STRAIN ε', `${strain} %`, '#22c55e');

    // Mini Live Stress-Strain Graph Area (Y: 230 to 490)
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, 230, 940, 270, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('LIVE STRESS (σ) vs. STRAIN (ε) DYNAMIC CURVE', 60, 260);

    // Draw curve inside graph box
    const pts = this.app.chart.dataPoints;
    const maxStrain = this.app.chart.options.maxStrain;
    const maxStress = this.app.chart.options.maxStress;
    const gw = 880;
    const gh = 200;
    const gx = 70;
    const gy = 280;

    if (pts.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.5;
      for (let i = 0; i < pts.length; i++) {
        const px = gx + (pts[i].strain / maxStrain) * gw;
        const py = gy + gh - (pts[i].stress / maxStress) * gh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Manual Load In-VR Step Row (Y: 510 to 570)
    this.drawVRButton(ctx, 40, 510, 210, 60, '+10 kN', '#1e293b', '#38bdf8', true);
    this.drawVRButton(ctx, 270, 510, 210, 60, '+25 kN', '#1e293b', '#38bdf8', true);
    this.drawVRButton(ctx, 500, 510, 210, 60, '+50 kN', '#1e293b', '#38bdf8', true);
    this.drawVRButton(ctx, 730, 510, 250, 60, '-10 kN (Unload)', '#1e293b', '#f59e0b', true);

    // Secondary Interactive Row (Tare, Capture, Next Material) (Y: 585 to 645)
    this.drawVRButton(ctx, 40, 585, 300, 60, '⚖️ TARE GAUGES', '#1e293b', '#cbd5e1');
    this.drawVRButton(ctx, 360, 585, 300, 60, '📸 CAPTURE POINT', '#0284c7', '#ffffff');
    this.drawVRButton(ctx, 680, 585, 300, 60, '🔄 NEXT MATERIAL', '#334155', '#38bdf8');

    // Primary Control Row (Start Auto, Pause, E-Stop) (Y: 660 to 735)
    const isRunning = this.app.state.isTestRunning;
    this.drawVRButton(ctx, 40, 660, 440, 75, isRunning ? '⚡ COMPRESSING...' : '⚡ AUTO RUN TEST', isRunning ? '#15803d' : '#0284c7', '#ffffff', true);
    this.drawVRButton(ctx, 500, 660, 220, 75, this.app.state.isTestPaused ? '▶ RESUME' : '⏸ PAUSE', '#d97706', '#ffffff');
    this.drawVRButton(ctx, 740, 660, 240, 75, '🛑 E-STOP', '#dc2626', '#ffffff', true);
  }

  drawVRMetricTile(ctx, x, y, w, h, label, val, color) {
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(label, x + 14, y + 26);

    ctx.fillStyle = color;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(val, x + 14, y + 66);
  }

  drawVRButton(ctx, x, y, w, h, text, bgCol, textCol, isBold = false) {
    ctx.fillStyle = bgCol;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textCol;
    ctx.font = isBold ? 'bold 22px Inter, sans-serif' : 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 7);
    ctx.textAlign = 'left';
  }
}
