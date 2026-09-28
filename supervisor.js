/**
 * Collaborative Safety Check & Lab Supervisor Multi-User Verification System
 * Enforces ISO/ASTM laboratory safety protocols and supervisor sign-off before high-pressure testing.
 */

import { sound } from './audio.js';

export class SupervisorSafetySystem {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('safety-modal');
    this.currentRole = 'operator'; // 'operator' or 'supervisor'
    this.isAuthorized = false;
    this.supervisorCode = 'SUP-9001';
    
    this.checklist = {
      platensCleaned: false,
      specimenCentered: false,
      dimensionsLogged: false,
      zeroClearanceSet: false,
      blastShieldClosed: false,
      ppeConfirmed: false,
      estopArmed: true
    };

    this.onApprovalGranted = options.onApprovalGranted || (() => {});
    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="safety-backdrop"></div>
      <div class="safety-dialog">
        <div class="safety-header">
          <div class="safety-title-group">
            <span class="shield-badge">🛡️</span>
            <div>
              <h3>ISO 17025 Lab Safety Protocol & Supervisor Sign-Off</h3>
              <p class="safety-subtitle">Dual-Key Collaborative Verification System for High-Pressure UTM Testing</p>
            </div>
          </div>
          <button id="safety-modal-close" class="modal-close-btn">&times;</button>
        </div>

        <div class="safety-body">
          <!-- Role Selector Bar -->
          <div class="role-selector-bar">
            <span class="role-label">Active Station Role:</span>
            <div class="role-toggle-group">
              <button id="role-btn-operator" class="role-btn active">👷 Student Operator</button>
              <button id="role-btn-supervisor" class="role-btn">👨‍🏫 Lab Supervisor (Inspector)</button>
            </div>
          </div>

          <div class="safety-grid">
            <!-- Left: Mandatory Inspection Checklist -->
            <div class="safety-card checklist-card">
              <h4>📋 Pre-Test Machine Safety Checklist</h4>
              <p class="checklist-desc">All safety checkpoints must be validated before hydraulic pump ignition.</p>

              <div class="check-item" id="check-platens">
                <input type="checkbox" id="chk-platens">
                <label for="chk-platens">
                  <strong>Platen Cleanliness:</strong> Platens brushed clean of abrasive debris & particulate grit.
                </label>
                <span class="item-status" id="status-platens">Pending</span>
              </div>

              <div class="check-item" id="check-centering">
                <input type="checkbox" id="chk-centering">
                <label for="chk-centering">
                  <strong>Concentric Centering:</strong> Specimen aligned with concentric alignment rings (Zero Eccentricity).
                </label>
                <span class="item-status" id="status-centering">Pending</span>
              </div>

              <div class="check-item" id="check-dimensions">
                <input type="checkbox" id="chk-dimensions">
                <label for="chk-dimensions">
                  <strong>Initial Dimensions:</strong> Height (h₀) & Diameter (d₀) verified via Vernier Caliper.
                </label>
                <span class="item-status" id="status-dimensions">Pending</span>
              </div>

              <div class="check-item" id="check-clearance">
                <input type="checkbox" id="chk-clearance">
                <label for="chk-clearance">
                  <strong>Zero-Clearance Seating:</strong> Upper platen brought into light contact without pre-load.
                </label>
                <span class="item-status" id="status-clearance">Pending</span>
              </div>

              <div class="check-item" id="check-shield">
                <input type="checkbox" id="chk-shield">
                <label for="chk-shield">
                  <strong>Blast Shield Interlock:</strong> Polycarbonate shatter shield slid shut and locked.
                </label>
                <span class="item-status" id="status-shield">Pending</span>
              </div>

              <div class="check-item" id="check-ppe">
                <input type="checkbox" id="chk-ppe">
                <label for="chk-ppe">
                  <strong>Operator PPE:</strong> ANSI Z87.1 safety goggles & laboratory attire confirmed.
                </label>
                <span class="item-status" id="status-ppe">Pending</span>
              </div>
            </div>

            <!-- Right: Supervisor Sign-off & Interlock Authorization -->
            <div class="safety-card authorization-card">
              <h4>✍️ Supervisor Digital Authorization</h4>
              <div class="auth-status-box" id="auth-status-box">
                <div class="status-icon" id="auth-status-icon">🔒</div>
                <div class="status-text">
                  <strong id="auth-status-title">HYDRAULIC INTERLOCK LOCKED</strong>
                  <p id="auth-status-desc">Awaiting Supervisor digital sign-off and safety green-light.</p>
                </div>
              </div>

