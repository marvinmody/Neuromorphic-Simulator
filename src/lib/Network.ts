// src/lib/Network.ts

import { Neuron } from './Neuron';

export type Synapse = {
  from: number;
  to: number;
  weight: number;
  delay: number;
  id: string;
};

type SpikeEvent = {
  targetNeuron: number;
  weight: number;
  arrivalTime: number;
  sourceNeuron: number;
  synapseId: string;
};

export type NetworkTopology = 'random' | 'feedforward' | 'small-world' | 'ring';

export class Network {
  public neurons: Neuron[];
  public synapses: Synapse[];
  private spikeQueue: SpikeEvent[];
  
  // STDP parameters
  public stdpEnabled: boolean = false;
  public stdpLearningRate: number = 0.01;
  public stdpTimeConstant: number = 20;
  public maxWeight: number = 2.0;
  public minWeight: number = 0.0;

  constructor() {
    this.neurons = [];
    this.synapses = [];
    this.spikeQueue = [];
  }

  addNeuron(neuron: Neuron): number {
    this.neurons.push(neuron);
    return this.neurons.length - 1;
  }

  addSynapse(synapse: Omit<Synapse, 'id'>): void {
    const synapseWithId: Synapse = {
      ...synapse,
      id: `${synapse.from}-${synapse.to}-${Date.now()}`
    };
    this.synapses.push(synapseWithId);
  }

  removeSynapse(synapseId: string): void {
    this.synapses = this.synapses.filter(s => s.id !== synapseId);
  }

  createTopology(topology: NetworkTopology, numNeurons: number): void {
    // Clear existing network
    this.neurons = [];
    this.synapses = [];
    this.spikeQueue = [];

    // Add neurons
    for (let i = 0; i < numNeurons; i++) {
      this.addNeuron(new Neuron());
    }

    switch (topology) {
      case 'feedforward':
        this.createFeedforwardTopology();
        break;
      case 'random':
        this.createRandomTopology(0.3);
        break;
      case 'small-world':
        this.createSmallWorldTopology();
        break;
      case 'ring':
        this.createRingTopology();
        break;
    }
  }

  private createFeedforwardTopology(): void {
    const layerSize = Math.ceil(this.neurons.length / 3);
    
    for (let layer = 0; layer < 2; layer++) {
      const startIdx = layer * layerSize;
      const endIdx = Math.min((layer + 1) * layerSize, this.neurons.length);
      const nextStartIdx = (layer + 1) * layerSize;
      const nextEndIdx = Math.min((layer + 2) * layerSize, this.neurons.length);

      for (let i = startIdx; i < endIdx; i++) {
        for (let j = nextStartIdx; j < nextEndIdx; j++) {
          if (Math.random() > 0.5) {
            this.addSynapse({
              from: i,
              to: j,
              weight: 0.5 + Math.random() * 0.5,
              delay: Math.floor(Math.random() * 5) + 1
            });
          }
        }
      }
    }
  }

  private createRandomTopology(connectivity: number): void {
    for (let i = 0; i < this.neurons.length; i++) {
      for (let j = 0; j < this.neurons.length; j++) {
        if (i !== j && Math.random() < connectivity) {
          this.addSynapse({
            from: i,
            to: j,
            weight: Math.random() * 0.8 + 0.2,
            delay: Math.floor(Math.random() * 5) + 1
          });
        }
      }
    }
  }

  private createSmallWorldTopology(): void {
    // Start with ring topology
    this.createRingTopology();
    
    // Randomly rewire some connections
    const rewireProb = 0.3;
    const synapsesToRewire = [...this.synapses];
    
    synapsesToRewire.forEach(synapse => {
      if (Math.random() < rewireProb) {
        // Remove old synapse
        this.removeSynapse(synapse.id);
        
        // Add new random connection
        let newTarget;
        do {
          newTarget = Math.floor(Math.random() * this.neurons.length);
        } while (newTarget === synapse.from);
        
        this.addSynapse({
          from: synapse.from,
          to: newTarget,
          weight: synapse.weight,
          delay: synapse.delay
        });
      }
    });
  }

