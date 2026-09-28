/**
 * Material Database & Constitutive Mechanical Models for Compression Testing
 * Accurately models elastic, plastic, strain-hardening, barrelling, and brittle fracture behaviors.
 */

export const MATERIALS = {
  mild_steel: {
    id: 'mild_steel',
    name: 'Mild Steel (AISI 1018 / Fe 410)',
    category: 'Ductile Metal',
    description: 'Ductile carbon steel with distinct yield point, extensive plastic deformation, and pronounced barrelling under compression without brittle fracture.',
    color: 0x8a929a,
    roughness: 0.35,
    metalness: 0.85,
    density: 7850, // kg/m3
    youngsModulus: 205, // GPa
    poissonsRatio: 0.29,
    yieldStrength: 260, // MPa (upper yield ~275, lower yield ~250)
    ultimateCompressiveStrength: 520, // MPa (engineering stress at severe barrelling limit)
    fractureStrain: 0.38, // 38% reduction in height before excessive load limit
    strainHardeningExponent: 0.18, // Hollomon n
    strengthCoefficient: 620, // Hollomon K (MPa)
    frictionFactor: 0.35, // Barrelling friction parameter
    failureType: 'barrelling', // 'barrelling', 'shear_fracture', 'crushing', 'fiber_buckling'
    shearAngleDeg: 0, // No shear fracture
    recommendedHeight: 30.0, // mm (standard aspect ratio H/D = 1.5 - 2.0)
    recommendedDiameter: 15.0, // mm
    theoreticalNotes: 'Yielding occurs along Lüders bands. In compression, necking does not occur; instead, frictional restraint at platen interfaces generates multi-axial stress states resulting in the classic barrel profile.',
    // Stress calculation function for engineering strain epsilon (0.0 to fractureStrain)
    getStress(strain) {
      if (strain <= 0) return 0;
      const elasticStrainLimit = this.yieldStrength / (this.youngsModulus * 1000);
      if (strain <= elasticStrainLimit) {
        return strain * this.youngsModulus * 1000;
      }
      const plasticStrain = strain - elasticStrainLimit;
      const trueStrain = -Math.log(Math.max(0.001, 1 - strain));
      
      if (plasticStrain < 0.012) {
        return this.yieldStrength + Math.sin(plasticStrain * 500) * 8 - plasticStrain * 200;
      }
      
      const basePlasticStress = this.strengthCoefficient * Math.pow(Math.max(0.001, trueStrain), this.strainHardeningExponent);
      const barrelMultiplier = 1 + 0.45 * Math.pow(strain, 1.3);
      return Math.min(this.ultimateCompressiveStrength * 1.25, basePlasticStress * barrelMultiplier);
    },

    // Inverse function: calculate strain from applied stress for manual load entry
    getStrainFromStress(stress) {
      if (stress <= 0) return 0;
      const elasticLimit = this.yieldStrength;
      const elasticStrainLimit = elasticLimit / (this.youngsModulus * 1000);
      if (stress <= elasticLimit) {
        return stress / (this.youngsModulus * 1000);
      }
      // Plastic region: numerical root-finding / interpolation
      const excessStress = Math.min(this.ultimateCompressiveStrength * 1.2, stress) - elasticLimit;
      const plasticRatio = excessStress / (this.ultimateCompressiveStrength * 1.2 - elasticLimit);
      const pStrain = Math.pow(Math.max(0, plasticRatio), 1.8) * (this.fractureStrain - elasticStrainLimit);
      return Math.min(this.fractureStrain * 1.2, elasticStrainLimit + pStrain);
    }
  },

  cast_iron: {
    id: 'cast_iron',
    name: 'Grey Cast Iron (ASTM Class 35)',
    category: 'Brittle Metal',
    description: 'High compressive strength with negligible ductility. Flake graphite microstructure leads to sudden catastrophic shear fracture along a ~45° to 55° plane.',
    color: 0x4f545a,
    roughness: 0.65,
    metalness: 0.6,
    density: 7200, // kg/m3
    youngsModulus: 115, // GPa (secant modulus in compression)
    poissonsRatio: 0.26,
    yieldStrength: 520, // MPa (0.2% offset pseudo-yield)
    ultimateCompressiveStrength: 750, // MPa (compressive strength is 3-4x tensile strength!)
    fractureStrain: 0.022, // 2.2% brittle strain
    strainHardeningExponent: 0.08,
    strengthCoefficient: 800,
    frictionFactor: 0.20,
    failureType: 'shear_fracture',
    shearAngleDeg: 52, // Typical Coulomb-Mohr angle: 45° + phi/2
    recommendedHeight: 30.0,
    recommendedDiameter: 15.0,
    theoreticalNotes: 'Grey cast iron is 3 to 4 times stronger in compression than in tension. Failure occurs abruptly when the maximum shear stress overcomes internal friction on an oblique plane at approximately 50°-55° with the loading axis.',
    getStress(strain) {
      if (strain <= 0) return 0;
      if (strain >= this.fractureStrain) {
        const post = (strain - this.fractureStrain) / 0.003;
        return Math.max(0, this.ultimateCompressiveStrength * (1 - post));
      }
      const ratio = strain / this.fractureStrain;
      return this.ultimateCompressiveStrength * (1.18 * ratio - 0.18 * Math.pow(ratio, 2.2));
    },
    getStrainFromStress(stress) {
      if (stress <= 0) return 0;
      const ratio = Math.min(1.0, stress / this.ultimateCompressiveStrength);
      return Math.pow(ratio, 1.1) * this.fractureStrain;
    }
  },

  concrete: {
    id: 'concrete',
    name: 'High-Strength Concrete (M40 Mix)',
    category: 'Brittle / Quasi-Brittle',
    description: 'Composite aggregate matrix. Demonstrates initial microcracking, peak compressive resistance, and subsequent crushing with spalling and vertical splitting.',
    color: 0x9e988e,
    roughness: 0.85,
    metalness: 0.05,
    density: 2400, // kg/m3
    youngsModulus: 31.6, // GPa (5000 * sqrt(fck))
    poissonsRatio: 0.20,
    yieldStrength: 32.0, // MPa (onset of inelastic microcracking)
    ultimateCompressiveStrength: 46.5, // MPa
    fractureStrain: 0.0038, // 0.38% (Eurocode 2 / ACI 318 peak strain ~0.002 to 0.0035)
    strainHardeningExponent: 0.1,
    strengthCoefficient: 50,
    frictionFactor: 0.25,
    failureType: 'crushing',
    shearAngleDeg: 65, // Spalling / cone-and-split
    recommendedHeight: 30.0,
    recommendedDiameter: 15.0,
    theoreticalNotes: 'Concrete exhibits quasi-brittle softening. As peak stress is attained, micro-cracks coalesce into macro-cracks, causing diagonal shear cones and lateral spalling.',
    getStress(strain) {
      if (strain <= 0) return 0;
      const eps0 = 0.0022; // Strain at peak
      const epsU = this.fractureStrain;
      if (strain <= eps0) {
        const eta = strain / eps0;
        return this.ultimateCompressiveStrength * (2 * eta - eta * eta);
      } else if (strain <= epsU) {
        const decay = (strain - eps0) / (epsU - eps0);
        return this.ultimateCompressiveStrength * (1.0 - 0.45 * decay);
      } else {
        return Math.max(0, this.ultimateCompressiveStrength * 0.15 * (1 - (strain - epsU) / 0.002));
      }
    },
    getStrainFromStress(stress) {
      if (stress <= 0) return 0;
      const ratio = Math.min(1.0, stress / this.ultimateCompressiveStrength);
      return 0.0022 * (1.0 - Math.sqrt(Math.max(0, 1.0 - ratio)));
    }
  },

  timber: {
    id: 'timber',
    name: 'Hardwood Oak (Parallel to Grain)',
    category: 'Anisotropic Cellular',
    description: 'Cellular wood fiber structure tested parallel to grain. Exhibiting linear elasticity followed by cell wall buckling and localized kink-band crushing.',
    color: 0xa87848,
    roughness: 0.7,
    metalness: 0.0,
    density: 750, // kg/m3
    youngsModulus: 12.5, // GPa
    poissonsRatio: 0.35,
    yieldStrength: 38.0, // MPa (Fiber buckling limit)
    ultimateCompressiveStrength: 54.0, // MPa
    fractureStrain: 0.045, // 4.5%
    strainHardeningExponent: 0.05,
    strengthCoefficient: 58,
    frictionFactor: 0.15,
    failureType: 'fiber_buckling',
    shearAngleDeg: 45,
    recommendedHeight: 30.0,
    recommendedDiameter: 15.0,
    theoreticalNotes: 'Wood in compression parallel to grain behaves like a bundle of hollow tubes. Initial yield is caused by elastic micro-buckling of cellulose microfibrils in the tracheid cell walls.',
    getStress(strain) {
      if (strain <= 0) return 0;
      const epsE = this.yieldStrength / (this.youngsModulus * 1000);
      if (strain <= epsE) {
        return strain * this.youngsModulus * 1000;
      }
      if (strain <= this.fractureStrain) {
        const pStrain = strain - epsE;
        return this.yieldStrength + (this.ultimateCompressiveStrength - this.yieldStrength) * (1 - Math.exp(-pStrain * 80));
      }
      return Math.max(this.yieldStrength * 0.7, this.ultimateCompressiveStrength * (1 - (strain - this.fractureStrain) * 3));
    },
    getStrainFromStress(stress) {
      if (stress <= 0) return 0;
      const epsE = this.yieldStrength / (this.youngsModulus * 1000);
      if (stress <= this.yieldStrength) {
        return stress / (this.youngsModulus * 1000);
      }
      const excess = Math.min(this.ultimateCompressiveStrength * 0.99, stress) - this.yieldStrength;
      const range = this.ultimateCompressiveStrength - this.yieldStrength;
      const ratio = excess / Math.max(1, range);
      return epsE - Math.log(Math.max(0.01, 1 - ratio)) / 80.0;
    }
  },

  aluminium: {
    id: 'aluminium',
    name: 'Aluminium Alloy 6061-T6',
    category: 'Ductile Light Metal',
    description: 'High strength-to-weight ratio aerospace alloy. Shows continuous smooth plastic flow with significant diameter expansion and no sharp yield point.',
    color: 0xc8d0d8,
    roughness: 0.28,
    metalness: 0.9,
    density: 2700, // kg/m3
    youngsModulus: 68.9, // GPa
    poissonsRatio: 0.33,
    yieldStrength: 276, // MPa (0.2% offset yield)
    ultimateCompressiveStrength: 410, // MPa
    fractureStrain: 0.35, // 35%
    strainHardeningExponent: 0.12,
    strengthCoefficient: 420,
    frictionFactor: 0.30,
    failureType: 'barrelling',
    shearAngleDeg: 0,
    recommendedHeight: 30.0,
    recommendedDiameter: 15.0,
    theoreticalNotes: 'Aluminium 6061-T6 lacks a distinct yield drop, transitioning smoothly into plastic flow described accurately by the Ramberg-Osgood relationship.',
    getStress(strain) {
      if (strain <= 0) return 0;
      const eps0 = this.yieldStrength / (this.youngsModulus * 1000);
      if (strain <= eps0) {
        return strain * this.youngsModulus * 1000;
      }
      const trueStrain = -Math.log(Math.max(0.001, 1 - strain));
      const plasticStress = this.yieldStrength + (this.strengthCoefficient - this.yieldStrength) * Math.pow(trueStrain, this.strainHardeningExponent);
      const barrel = 1 + 0.35 * Math.pow(strain, 1.2);
      return Math.min(this.ultimateCompressiveStrength * 1.2, plasticStress * barrel);
    },
    getStrainFromStress(stress) {
      if (stress <= 0) return 0;
      const eps0 = this.yieldStrength / (this.youngsModulus * 1000);
      if (stress <= this.yieldStrength) {
        return stress / (this.youngsModulus * 1000);
      }
      const excess = Math.min(this.ultimateCompressiveStrength * 1.15, stress) - this.yieldStrength;
      const range = this.ultimateCompressiveStrength * 1.15 - this.yieldStrength;
      const ratio = excess / Math.max(1, range);
      return eps0 + Math.pow(ratio, 1.6) * (this.fractureStrain - eps0);
    }
  }
};

