export interface NeuronConfig {
  threshold: number;
  restingPotential: number;
  resetPotential: number;
  membraneTau: number; // Membrane time constant (ms)
  refractoryPeriod: number; // ms
  capacitance: number; // pF
  resistance: number; // MOhm
}

export class Neuron {
  // Biologically accurate parameters
  public membranePotential: number;
  public readonly config: NeuronConfig;
  
  // State tracking
  private fired: boolean = false;
  private lastSpikeTime: number | null = null;
  private refractoryUntil: number = 0;
  
  // Biological metrics
  public totalSpikes: number = 0;
  public spikeHistory: number[] = [];
  public voltageHistory: number[] = [];
  private readonly maxHistoryLength: number = 200;
  
  // Advanced properties
  public adaptationCurrent: number = 0;
  public adaptationTimeConstant: number = 100;
  public adaptationIncrement: number = 0.1;

  constructor(config: Partial<NeuronConfig> = {}) {
    this.config = {
      threshold: -50, // mV
      restingPotential: -70, // mV
      resetPotential: -70, // mV
      membraneTau: 20, // ms
      refractoryPeriod: 2, // ms
      capacitance: 100, // pF
      resistance: 200, // MOhm
      ...config
    };
    
    this.membranePotential = this.config.restingPotential;
  }

  public hasFired(): boolean {
    return this.fired;
  }

  public isInRefractoryPeriod(currentTime: number): boolean {
    return currentTime < this.refractoryUntil;
  }

  public getInstantaneousFiringRate(): number {
    if (this.spikeHistory.length < 2) return 0;
    
    const recent = this.spikeHistory.slice(-10);
    if (recent.length < 2) return 0;
    
    const intervals = recent.slice(1).map((time, i) => time - recent[i]);
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    return avgInterval > 0 ? 1000 / avgInterval : 0; // Hz
  }

  public getMembranePotentialNormalized(): number {
    const range = this.config.threshold - this.config.restingPotential;
    return Math.max(0, Math.min(1, 
      (this.membranePotential - this.config.restingPotential) / range
    ));
  }

  public step(inputCurrent: number, deltaTime: number, currentTime: number): boolean {
    this.fired = false;

    // Skip processing if in refractory period
    if (this.isInRefractoryPeriod(currentTime)) {
      this.membranePotential = this.config.resetPotential;
      return false;
    }

    // Apply adaptation current (spike frequency adaptation)
    const totalCurrent = inputCurrent - this.adaptationCurrent;
    
    // Leaky integrate-and-fire dynamics with proper time constants
    const leak = (this.config.restingPotential - this.membranePotential) / this.config.membraneTau;
    const injection = totalCurrent / (this.config.capacitance * this.config.resistance);
    
    // Euler integration
    this.membranePotential += (leak + injection) * deltaTime;
    
    // Update adaptation current
    this.adaptationCurrent *= Math.exp(-deltaTime / this.adaptationTimeConstant);

    // Record voltage history
    this.voltageHistory.push(this.membranePotential);
    if (this.voltageHistory.length > this.maxHistoryLength) {
      this.voltageHistory.shift();
    }

    // Check for spike
    if (this.membranePotential >= this.config.threshold) {
      this.fired = true;
      this.lastSpikeTime = currentTime;
      this.refractoryUntil = currentTime + this.config.refractoryPeriod;
      this.membranePotential = this.config.resetPotential;
      
      // Update adaptation
      this.adaptationCurrent += this.adaptationIncrement;
      
      // Update spike statistics
      this.totalSpikes++;
      this.spikeHistory.push(currentTime);
      
      if (this.spikeHistory.length > this.maxHistoryLength) {
        this.spikeHistory.shift();
      }
    }

    return this.fired;
  }

  public reset(): void {
    this.membranePotential = this.config.restingPotential;
    this.fired = false;
    this.lastSpikeTime = null;
    this.refractoryUntil = 0;
    this.totalSpikes = 0;
    this.spikeHistory = [];
    this.voltageHistory = [];
    this.adaptationCurrent = 0;
  }
}