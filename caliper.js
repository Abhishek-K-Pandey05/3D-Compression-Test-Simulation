/**
 * Interactive Vernier Caliper Module
 * Provides realistic 2D/3D precision measurement workflow for initial specimen height & diameter.
 */

import { sound } from './audio.js';

export class VernierCaliperTool {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('caliper-modal');
    this.leastCount = 0.02; // 0.02 mm (50 divisions = 1 mm)
    this.currentValue = 0.0; // mm
    this.targetDimension = 15.0; // mm (the true specimen dimension being measured)
    this.measurementMode = 'diameter'; // 'diameter' or 'height'
    this.isLocked = false;
    this.onDimensionRecorded = options.onDimensionRecorded || (() => {});
    
    this.measuredData = {
      diameter: null,
      height: null
    };

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="caliper-backdrop"></div>
      <div class="caliper-dialog">
        <div class="caliper-header">
          <div class="caliper-title-group">
            <span class="caliper-icon">📐</span>
            <div>
              <h3>Precision Vernier Caliper Station</h3>
              <p class="caliper-subtitle">Standard Metric 0.02mm Resolution • ISO 9001 Metrology Standard</p>
            </div>
          </div>
          <div class="caliper-header-actions">
            <div class="caliper-mode-pills">
              <button id="btn-measure-diameter" class="pill-btn active">📏 Measure Diameter (d₀)</button>
              <button id="btn-measure-height" class="pill-btn">📐 Measure Height (h₀)</button>
            </div>
            <button id="caliper-close-btn" class="modal-close-btn" title="Close Caliper">&times;</button>
          </div>
        </div>

        <div class="caliper-body">
          <!-- Caliper Graphical Canvas Area -->
          <div class="caliper-viewport">
            <div class="caliper-specimen-indicator">
              <div id="caliper-specimen-preview" class="specimen-preview diameter-mode">
                <span id="specimen-tag">Mild Steel Sample</span>
              </div>
            </div>

            <!-- Canvas for rendered photorealistic Caliper -->
            <canvas id="caliper-canvas" width="840" height="260"></canvas>

            <!-- Magnifier Loupe Overlay -->
            <div id="caliper-loupe" class="caliper-loupe">
              <div class="loupe-header">🔍 Optical Alignment Loupe (5x Zoom)</div>
              <canvas id="loupe-canvas" width="220" height="90"></canvas>
              <div class="loupe-hint">Find matching vernier line</div>
            </div>
          </div>

          <!-- Controls and Readout Panel -->
          <div class="caliper-controls-grid">
            <!-- Caliper Jaw Slider & Fine Adjust -->
            <div class="caliper-card slider-card">
              <div class="card-header">
                <span>Jaw Position Control</span>
                <span class="badge" id="jaw-contact-badge">Free Motion</span>
              </div>
              <div class="slider-wrapper">
                <input type="range" id="caliper-slider" min="0" max="60" step="0.02" value="0">
              </div>
              <div class="fine-adjust-group">
                <button id="caliper-nudge-left" class="btn-micro" title="Step -0.02mm">◀ -0.02mm</button>
                <button id="caliper-snap-target" class="btn-micro primary" title="Snap Jaws to Specimen">🧲 Snap to Specimen</button>
                <button id="caliper-nudge-right" class="btn-micro" title="Step +0.02mm">+0.02mm ▶</button>
              </div>
            </div>

            <!-- Educational Scale Reading Practice / Readout -->
            <div class="caliper-card reading-card">
              <div class="card-header">
                <span>Metrology Readout & Calculation</span>
                <span class="badge info">LC = 0.02 mm</span>
              </div>
              <div class="reading-row">
                <div class="calc-block">
                  <label>Main Scale (MSR)</label>
                  <div class="val-box"><span id="val-msr">0</span> <small>mm</small></div>
                </div>
                <div class="calc-sign">+</div>
                <div class="calc-block">
                  <label>Vernier Division (VSD × 0.02)</label>
                  <div class="val-box"><span id="val-vsr">0</span> <small>(<span id="val-vsd-raw">0</span>)</small></div>
                </div>
                <div class="calc-sign">=</div>
                <div class="calc-block highlight">
                  <label>Total Reading</label>
                  <div class="val-box total"><span id="val-total">0.00</span> <small>mm</small></div>
                </div>
              </div>