/**
 * Mechanical Formulas Helper
 */
export const Mechanics = {
  // Cross-sectional Area A0 = pi * d0^2 / 4 (mm^2)
  initialArea(diameterMm) {
    return (Math.PI * Math.pow(diameterMm, 2)) / 4.0;
  },

  // Instantaneous Cross-sectional Area A (accounting for barrelling / volume conservation)
  // A = A0 / (1 - strain) for plastic incompressible flow
  instantaneousArea(area0, strain) {
    if (strain >= 0.95) return area0 * 20;
    return area0 / Math.max(0.05, 1.0 - strain);
  },

  // Engineering Stress sigma = P / A0 (MPa or N/mm2)
  // P in kN, A0 in mm2 -> (P * 1000) / A0
  engineeringStress(loadKN, area0Mm2) {
    return (loadKN * 1000.0) / area0Mm2;
  },

  // Load P in kN from Stress sigma (MPa) and A0 (mm2)
  loadFromStress(stressMPa, area0Mm2) {
    return (stressMPa * area0Mm2) / 1000.0;
  },

  // Engineering Strain epsilon = deltaL / L0 (dimensionless)
  engineeringStrain(displacementMm, initialHeightMm) {
    return Math.max(0, displacementMm / initialHeightMm);
  },

  // True Stress sigma_true = sigma_eng * (1 - epsilon_eng)
  trueStress(engStress, engStrain) {
    return engStress * (1.0 - engStrain);
  },

  // True Strain epsilon_true = -ln(1 - epsilon_eng)
  trueStrain(engStrain) {
    return -Math.log(Math.max(0.0001, 1.0 - engStrain));
  },

  // Percentage height reduction: (deltaL / L0) * 100
  percentageHeightReduction(deltaL, l0) {
    return (deltaL / l0) * 100.0;
  },

  // Theoretical Young's Modulus calculation from linear fit points
  calculateYoungsModulus(stress1, strain1, stress2, strain2) {
    const deltaStrain = strain2 - strain1;
    if (Math.abs(deltaStrain) < 1e-6) return 0;
    return (stress2 - stress1) / (deltaStrain * 1000.0); // in GPa
  }
};