  private createRingTopology(): void {
    for (let i = 0; i < this.neurons.length; i++) {
      const next = (i + 1) % this.neurons.length;
      this.addSynapse({
        from: i,
        to: next,
        weight: 0.8,
        delay: 2
      });
    }
  }

  private applySTDP(preNeuronIdx: number, postNeuronIdx: number, synapse: Synapse): void {
    if (!this.stdpEnabled) return;

    const preNeuron = this.neurons[preNeuronIdx];
    const postNeuron = this.neurons[postNeuronIdx];
    
    const preSpikes = preNeuron.spikeHistory;
    const postSpikes = postNeuron.spikeHistory;
    
    if (preSpikes.length === 0 || postSpikes.length === 0) return;

    // Get recent spikes
    const recentWindow = 50;
    const currentTime = Math.max(
      preSpikes[preSpikes.length - 1] || 0,
      postSpikes[postSpikes.length - 1] || 0
    );
    
    const recentPreSpikes = preSpikes.filter(t => t > currentTime - recentWindow);
    const recentPostSpikes = postSpikes.filter(t => t > currentTime - recentWindow);

    let weightChange = 0;

    // Calculate STDP weight changes
    recentPreSpikes.forEach(preTime => {
      recentPostSpikes.forEach(postTime => {
        const timeDiff = postTime - preTime;
        
        if (Math.abs(timeDiff) < this.stdpTimeConstant * 3) {
          if (timeDiff > 0) {
            // Post after pre -> strengthen (LTP)
            weightChange += this.stdpLearningRate * Math.exp(-timeDiff / this.stdpTimeConstant);
          } else {
            // Pre after post -> weaken (LTD)
            weightChange -= this.stdpLearningRate * Math.exp(timeDiff / this.stdpTimeConstant);
          }
        }
      });
    });

    // Update weight with bounds
    synapse.weight = Math.max(this.minWeight, 
      Math.min(this.maxWeight, synapse.weight + weightChange)
    );
  }

  step(time: number): void {
    const inputs = new Array(this.neurons.length).fill(0);
    const remainingEvents: SpikeEvent[] = [];

    // Process spike queue
    for (const event of this.spikeQueue) {
      if (event.arrivalTime <= time) {
        inputs[event.targetNeuron] += event.weight;
        
        // Apply STDP when spike arrives
        const synapse = this.synapses.find(s => s.id === event.synapseId);
        if (synapse) {
          this.applySTDP(event.sourceNeuron, event.targetNeuron, synapse);
        }
      } else {
        remainingEvents.push(event);
      }
    }
    this.spikeQueue = remainingEvents;

    // Update neurons
    for (let i = 0; i < this.neurons.length; i++) {
      const neuron = this.neurons[i];
      const didFire = neuron.step(inputs[i], time);

      if (didFire) {
        const outgoingSynapses = this.synapses.filter(s => s.from === i);
        for (const synapse of outgoingSynapses) {
          const newEvent: SpikeEvent = {
            targetNeuron: synapse.to,
            sourceNeuron: i,
            weight: synapse.weight,
            arrivalTime: time + synapse.delay,
            synapseId: synapse.id
          };
          this.spikeQueue.push(newEvent);
        }
      }
    }
  }

  getNetworkStats() {
    const totalSpikes = this.neurons.reduce((sum, n) => sum + n.totalSpikes, 0);
    const avgFiringRate = this.neurons.reduce((sum, n) => sum + n.getSpikeRate(), 0) / this.neurons.length;
    const totalSynapses = this.synapses.length;
    const avgWeight = this.synapses.reduce((sum, s) => sum + s.weight, 0) / totalSynapses;

    return {
      totalSpikes,
      avgFiringRate,
      totalSynapses,
      avgWeight,
      connectivity: totalSynapses / (this.neurons.length * (this.neurons.length - 1))
    };
  }

  reset(): void {
    this.neurons.forEach(neuron => neuron.reset());
    this.spikeQueue = [];
  }
}