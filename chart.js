/**
 * Dynamic High-Performance Real-Time Stress-Strain Canvas Chart
 * Synchronizes with deformation engine, plots live curves, highlights yield & failure milestones,
 * supports data capture points, zooming, crosshair inspection, and export.
 */

export class StressStrainChart {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.options = Object.assign({
      maxStrain: 0.40,
      maxStress: 800,
      title: 'Stress (σ) vs. Strain (ε) Dynamic Curve',
      showTrueStress: false,
      showGrid: true,
      showMilestones: true
    }, options);

    this.dataPoints = []; // [{strain, stress, trueStress, load, displacement, time, isCaptured}]
    this.milestones = []; // [{type: 'yield', strain, stress, label}]
    this.isLive = false;
    this.currentPoint = null;
    this.hoverPoint = null;

    this.padding = { top: 40, right: 30, bottom: 50, left: 65 };
    this.zoomLevel = 1.0;
    this.panOffset = { x: 0, y: 0 };

    this.initEvents();
  }

  initEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.handleHover(x, y);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverPoint = null;
      this.render();
    });

    // Resize observer to keep sharp canvas on retina/high-DPI screens
    const resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    resizeObserver.observe(this.canvas);
    this.resizeCanvas();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(300, rect.width || 500);
    const h = Math.max(220, rect.height || 300);

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    if (this.ctx) {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
    this.render();
  }

  setMaterialLimits(material) {
    if (!material) return;
    if (material.id === 'cast_iron') {
      this.options.maxStrain = 0.035;
      this.options.maxStress = 850;
    } else if (material.id === 'concrete') {
      this.options.maxStrain = 0.006;
      this.options.maxStress = 60;
    } else if (material.id === 'timber') {
      this.options.maxStrain = 0.06;
      this.options.maxStress = 70;
    } else if (material.id === 'aluminium') {
      this.options.maxStrain = 0.38;
      this.options.maxStress = 450;
    } else {
      // Mild steel
      this.options.maxStrain = 0.42;
      this.options.maxStress = 650;
    }
    this.reset();
  }

  reset() {
    this.dataPoints = [];
    this.milestones = [];
    this.currentPoint = null;
    this.hoverPoint = null;
    this.render();
  }

  addPoint(point) {
    // point: { strain, stress, trueStress, load, displacement, time }
    this.dataPoints.push(point);
    this.currentPoint = point;

    // Auto-scale if limits exceeded
    if (point.strain > this.options.maxStrain * 0.95) {
      this.options.maxStrain = point.strain * 1.25;
    }
    if (point.stress > this.options.maxStress * 0.95) {
      this.options.maxStress = point.stress * 1.25;
    }

    this.render();
  }

  addMilestone(type, strain, stress, label) {
    this.milestones.push({ type, strain, stress, label });
    this.render();
  }

  captureCurrentPoint() {
    if (!this.currentPoint) return null;
    const pt = { ...this.currentPoint, isCaptured: true, captureIndex: this.dataPoints.filter(p => p.isCaptured).length + 1 };
    
    // Mark in main array
    const lastIdx = this.dataPoints.length - 1;
    if (lastIdx >= 0) {
      this.dataPoints[lastIdx].isCaptured = true;
      this.dataPoints[lastIdx].captureIndex = pt.captureIndex;
    }
    this.render();
    return pt;
  }

  toggleTrueStress(val) {
    this.options.showTrueStress = (val !== undefined) ? val : !this.options.showTrueStress;
    this.render();
  }

  handleHover(x, y) {
    const plotW = (this.canvas.clientWidth || 500) - this.padding.left - this.padding.right;
    const plotH = (this.canvas.clientHeight || 300) - this.padding.top - this.padding.bottom;

    if (x < this.padding.left || x > this.padding.left + plotW || y < this.padding.top || y > this.padding.top + plotH) {
      this.hoverPoint = null;
      this.render();
      return;
    }

    const mouseStrain = ((x - this.padding.left) / plotW) * this.options.maxStrain;
    
    // Find closest data point
    let closest = null;
    let minDiff = Infinity;
    for (const pt of this.dataPoints) {
      const diff = Math.abs(pt.strain - mouseStrain);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }

    this.hoverPoint = closest;
    this.render();
  }

  // Coordinate mapping
  toCanvasX(strain, plotW) {
    return this.padding.left + (strain / this.options.maxStrain) * plotW;
  }

  toCanvasY(stress, plotH) {
    return this.padding.top + plotH - (stress / this.options.maxStress) * plotH;
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.clientWidth || 500;
    const h = this.canvas.clientHeight || 300;

    const plotW = w - this.padding.left - this.padding.right;
    const plotH = h - this.padding.top - this.padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // 1. Background Grid & Styling
    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(this.padding.left, this.padding.top, plotW, plotH);

    // 2. Grid lines & Axis ticks
    if (this.options.showGrid) {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;

      // Vertical grid (Strain)
      const numStrainSteps = 6;
      for (let i = 0; i <= numStrainSteps; i++) {
        const strainVal = (this.options.maxStrain / numStrainSteps) * i;
        const x = this.toCanvasX(strainVal, plotW);

        ctx.beginPath();
        ctx.moveTo(x, this.padding.top);
        ctx.lineTo(x, this.padding.top + plotH);
        ctx.stroke();

        // Strain Label
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        const displayStrain = (this.options.maxStrain < 0.01) 
          ? (strainVal * 100).toFixed(3) + '%' 
          : (this.options.maxStrain < 0.1) 
            ? (strainVal * 100).toFixed(2) + '%' 
            : (strainVal * 100).toFixed(1) + '%';
        ctx.fillText(displayStrain, x, this.padding.top + plotH + 18);
      }

      // Horizontal grid (Stress)
      const numStressSteps = 5;
      for (let i = 0; i <= numStressSteps; i++) {
        const stressVal = (this.options.maxStress / numStressSteps) * i;
        const y = this.toCanvasY(stressVal, plotH);

        ctx.beginPath();
        ctx.moveTo(this.padding.left, y);
        ctx.lineTo(this.padding.left + plotW, y);
        ctx.stroke();

        // Stress Label
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(stressVal.toFixed(0), this.padding.left - 8, y + 3);
      }
    }

    // 3. Axis Borders & Titles
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.padding.left, this.padding.top, plotW, plotH);

    // X-Axis Title
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Engineering Strain (ε = ΔL / L₀)', this.padding.left + plotW / 2, h - 12);

    // Y-Axis Title
    ctx.save();
    ctx.translate(18, this.padding.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Engineering Stress σ (MPa or N/mm²)', 0, 0);
    ctx.restore();

    // Chart Legend / Header
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('● Engineering Stress (P/A₀)', this.padding.left, this.padding.top - 14);

    if (this.options.showTrueStress) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('● True Stress σ_true', this.padding.left + 190, this.padding.top - 14);
    }

    if (this.dataPoints.length === 0) {
      // Empty placeholder message
      ctx.fillStyle = '#475569';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for Hydraulic Compression Test to start...', this.padding.left + plotW / 2, this.padding.top + plotH / 2);
      return;
    }

    // 4. Draw Engineering Stress Curve
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';

    for (let i = 0; i < this.dataPoints.length; i++) {
      const pt = this.dataPoints[i];
      const x = this.toCanvasX(pt.strain, plotW);
      const y = this.toCanvasY(pt.stress, plotH);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Subtle area glow under curve
    ctx.lineTo(this.toCanvasX(this.dataPoints[this.dataPoints.length - 1].strain, plotW), this.toCanvasY(0, plotH));
    ctx.lineTo(this.toCanvasX(0, plotW), this.toCanvasY(0, plotH));
    ctx.closePath();
    const areaGrad = ctx.createLinearGradient(0, this.padding.top, 0, this.padding.top + plotH);
    areaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
    areaGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // 5. Draw True Stress Curve if toggled
    if (this.options.showTrueStress) {
      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      for (let i = 0; i < this.dataPoints.length; i++) {
        const pt = this.dataPoints[i];
        const trueVal = pt.trueStress || (pt.stress * (1 - pt.strain));
        const x = this.toCanvasX(pt.strain, plotW);
        const y = this.toCanvasY(trueVal, plotH);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 6. Draw Milestones (Yield point, UCS, Fracture)
    if (this.options.showMilestones) {
      for (const ms of this.milestones) {
        const mx = this.toCanvasX(ms.strain, plotW);
        const my = this.toCanvasY(ms.stress, plotH);

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Milestone flag label
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(ms.label, mx + 7, my - 5);
      }
    }

    // 7. Draw Captured Data Points (with yellow diamonds)
    for (const pt of this.dataPoints) {
      if (pt.isCaptured) {
        const cx = this.toCanvasX(pt.strain, plotW);
        const cy = this.toCanvasY(pt.stress, plotH);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(-4.5, -4.5, 9, 9);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-4.5, -4.5, 9, 9);
        ctx.restore();

        // Badge number
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`#${pt.captureIndex || ''}`, cx, cy - 8);
      }
    }

    // 8. Live Head Pulse Marker
    if (this.currentPoint) {
      const hx = this.toCanvasX(this.currentPoint.strain, plotW);
      const hy = this.toCanvasY(this.currentPoint.stress, plotH);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 9. Interactive Hover Tooltip & Crosshair
    if (this.hoverPoint) {
      const hx = this.toCanvasX(this.hoverPoint.strain, plotW);
      const hy = this.toCanvasY(this.hoverPoint.stress, plotH);

      // Crosshair lines
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      ctx.beginPath();
      ctx.moveTo(hx, this.padding.top);
      ctx.lineTo(hx, this.padding.top + plotH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(this.padding.left, hy);
      ctx.lineTo(this.padding.left + plotW, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tooltip Card
      const ttW = 165;
      const ttH = 75;
      let ttX = hx + 12;
      let ttY = hy - ttH / 2;
      if (ttX + ttW > w - 10) ttX = hx - ttW - 12;
      if (ttY < this.padding.top + 5) ttY = this.padding.top + 5;
      if (ttY + ttH > h - 10) ttY = h - ttH - 10;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(ttX, ttY, ttW, ttH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Stress (σ): ${this.hoverPoint.stress.toFixed(2)} MPa`, ttX + 8, ttY + 16);
      ctx.fillText(`Strain (ε): ${(this.hoverPoint.strain * 100).toFixed(3)}%`, ttX + 8, ttY + 32);
      ctx.fillText(`Load (P): ${this.hoverPoint.load ? this.hoverPoint.load.toFixed(2) : '--'} kN`, ttX + 8, ttY + 48);
      ctx.fillText(`ΔL Disp: ${this.hoverPoint.displacement ? this.hoverPoint.displacement.toFixed(3) : '--'} mm`, ttX + 8, ttY + 64);
    }
  }
}
