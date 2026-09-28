# Universal Testing Machine (UTM) - 3D Compression Test Virtual Laboratory

An interactive, high-fidelity 3D simulation of a **Universal Testing Machine (UTM)** compression test conforming to **ASTM E9-19** and **ISO 13314** standards. This simulation bridges procedural laboratory discipline with physical metallurgy and mechanical engineering mechanics.

---

## 🌟 Key Features

### 1. High-Fidelity 3D Laboratory & UTM Model
- **Universal Testing Machine**: Full 3D modeled base plinth, dual chromed guide columns, movable hydraulic crosshead, load cell, spherical seated hardened platens with laser-etched concentric alignment rings, sliding polycarbonate blast safety shield, and hydraulic power unit (HPU).
- **Realistic Analog Dial Gauge**: Functional 0–1000 kN dial gauge with live load needle and red maximum peak-load memory needle.
- **Cinematic & Tactical Camera Presets**: Lab Overview, Specimen Focus, Dial Gauge Macro, Caliper Workbench, and Telemetry Desk.
- **WebXR Immersive VR Support**: Full VR headset integration via Three.js WebXR.

### 2. Physical Metallurgy & Constitutive Material Models
Simulates diverse failure modes across 5 engineering materials:
- **Mild Steel (AISI 1018 / Fe 410)**: Ductile yielding with Lüders bands, plastic flow, and classic **barrelling (bulging)** caused by platen friction without brittle fracture.
- **Grey Cast Iron (ASTM Class 35)**: Brittle failure with high compressive strength ($3-4\times$ tensile) resulting in sudden **catastrophic shear fracture along a ~52° slip plane** (Mohr-Coulomb criterion).
- **High-Strength Concrete (M40 Mix)**: Progressive microcracking, peak compressive resistance, cone-and-split shear failure, and falling aggregate spalling particles.
- **Hardwood Oak (Parallel to Grain)**: Cellular wood fiber elastic micro-buckling and kink-band crushing.
- **Aluminium Alloy 6061-T6**: Continuous ductile plastic flow and significant lateral expansion.

### 3. Interactive Precision Vernier Caliper Station
- Photorealistic 2D/3D Vernier Caliper with **0.02 mm Least Count** (50 divisions = 49 mm).
- Sliding jaw controls with fine $\pm 0.02\text{ mm}$ nudge buttons and "Snap to Specimen" tool.
- **5x Optical Alignment Loupe** displaying exact vernier coincident line.
- Real-time metrology formula calculation ($MSR + VSD \times LC = Total$) with validation feedback before recording into the lab log.

### 4. Dynamic Real-Time Stress-Strain HUD & Telemetry
- Real-time animated canvas chart plotting Engineering Stress ($\sigma = P/A_0$) vs. Engineering Strain ($\epsilon = \Delta L / L_0$).
- Milestone markers for Proportional Limit, Yield Strength ($\sigma_y$), Ultimate Compressive Strength (UCS), and Rupture points.
- Interactive crosshair tooltip inspector, tangent modulus display, and **True Stress Overlay** ($\sigma_t = \sigma(1-\epsilon)$).
- **Von Mises Stress Heatmap** visualizer directly on the 3D specimen mesh.

### 5. Collaborative ISO 17025 Safety Check & Supervisor Sign-Off
- Multi-user dual role mode: **Student Operator** vs. **Lab Supervisor**.
- Pre-test machine checklist: Platen cleanliness, concentric centering ($\pm 0.2\text{ mm}$), initial dimensions, zero-clearance seating, blast shield lock, and operator PPE.
- Supervisor digital signature canvas and authorization code authentication (`SUP-9001`) to unlock high-pressure hydraulic pumps.

### 6. Virtual Lab Notebook & ASTM Formal Report Generator
- Real-time logged data table with timestamp, load ($P$), displacement ($\Delta L$), instantaneous height, strain ($\epsilon$), engineering stress ($\sigma$), and true stress ($\sigma_t$).
- Automatic mechanical parameter calculations (Young's Modulus $E$, Yield Strength $\sigma_y$, UCS, % reduction in height) with comparison to theoretical values and % error calculation.
- **CSV Data Export** for external analysis in Excel or MATLAB.
- **Printable ASTM E9 Formal Test Report** with ISO laboratory seal, metallurgical analysis, and dual sign-off blocks.

### 7. Procedural Web Audio API Synthesizer
- Low-frequency hydraulic pump drone that dynamically modulates pitch and filter cutoff under increasing hydraulic load.
- Metal platen touch contact sound, acoustic emission yielding groans, explosive brittle fracture snap with acoustic reverb, concrete crushing rattle, and dial beeps.

---

## 🚀 How to Run Locally

Because this simulation is built with pure standard ES Modules, HTML5, CSS3, and Three.js (via CDN), it requires no build steps or heavy dependencies.

### Option 1: Using Any Static HTTP Server (Recommended)
Run in terminal from the project folder:
```bash
# Using Node / npx
npx http-server -p 8080

# Or using Python (if installed)
python -m http.server 8080
```
Then open `http://localhost:8080` in any modern web browser (Chrome, Edge, Firefox, Safari, Meta Quest Browser).

### Option 2: Direct File Open
You can also open `index.html` directly in modern browsers supporting ES modules.

---

## 📐 Mechanical Engineering Formulas Implemented

1. **Initial Cross-Sectional Area**:
   $$A_0 = \frac{\pi \cdot d_0^2}{4}$$
2. **Engineering Stress**:
   $$\sigma = \frac{P \cdot 1000}{A_0} \quad (\text{MPa or N/mm}^2)$$
3. **Engineering Strain**:
   $$\epsilon = \frac{\Delta L}{L_0}$$
4. **Instantaneous Barrelling Radius Profile**:
   $$R(y, t) = R_0 \cdot \left[1 + \mu_{\text{barrel}} \cdot \left(\frac{1}{\sqrt{1 - \epsilon(t)}} - 1\right) \cdot \left(1 - \left(\frac{2y}{h(t)}\right)^2\right)\right]$$
5. **True Stress and True Strain**:
   $$\sigma_{\text{true}} = \sigma \cdot (1 - \epsilon)$$
   $$\epsilon_{\text{true}} = -\ln(1 - \epsilon)$$
6. **Modulus of Elasticity (Linear Elastic Slope)**:
   $$E = \frac{\Delta \sigma}{\Delta \epsilon \cdot 1000} \quad (\text{GPa})$$
