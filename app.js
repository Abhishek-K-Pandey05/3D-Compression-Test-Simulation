/**
 * Antigravity UTM Compression Test Virtual Laboratory - Master Application
 * Coordinates 3D Scene, Specimen Physics, Vernier Caliper, Dynamic Chart, Safety Supervisor & Notebook.
 */

import { MATERIALS, Mechanics } from './materials.js';
import { LabScene } from './scene.js';
import { SpecimenManager } from './specimen.js';
import { VernierCaliperTool } from './caliper.js';
import { StressStrainChart } from './chart.js';
import { SupervisorSafetySystem } from './supervisor.js';
import { LabNotebook } from './notebook.js';
import { VRManager } from './vr.js';
import { sound } from './audio.js';

class UTMLabApplication {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 8;
    this.mode = 'guided'; // 'guided', 'free', 'quiz'

    // Selected material & specimen parameters
    this.currentMaterial = MATERIALS.mild_steel;
    this.initialHeight = 30.0; // mm
    this.initialDiameter = 15.0; // mm
    this.initialArea = Mechanics.initialArea(15.0);

    // Procedural Lab Protocol State
    this.state = {
      materialSelected: true,
      platensCleaned: false,
      dimensionsMeasured: false,
      specimenPlaced: false,
      crossheadSeated: false,
      shieldClosed: false,
      supervisorApproved: false,
      gaugesZeroed: false,
      isTestRunning: false,
      isTestPaused: false,
      isTestCompleted: false,
      emergencyStopped: false
    };

    // Live Test Dynamic Variables
    this.testRate = 1.0; // mm/min crosshead speed
    this.currentDisplacement = 0.0; // mm
    this.currentStrain = 0.0;
    this.currentStress = 0.0; // MPa
    this.currentLoad = 0.0; // kN
    this.peakStress = 0.0;
    this.peakLoad = 0.0;
    this.testTime = 0.0; // seconds
    this.yieldDetected = false;
    this.failureDetected = false;

    // Crosshead jog position
    this.crossheadPosMm = 38.0; // 8 mm clearance initially

    // Subsystems
    this.scene = null;
    this.specimen = null;
    this.caliper = null;
    this.chart = null;
    this.supervisor = null;
    this.notebook = null;

