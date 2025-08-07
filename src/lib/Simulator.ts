import { Network } from './Network';

export type InputPattern = {
  name: string;
  generate: (time: number, networkSize: number) => number[];
};

export class Simulator {
  public network: Network;
  private isRunning: boolean = false;
  private intervalId: number | null = null;
  private onUpdate: (network: Network, time: number) => void;
  private time: number = 0;
  private speed: number;
  private stepsPerFrame: number = 1;
  
  // Input patterns
  private currentPattern: InputPattern | null = null;
  public noiseLevel: number = 0.1;
  public inputStrength: number = 1.0;

  // Built-in patterns - biologically realistic parameters
  public readonly patterns: InputPattern[] = [
    {
      name: 'Random',
      generate: (time: number, networkSize: number) => 
        Array.from({ length: networkSize }, () => 
          Math.random() < 0.1 ? Math.random() * 50 : 0 // pA (picoamperes)
        )
    },
    {
      name: 'Poisson',
      generate: (time: number, networkSize: number) => 
        Array.from({ length: networkSize }, () => 
          Math.random() < 0.05 ? 20 + Math.random() * 30 : 0 // 20-50 pA
        )
    },
    {
      name: 'Rhythmic',
      generate: (time: number, networkSize: number) => {
        const rhythm = Math.sin(time * 0.02) > 0.5; // 10Hz rhythm
        return Array.from({ length: networkSize }, (_, i) => 
          rhythm && i < 2 ? 40 : 0 // 40 pA current injection
        );
      }
    },
    {
      name: 'Pulse Train',
      generate: (time: number, networkSize: number) => {
        const pulseInterval = 100; // 100ms intervals = 10Hz
        const pulseWidth = 5; // 5ms pulses
        const inPulse = (time % pulseInterval) < pulseWidth;
        return Array.from({ length: networkSize }, (_, i) => 
          inPulse && i < 3 ? 60 : 0 // 60 pA current injection
        );
      }
    },
    {
      name: 'Wave',
      generate: (time: number, networkSize: number) => 
        Array.from({ length: networkSize }, (_, i) => {
          const phase = (time * 0.01) + (i * Math.PI / networkSize);
          return Math.max(0, Math.sin(phase)) * 30; // 0-30 pA sinusoidal current
        })
    },
    {
      name: 'Burst',
      generate: (time: number, networkSize: number) => {
        const burstInterval = 500; // 500ms intervals
        const burstLength = 50; // 50ms bursts
        const inBurst = (time % burstInterval) < burstLength;
        return Array.from({ length: networkSize }, (_, i) => 
          inBurst && i === 0 ? 80 : 0 // 80 pA strong stimulation
        );
      }
    }
  ];

  constructor(
    network: Network,
    onUpdate: (network: Network, time: number) => void,
    speed: number = 1
  ) {
    this.network = network;
    this.onUpdate = onUpdate;
    this.speed = speed;
    this.calculateStepsPerFrame();
  }

  private calculateStepsPerFrame(): void {
    // Realistic biological timing
    const biologicalTimeStep = 0.1; // 0.1ms per simulation step
    const targetFPS = 60; // Visual update rate
    const frameInterval = 1000 / targetFPS; // ~16.67ms per visual frame
    
    // Speed control: 1 = real-time, higher = faster than real-time
    // Real-time means: 16.67ms of simulation time per 16.67ms of real time
    const simulationTimePerFrame = frameInterval * (this.speed / 10);
    
    // Calculate steps needed for this simulation time
    this.stepsPerFrame = Math.max(1, Math.round(simulationTimePerFrame / biologicalTimeStep));
    
    // Cap at reasonable maximum to prevent browser freeze
    this.stepsPerFrame = Math.min(this.stepsPerFrame, 100);
  }

  setInputPattern(patternName: string | null): void {
    this.currentPattern = patternName ? 
      this.patterns.find(p => p.name === patternName) || null : 
      null;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(1, Math.min(100, speed));
    this.calculateStepsPerFrame();
    
    if (this.isRunning) {
      this.pause();
      this.play();
    }
  }

  setNoiseLevel(level: number): void {
    this.noiseLevel = Math.max(0, Math.min(1, level));
  }

  setInputStrength(strength: number): void {
    this.inputStrength = Math.max(0, Math.min(3, strength));
  }

  reset(): void {
    this.time = 0;
    this.network.reset();
  }