              <!-- Measurement Verification & Action -->
              <div class="record-action-group">
                <div id="reading-status-msg" class="reading-msg">
                  ⚠️ Adjust the caliper jaws until they snugly touch both sides of the specimen.
                </div>
                <button id="btn-record-dimension" class="btn-success btn-block" disabled>
                  💾 Record <span id="record-dim-name">Diameter (d₀)</span> into Lab Log
                </button>
              </div>
            </div>
          </div>

          <!-- Recorded Dimensions Status Footer -->
          <div class="caliper-footer-status">
            <div class="recorded-item" id="rec-d-item">
              <span class="dot"></span>
              <span>Diameter (d₀): <strong><span id="rec-d-val">Not Recorded</span></strong></span>
            </div>
            <div class="recorded-item" id="rec-h-item">
              <span class="dot"></span>
              <span>Height (h₀): <strong><span id="rec-h-val">Not Recorded</span></strong></span>
            </div>
            <div class="recorded-item area-item">
              <span>Calculated Area (A₀): <strong><span id="rec-area-val">--</span> mm²</strong></span>
            </div>
            <button id="btn-caliper-done" class="btn-primary" disabled>
              ✅ Proceed to Machine Setup
            </button>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('caliper-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.loupeCanvas = document.getElementById('loupe-canvas');
    this.loupeCtx = this.loupeCanvas ? this.loupeCanvas.getContext('2d') : null;
    this.slider = document.getElementById('caliper-slider');
  }

  setSpecimen(material, trueHeight, trueDiameter) {
    this.material = material;
    this.trueHeight = trueHeight || 30.0;
    this.trueDiameter = trueDiameter || 15.0;
    
    const preview = document.getElementById('caliper-specimen-preview');
    const tag = document.getElementById('specimen-tag');
    if (tag && material) tag.textContent = material.name;
    
    this.setMode(this.measurementMode);
  }

  setMode(mode) {
    this.measurementMode = mode;
    this.targetDimension = (mode === 'diameter') ? this.trueDiameter : this.trueHeight;
    
    const dBtn = document.getElementById('btn-measure-diameter');
    const hBtn = document.getElementById('btn-measure-height');
    const preview = document.getElementById('caliper-specimen-preview');
    const recName = document.getElementById('record-dim-name');

    if (dBtn && hBtn) {
      if (mode === 'diameter') {
        dBtn.classList.add('active');
        hBtn.classList.remove('active');
        if (preview) {
          preview.className = 'specimen-preview diameter-mode';
        }
        if (recName) recName.textContent = 'Diameter (d₀)';
      } else {
        hBtn.classList.add('active');
        dBtn.classList.remove('active');
        if (preview) {
          preview.className = 'specimen-preview height-mode';
        }
        if (recName) recName.textContent = 'Height (h₀)';
      }
    }

    // Set initial position
    this.currentValue = Math.max(0, this.targetDimension - 6.0);
    if (this.slider) this.slider.value = this.currentValue;
    this.update();
  }

  open() {
    if (this.container) {
      this.container.classList.add('active');
      this.container.style.display = 'flex';
    }
    this.update();
  }

  close() {
    if (this.container) {
      this.container.classList.remove('active');
      this.container.style.display = 'none';
    }
  }

