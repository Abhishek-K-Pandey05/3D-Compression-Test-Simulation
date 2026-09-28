import * as THREE from 'three';

export class SpecimenManager {
  constructor(scene) {
    this.scene = scene;
    this.materialDef = null;
    this.initialHeight = 30.0; // mm (in world units: 1 unit = 10 mm, so 3.0 units)
    this.initialDiameter = 15.0; // mm (1.5 units)
    this.scaleFactor = 0.1; // 1mm = 0.1 Three.js units

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.mesh = null;
    this.shearGroup = null;
    this.upperShearMesh = null;
    this.lowerShearMesh = null;
    this.particles = null;

    this.isHeatmapMode = false;
    this.isFractured = false;
    this.currentStrain = 0.0;

    // Base geometry storage for deformation
    this.basePositions = null;
    this.radialSegs = 48;
    this.heightSegs = 48;

    this.initParticleSystem();
  }

  setMaterial(materialDef, heightMm = 30.0, diameterMm = 15.0) {
    this.materialDef = materialDef;
    this.initialHeight = heightMm;
    this.initialDiameter = diameterMm;
    this.isFractured = false;
    this.currentStrain = 0.0;

    this.buildSpecimenMesh();
  }

  buildSpecimenMesh() {
    // Clean up existing meshes
    if (this.mesh) {
      this.group.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.shearGroup) {
      this.group.remove(this.shearGroup);
      this.shearGroup = null;
    }

    const radius = (this.initialDiameter / 2.0) * this.scaleFactor;
    const height = this.initialHeight * this.scaleFactor;

    // Create dense cylinder geometry for smooth barrelling deformation
    const geom = new THREE.CylinderGeometry(radius, radius, height, this.radialSegs, this.heightSegs, false);
    
    // Store original vertex coordinates
    this.basePositions = new Float32Array(geom.attributes.position.array);

    // Create material
    const mat = this.createMaterialInstance();

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    // Base of specimen sits on lower platen at Y = 0.925
    this.mesh.position.y = height / 2.0;

    // Register with 3D Inspector
    if (this.materialDef) {
      this.mesh.userData.componentMeta = {
        category: 'COMPRESSION TEST SPECIMEN',
        name: `${this.materialDef.name} Specimen`,
        description: `Dimensions: Ø${this.initialDiameter.toFixed(1)}mm × H${this.initialHeight.toFixed(1)}mm (A₀ = ${((Math.PI * Math.pow(this.initialDiameter, 2))/4).toFixed(1)} mm²). ${this.materialDef.description}`
      };
    }

    this.group.add(this.mesh);
    this.group.visible = true;
  }