              <!-- Supervisor Passcode / Green-Light Form -->
              <div class="supervisor-form-group">
                <label for="supervisor-pin">Supervisor Sign-off Authorization Code:</label>
                <div class="input-with-btn">
                  <input type="text" id="supervisor-pin" placeholder="Enter code (Default: SUP-9001)" value="SUP-9001">
                  <button id="btn-quick-fill-pin" class="btn-micro" title="Use Standard Faculty ID">🔑 Auto-Fill</button>
                </div>
              </div>

              <!-- Digital Signature Pad -->
              <div class="signature-group">
                <div class="sig-header">
                  <label>Supervisor Electronic Signature:</label>
                  <button id="btn-clear-sig" class="btn-micro">Clear</button>
                </div>
                <canvas id="sig-canvas" width="300" height="90"></canvas>
              </div>

              <button id="btn-grant-approval" class="btn-success btn-block" disabled>
                🟢 GREEN-LIGHT & UNLOCK HYDRAULIC PUMP
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.sigCanvas = document.getElementById('sig-canvas');
    this.sigCtx = this.sigCanvas ? this.sigCanvas.getContext('2d') : null;
    this.initSignaturePad();
  }

  initSignaturePad() {
    if (!this.sigCanvas || !this.sigCtx) return;
    const ctx = this.sigCtx;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw placeholder signature line
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 300, 90);
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(20, 70);
    ctx.lineTo(280, 70);
    ctx.stroke();

    let drawing = false;
    this.hasSignature = false;

    const startDraw = (e) => {
      drawing = true;
      const rect = this.sigCanvas.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e) => {
      if (!drawing) return;
      const rect = this.sigCanvas.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineTo(x, y);
      ctx.stroke();
      this.hasSignature = true;
      this.validateAll();
    };

    const stopDraw = () => {
      drawing = false;
    };

    this.sigCanvas.addEventListener('mousedown', startDraw);
    this.sigCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    this.sigCanvas.addEventListener('touchstart', startDraw);
    this.sigCanvas.addEventListener('touchmove', draw);
    this.sigCanvas.addEventListener('touchend', stopDraw);
  }

  bindEvents() {
    const closeBtn = document.getElementById('safety-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Role switcher
    const opBtn = document.getElementById('role-btn-operator');
    const supBtn = document.getElementById('role-btn-supervisor');

    if (opBtn && supBtn) {
      opBtn.addEventListener('click', () => {
        sound.playClick();
        this.setRole('operator');
      });
      supBtn.addEventListener('click', () => {
        sound.playClick();
        this.setRole('supervisor');
      });
    }

    // Checkboxes
    const chkIds = [
      { id: 'chk-platens', key: 'platensCleaned' },
      { id: 'chk-centering', key: 'specimenCentered' },
      { id: 'chk-dimensions', key: 'dimensionsLogged' },
      { id: 'chk-clearance', key: 'zeroClearanceSet' },
      { id: 'chk-shield', key: 'blastShieldClosed' },
      { id: 'chk-ppe', key: 'ppeConfirmed' }
    ];

    chkIds.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener('change', (e) => {
          sound.playClick();
          this.checklist[item.key] = e.target.checked;
          const statusSpan = document.getElementById(`status-${item.key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
          if (statusSpan) {
            statusSpan.textContent = e.target.checked ? 'PASSED ✓' : 'Pending';
            statusSpan.className = e.target.checked ? 'item-status passed' : 'item-status';
          }
          this.validateAll();
        });
      }
    });

    // Auto-fill pin button
    const autoPinBtn = document.getElementById('btn-quick-fill-pin');
    if (autoPinBtn) {
      autoPinBtn.addEventListener('click', () => {
        sound.playClick();
        const pinInput = document.getElementById('supervisor-pin');
        if (pinInput) pinInput.value = 'SUP-9001';
        this.validateAll();
      });
    }

    // Clear signature button
    const clearSigBtn = document.getElementById('btn-clear-sig');
    if (clearSigBtn) {
      clearSigBtn.addEventListener('click', () => {
        sound.playClick();
        if (this.sigCtx && this.sigCanvas) {
          this.sigCtx.fillStyle = '#0f172a';
          this.sigCtx.fillRect(0, 0, 300, 90);
          this.sigCtx.strokeStyle = '#334155';
          this.sigCtx.beginPath();
          this.sigCtx.moveTo(20, 70);
          this.sigCtx.lineTo(280, 70);
          this.sigCtx.stroke();
        }
        this.hasSignature = false;
        this.validateAll();
      });
    }

    // Approval Button
    const approveBtn = document.getElementById('btn-grant-approval');
    if (approveBtn) {
      approveBtn.addEventListener('click', () => {
        this.grantApproval();
      });
    }
  }

  setRole(role) {
    this.currentRole = role;
    const opBtn = document.getElementById('role-btn-operator');
    const supBtn = document.getElementById('role-btn-supervisor');

    if (role === 'operator') {
      opBtn.classList.add('active');
      supBtn.classList.remove('active');
    } else {
      supBtn.classList.add('active');
      opBtn.classList.remove('active');
    }
  }

  updateSystemStatus(statusObj) {
    // Sync external lab states into checklist
    if (statusObj.platensCleaned !== undefined) {
      this.checklist.platensCleaned = statusObj.platensCleaned;
      const chk = document.getElementById('chk-platens');
      if (chk) chk.checked = statusObj.platensCleaned;
    }
    if (statusObj.specimenCentered !== undefined) {
      this.checklist.specimenCentered = statusObj.specimenCentered;
      const chk = document.getElementById('chk-centering');
      if (chk) chk.checked = statusObj.specimenCentered;
    }
    if (statusObj.dimensionsLogged !== undefined) {
      this.checklist.dimensionsLogged = statusObj.dimensionsLogged;
      const chk = document.getElementById('chk-dimensions');
      if (chk) chk.checked = statusObj.dimensionsLogged;
    }
    if (statusObj.zeroClearanceSet !== undefined) {
      this.checklist.zeroClearanceSet = statusObj.zeroClearanceSet;
      const chk = document.getElementById('chk-clearance');
      if (chk) chk.checked = statusObj.zeroClearanceSet;
    }
    if (statusObj.blastShieldClosed !== undefined) {
      this.checklist.blastShieldClosed = statusObj.blastShieldClosed;
      const chk = document.getElementById('chk-shield');
      if (chk) chk.checked = statusObj.blastShieldClosed;
    }
    this.validateAll();
  }

  validateAll() {
    const allChecked = Object.values(this.checklist).every(Boolean);
    const pinInput = document.getElementById('supervisor-pin');
    const pinValid = pinInput && pinInput.value.trim().toUpperCase() === 'SUP-9001';
    const sigValid = this.hasSignature;

    const approveBtn = document.getElementById('btn-grant-approval');
    if (approveBtn) {
      approveBtn.disabled = !(allChecked && pinValid && sigValid);
    }
  }

  grantApproval() {
    this.isAuthorized = true;
    sound.playSafetySuccess();

    const authBox = document.getElementById('auth-status-box');
    const authIcon = document.getElementById('auth-status-icon');
    const authTitle = document.getElementById('auth-status-title');
    const authDesc = document.getElementById('auth-status-desc');

    if (authBox) {
      authBox.className = 'auth-status-box approved';
      if (authIcon) authIcon.textContent = '🟢';
      if (authTitle) authTitle.textContent = 'SAFETY CLEARANCE GRANTED';
      if (authDesc) authDesc.textContent = 'Supervisor approval registered. High-pressure pump interlock unlocked.';
    }

    setTimeout(() => {
      this.close();
      if (this.onApprovalGranted) {
        this.onApprovalGranted();
      }
    }, 1000);
  }

  open() {
    if (this.container) {
      this.container.classList.add('active');
      this.container.style.display = 'flex';
    }
    this.validateAll();
  }

  close() {
    if (this.container) {
      this.container.classList.remove('active');
      this.container.style.display = 'none';
    }
  }

  reset() {
    this.isAuthorized = false;
    this.hasSignature = false;
    // Keep baseline PPE checked, reset dynamic ones
    this.checklist.platensCleaned = false;
    this.checklist.specimenCentered = false;
    this.checklist.dimensionsLogged = false;
    this.checklist.zeroClearanceSet = false;
    this.checklist.blastShieldClosed = false;
    this.checklist.ppeConfirmed = false;

    ['platens', 'centering', 'dimensions', 'clearance', 'shield', 'ppe'].forEach(k => {
      const el = document.getElementById(`chk-${k}`);
      if (el) el.checked = false;
      const statusSpan = document.getElementById(`status-${k}`);
      if (statusSpan) {
        statusSpan.textContent = 'Pending';
        statusSpan.className = 'item-status';
      }
    });

    const approveBtn = document.getElementById('btn-grant-approval');
    if (approveBtn) approveBtn.disabled = true;

    const authBox = document.getElementById('auth-status-box');
    const authIcon = document.getElementById('auth-status-icon');
    const authTitle = document.getElementById('auth-status-title');
    const authDesc = document.getElementById('auth-status-desc');
    if (authBox) {
      authBox.className = 'auth-status-box';
      if (authIcon) authIcon.textContent = '🔒';
      if (authTitle) authTitle.textContent = 'HYDRAULIC INTERLOCK LOCKED';
      if (authDesc) authDesc.textContent = 'Awaiting Supervisor digital sign-off and safety green-light.';
    }
  }
}