  bindEvents() {
    const closeBtn = document.getElementById('caliper-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const dBtn = document.getElementById('btn-measure-diameter');
    if (dBtn) dBtn.addEventListener('click', () => {
      sound.playClick();
      this.setMode('diameter');
    });

    const hBtn = document.getElementById('btn-measure-height');
    if (hBtn) hBtn.addEventListener('click', () => {
      sound.playClick();
      this.setMode('height');
    });

    if (this.slider) {
      this.slider.addEventListener('input', (e) => {
        this.currentValue = parseFloat(e.target.value);
        sound.playCaliperSlide();
        this.update();
      });
    }

    const snapBtn = document.getElementById('caliper-snap-target');
    if (snapBtn) {
      snapBtn.addEventListener('click', () => {
        this.currentValue = this.targetDimension;
        if (this.slider) this.slider.value = this.currentValue;
        sound.playPlatenContact();
        this.update();
      });
    }

    const nudgeLeft = document.getElementById('caliper-nudge-left');
    if (nudgeLeft) {
      nudgeLeft.addEventListener('click', () => {
        this.currentValue = Math.max(0, parseFloat((this.currentValue - 0.02).toFixed(2)));
        if (this.slider) this.slider.value = this.currentValue;
        sound.playCaliperSlide();
        this.update();
      });
    }

    const nudgeRight = document.getElementById('caliper-nudge-right');
    if (nudgeRight) {
      nudgeRight.addEventListener('click', () => {
        this.currentValue = Math.min(60, parseFloat((this.currentValue + 0.02).toFixed(2)));
        if (this.slider) this.slider.value = this.currentValue;
        sound.playCaliperSlide();
        this.update();
      });
    }

    const recordBtn = document.getElementById('btn-record-dimension');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => {
        this.recordCurrentDimension();
      });
    }