  createMaterialInstance() {
    const matDef = this.materialDef;
    if (this.isHeatmapMode) {
      return new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.4,
        metalness: 0.2
      });
    }

    if (!matDef) {
      return new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.8 });
    }

    // Generate procedural canvas texture for rich surface detail
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (matDef.id === 'cast_iron') {
      ctx.fillStyle = '#4b5056';
      ctx.fillRect(0, 0, 512, 512);
      // Graphite flake speckles
      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const grey = Math.floor(Math.random() * 40 + 35);
        ctx.fillStyle = `rgb(${grey},${grey},${grey})`;
        ctx.fillRect(x, y, Math.random() * 2 + 1, Math.random() * 2 + 1);
      }
    } else if (matDef.id === 'concrete') {
      ctx.fillStyle = '#8f887d';
      ctx.fillRect(0, 0, 512, 512);
      // Aggregate gravel flecks
      for (let i = 0; i < 1500; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = Math.random() * 4 + 1;
        ctx.fillStyle = Math.random() > 0.5 ? '#5c5448' : '#b8b2a7';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (matDef.id === 'timber') {
      ctx.fillStyle = '#a6723e';
      ctx.fillRect(0, 0, 512, 512);
      // Longitudinal wood grain lines
      ctx.strokeStyle = '#6f4821';
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * 512;
        ctx.lineWidth = Math.random() * 2 + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 10, 150, x - 10, 350, x + 5, 512);
        ctx.stroke();
      }
    } else {
      // Mild steel / Aluminium fine lathe machining marks
      ctx.fillStyle = (matDef.id === 'aluminium') ? '#d0d7de' : '#88919b';
      ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 4) {
        ctx.fillStyle = (y % 8 === 0) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(0, y, 512, 2);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);

    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: matDef.roughness,
      metalness: matDef.metalness,
      color: 0xffffff
    });
  }

  // Update real-time deformation based on strain
  updateDeformation(strain, stressRatio = 0.0) {
    this.currentStrain = strain;
    if (!this.mesh || !this.basePositions) return;

    const h0 = this.initialHeight * this.scaleFactor;
    const r0 = (this.initialDiameter / 2.0) * this.scaleFactor;
    const currentHeight = h0 * Math.max(0.05, 1.0 - strain);

    const positions = this.mesh.geometry.attributes.position.array;
    const count = this.basePositions.length / 3;

    // Barrelling coefficient
    const frictionFactor = (this.materialDef && this.materialDef.frictionFactor) ? this.materialDef.frictionFactor : 0.35;
    // Theoretical volume conservation multiplier: sqrt(1 / (1 - strain))
    const volExpansion = Math.sqrt(1.0 / Math.max(0.05, 1.0 - strain)) - 1.0;

    for (let i = 0; i < count; i++) {
      const bx = this.basePositions[i * 3];
      const by = this.basePositions[i * 3 + 1]; // original Y in [-h0/2, h0/2]
      const bz = this.basePositions[i * 3 + 2];

      const normY = by / (h0 / 2.0); // in [-1, 1]
      // Deformed Y
      const newY = normY * (currentHeight / 2.0);

      // Barrelling profile: parabolic factor (1 - normY^2) gives zero expansion at platen ends (normY = +/- 1) and max at mid-height (normY = 0)
      const barrelFactor = 1.0 + (frictionFactor * 2.2 * volExpansion + (1 - frictionFactor) * volExpansion) * (1.0 - 0.75 * Math.pow(normY, 2));

      positions[i * 3] = bx * barrelFactor;
      positions[i * 3 + 1] = newY;
      positions[i * 3 + 2] = bz * barrelFactor;
    }

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();

    // Keep bottom flat on lower platen Y = 0
    this.mesh.position.y = currentHeight / 2.0;

    // Stress heatmap coloring update
    if (this.isHeatmapMode && this.mesh.material) {
      // Interpolate from blue (low stress) -> green -> yellow -> red (high stress)
      const r = Math.min(1, Math.max(0, stressRatio * 1.5 - 0.3));
      const g = Math.min(1, Math.max(0, 1.0 - Math.abs(stressRatio - 0.5) * 1.8));
      const b = Math.min(1, Math.max(0, 1.0 - stressRatio * 1.6));
      this.mesh.material.color.setRGB(r, g, b);
    }
  }

  // Trigger brittle shear failure (Grey Cast Iron)
  triggerShearFracture() {
    if (this.isFractured) return;
    this.isFractured = true;

    // Hide uniform mesh
    if (this.mesh) this.mesh.visible = false;

    // Create two shear fracture pieces sliding along a 52-degree plane
    this.shearGroup = new THREE.Group();
    const radius = (this.initialDiameter / 2.0) * this.scaleFactor;
    const height = this.initialHeight * this.scaleFactor * (1 - this.currentStrain);

    const angleRad = (52 * Math.PI) / 180;
    const shearMat = this.createMaterialInstance();

    // Upper shear half
    const upperGeom = new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, height / 2, this.radialSegs, 16);
    this.upperShearMesh = new THREE.Mesh(upperGeom, shearMat);
    this.upperShearMesh.position.set(0.08, height * 0.72, 0.04);
    this.upperShearMesh.rotation.z = 0.12;
    this.upperShearMesh.castShadow = true;

    // Lower shear half
    const lowerGeom = new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, height / 2, this.radialSegs, 16);
    this.lowerShearMesh = new THREE.Mesh(lowerGeom, shearMat);
    this.lowerShearMesh.position.set(-0.06, height * 0.24, -0.03);
    this.lowerShearMesh.rotation.z = -0.06;
    this.lowerShearMesh.castShadow = true;

    this.shearGroup.add(this.upperShearMesh);
    this.shearGroup.add(this.lowerShearMesh);
    this.group.add(this.shearGroup);

    // Emit brittle fracture dust shards
    this.emitParticles(35, this.mesh.position.y);
  }

  // Trigger concrete crushing / spalling
  triggerConcreteCrushing() {
    if (this.isFractured) return;
    this.isFractured = true;

    this.emitParticles(80, this.mesh.position.y);
  }

  initParticleSystem() {
    const pCount = 150;
    const pGeom = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    const pVelocities = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      pPositions[i * 3] = 0;
      pPositions[i * 3 + 1] = -100; // Hidden below
      pPositions[i * 3 + 2] = 0;

      pVelocities[i * 3] = 0;
      pVelocities[i * 3 + 1] = 0;
      pVelocities[i * 3 + 2] = 0;
    }

    pGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    this.particleVelocities = pVelocities;
    this.particleLifetimes = new Float32Array(pCount);

    const pMat = new THREE.PointsMaterial({
      color: 0x9e988e,
      size: 0.045,
      transparent: true,
      opacity: 0.85
    });

    this.particles = new THREE.Points(pGeom, pMat);
    this.scene.add(this.particles);
  }

  emitParticles(count, originY) {
    if (!this.particles) return;
    const pos = this.particles.geometry.attributes.position.array;
    const vel = this.particleVelocities;
    const life = this.particleLifetimes;

    const n = Math.min(count, 150);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = originY + (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

      vel[i * 3] = (Math.random() - 0.5) * 0.8;
      vel[i * 3 + 1] = Math.random() * 0.6 + 0.2;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

      life[i] = 1.0;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
  }

  updateParticles(dt) {
    if (!this.particles) return;
    const pos = this.particles.geometry.attributes.position.array;
    const vel = this.particleVelocities;
    const life = this.particleLifetimes;
    let needsUpdate = false;

    for (let i = 0; i < 150; i++) {
      if (life[i] > 0) {
        life[i] -= dt * 0.8;
        vel[i * 3 + 1] -= 9.8 * 0.1 * dt; // Gravity

        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

        // Bounce on floor platen
        if (pos[i * 3 + 1] < 0.02) {
          pos[i * 3 + 1] = 0.02;
          vel[i * 3 + 1] = -vel[i * 3 + 1] * 0.3;
          vel[i * 3] *= 0.7;
          vel[i * 3 + 2] *= 0.7;
        }
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  toggleHeatmap(val) {
    this.isHeatmapMode = (val !== undefined) ? val : !this.isHeatmapMode;
    if (this.mesh) {
      this.mesh.material = this.createMaterialInstance();
    }
  }

  getCurrentHeightMm() {
    return this.initialHeight * (1.0 - this.currentStrain);
  }

  reset() {
    this.isFractured = false;
    this.currentStrain = 0.0;
    if (this.mesh) {
      this.mesh.visible = true;
    }
    if (this.shearGroup) {
      this.group.remove(this.shearGroup);
      this.shearGroup = null;
    }
    this.updateDeformation(0.0);
  }
}
