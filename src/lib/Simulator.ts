import { Network } from './Network';

export type InputPattern = {
  name: string;
  generate: (time: number, networkSize: number) => number[];
};

export class Simulator {
  public network: Network;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private onUpdate: (network: Network, time: number) => void;
  private time: number = 0;
  private speed: number;
  private frameCounter: number = 0;
  
  // Input patterns
  private currentPattern: InputPattern | null = null;
  public noiseLevel: number = 0.1;

  // Built-in patterns
  public readonly patterns: InputPattern[] = [
    {
      name: 'Random',
      generate: (time: number, networkSize: number) => 
        Array.from({ length: networkSize }, () => 
          Math.random() < 0.1 ? Math.random() * 2 : 0
        )
    },
    {
      name: 'Pulse Train',
      generate: (time: number, networkSize: number) => {
        const pulseInterval = 20;
        const pulseWidth = 3;
        const inPulse = (time % pulseInterval) < pulseWidth;
        return Array.from({ length: networkSize }, (_, i) => 
          inPulse && i < 3 ? 1.5 : 0
        );
      }
    },
    {
      name: 'Wave',
      generate: (time: number, networkSize: number) => 
        Array.from({ length: networkSize }, (_, i) => {
          const phase = (time * 0.2) + (i * Math.PI / networkSize);
          return Math.max(0, Math.sin(phase)) * 0.8;
        })
    },
    {
      name: 'Burst',
      generate: (time: number, networkSize: number) => {
        const burstInterval = 50;
        const burstLength = 5;
        const inBurst = (time % burstInterval) < burstLength;
        return Array.from({ length: networkSize }, (_, i) => 
          inBurst && i === 0 ? 2.0 : 0
        );
      }
    }
  ];

  constructor(
    network: Network,
    onUpdate: (network: Network, time: number) => void,
    speed: number = 5
  ) {
    this.network = network;
    this.onUpdate = onUpdate;
    this.speed = speed;
  }

  setInputPattern(patternName: string | null): void {
    this.currentPattern = patternName ? 
      this.patterns.find(p => p.name === patternName) || null : 
      null;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(1, speed);
  }

  setNoiseLevel(level: number): void {
    this.noiseLevel = Math.max(0, Math.min(1, level));
  }

  reset(): void {
    this.time = 0;
    this.frameCounter = 0;
    this.network.reset();
  }

  play(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.frameCounter = 0;
    this.run();
  }

  pause(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private applyInputs(): void {
    let inputs: number[] = [];

    // Generate pattern inputs
    if (this.currentPattern) {
      inputs = this.currentPattern.generate(this.time, this.network.neurons.length);
    } else {
      inputs = new Array(this.network.neurons.length).fill(0);
    }

    // Add noise
    if (this.noiseLevel > 0) {
      inputs = inputs.map(input => 
        input + (Math.random() - 0.5) * this.noiseLevel * 2
      );
    }

    // Apply inputs to neurons
    inputs.forEach((input, i) => {
      if (i < this.network.neurons.length) {
        this.network.neurons[i].membranePotential += input;
      }
    });
  }

  private run = (): void => {
    if (this.frameCounter % this.speed === 0) {
      this.applyInputs();
      this.network.step(this.time);
      this.time++;
      this.onUpdate(this.network, this.time);
    }

    this.frameCounter++;

    if (this.isRunning) {
      this.animationFrameId = requestAnimationFrame(this.run);
    }
  };
}