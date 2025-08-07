// src/lib/Neuron.ts
export class Neuron {
  // State variables
  public membranePotential: number = 0;
  public readonly threshold: number;
  public readonly resetPotential: number = 0.0;
  public readonly decay: number;
  public readonly refractoryPeriod: number;

  // Firing state
  private fired: boolean = false;
  private lastSpikeTime: number | null = null;
  private refractoryUntil: number = 0;

  // Statistics for monitoring
  public totalSpikes: number = 0;
  public spikeHistory: number[] = [];
  public readonly maxHistoryLength: number = 100;

  constructor(
    threshold: number = 1.0,
    decay: number = 0.95,
    refractoryPeriod: number = 2
  ) {
    this.threshold = threshold;
    this.decay = decay;
    this.refractoryPeriod = refractoryPeriod;
  }

  public hasFired(): boolean {
    return this.fired;
  }

  public isInRefractoryPeriod(currentTime: number): boolean {
    return currentTime < this.refractoryUntil;
  }

  public getSpikeRate(timeWindow: number = 50): number {
    if (this.spikeHistory.length < 2) return 0;
    
    const currentTime = this.spikeHistory[this.spikeHistory.length - 1] || 0;
    const validSpikes = this.spikeHistory.filter(
      time => time > currentTime - timeWindow
    );
    
    return validSpikes.length / timeWindow;
  }

  public step(inputCurrent: number, time: number): boolean {
    this.fired = false;

    // Skip processing if in refractory period
    if (this.isInRefractoryPeriod(time)) {
      return false;
    }

    // Apply decay (leaky part)
    this.membranePotential *= this.decay;

    // Integrate input current
    this.membranePotential += inputCurrent;

    // Check for spike
    if (this.membranePotential >= this.threshold) {
      this.membranePotential = this.resetPotential;
      this.fired = true;
      this.lastSpikeTime = time;
      this.refractoryUntil = time + this.refractoryPeriod;
      
      // Update statistics
      this.totalSpikes++;
      this.spikeHistory.push(time);
      
      // Limit history length
      if (this.spikeHistory.length > this.maxHistoryLength) {
        this.spikeHistory.shift();
      }
    }

    // Clamp potential
    if (this.membranePotential < this.resetPotential) {
      this.membranePotential = this.resetPotential;
    }

    return this.fired;
  }

  public reset(): void {
    this.membranePotential = this.resetPotential;
    this.fired = false;
    this.lastSpikeTime = null;
    this.refractoryUntil = 0;
    this.totalSpikes = 0;
    this.spikeHistory = [];
  }
}