  play(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Fixed 60fps for smooth visual updates
    const visualUpdateInterval = 1000 / 60; // 16.67ms
    
    this.intervalId = window.setInterval(() => {
      if (!this.isRunning) return;
      
      // Run calculated number of simulation steps per visual frame
      // At speed=1: ~167 steps per frame (for real-time 0.1ms simulation)
      // At speed=10: ~1670 steps per frame (10x faster than real-time)
      for (let i = 0; i < this.stepsPerFrame; i++) {
        const currentInputs = this.generateBiologicalInputs();
        this.applyBiologicalCurrents(currentInputs);
        this.network.step();
        this.time = this.network.getCurrentTime();
      }
      
      // Update visualization once per frame
      this.onUpdate(this.network, this.time);
    }, visualUpdateInterval);
  }

  pause(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private generateBiologicalInputs(): number[] {
    let currents: number[] = [];

    // Generate pattern-based currents (in pA - picoamperes)
    if (this.currentPattern) {
      currents = this.currentPattern.generate(this.time, this.network.neurons.length);
    } else {
      currents = new Array(this.network.neurons.length).fill(0);
    }

    // Scale by input strength
    currents = currents.map(current => current * this.inputStrength);

    // Add biological noise (Johnson noise, synaptic noise, etc.)
    if (this.noiseLevel > 0) {
      currents = currents.map(current => {
        // Gaussian noise with standard deviation proportional to noise level
        const noise = this.gaussianRandom() * this.noiseLevel * 10; // 0-10 pA noise
        return current + noise;
      });
    }

    // Add spontaneous miniature currents (mEPSCs/mIPSCs)
    currents = currents.map(current => {
      if (Math.random() < 0.01) { // 1% chance per neuron per step
        const miniCurrent = 2 + Math.random() * 8; // 2-10 pA miniature current
        return current + miniCurrent;
      }
      return current;
    });

    return currents;
  }

  private applyBiologicalCurrents(currents: number[]): void {
    // Apply currents in a biologically realistic way
    this.network.neurons.forEach((neuron, i) => {
      if (i < currents.length) {
        const currentInPicoamps = currents[i];
        
        // Convert picoamperes to the appropriate units for your simulation
        // This depends on your neuron model's implementation
        
        // Method 1: If your neuron has a current injection method
        if (typeof (neuron as any).injectCurrent === 'function') {
          (neuron as any).injectCurrent(currentInPicoamps);
        }
        // Method 2: If your neuron has an external current property
        else if ('externalCurrent' in neuron) {
          (neuron as any).externalCurrent = currentInPicoamps;
        }
        // Method 3: If your network has a current injection method
        else if (typeof (this.network as any).injectCurrent === 'function') {
          (this.network as any).injectCurrent(i, currentInPicoamps);
        }
        // Method 4: Calculate conductance change (more realistic)
        else if (currentInPicoamps > 0) {
          this.applyConductanceBasedCurrent(neuron, currentInPicoamps);
        }
      }
    });
  }

  private applyConductanceBasedCurrent(neuron: any, currentPicoamps: number): void {
    // Biologically realistic current injection via conductance changes
    // This simulates synaptic input more accurately than direct current injection
    
    const deltaTime = 0.1; // ms - should match your network's time step
    
    // Convert current to conductance change
    // I = g * (V - E_rev), so g = I / (V - E_rev)
    const reversalPotential = 0; // mV for excitatory synapses (AMPA/NMDA)
    const currentMembranePotential = neuron.membranePotential || -70; // mV
    
    if (Math.abs(currentMembranePotential - reversalPotential) > 0.1) {
      // Calculate equivalent conductance (convert pA to nS)
      const conductanceNanosiemens = Math.abs(currentPicoamps) / 
        Math.abs(currentMembranePotential - reversalPotential) * 1000;
      
      // Apply as synaptic-like input
      const voltageChange = (conductanceNanosiemens / 1000) * 
        (reversalPotential - currentMembranePotential) * deltaTime;
      
      neuron.membranePotential += voltageChange;
    } else {
      // Fallback for when membrane potential equals reversal potential
      // Apply small direct current (less realistic but necessary)
      const currentInNanoamps = currentPicoamps / 1000;
      const membraneCapacitance = 100; // pF typical for neurons
      const voltageChange = (currentInNanoamps * deltaTime) / membraneCapacitance;
      
      neuron.membranePotential += voltageChange;
    }
  }

  private gaussianRandom(): number {
    // Box-Muller transform for Gaussian noise
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}