    this.lastFrameTime = performance.now();
  }

  init() {
    // 1. Initialize 3D Scene
    this.scene = new LabScene('viewport-3d-container');

    // 2. Initialize 3D Specimen Manager
    this.specimen = new SpecimenManager(this.scene.scene);
    this.specimen.setMaterial(this.currentMaterial, this.initialHeight, this.initialDiameter);
    if (this.specimen.mesh) {
      this.scene.registerInspectable(this.specimen.mesh, this.specimen.mesh.userData.componentMeta);
    }

    // 3. Initialize Dynamic Stress-Strain Chart
    this.chart = new StressStrainChart('stress-strain-canvas');
    this.chart.setMaterialLimits(this.currentMaterial);

    // 4. Initialize Vernier Caliper Tool
    this.caliper = new VernierCaliperTool({
      container: document.getElementById('caliper-modal'),
      onDimensionRecorded: (dims) => this.handleDimensionsRecorded(dims)
    });
    this.caliper.setSpecimen(this.currentMaterial, this.initialHeight, this.initialDiameter);

    // 5. Initialize Supervisor Safety System
    this.supervisor = new SupervisorSafetySystem({
      container: document.getElementById('safety-modal'),
      onApprovalGranted: () => this.handleSupervisorApproval()
    });

    // 6. Initialize Virtual Lab Notebook
    this.notebook = new LabNotebook({
      container: document.getElementById('notebook-modal'),
      reportContainer: document.getElementById('report-modal')
    });
    this.notebook.setSpecimen(this.currentMaterial, this.initialHeight, this.initialDiameter);

    // 7. Initialize Full WebXR VR Subsystem
    this.vr = new VRManager(this.scene, this);

    // 8. Bind UI Events & Controls
    this.bindUIEvents();
    this.updateStepUI();
    this.updateMaterialDisplay();

    // 9. Start Render / Physics Loop
    this.scene.render((time) => this.onFrame(time));
  }

  bindUIEvents() {
    // Material Selector Dropdown / Radio Buttons
    const matSelect = document.getElementById('material-select');
    if (matSelect) {
      matSelect.addEventListener('change', (e) => {
        sound.playClick();
        this.selectMaterial(e.target.value);
      });
    }

    // Camera Preset Buttons
    document.querySelectorAll('[data-cam]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sound.playClick();
        const preset = e.currentTarget.getAttribute('data-cam');
        this.scene.setCameraPreset(preset);
        document.querySelectorAll('[data-cam]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        if (this.scene.controls.autoRotate) {
          this.scene.controls.autoRotate = false;
          const autoBtn = document.getElementById('btn-toggle-autorotate');
          if (autoBtn) autoBtn.classList.remove('active');
        }
      });
    });

    const autoRotateBtn = document.getElementById('btn-toggle-autorotate');
    if (autoRotateBtn) {
      autoRotateBtn.addEventListener('click', () => {
        sound.playClick();
        this.scene.controls.autoRotate = !this.scene.controls.autoRotate;
        this.scene.controls.autoRotateSpeed = 2.0;
        autoRotateBtn.classList.toggle('active', this.scene.controls.autoRotate);
      });
    }

    // Audio & Viewport Toggles
    const muteBtn = document.getElementById('btn-toggle-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        muteBtn.classList.toggle('active', isMuted);
      });
    }

    const heatmapToggle = document.getElementById('btn-toggle-heatmap');
    if (heatmapToggle) {
      heatmapToggle.addEventListener('click', () => {
        sound.playClick();
        this.specimen.toggleHeatmap();
        heatmapToggle.classList.toggle('active', this.specimen.isHeatmapMode);
      });
    }

    const trueStressToggle = document.getElementById('btn-toggle-truestress');
    if (trueStressToggle) {
      trueStressToggle.addEventListener('click', () => {
        sound.playClick();
        this.chart.toggleTrueStress();
        trueStressToggle.classList.toggle('active', this.chart.options.showTrueStress);
      });
    }

    // Step-by-Step Interactive Action Buttons
    const btnCleanPlatens = document.getElementById('btn-clean-platens');
    if (btnCleanPlatens) {
      btnCleanPlatens.addEventListener('click', () => this.actionCleanPlatens());
    }

    const btnOpenCaliper = document.getElementById('btn-open-caliper');
    if (btnOpenCaliper) {
      btnOpenCaliper.addEventListener('click', () => {
        sound.playClick();
        this.scene.setCameraPreset('caliper');
        this.caliper.open();
      });
    }

    const btnPlaceSpecimen = document.getElementById('btn-place-specimen');
    if (btnPlaceSpecimen) {
      btnPlaceSpecimen.addEventListener('click', () => this.actionPlaceSpecimen());
    }

    const btnJogDown = document.getElementById('btn-jog-down');
    if (btnJogDown) {
      btnJogDown.addEventListener('click', () => this.actionJogCrosshead('down'));
    }

    const btnJogUp = document.getElementById('btn-jog-up');
    if (btnJogUp) {
      btnJogUp.addEventListener('click', () => this.actionJogCrosshead('up'));
    }

    const btnAutoSeat = document.getElementById('btn-auto-seat');
    if (btnAutoSeat) {
      btnAutoSeat.addEventListener('click', () => this.actionAutoSeatCrosshead());
    }

    const btnToggleShield = document.getElementById('btn-toggle-shield');
    if (btnToggleShield) {
      btnToggleShield.addEventListener('click', () => this.actionToggleShield());
    }

    const btnOpenSafety = document.getElementById('btn-open-safety');
    if (btnOpenSafety) {
      btnOpenSafety.addEventListener('click', () => {
        sound.playClick();
        this.supervisor.updateSystemStatus({
          platensCleaned: this.state.platensCleaned,
          specimenCentered: this.state.specimenPlaced,
          dimensionsLogged: this.state.dimensionsMeasured,
          zeroClearanceSet: this.state.crossheadSeated,
          blastShieldClosed: this.state.shieldClosed
        });
        this.supervisor.open();
      });
    }

    const btnTare = document.getElementById('btn-tare-gauges');
    if (btnTare) {
      btnTare.addEventListener('click', () => this.actionTareGauges());
    }

    // Main Test Machine Controls
    const btnStartTest = document.getElementById('btn-start-test');
    if (btnStartTest) {
      btnStartTest.addEventListener('click', () => this.startCompressionTest());
    }

    const btnPauseTest = document.getElementById('btn-pause-test');
    if (btnPauseTest) {
      btnPauseTest.addEventListener('click', () => this.pauseCompressionTest());
    }

    const btnEStop = document.getElementById('btn-estop');
    if (btnEStop) {
      btnEStop.addEventListener('click', () => this.triggerEmergencyStop());
    }

    const btnCapturePoint = document.getElementById('btn-capture-point');
    if (btnCapturePoint) {
      btnCapturePoint.addEventListener('click', () => this.captureDataPoint());
    }

    const btnOpenNotebook = document.getElementById('btn-open-notebook');
    if (btnOpenNotebook) {
      btnOpenNotebook.addEventListener('click', () => {
        sound.playClick();
        this.notebook.openNotebook();
      });
    }

    const btnResetAll = document.getElementById('btn-reset-all');
    if (btnResetAll) {
      btnResetAll.addEventListener('click', () => this.resetSimulation());
    }

    // Loading mode (manual vs auto)
    this.loadingMode = 'manual'; // 'manual' or 'auto'

    // Manual Load Entry Event Listeners
    const btnModeManual = document.getElementById('btn-mode-manual-load');
    const btnModeAuto = document.getElementById('btn-mode-auto-load');
    const panelManual = document.getElementById('manual-load-controls-panel');
    const panelAuto = document.getElementById('auto-load-controls-panel');

    if (btnModeManual && btnModeAuto) {
      btnModeManual.addEventListener('click', () => {
        sound.playClick();
        this.loadingMode = 'manual';
        btnModeManual.classList.add('active');
        btnModeAuto.classList.remove('active');
        if (panelManual) panelManual.style.display = 'block';
        if (panelAuto) panelAuto.style.display = 'none';
        const startBtn = document.getElementById('btn-start-test');
        if (startBtn) startBtn.style.display = 'none';
      });

      btnModeAuto.addEventListener('click', () => {
        sound.playClick();
        this.loadingMode = 'auto';
        btnModeAuto.classList.add('active');
        btnModeManual.classList.remove('active');
        if (panelAuto) panelAuto.style.display = 'block';
        if (panelManual) panelManual.style.display = 'none';
        const startBtn = document.getElementById('btn-start-test');
        if (startBtn) startBtn.style.display = 'block';
      });
    }

    // Direct Manual Load Input Apply Button
    const btnApplyManual = document.getElementById('btn-apply-manual-load');
    const manualInput = document.getElementById('manual-load-input');
    const manualSlider = document.getElementById('manual-load-slider');

    if (btnApplyManual && manualInput) {
      btnApplyManual.addEventListener('click', () => {
        const val = parseFloat(manualInput.value) || 0;
        this.applyManualLoad(val);
      });

      manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = parseFloat(manualInput.value) || 0;
          this.applyManualLoad(val);
        }
      });
    }

    // Manual Load Step Buttons (+5, +10, +25, +50, +100, -10)
    document.querySelectorAll('.load-step-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sound.playClick();
        const step = parseFloat(e.currentTarget.getAttribute('data-step')) || 0;
        const newLoad = Math.max(0, this.currentLoad + step);
        if (manualInput) manualInput.value = newLoad.toFixed(1);
        if (manualSlider) manualSlider.value = newLoad;
        this.applyManualLoad(newLoad);
      });
    });

    // Manual Load Slider
    if (manualSlider) {
      manualSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        if (manualInput) manualInput.value = val.toFixed(1);
        this.applyManualLoad(val);
      });
    }

    // Mode Selector (Guided vs Free vs Quiz)
    const modeTabs = document.querySelectorAll('[data-mode]');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        sound.playClick();
        const m = e.currentTarget.getAttribute('data-mode');
        this.setAppMode(m);
        modeTabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Quiz submission
    const quizSubmit = document.getElementById('btn-submit-quiz');
    if (quizSubmit) {
      quizSubmit.addEventListener('click', () => this.evaluateQuiz());
    }
  }

  selectMaterial(materialKey) {
    if (this.state.isTestRunning) return;
    this.currentMaterial = MATERIALS[materialKey] || MATERIALS.mild_steel;
    this.initialHeight = this.currentMaterial.recommendedHeight;
    this.initialDiameter = this.currentMaterial.recommendedDiameter;
    this.initialArea = Mechanics.initialArea(this.initialDiameter);

    this.specimen.setMaterial(this.currentMaterial, this.initialHeight, this.initialDiameter);
    if (this.specimen.mesh) {
      this.scene.registerInspectable(this.specimen.mesh, this.specimen.mesh.userData.componentMeta);
    }
    this.caliper.setSpecimen(this.currentMaterial, this.initialHeight, this.initialDiameter);
    this.chart.setMaterialLimits(this.currentMaterial);
    this.notebook.setSpecimen(this.currentMaterial, this.initialHeight, this.initialDiameter);

    this.updateMaterialDisplay();
  }

  updateMaterialDisplay() {
    const m = this.currentMaterial;
    const titleEl = document.getElementById('disp-mat-title');
    const catEl = document.getElementById('disp-mat-cat');
    const descEl = document.getElementById('disp-mat-desc');
    const notesEl = document.getElementById('disp-mat-notes');

    if (titleEl) titleEl.textContent = m.name;
    if (catEl) catEl.textContent = m.category;
    if (descEl) descEl.textContent = m.description;
    if (notesEl) notesEl.textContent = m.theoreticalNotes;
  }

  // --- Step 2: Clean Platens ---
  actionCleanPlatens() {
    sound.playClick();
    this.scene.setCameraPreset('specimen');

    const btn = document.getElementById('btn-clean-platens');
    if (btn) {
      btn.innerHTML = '⏳ Cleaning Platens with Degreaser...';
      btn.disabled = true;
    }

    setTimeout(() => {
      this.state.platensCleaned = true;
      sound.playSafetySuccess();
      if (btn) {
        btn.innerHTML = '✅ Platens Pristine & Clean';
        btn.classList.add('btn-success');
      }
      this.advanceStep(3);
    }, 1000);
  }

  // --- Step 3: Handle Caliper Measurement ---
  handleDimensionsRecorded(dims) {
    if (dims.diameter && dims.height) {
      this.initialDiameter = dims.diameter;
      this.initialHeight = dims.height;
      this.initialArea = Mechanics.initialArea(dims.diameter);

      this.state.dimensionsMeasured = true;
      this.specimen.setMaterial(this.currentMaterial, this.initialHeight, this.initialDiameter);
      this.notebook.setSpecimen(this.currentMaterial, this.initialHeight, this.initialDiameter);

      const dBadge = document.getElementById('hud-d0-val');
      const hBadge = document.getElementById('hud-h0-val');
      const aBadge = document.getElementById('hud-a0-val');

      if (dBadge) dBadge.textContent = `${this.initialDiameter.toFixed(2)} mm`;
      if (hBadge) hBadge.textContent = `${this.initialHeight.toFixed(2)} mm`;
      if (aBadge) aBadge.textContent = `${this.initialArea.toFixed(2)} mm²`;

      this.advanceStep(4);
    }
  }

  // --- Step 4: Place Specimen ---
  actionPlaceSpecimen() {
    sound.playPlatenContact();
    this.scene.setCameraPreset('specimen');
    this.state.specimenPlaced = true;

    const btn = document.getElementById('btn-place-specimen');
    if (btn) {
      btn.innerHTML = '✅ Specimen Concentrically Centered (±0.2mm)';
      btn.classList.add('btn-success');
      btn.disabled = true;
    }

    this.advanceStep(5);
  }

  // --- Step 5: Crosshead Jogging & Seating ---
  actionJogCrosshead(dir) {
    sound.playCaliperSlide();
    const step = (dir === 'down') ? -1.0 : 1.0;
    const targetHeight = this.initialHeight; // The specimen top is at this height

    this.crossheadPosMm = Math.max(targetHeight, Math.min(50.0, this.crossheadPosMm + step));
    this.scene.setCrossheadHeight(this.crossheadPosMm);

    if (Math.abs(this.crossheadPosMm - targetHeight) < 0.1) {
      this.seatCrossheadSuccess();
    }
  }

  actionAutoSeatCrosshead() {
    sound.playPlatenContact();
    this.crossheadPosMm = this.initialHeight;
    this.scene.setCrossheadHeight(this.crossheadPosMm);
    this.seatCrossheadSuccess();
  }

  seatCrossheadSuccess() {
    this.state.crossheadSeated = true;
    sound.playPlatenContact();

    const seatBadge = document.getElementById('seat-status-badge');
    if (seatBadge) {
      seatBadge.textContent = 'Zero Clearance Seated (Touch Contact)';
      seatBadge.className = 'badge success';
    }

    const btnAuto = document.getElementById('btn-auto-seat');
    if (btnAuto) {
      btnAuto.innerHTML = '✅ Platen Seated (P = 0.05 kN)';
      btnAuto.disabled = true;
    }

    this.advanceStep(6);
  }

  // --- Step 6: Safety Shield & Supervisor ---
  actionToggleShield() {
    sound.playClick();
    this.state.shieldClosed = !this.state.shieldClosed;
    this.scene.setSafetyDoor(this.state.shieldClosed);

    const btn = document.getElementById('btn-toggle-shield');
    if (btn) {
      btn.innerHTML = this.state.shieldClosed ? '🔒 Blast Shield Closed & Interlocked' : '🔓 Slide Shield Closed';
      btn.classList.toggle('btn-success', this.state.shieldClosed);
    }
  }

  handleSupervisorApproval() {
    this.state.supervisorApproved = true;
    sound.playSafetySuccess();

    const safetyBadge = document.getElementById('supervisor-status-badge');
    if (safetyBadge) {
      safetyBadge.textContent = 'Supervisor Green-Light: AUTHORIZED';
      safetyBadge.className = 'badge success pulse';
    }

    const btnSafety = document.getElementById('btn-open-safety');
    if (btnSafety) {
      btnSafety.innerHTML = '✅ Supervisor Green-Light Registered';
      btnSafety.classList.add('btn-success');
    }

    this.advanceStep(7);
  }

  // --- Step 7: Tare Gauges ---
  actionTareGauges() {
    sound.playClick();
    this.state.gaugesZeroed = true;
    this.scene.resetDialPeak();

    const tareBadge = document.getElementById('tare-status-badge');
    if (tareBadge) {
      tareBadge.textContent = 'Load Cell & LVDT Zeroed (0.00 kN)';
      tareBadge.className = 'badge success';
    }

    const btnTare = document.getElementById('btn-tare-gauges');
    if (btnTare) {
      btnTare.innerHTML = '✅ Gauges Zeroed & Calibrated';
      btnTare.classList.add('btn-success');
      btnTare.disabled = true;
    }

    this.advanceStep(8);
  }

  // --- Manual Compressive Load Entry Method ---
  applyManualLoad(loadKN) {
    if (!this.state.supervisorApproved && this.mode === 'guided') {
      sound.playAlert();
      alert('Safety Interlock Active! Please complete the Step 6 Lab Supervisor Safety Green-Light before applying load.');
      return;
    }

    sound.ensureContext();
    const clampedLoad = Math.max(0, Math.min(1000, loadKN));
    this.currentLoad = clampedLoad;
    this.currentStress = Mechanics.engineeringStress(this.currentLoad, this.initialArea);
    this.currentStrain = this.currentMaterial.getStrainFromStress ? this.currentMaterial.getStrainFromStress(this.currentStress) : (this.currentStress / (this.currentMaterial.youngsModulus * 1000));
    this.currentDisplacement = this.currentStrain * this.initialHeight;

    if (this.currentStress > this.peakStress) {
      this.peakStress = this.currentStress;
      this.peakLoad = this.currentLoad;
    }

    // Play subtle hydraulic load hiss / motor tone
    sound.updatePumpLoad(this.currentLoad / (this.currentMaterial.ultimateCompressiveStrength * this.initialArea / 1000.0));

    // Yield Point Check
    const elasticLimit = this.currentMaterial.yieldStrength / (this.currentMaterial.youngsModulus * 1000);
    if (!this.yieldDetected && this.currentStrain >= elasticLimit) {
      this.yieldDetected = true;
      sound.playYieldCreak();
      this.chart.addMilestone('yield', this.currentStrain, this.currentStress, `Yield Point (${this.currentMaterial.yieldStrength} MPa)`);
      this.showToast(`⚡ Yield Point Reached at P = ${this.currentLoad.toFixed(1)} kN (σ = ${this.currentStress.toFixed(1)} MPa)!`);
    }

    // Check Ultimate Compressive Failure
    const maxCapacityLoad = (this.currentMaterial.ultimateCompressiveStrength * this.initialArea) / 1000.0;
    if (!this.failureDetected && this.currentLoad >= maxCapacityLoad * 0.99) {
      this.handleSpecimenFailure();
    } else {
      // Normal Deformation Update
      const stressRatio = Math.min(1.0, this.currentStress / this.currentMaterial.ultimateCompressiveStrength);
      this.specimen.updateDeformation(this.currentStrain, stressRatio);
      this.scene.setCrossheadHeight(this.specimen.getCurrentHeightMm());
      this.scene.setDialLoad(this.currentLoad);
    }

    // Update Dynamic Stress-Strain Chart
    const point = {
      strain: this.currentStrain,
      stress: this.currentStress,
      trueStress: Mechanics.trueStress(this.currentStress, this.currentStrain),
      load: this.currentLoad,
      displacement: this.currentDisplacement,
      time: this.testTime += 0.5
    };
    this.chart.addPoint(point);
    this.notebook.logDataPoint(point);

    this.updateHUDReadouts();
  }

  // --- Step 8: Compression Test Execution ---
  startCompressionTest() {
    if (!this.state.supervisorApproved && this.mode === 'guided') {
      sound.playAlert();
      alert('Safety Interlock Active! Lab Supervisor must green-light the machine setup in Step 6 before hydraulic pump activation.');
      return;
    }

    if (this.state.isTestCompleted) {
      this.resetSimulation();
    }

    sound.ensureContext();
    sound.startHydraulicPump();
    sound.playClick();

    this.state.isTestRunning = true;
    this.state.isTestPaused = false;
    this.chart.isLive = true;

    this.scene.setCameraPreset('specimen');

    const startBtn = document.getElementById('btn-start-test');
    const pauseBtn = document.getElementById('btn-pause-test');
    const estopBtn = document.getElementById('btn-estop');

    if (startBtn) {
      startBtn.innerHTML = '⚡ Compressing Specimen...';
      startBtn.classList.add('active');
      startBtn.disabled = true;
    }
    if (pauseBtn) pauseBtn.disabled = false;
    if (estopBtn) estopBtn.disabled = false;
  }

  pauseCompressionTest() {
    if (!this.state.isTestRunning) return;
    this.state.isTestPaused = !this.state.isTestPaused;
    sound.playClick();

    if (this.state.isTestPaused) {
      sound.stopHydraulicPump();
    } else {
      sound.startHydraulicPump();
    }

    const pauseBtn = document.getElementById('btn-pause-test');
    if (pauseBtn) {
      pauseBtn.innerHTML = this.state.isTestPaused ? '▶ Resume Test' : '⏸ Pause Test';
      pauseBtn.classList.toggle('btn-warning', this.state.isTestPaused);
    }
  }

  triggerEmergencyStop() {
    sound.playAlert();
    sound.stopHydraulicPump();

    this.state.isTestRunning = false;
    this.state.emergencyStopped = true;
    this.chart.isLive = false;

    const startBtn = document.getElementById('btn-start-test');
    const estopBtn = document.getElementById('btn-estop');

    if (startBtn) {
      startBtn.innerHTML = '🛑 E-STOP ACTIVATED';
      startBtn.disabled = true;
    }
    if (estopBtn) {
      estopBtn.classList.add('e-stopped');
    }

    alert('EMERGENCY STOP (E-STOP) ACTIVATED! Hydraulic power cut off immediately.');
  }

  captureDataPoint() {
    sound.playClick();
    const pt = {
      strain: this.currentStrain,
      stress: this.currentStress,
      trueStress: Mechanics.trueStress(this.currentStress, this.currentStrain),
      load: this.currentLoad,
      displacement: this.currentDisplacement,
      time: this.testTime
    };

    this.chart.captureCurrentPoint();
    this.notebook.logDataPoint({ ...pt, isCaptured: true });

    // Flash toast notification
    this.showToast(`📸 Captured Point: Load = ${this.currentLoad.toFixed(2)} kN, σ = ${this.currentStress.toFixed(1)} MPa`);
  }

  showToast(msg) {
    let toast = document.getElementById('lab-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lab-toast';
      toast.className = 'lab-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // --- Real-time Physics & Animation Frame ---
  onFrame(time) {
    const dt = Math.min(0.05, (performance.now() - this.lastFrameTime) / 1000.0);
    this.lastFrameTime = performance.now();

    // Update particle physics
    this.specimen.updateParticles(dt);

    // Update VR Subsystem (controllers, laser rays, in-VR HUD canvas texture)
    if (this.vr) {
      this.vr.update(dt);
    }

    if (this.state.isTestRunning && !this.state.isTestPaused && !this.state.emergencyStopped) {
      this.testTime += dt;

      // Rate: mm/min -> mm/sec
      const dispSpeed = (this.testRate / 60.0) * 1.8; // slightly accelerated for engaging pedagogy
      this.currentDisplacement += dispSpeed * dt;
      this.currentStrain = Mechanics.engineeringStrain(this.currentDisplacement, this.initialHeight);

      // Evaluate stress from constitutive material equation
      this.currentStress = this.currentMaterial.getStress(this.currentStrain);
      this.currentLoad = Mechanics.loadFromStress(this.currentStress, this.initialArea);

      if (this.currentStress > this.peakStress) {
        this.peakStress = this.currentStress;
        this.peakLoad = this.currentLoad;
      }

      // Check Yield Point Milestone
      const elasticLimit = this.currentMaterial.yieldStrength / (this.currentMaterial.youngsModulus * 1000);
      if (!this.yieldDetected && this.currentStrain >= elasticLimit) {
        this.yieldDetected = true;
        sound.playYieldCreak();
        this.chart.addMilestone('yield', this.currentStrain, this.currentStress, `Yield Point (${this.currentMaterial.yieldStrength} MPa)`);
        this.showToast(`⚡ Yield Point Reached! Specimen entering plastic flow.`);
      }

      // Check Failure State (Fracture or Maximum Compression Limit)
      if (!this.failureDetected && this.currentStrain >= this.currentMaterial.fractureStrain) {
        this.handleSpecimenFailure();
      }

      // Update 3D Specimen Deformation
      const stressRatio = Math.min(1.0, this.currentStress / this.currentMaterial.ultimateCompressiveStrength);
      this.specimen.updateDeformation(this.currentStrain, stressRatio);

      // Move Upper Crosshead down with specimen height
      const currentHeightMm = this.specimen.getCurrentHeightMm();
      this.scene.setCrossheadHeight(currentHeightMm);

      // Update Dial Gauge Needle
      this.scene.setDialLoad(this.currentLoad);

      // Modulate hydraulic sound based on load
      sound.updatePumpLoad(this.currentLoad / (this.currentMaterial.ultimateCompressiveStrength * this.initialArea / 1000.0));

      // Update Dynamic Chart
      const chartPoint = {
        strain: this.currentStrain,
        stress: this.currentStress,
        trueStress: Mechanics.trueStress(this.currentStress, this.currentStrain),
        load: this.currentLoad,
        displacement: this.currentDisplacement,
        time: this.testTime
      };
      this.chart.addPoint(chartPoint);

      // Auto-log to notebook at regular intervals (every ~0.5% strain)
      if (Math.floor(this.currentStrain * 100) > Math.floor((this.currentStrain - dispSpeed * dt / this.initialHeight) * 100)) {
        this.notebook.logDataPoint(chartPoint);
      }

      // Update HUD Readouts
      this.updateHUDReadouts();
    }
  }

  handleSpecimenFailure() {
    this.failureDetected = true;
    this.state.isTestCompleted = true;
    this.state.isTestRunning = false;
    sound.stopHydraulicPump();

    // Trigger Material-Specific Failure Visuals & Audio
    if (this.currentMaterial.failureType === 'shear_fracture') {
      sound.playBrittleFracture();
      this.specimen.triggerShearFracture();
      this.chart.addMilestone('fracture', this.currentStrain, this.currentStress, `Shear Fracture (${this.peakStress.toFixed(0)} MPa)`);
      this.showToast(`💥 CATASTROPHIC SHEAR FAILURE! Specimen fractured along ~52° slip plane.`);
    } else if (this.currentMaterial.failureType === 'crushing') {
      sound.playConcreteCrush();
      this.specimen.triggerConcreteCrushing();
      this.chart.addMilestone('fracture', this.currentStrain, this.currentStress, `Crushing Failure (${this.peakStress.toFixed(0)} MPa)`);
      this.showToast(`💥 COMPRESSIVE CRUSHING FAILURE! Concrete aggregate spalling.`);
    } else {
      // Ductile barrelling limit
      sound.playSafetySuccess();
      this.chart.addMilestone('ucs', this.currentStrain, this.currentStress, `Ultimate Strength (${this.peakStress.toFixed(0)} MPa)`);
      this.showToast(`🏁 Test Completed! Specimen achieved extensive ductile barrelling.`);
    }

    // Finalize Notebook results
    this.notebook.computeFinalResults(this.chart.dataPoints, this.peakStress, this.peakLoad, this.currentDisplacement);

    // Update start button
    const startBtn = document.getElementById('btn-start-test');
    if (startBtn) {
      startBtn.innerHTML = '🏁 Test Complete - View Report';
      startBtn.classList.remove('active');
      startBtn.classList.add('btn-success');
      startBtn.disabled = false;
      startBtn.onclick = () => this.notebook.openReport();
    }

    // Auto-prompt to open formal report after 2.5s
    setTimeout(() => {
      this.notebook.openNotebook();
    }, 2000);
  }

  updateHUDReadouts() {
    const loadEl = document.getElementById('hud-load-val');
    const dispEl = document.getElementById('hud-disp-val');
    const stressEl = document.getElementById('hud-stress-val');
    const strainEl = document.getElementById('hud-strain-val');
    const peakEl = document.getElementById('hud-peak-val');

    if (loadEl) loadEl.textContent = `${this.currentLoad.toFixed(2)} kN`;
    if (dispEl) dispEl.textContent = `${this.currentDisplacement.toFixed(3)} mm`;
    if (stressEl) stressEl.textContent = `${this.currentStress.toFixed(1)} MPa`;
    if (strainEl) strainEl.textContent = `${(this.currentStrain * 100).toFixed(2)}%`;
    if (peakEl) peakEl.textContent = `${this.peakLoad.toFixed(2)} kN`;
  }

  advanceStep(nextStep) {
    if (nextStep <= this.totalSteps) {
      this.currentStep = nextStep;
      this.updateStepUI();
    }
  }

  updateStepUI() {
    // Update step wizard indicator badges
    for (let i = 1; i <= this.totalSteps; i++) {
      const stepItem = document.getElementById(`step-card-${i}`);
      if (stepItem) {
        if (i < this.currentStep) {
          stepItem.className = 'step-card completed';
        } else if (i === this.currentStep) {
          stepItem.className = 'step-card active';
        } else {
          stepItem.className = 'step-card disabled';
        }
      }
    }

    // Update active action panels
    for (let i = 1; i <= this.totalSteps; i++) {
      const panel = document.getElementById(`step-action-panel-${i}`);
      if (panel) {
        panel.style.display = (i === this.currentStep) ? 'block' : 'none';
      }
    }

    // Update banner message
    const bannerMsg = document.getElementById('wizard-banner-msg');
    const stepTitles = [
      'Step 1: Select Material Specimen',
      'Step 2: Clean Upper & Lower Platens',
      'Step 3: Measure Height & Diameter via Vernier Caliper',
      'Step 4: Mount & Concentrically Center Specimen',
      'Step 5: Jog Crosshead to Zero-Clearance Contact',
      'Step 6: Close Shield & Obtain Supervisor Green-Light',
      'Step 7: Tare Load Cell & Zero Dial Gauge',
      'Step 8: Execute Hydraulic Compression Test'
    ];
    if (bannerMsg) {
      bannerMsg.textContent = stepTitles[this.currentStep - 1] || 'Compression Test in Progress';
    }
  }

  setAppMode(mode) {
    this.mode = mode;
    const wizardPanel = document.getElementById('wizard-sidebar');
    const quizPanel = document.getElementById('quiz-modal');
    const freePanel = document.getElementById('free-mode-controls');

    if (mode === 'quiz') {
      if (quizPanel) quizPanel.style.display = 'flex';
    } else {
      if (quizPanel) quizPanel.style.display = 'none';
    }

    if (freePanel) {
      freePanel.style.display = (mode === 'free') ? 'block' : 'none';
    }

    if (mode === 'free') {
      // In free mode, unlock all steps immediately
      this.state.platensCleaned = true;
      this.state.dimensionsMeasured = true;
      this.state.specimenPlaced = true;
      this.state.crossheadSeated = true;
      this.state.shieldClosed = true;
      this.state.supervisorApproved = true;
      this.state.gaugesZeroed = true;
      this.currentStep = 8;
      this.updateStepUI();
      const startBtn = document.getElementById('btn-start-test');
      if (startBtn) startBtn.disabled = false;
    }
  }

  evaluateQuiz() {
    const answers = {
      q1: 'b', // What causes barrelling in ductile compression? (Frictional restraint at platen interfaces)
      q2: 'c', // Why grey cast iron fails along ~45-55 deg plane? (Maximum shear stress / Mohr-Coulomb)
      q3: 'a', // True stress vs Engineering stress in compression? (True stress is lower than engineering stress due to area expansion)
      q4: 'd', // Purpose of concentric rings? (Prevent eccentric bending stresses)
      q5: 'b'  // Least count of 0.02mm caliper? (50 vernier divisions = 49mm)
    };

    let score = 0;
    let total = 5;

    for (let key in answers) {
      const selected = document.querySelector(`input[name="${key}"]:checked`);
      if (selected && selected.value === answers[key]) {
        score++;
      }
    }

    const resultEl = document.getElementById('quiz-results-box');
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="quiz-score-card ${score >= 4 ? 'passed' : 'failed'}">
          <h3>${score >= 4 ? '🎉 Congratulations! Assessment Passed' : '⚠️ Keep Practicing'}</h3>
          <p>You scored <strong>${score} / ${total}</strong> (${(score / total * 100).toFixed(0)}%) on Mechanical Compression Metallurgy.</p>
          <p>${score >= 4 ? 'You have demonstrated mastery of ASTM E9 compression testing protocols and failure mechanics.' : 'Review the theoretical notes in the Lab Notebook and try again.'}</p>
        </div>
      `;
    }
  }

  resetSimulation() {
    sound.stopHydraulicPump();
    sound.playClick();

    this.currentDisplacement = 0.0;
    this.currentStrain = 0.0;
    this.currentStress = 0.0;
    this.currentLoad = 0.0;
    this.peakStress = 0.0;
    this.peakLoad = 0.0;
    this.testTime = 0.0;
    this.yieldDetected = false;
    this.failureDetected = false;

    this.state.isTestRunning = false;
    this.state.isTestPaused = false;
    this.state.isTestCompleted = false;
    this.state.emergencyStopped = false;
    this.state.gaugesZeroed = false;

    this.specimen.reset();
    this.chart.reset();
    this.notebook.reset();
    this.scene.resetDialPeak();
    this.scene.setDialLoad(0);

    this.crossheadPosMm = 38.0;
    this.scene.setCrossheadHeight(this.crossheadPosMm);

    const startBtn = document.getElementById('btn-start-test');
    const pauseBtn = document.getElementById('btn-pause-test');
    const estopBtn = document.getElementById('btn-estop');

    if (startBtn) {
      startBtn.innerHTML = '⚡ Start Compressive Loading';
      startBtn.classList.remove('btn-success', 'active');
      startBtn.disabled = !this.state.supervisorApproved;
      startBtn.onclick = () => this.startCompressionTest();
    }
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.innerHTML = '⏸ Pause';
    }
    if (estopBtn) {
      estopBtn.classList.remove('e-stopped');
      estopBtn.disabled = true;
    }

    this.updateHUDReadouts();
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.utmApp = new UTMLabApplication();
  window.utmApp.init();
});