    const doneBtn = document.getElementById('btn-caliper-done');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        sound.playSafetySuccess();
        this.close();
        if (this.onDimensionRecorded) {
          this.onDimensionRecorded(this.measuredData);
        }
      });
    }
  }

  recordCurrentDimension() {
    const val = parseFloat(this.currentValue.toFixed(2));
    if (Math.abs(val - this.targetDimension) > 0.04) return;

    sound.playSafetySuccess();

    if (this.measurementMode === 'diameter') {
      this.measuredData.diameter = val;
      const recD = document.getElementById('rec-d-val');
      const itemD = document.getElementById('rec-d-item');
      if (recD) recD.textContent = `${val.toFixed(2)} mm`;
      if (itemD) itemD.classList.add('recorded');

      // Auto switch to height if not measured
      if (!this.measuredData.height) {
        setTimeout(() => this.setMode('height'), 600);
      }
    } else {
      this.measuredData.height = val;
      const recH = document.getElementById('rec-h-val');
      const itemH = document.getElementById('rec-h-item');
      if (recH) recH.textContent = `${val.toFixed(2)} mm`;
      if (itemH) itemH.classList.add('recorded');

      if (!this.measuredData.diameter) {
        setTimeout(() => this.setMode('diameter'), 600);
      }
    }

    // Calculate Area
    if (this.measuredData.diameter) {
      const area = (Math.PI * Math.pow(this.measuredData.diameter, 2)) / 4.0;
      const areaEl = document.getElementById('rec-area-val');
      if (areaEl) areaEl.textContent = area.toFixed(2);
    }

    // Check if both measured
    if (this.measuredData.diameter && this.measuredData.height) {
      const doneBtn = document.getElementById('btn-caliper-done');
      if (doneBtn) {
        doneBtn.disabled = false;
        doneBtn.classList.add('pulse');
      }
    }

    this.update();
  }

  update() {
    this.renderCaliperCanvas();
    this.renderLoupeCanvas();
    this.updateReadout();
  }

  updateReadout() {
    const total = parseFloat(this.currentValue.toFixed(2));
    const msr = Math.floor(total);
    const remainder = total - msr;
    const vsd = Math.round(remainder / this.leastCount);
    const vsr = (vsd * this.leastCount).toFixed(2);

    const msrEl = document.getElementById('val-msr');
    const vsrEl = document.getElementById('val-vsr');
    const vsdRawEl = document.getElementById('val-vsd-raw');
    const totalEl = document.getElementById('val-total');
    const badgeEl = document.getElementById('jaw-contact-badge');
    const recordBtn = document.getElementById('btn-record-dimension');
    const msgEl = document.getElementById('reading-status-msg');

    if (msrEl) msrEl.textContent = msr;
    if (vsrEl) vsrEl.textContent = vsr;
    if (vsdRawEl) vsdRawEl.textContent = `${vsd} div`;
    if (totalEl) totalEl.textContent = total.toFixed(2);

    const diff = Math.abs(total - this.targetDimension);
    const isSnug = diff <= 0.02;
    const isClose = diff <= 0.2;

    if (badgeEl) {
      if (isSnug) {
        badgeEl.textContent = '🎯 Perfect Specimen Contact';
        badgeEl.className = 'badge success';
      } else if (isClose) {
        badgeEl.textContent = '⚠️ Near Contact - Fine Tune';
        badgeEl.className = 'badge warning';
      } else if (total < this.targetDimension) {
        badgeEl.textContent = '❌ Specimen Collision (Too tight)';
        badgeEl.className = 'badge danger';
      } else {
        badgeEl.textContent = '↔️ Open Clearance';
        badgeEl.className = 'badge info';
      }
    }

    if (recordBtn) {
      recordBtn.disabled = !isSnug;
    }

    if (msgEl) {
      if (isSnug) {
        msgEl.innerHTML = `✅ <strong>Jaws accurately seated!</strong> Reading is <strong>${total.toFixed(2)} mm</strong>. Click record below.`;
        msgEl.className = 'reading-msg success';
      } else if (total < this.targetDimension) {
        msgEl.innerHTML = `⚠️ Jaws are pressing into specimen! Loosen jaws to <strong>${this.targetDimension.toFixed(2)} mm</strong>.`;
        msgEl.className = 'reading-msg danger';
      } else {
        msgEl.innerHTML = `🔍 Bring the sliding jaw to touch the specimen at <strong>${this.targetDimension.toFixed(2)} mm</strong>.`;
        msgEl.className = 'reading-msg';
      }
    }
  }

  renderCaliperCanvas() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Coordinate system parameters
    const originX = 140; // Base of fixed jaw
    const scaleY = 90; // Main beam Y
    const beamHeight = 42;
    const pixelsPerMm = 9.0; // Scale factor

    // Background gradient (laboratory stainless bench)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#151922');
    bgGrad.addColorStop(1, '#0e1217');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 1. Draw Main Beam (Satin Stainless Steel)
    const beamGrad = ctx.createLinearGradient(0, scaleY, 0, scaleY + beamHeight);
    beamGrad.addColorStop(0, '#d1d8e0');
    beamGrad.addColorStop(0.3, '#f1f5f9');
    beamGrad.addColorStop(0.8, '#cbd5e1');
    beamGrad.addColorStop(1, '#94a3b8');

    ctx.fillStyle = beamGrad;
    ctx.fillRect(originX - 40, scaleY, w - (originX - 40) - 20, beamHeight);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX - 40, scaleY, w - (originX - 40) - 20, beamHeight);

    // 2. Draw Fixed Jaw (Left)
    ctx.beginPath();
    ctx.moveTo(originX - 40, scaleY);
    ctx.lineTo(originX, scaleY);
    ctx.lineTo(originX, scaleY + beamHeight + 95);
    ctx.lineTo(originX - 22, scaleY + beamHeight + 95);
    ctx.bezierCurveTo(originX - 25, scaleY + beamHeight + 50, originX - 40, scaleY + beamHeight + 20, originX - 40, scaleY);
    ctx.closePath();

    const fixedJawGrad = ctx.createLinearGradient(originX - 40, scaleY, originX, scaleY + 120);
    fixedJawGrad.addColorStop(0, '#e2e8f0');
    fixedJawGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = fixedJawGrad;
    ctx.fill();
    ctx.stroke();

    // 3. Draw Specimen between Jaws
    const jawPosPixels = originX + this.currentValue * pixelsPerMm;
    const specWidthPixels = this.targetDimension * pixelsPerMm;
    const specHeightPixels = (this.measurementMode === 'diameter' ? 55 : 40);

    const specX = originX;
    const specY = scaleY + beamHeight + 15;

    // Specimen gradient
    const specGrad = ctx.createLinearGradient(specX, specY, specX, specY + specHeightPixels);
    if (this.material && this.material.id === 'cast_iron') {
      specGrad.addColorStop(0, '#5f656b');
      specGrad.addColorStop(0.5, '#7b828a');
      specGrad.addColorStop(1, '#474c52');
    } else if (this.material && this.material.id === 'concrete') {
      specGrad.addColorStop(0, '#9c968c');
      specGrad.addColorStop(0.5, '#b5afa6');
      specGrad.addColorStop(1, '#827c73');
    } else if (this.material && this.material.id === 'timber') {
      specGrad.addColorStop(0, '#9e6e3c');
      specGrad.addColorStop(0.5, '#b8824a');
      specGrad.addColorStop(1, '#78532c');
    } else {
      // Mild steel / metal
      specGrad.addColorStop(0, '#85909c');
      specGrad.addColorStop(0.5, '#b0bac6');
      specGrad.addColorStop(1, '#6a737e');
    }

    ctx.save();
    ctx.fillStyle = specGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillRect(specX, specY, specWidthPixels, specHeightPixels);
    ctx.strokeStyle = '#2b333c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(specX, specY, specWidthPixels, specHeightPixels);

    // Specimen metallic highlight line
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(specX, specY + 6);
    ctx.lineTo(specX + specWidthPixels, specY + 6);
    ctx.stroke();

    // Specimen center label
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.measurementMode === 'diameter' ? 'Ø d₀' : '↕ h₀', specX + specWidthPixels / 2, specY + specHeightPixels / 2 + 3);
    ctx.restore();

    // 4. Draw Main Scale Divisions on Beam
    ctx.fillStyle = '#0f172a';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';

    const maxMm = Math.floor((w - originX) / pixelsPerMm);
    for (let mm = 0; mm <= maxMm; mm++) {
      const x = originX + mm * pixelsPerMm;
      let lineLen = 6;
      if (mm % 10 === 0) {
        lineLen = 14;
        ctx.fillText(mm.toString(), x, scaleY + lineLen + 10);
      } else if (mm % 5 === 0) {
        lineLen = 10;
      }

      ctx.beginPath();
      ctx.moveTo(x, scaleY);
      ctx.lineTo(x, scaleY + lineLen);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = (mm % 10 === 0) ? 1.2 : 0.8;
      ctx.stroke();
    }

    // 5. Draw Sliding Vernier Assembly (Slider Body + Right Jaw)
    const sliderWidth = 240;
    const sliderX = jawPosPixels - 2;

    ctx.save();
    // Sliding jaw path
    ctx.beginPath();
    ctx.moveTo(sliderX, scaleY - 10);
    ctx.lineTo(sliderX + sliderWidth, scaleY - 10);
    ctx.lineTo(sliderX + sliderWidth, scaleY + beamHeight + 15);
    ctx.lineTo(sliderX + 45, scaleY + beamHeight + 15);
    ctx.lineTo(sliderX + 22, scaleY + beamHeight + 95);
    ctx.lineTo(sliderX, scaleY + beamHeight + 95);
    ctx.lineTo(sliderX, scaleY - 10);
    ctx.closePath();

    const sliderGrad = ctx.createLinearGradient(sliderX, scaleY, sliderX + sliderWidth, scaleY + 120);
    sliderGrad.addColorStop(0, '#e2e8f0');
    sliderGrad.addColorStop(0.5, '#cbd5e1');
    sliderGrad.addColorStop(1, '#94a3b8');

    ctx.fillStyle = sliderGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 6. Draw Vernier Scale Markings on Slider Body
    // 50 vernier divisions = 49 mm (standard 0.02mm vernier)
    // Division spacing = 49 / 50 = 0.98 mm in world coordinates = 0.98 * pixelsPerMm
    const vernierSpacing = 0.98 * pixelsPerMm;
    const vernierY = scaleY + 2;

    ctx.fillStyle = '#0f172a';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 50; i++) {
      const vx = jawPosPixels + i * vernierSpacing;
      let vLineLen = 5;
      if (i % 5 === 0) {
        vLineLen = 10;
        const mainUnit = i / 5; // 0, 1, 2, ... 10 (tenths of mm)
        ctx.fillText((mainUnit / 10).toFixed(1), vx, vernierY + vLineLen + 8);
      }

      ctx.beginPath();
      ctx.moveTo(vx, vernierY);
      ctx.lineTo(vx, vernierY + vLineLen);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = (i % 5 === 0) ? 1.1 : 0.7;
      ctx.stroke();
    }

    // Caliper branding and specs on slider
    ctx.fillStyle = '#334155';
    ctx.font = 'italic bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('STAINLESS HARDENED • 0.02mm', sliderX + 65, scaleY - 2);

    // Indicator of contact point
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(jawPosPixels, scaleY + beamHeight + 5);
    ctx.lineTo(jawPosPixels, scaleY + beamHeight + 95);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  renderLoupeCanvas() {
    if (!this.loupeCtx || !this.loupeCanvas) return;
    const ctx = this.loupeCtx;
    const w = this.loupeCanvas.width;
    const h = this.loupeCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Loupe background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const zoom = 4.0;
    const pixelsPerMm = 9.0 * zoom;
    const vernierSpacing = 0.98 * pixelsPerMm;

    const total = parseFloat(this.currentValue.toFixed(2));
    const msr = Math.floor(total);
    const remainder = total - msr;
    const bestVsd = Math.round(remainder / this.leastCount);

    // Center loupe around the coincident Vernier line
    const centerX = w / 2;
    const coincidenceOffset = bestVsd * vernierSpacing;
    const originX = centerX - coincidenceOffset;

    // Draw Main Scale on Upper half
    const mainY = 32;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    for (let mm = msr - 3; mm <= msr + 5; mm++) {
      const mx = originX + (mm - total) * pixelsPerMm + coincidenceOffset;
      if (mx < -20 || mx > w + 20) continue;

      let len = 12;
      if (mm % 5 === 0) {
        len = 20;
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${mm}mm`, mx, mainY - len - 2);
      }

      ctx.beginPath();
      ctx.moveTo(mx, mainY);
      ctx.lineTo(mx, mainY - len);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Scale dividing seam line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, mainY);
    ctx.lineTo(w, mainY);
    ctx.stroke();

    // Draw Vernier Scale on Lower half
    for (let i = 0; i <= 50; i++) {
      const vx = originX + i * vernierSpacing;
      if (vx < -20 || vx > w + 20) continue;

      let len = 12;
      const isCoincident = (i === bestVsd);

      if (i % 5 === 0) {
        len = 20;
        ctx.fillStyle = isCoincident ? '#38bdf8' : '#cbd5e1';
        ctx.fillText((i * 0.02).toFixed(2), vx, mainY + len + 12);
      }

      ctx.beginPath();
      ctx.moveTo(vx, mainY);
      ctx.lineTo(vx, mainY + len);
      ctx.strokeStyle = isCoincident ? '#38bdf8' : '#e2e8f0';
      ctx.lineWidth = isCoincident ? 2.5 : 1.2;
      ctx.stroke();

      if (isCoincident) {
        // Coincidence indicator ring / arrow
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(vx, mainY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Reticle line at center
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
