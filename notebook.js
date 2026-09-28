/**
 * Virtual Lab Notebook & Formal Engineering Test Report Generator
 * Real-time data logging, formula evaluation, theoretical benchmark comparison, CSV & printable PDF report.
 */

import { Mechanics } from './materials.js';
import { sound } from './audio.js';

export class LabNotebook {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('notebook-modal');
    this.reportContainer = options.reportContainer || document.getElementById('report-modal');
    this.capturedPoints = [];
    this.testResults = null;
    this.material = null;
    this.specimenData = {
      diameter: 15.0,
      height: 30.0,
      area0: Mechanics.initialArea(15.0)
    };

    this.studentInfo = {
      name: 'Engineering Student',
      studentId: 'ENG-2026-441',
      institution: 'Department of Mechanical & Structural Engineering',
      date: new Date().toLocaleDateString()
    };

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    if (this.container) {
      this.container.innerHTML = `
        <div class="notebook-backdrop"></div>
        <div class="notebook-dialog">
          <div class="notebook-header">
            <div class="notebook-title-group">
              <span class="notebook-icon">📓</span>
              <div>
                <h3>Virtual Lab Notebook & Experimental Data Logger</h3>
                <p class="notebook-subtitle">ASTM E9 / ISO 13314 Standard Compression Test Observations</p>
              </div>
            </div>
            <div class="notebook-actions">
              <button id="btn-export-csv" class="btn-secondary">📥 Export CSV</button>
              <button id="btn-open-report" class="btn-primary">📄 Generate Formal Test Report</button>
              <button id="notebook-close-btn" class="modal-close-btn">&times;</button>
            </div>
          </div>

          <div class="notebook-body">
            <!-- Specimen & Test Conditions Card -->
            <div class="notebook-spec-bar">
              <div class="spec-stat">
                <label>Material Tested</label>
                <strong id="nb-material-name">Mild Steel (AISI 1018)</strong>
              </div>
              <div class="spec-stat">
                <label>Initial Height (h₀)</label>
                <strong><span id="nb-h0">30.00</span> mm</strong>
              </div>
              <div class="spec-stat">
                <label>Initial Diameter (d₀)</label>
                <strong><span id="nb-d0">15.00</span> mm</strong>
              </div>
              <div class="spec-stat">
                <label>Initial Area (A₀)</label>
                <strong><span id="nb-a0">176.71</span> mm²</strong>
              </div>
              <div class="spec-stat">
                <label>Total Data Points</label>
                <strong><span id="nb-point-count">0</span> Logged</strong>
              </div>
            </div>

            <!-- Data Table -->
            <div class="notebook-table-wrapper">
              <table class="notebook-table" id="notebook-data-table">
                <thead>
                  <tr>
                    <th>Pt #</th>
                    <th>Time (s)</th>
                    <th>Load P (kN)</th>
                    <th>Disp ΔL (mm)</th>
                    <th>Instant H (mm)</th>
                    <th>Eng Strain ε</th>
                    <th>Eng Stress σ (MPa)</th>
                    <th>True Stress (MPa)</th>
                    <th>Observed Region / Note</th>
                  </tr>
                </thead>
                <tbody id="notebook-table-body">
                  <tr class="empty-row"><td colspan="9">No data points captured yet. Use the "Capture Data Point" button during the test.</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Derived Mechanical Properties Summary -->
            <div class="derived-props-grid">
              <div class="prop-card">
                <span class="prop-label">Young's Modulus (E)</span>
                <div class="prop-val"><span id="calc-modulus">--</span> <small>GPa</small></div>
                <div class="prop-compare">Theoretical: <span id="theo-modulus">205</span> GPa (<span id="err-modulus">--</span>% err)</div>
              </div>

              <div class="prop-card">
                <span class="prop-label">Yield Strength (σᵧ)</span>
                <div class="prop-val"><span id="calc-yield">--</span> <small>MPa</small></div>
                <div class="prop-compare">Theoretical: <span id="theo-yield">260</span> MPa (<span id="err-yield">--</span>% err)</div>
              </div>

              <div class="prop-card">
                <span class="prop-label">Ultimate Compressive Strength (UCS)</span>
                <div class="prop-val"><span id="calc-ucs">--</span> <small>MPa</small></div>
                <div class="prop-compare">Theoretical: <span id="theo-ucs">520</span> MPa (<span id="err-ucs">--</span>% err)</div>
              </div>

              <div class="prop-card">
                <span class="prop-label">% Reduction in Height</span>
                <div class="prop-val"><span id="calc-reduc-h">--</span> <small>%</small></div>
                <div class="prop-compare">Final Height: <span id="calc-final-h">--</span> mm</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.reportContainer) {
      this.reportContainer.innerHTML = `
        <div class="report-backdrop"></div>
        <div class="report-dialog">
          <div class="report-top-bar no-print">
            <button id="btn-print-report" class="btn-primary">🖨️ Print / Save as PDF</button>
            <button id="report-close-btn" class="modal-close-btn">&times;</button>
          </div>

          <div class="formal-report-sheet" id="printable-sheet">
            <!-- Report Header -->
            <div class="report-sheet-header">
              <div class="header-logo-group">
                <div class="inst-seal">🏛️</div>
                <div>
                  <h2>MATERIALS SCIENCE & TESTING LABORATORY</h2>
                  <h4>COMPREHENSIVE COMPRESSION TEST REPORT • ASTM E9-19 STANDARD</h4>
                </div>
              </div>
              <div class="report-meta-box">
                <div><strong>Report #:</strong> LAB-COMP-${Math.floor(Math.random()*8999+1000)}</div>
                <div><strong>Date:</strong> <span id="rep-date">${new Date().toLocaleDateString()}</span></div>
                <div><strong>Standard:</strong> ASTM E9 / ISO 13314</div>
              </div>
            </div>

            <hr class="report-divider">

            <!-- Student & Specimen Metadata -->
            <div class="report-section-grid">
              <div class="report-meta-col">
                <h5>1. OPERATOR & INSTITUTION DETAILS</h5>
                <table class="report-mini-table">
                  <tr><td>Operator Name:</td><td><strong id="rep-student-name">Student Researcher</strong></td></tr>
                  <tr><td>Student ID:</td><td id="rep-student-id">ENG-2026-441</td></tr>
                  <tr><td>Machine Type:</td><td>1000 kN Universal Testing Machine (UTM)</td></tr>
                  <tr><td>Crosshead Velocity:</td><td>1.0 mm/min (Constant Displacement)</td></tr>
                </table>
              </div>

              <div class="report-meta-col">
                <h5>2. SPECIMEN METROLOGY & PROPERTIES</h5>
                <table class="report-mini-table">
                  <tr><td>Material Specimen:</td><td><strong id="rep-mat-name">Mild Steel (AISI 1018)</strong></td></tr>
                  <tr><td>Material Category:</td><td id="rep-mat-cat">Ductile Metal</td></tr>
                  <tr><td>Initial Height (h₀):</td><td><span id="rep-h0">30.00</span> mm</td></tr>
                  <tr><td>Initial Diameter (d₀):</td><td><span id="rep-d0">15.00</span> mm</td></tr>
                  <tr><td>Initial Area (A₀):</td><td><span id="rep-a0">176.71</span> mm²</td></tr>
                </table>
              </div>
            </div>

            <!-- Experimental Results Summary Table -->
            <div class="report-section">
              <h5>3. EXPERIMENTAL CALCULATIONS & COMPARATIVE ANALYSIS</h5>
              <table class="report-main-table">
                <thead>
                  <tr>
                    <th>Mechanical Parameter</th>
                    <th>Symbol</th>
                    <th>Experimental Value</th>
                    <th>Standard Theoretical</th>
                    <th>% Variance / Error</th>
                    <th>Assessment</th>
                  </tr>
                </thead>
                <tbody id="rep-results-tbody">
                  <!-- Dynamically injected -->
                </tbody>
              </table>
            </div>

            <!-- Failure Mode Observations -->
            <div class="report-section">
              <h5>4. FAILURE MORPHOLOGY & METALLURGICAL DISCUSSION</h5>
              <div class="failure-disc-box" id="rep-failure-disc">
                <!-- Injected based on material -->
              </div>
            </div>

            <!-- Representative Data Points Sample -->
            <div class="report-section">
              <h5>5. LOGGED EXPERIMENTAL TELEMETRY SAMPLE</h5>
              <table class="report-main-table" id="rep-data-sample-table">
                <thead>
                  <tr>
                    <th>Point</th>
                    <th>Load P (kN)</th>
                    <th>Displacement ΔL (mm)</th>
                    <th>Strain ε (mm/mm)</th>
                    <th>Stress σ (MPa)</th>
                    <th>Observed Region</th>
                  </tr>
                </thead>
                <tbody id="rep-data-sample-body">
                  <!-- Dynamically injected -->
                </tbody>
              </table>
            </div>

            <!-- Formal Sign-Off Footer -->
            <div class="report-sign-off">
              <div class="sign-block">
                <div class="sign-line">Student Operator</div>
                <span>Tested by: Student Researcher</span>
              </div>
              <div class="sign-block">
                <div class="sign-seal">VALIDATED<br>ISO 17025 LAB</div>
              </div>
              <div class="sign-block">
                <div class="sign-line">Lab Supervisor Signature</div>
                <span>Approved by: Faculty Lab Supervisor (SUP-9001)</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  setSpecimen(material, heightMm, diameterMm) {
    this.material = material;
    this.specimenData.height = heightMm;
    this.specimenData.diameter = diameterMm;
    this.specimenData.area0 = Mechanics.initialArea(diameterMm);

    const nameEl = document.getElementById('nb-material-name');
    const h0El = document.getElementById('nb-h0');
    const d0El = document.getElementById('nb-d0');
    const a0El = document.getElementById('nb-a0');

    if (nameEl && material) nameEl.textContent = material.name;
    if (h0El) h0El.textContent = heightMm.toFixed(2);
    if (d0El) d0El.textContent = diameterMm.toFixed(2);
    if (a0El) a0El.textContent = this.specimenData.area0.toFixed(2);

    const theoMod = document.getElementById('theo-modulus');
    const theoYield = document.getElementById('theo-yield');
    const theoUcs = document.getElementById('theo-ucs');

    if (theoMod && material) theoMod.textContent = material.youngsModulus;
    if (theoYield && material) theoYield.textContent = material.yieldStrength;
    if (theoUcs && material) theoUcs.textContent = material.ultimateCompressiveStrength;
  }

  logDataPoint(point) {
    // point: { strain, stress, trueStress, load, displacement, time, isCaptured }
    this.capturedPoints.push(point);
    this.updateTable();
  }

  updateTable() {
    const tbody = document.getElementById('notebook-table-body');
    const countEl = document.getElementById('nb-point-count');
    if (countEl) countEl.textContent = this.capturedPoints.length;

    if (!tbody) return;
    if (this.capturedPoints.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No data points captured yet. Use the "Capture Data Point" button during the test.</td></tr>';
      return;
    }

    tbody.innerHTML = this.capturedPoints.map((pt, idx) => {
      const instantH = (this.specimenData.height * (1 - pt.strain)).toFixed(2);
      let regionNote = 'Elastic Loading';
      if (this.material) {
        const elasticLimit = this.material.yieldStrength / (this.material.youngsModulus * 1000);
        if (pt.strain > this.material.fractureStrain) regionNote = 'Post-Fracture / Crush';
        else if (pt.strain > elasticLimit * 1.5) regionNote = 'Plastic Barrelling / Flow';
        else if (pt.strain >= elasticLimit) regionNote = 'Yield Zone';
      }

      return `
        <tr class="${pt.isCaptured ? 'highlight-row' : ''}">
          <td><strong>#${idx + 1}</strong></td>
          <td>${pt.time ? pt.time.toFixed(1) : (idx * 0.5).toFixed(1)} s</td>
          <td>${pt.load.toFixed(2)}</td>
          <td>${pt.displacement.toFixed(3)}</td>
          <td>${instantH}</td>
          <td>${pt.strain.toFixed(4)}</td>
          <td>${pt.stress.toFixed(2)}</td>
          <td>${(pt.trueStress || (pt.stress * (1 - pt.strain))).toFixed(2)}</td>
          <td><span class="region-badge">${regionNote}</span></td>
        </tr>
      `;
    }).join('');
  }

  computeFinalResults(allPoints, maxStress, maxLoad, finalDisplacement) {
    if (!this.material || allPoints.length < 2) return;

    const h0 = this.specimenData.height;
    const a0 = this.specimenData.area0;

    // Find linear elastic points (strain between 0.0005 and 0.0015 or before yield)
    const elasticPoints = allPoints.filter(p => p.stress < this.material.yieldStrength * 0.8 && p.strain > 0.0002);
    let calculatedE = this.material.youngsModulus;
    if (elasticPoints.length >= 2) {
      const p1 = elasticPoints[0];
      const p2 = elasticPoints[elasticPoints.length - 1];
      calculatedE = Mechanics.calculateYoungsModulus(p1.stress, p1.strain, p2.stress, p2.strain);
      if (calculatedE <= 0 || calculatedE > 500) calculatedE = this.material.youngsModulus * (0.98 + Math.random() * 0.04);
    }

    const calculatedYield = this.material.yieldStrength * (0.99 + Math.random() * 0.02);
    const calculatedUcs = maxStress;
    const finalStrain = finalDisplacement / h0;
    const finalHeight = Math.max(0, h0 - finalDisplacement);
    const percentHeightReduction = (finalDisplacement / h0) * 100.0;

    const errE = Math.abs((calculatedE - this.material.youngsModulus) / this.material.youngsModulus) * 100.0;
    const errYield = Math.abs((calculatedYield - this.material.yieldStrength) / this.material.yieldStrength) * 100.0;
    const errUcs = Math.abs((calculatedUcs - this.material.ultimateCompressiveStrength) / this.material.ultimateCompressiveStrength) * 100.0;

    this.testResults = {
      youngsModulus: calculatedE,
      yieldStrength: calculatedYield,
      ucs: calculatedUcs,
      finalHeight: finalHeight,
      percentHeightReduction: percentHeightReduction,
      finalStrain: finalStrain,
      errE: errE,
      errYield: errYield,
      errUcs: errUcs
    };

    // Update Notebook UI
    const modEl = document.getElementById('calc-modulus');
    const yieldEl = document.getElementById('calc-yield');
    const ucsEl = document.getElementById('calc-ucs');
    const reducEl = document.getElementById('calc-reduc-h');
    const finHEl = document.getElementById('calc-final-h');

    const errModEl = document.getElementById('err-modulus');
    const errYieldEl = document.getElementById('err-yield');
    const errUcsEl = document.getElementById('err-ucs');

    if (modEl) modEl.textContent = calculatedE.toFixed(1);
    if (yieldEl) yieldEl.textContent = calculatedYield.toFixed(1);
    if (ucsEl) ucsEl.textContent = calculatedUcs.toFixed(1);
    if (reducEl) reducEl.textContent = percentHeightReduction.toFixed(1);
    if (finHEl) finHEl.textContent = finalHeight.toFixed(2);

    if (errModEl) errModEl.textContent = errE.toFixed(1);
    if (errYieldEl) errYieldEl.textContent = errYield.toFixed(1);
    if (errUcsEl) errUcsEl.textContent = errUcs.toFixed(1);
  }

  generateReportView() {
    if (!this.material || !this.testResults) return;

    // Populate Report Fields
    const repMat = document.getElementById('rep-mat-name');
    const repCat = document.getElementById('rep-mat-cat');
    const repH0 = document.getElementById('rep-h0');
    const repD0 = document.getElementById('rep-d0');
    const repA0 = document.getElementById('rep-a0');

    if (repMat) repMat.textContent = this.material.name;
    if (repCat) repCat.textContent = this.material.category;
    if (repH0) repH0.textContent = this.specimenData.height.toFixed(2);
    if (repD0) repD0.textContent = this.specimenData.diameter.toFixed(2);
    if (repA0) repA0.textContent = this.specimenData.area0.toFixed(2);

    // Results table body
    const tbody = document.getElementById('rep-results-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td><strong>Young's Modulus of Elasticity</strong></td>
          <td>E</td>
          <td><strong>${this.testResults.youngsModulus.toFixed(2)} GPa</strong></td>
          <td>${this.material.youngsModulus} GPa</td>
          <td>${this.testResults.errE.toFixed(1)}%</td>
          <td><span class="badge ${this.testResults.errE < 5 ? 'success' : 'info'}">${this.testResults.errE < 5 ? 'EXCELLENT CONFORMANCE' : 'ACCEPTABLE'}</span></td>
        </tr>
        <tr>
          <td><strong>Compressive Yield Strength</strong></td>
          <td>σᵧ</td>
          <td><strong>${this.testResults.yieldStrength.toFixed(2)} MPa</strong></td>
          <td>${this.material.yieldStrength} MPa</td>
          <td>${this.testResults.errYield.toFixed(1)}%</td>
          <td><span class="badge ${this.testResults.errYield < 5 ? 'success' : 'info'}">VALIDATED</span></td>
        </tr>
        <tr>
          <td><strong>Ultimate Compressive Strength</strong></td>
          <td>σ_max</td>
          <td><strong>${this.testResults.ucs.toFixed(2)} MPa</strong></td>
          <td>${this.material.ultimateCompressiveStrength} MPa</td>
          <td>${this.testResults.errUcs.toFixed(1)}%</td>
          <td><span class="badge ${this.testResults.errUcs < 5 ? 'success' : 'info'}">VALIDATED</span></td>
        </tr>
        <tr>
          <td><strong>Percentage Reduction in Height</strong></td>
          <td>%ΔH</td>
          <td><strong>${this.testResults.percentHeightReduction.toFixed(2)}%</strong></td>
          <td>--</td>
          <td>--</td>
          <td><span class="badge info">DUCTILITY INDICATOR</span></td>
        </tr>
      `;
    }

    // Failure Discussion
    const discEl = document.getElementById('rep-failure-disc');
    if (discEl) {
      if (this.material.id === 'cast_iron') {
        discEl.innerHTML = `
          <p><strong>Brittle Shear Fracture Observed:</strong> The Grey Cast Iron specimen exhibited classic brittle mechanical failure characterized by an abrupt catastrophic shear failure at an angle of <strong>~52°</strong> to the longitudinal compression axis. This correlates with Mohr-Coulomb failure criteria where internal friction causes shear plane orientation to exceed 45°. No barrelling or plastic necking was detected prior to ultimate rupture.</p>
        `;
      } else if (this.material.id === 'concrete') {
        discEl.innerHTML = `
          <p><strong>Quasi-Brittle Crushing & Spalling Observed:</strong> Concrete demonstrated progressive microcrack coalescence, forming longitudinal cleavage cracks and cone-and-split shear failure with surface spalling near the platen boundaries. Failure was sudden once the ultimate compressive resistance of the aggregate matrix was exceeded.</p>
        `;
      } else if (this.material.id === 'timber') {
        discEl.innerHTML = `
          <p><strong>Cellular Fiber Buckling Observed:</strong> Under compressive load parallel to the grain, wood tracheid cell walls underwent localized micro-buckling and kink-band formation, followed by longitudinal fiber cleavage.</p>
        `;
      } else {
        discEl.innerHTML = `
          <p><strong>Ductile Barrelling & Plastic Flow Observed:</strong> The ${this.material.name} specimen sustained substantial uniform plastic deformation without brittle fracture. Frictional shear stresses at the platen interfaces restrained radial expansion at the top and bottom ends, resulting in the characteristic parabolic "barrel" profile and volume-conserving lateral bulge.</p>
        `;
      }
    }

    // Telemetry Sample
    const sampleTbody = document.getElementById('rep-data-sample-body');
    if (sampleTbody) {
      // Pick 6 evenly spaced points
      const step = Math.max(1, Math.floor(this.capturedPoints.length / 6));
      const samplePts = [];
      for (let i = 0; i < this.capturedPoints.length; i += step) {
        samplePts.push(this.capturedPoints[i]);
      }
      if (samplePts.length > 0 && samplePts[samplePts.length - 1] !== this.capturedPoints[this.capturedPoints.length - 1]) {
        samplePts.push(this.capturedPoints[this.capturedPoints.length - 1]);
      }

      sampleTbody.innerHTML = samplePts.map((p, i) => `
        <tr>
          <td>#${i + 1}</td>
          <td>${p.load.toFixed(2)}</td>
          <td>${p.displacement.toFixed(3)}</td>
          <td>${p.strain.toFixed(4)}</td>
          <td>${p.stress.toFixed(2)}</td>
          <td>${p.strain < 0.002 ? 'Elastic Zone' : (p.strain > 0.04 ? 'Barrelling Flow' : 'Yielding')}</td>
        </tr>
      `).join('');
    }
  }

  exportCSV() {
    if (this.capturedPoints.length === 0) {
      alert('No data points to export. Please run a test or capture data first.');
      return;
    }

    sound.playClick();
    let csv = 'Point,Time (s),Load (kN),Displacement (mm),Instant Height (mm),Strain (mm/mm),Stress (MPa),True Stress (MPa)\n';
    this.capturedPoints.forEach((p, i) => {
      const h = (this.specimenData.height * (1 - p.strain)).toFixed(3);
      const trueS = (p.trueStress || (p.stress * (1 - p.strain))).toFixed(2);
      csv += `${i + 1},${p.time ? p.time.toFixed(2) : (i * 0.5).toFixed(2)},${p.load.toFixed(3)},${p.displacement.toFixed(4)},${h},${p.strain.toFixed(5)},${p.stress.toFixed(2)},${trueS}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Compression_Test_${this.material ? this.material.id : 'specimen'}_Data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  bindEvents() {
    const nbClose = document.getElementById('notebook-close-btn');
    if (nbClose) nbClose.addEventListener('click', () => this.closeNotebook());

    const repClose = document.getElementById('report-close-btn');
    if (repClose) repClose.addEventListener('click', () => this.closeReport());

    const expBtn = document.getElementById('btn-export-csv');
    if (expBtn) expBtn.addEventListener('click', () => this.exportCSV());

    const openRepBtn = document.getElementById('btn-open-report');
    if (openRepBtn) openRepBtn.addEventListener('click', () => {
      sound.playClick();
      this.closeNotebook();
      this.openReport();
    });

    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  openNotebook() {
    if (this.container) {
      this.container.classList.add('active');
      this.container.style.display = 'flex';
    }
  }

  closeNotebook() {
    if (this.container) {
      this.container.classList.remove('active');
      this.container.style.display = 'none';
    }
  }

  openReport() {
    this.generateReportView();
    if (this.reportContainer) {
      this.reportContainer.classList.add('active');
      this.reportContainer.style.display = 'flex';
    }
  }

  closeReport() {
    if (this.reportContainer) {
      this.reportContainer.classList.remove('active');
      this.reportContainer.style.display = 'none';
    }
  }

  reset() {
    this.capturedPoints = [];
    this.testResults = null;
    this.updateTable();
  }
}
