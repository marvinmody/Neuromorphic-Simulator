import { Neuron, NeuronConfig } from './Neuron';

export interface SynapseConfig {
  from: number;
  to: number;
  weight: number;
  delay: number;
  plasticity: {
    enabled: boolean;
    aPlus: number;  // LTP amplitude
    aMinus: number; // LTD amplitude
    tauPlus: number; // LTP time constant
    tauMinus: number; // LTD time constant
  };
}

export type Synapse = SynapseConfig & {
  id: string;
  weightHistory: number[];
  lastUpdate: number;
};

export type NetworkTopology = 'random' | 'feedforward' | 'small-world' | 'ring' | 'cortical-column';

interface SpikeEvent {
  targetNeuron: number;
  sourceNeuron: number;
  weight: number;
  arrivalTime: number;
  synapseId: string;
}

export class Network {
  public neurons: Neuron[];
  public synapses: Synapse[];
  private spikeQueue: SpikeEvent[];
  private currentTime: number = 0;
  private deltaTime: number = 0.1; // ms
  
  // Network-level plasticity parameters
  public globalPlasticityEnabled: boolean = false;
  public homeostasisEnabled: boolean = true;
  public targetFiringRate: number = 10; // Hz
  
  // Performance tracking
  public networkActivity: number[] = [];
  public synchronyIndex: number = 0;

  constructor() {
    this.neurons = [];
    this.synapses = [];
    this.spikeQueue = [];
  }

  addNeuron(config?: Partial<NeuronConfig>): number {
    const neuron = new Neuron(config);
    this.neurons.push(neuron);
    return this.neurons.length - 1;
  }

  addSynapse(config: Omit<SynapseConfig, 'plasticity'> & { plasticity?: Partial<SynapseConfig['plasticity']> }): void {
    const synapse: Synapse = {
      ...config,
      plasticity: {
        enabled: true,
        aPlus: 0.01,
        aMinus: 0.0105,
        tauPlus: 20,
        tauMinus: 20,
        ...config.plasticity
      },
      id: `${config.from}-${config.to}-${Date.now()}-${Math.random()}`,
      weightHistory: [config.weight],
      lastUpdate: 0
    };
    this.synapses.push(synapse);
  }

  createCorticalColumn(layers: number[] = [4, 8, 6, 2]): void {
    this.neurons = [];
    this.synapses = [];
    
    let neuronIndex = 0;
    const layerStartIndices: number[] = [];
    
    // Create neurons for each layer with different properties
    layers.forEach((size, layerIdx) => {
      layerStartIndices.push(neuronIndex);
      
      for (let i = 0; i < size; i++) {
        // Layer-specific properties
        const config: Partial<NeuronConfig> = {
          threshold: -50 + (layerIdx * 2), // Deeper layers slightly higher threshold
          membraneTau: 15 + (layerIdx * 5), // Deeper layers slower
          adaptationIncrement: 0.05 + (layerIdx * 0.02)
        };
        
        this.addNeuron(config);
        neuronIndex++;
      }
    });
    
    // Create inter-layer connections
    for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
      const currentLayerStart = layerStartIndices[layerIdx];
      const currentLayerSize = layers[layerIdx];
      const nextLayerStart = layerStartIndices[layerIdx + 1];
      const nextLayerSize = layers[layerIdx + 1];
      
      // Forward connections
      for (let i = 0; i < currentLayerSize; i++) {
        const sourceIdx = currentLayerStart + i;
        
        // Connect to multiple neurons in next layer
        const connectionProbability = layerIdx === 0 ? 0.8 : 0.6;
        
        for (let j = 0; j < nextLayerSize; j++) {
          const targetIdx = nextLayerStart + j;
          
          if (Math.random() < connectionProbability) {
            this.addSynapse({
              from: sourceIdx,
              to: targetIdx,
              weight: 0.3 + Math.random() * 0.4,
              delay: 1 + Math.floor(Math.random() * 3),
              plasticity: { enabled: this.globalPlasticityEnabled }
            });
          }
        }
      }
      
      // Recurrent connections within layer (sparse)
      for (let i = 0; i < currentLayerSize; i++) {
        for (let j = 0; j < currentLayerSize; j++) {
          if (i !== j && Math.random() < 0.1) {
            this.addSynapse({
              from: currentLayerStart + i,
              to: currentLayerStart + j,
              weight: 0.1 + Math.random() * 0.2,
              delay: 1,
              plasticity: { enabled: this.globalPlasticityEnabled }
            });
          }
        }
      }
    }
  }

  private applySTDP(synapse: Synapse, preSpikes: number[], postSpikes: number[]): void {
    if (!synapse.plasticity.enabled || !this.globalPlasticityEnabled) return;
    
    let weightChange = 0;
    const recentWindow = 100; // ms
    const currentTime = this.currentTime;
    
    // Filter recent spikes
    const recentPreSpikes = preSpikes.filter(t => t > currentTime - recentWindow);
    const recentPostSpikes = postSpikes.filter(t => t > currentTime - recentWindow);
    
    // Apply STDP rule
    recentPreSpikes.forEach(tPre => {
      recentPostSpikes.forEach(tPost => {
        const dt = tPost - tPre;
        
        if (dt > 0) {
          // LTP: post after pre
          weightChange += synapse.plasticity.aPlus * Math.exp(-dt / synapse.plasticity.tauPlus);
        } else if (dt < 0) {
          // LTD: pre after post
          weightChange -= synapse.plasticity.aMinus * Math.exp(dt / synapse.plasticity.tauMinus);
        }
      });
    });
    
    // Apply weight change with bounds
    const oldWeight = synapse.weight;
    synapse.weight = Math.max(0, Math.min(2, synapse.weight + weightChange));
    
    // Record weight history
    if (Math.abs(synapse.weight - oldWeight) > 0.001) {
      synapse.weightHistory.push(synapse.weight);
      if (synapse.weightHistory.length > 100) {
        synapse.weightHistory.shift();
      }
      synapse.lastUpdate = currentTime;
    }
  }

  private applyHomeostasis(): void {
    if (!this.homeostasisEnabled) return;
    
    this.neurons.forEach(neuron => {
      const currentRate = neuron.getInstantaneousFiringRate();
      const rateDiff = this.targetFiringRate - currentRate;
      
      // Adjust threshold based on firing rate
      if (Math.abs(rateDiff) > 1) {
        const adjustment = rateDiff * 0.001; // Small adjustment
        neuron.config.threshold += adjustment;
        
        // Keep threshold within reasonable bounds
        neuron.config.threshold = Math.max(-60, Math.min(-40, neuron.config.threshold));
      }
    });
  }

  step(): void {
    this.currentTime += this.deltaTime;
    
    // Process spike queue
    const inputs = new Array(this.neurons.length).fill(0);
    const remainingEvents: SpikeEvent[] = [];
    
    for (const event of this.spikeQueue) {
      if (event.arrivalTime <= this.currentTime) {
        inputs[event.targetNeuron] += event.weight;
        
        // Apply STDP
        const synapse = this.synapses.find(s => s.id === event.synapseId);
        if (synapse) {
          const preNeuron = this.neurons[event.sourceNeuron];
          const postNeuron = this.neurons[event.targetNeuron];
          this.applySTDP(synapse, preNeuron.spikeHistory, postNeuron.spikeHistory);
        }
      } else {
        remainingEvents.push(event);
      }
    }
    this.spikeQueue = remainingEvents;

    // Update neurons
    let activeSpikes = 0;
    for (let i = 0; i < this.neurons.length; i++) {
      const neuron = this.neurons[i];
      const didFire = neuron.step(inputs[i], this.deltaTime, this.currentTime);

      if (didFire) {
        activeSpikes++;
        
        // Queue spikes for connected neurons
        const outgoingSynapses = this.synapses.filter(s => s.from === i);
        for (const synapse of outgoingSynapses) {
          this.spikeQueue.push({
            targetNeuron: synapse.to,
            sourceNeuron: i,
            weight: synapse.weight,
            arrivalTime: this.currentTime + synapse.delay,
            synapseId: synapse.id
          });
        }
      }
    }
    
    // Track network activity
    this.networkActivity.push(activeSpikes);
    if (this.networkActivity.length > 1000) {
      this.networkActivity.shift();
    }
    
    // Calculate synchrony index
    this.updateSynchronyIndex();
    
    // Apply homeostasis periodically
    if (Math.floor(this.currentTime) % 100 === 0) {
      this.applyHomeostasis();
    }
  }

  private updateSynchronyIndex(): void {
    if (this.networkActivity.length < 10) return;
    
    const recent = this.networkActivity.slice(-10);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    
    // Synchrony index: higher variance indicates more synchronous activity
    this.synchronyIndex = variance / (mean + 0.001); // Avoid division by zero
  }

  getNetworkStats() {
    const totalSpikes = this.neurons.reduce((sum, n) => sum + n.totalSpikes, 0);
    const avgFiringRate = this.neurons.reduce((sum, n) => sum + n.getInstantaneousFiringRate(), 0) / this.neurons.length;
    const totalSynapses = this.synapses.length;
    const avgWeight = this.synapses.reduce((sum, s) => sum + s.weight, 0) / totalSynapses;
    const activeNeurons = this.neurons.filter(n => n.getInstantaneousFiringRate() > 0.1).length;
    
    return {
      totalSpikes,
      avgFiringRate,
      totalSynapses,
      avgWeight,
      connectivity: totalSynapses / (this.neurons.length * (this.neurons.length - 1)),
      activeNeurons,
      synchronyIndex: this.synchronyIndex,
      currentTime: this.currentTime
    };
  }

  reset(): void {
    this.currentTime = 0;
    this.neurons.forEach(neuron => neuron.reset());
    this.spikeQueue = [];
    this.networkActivity = [];
    this.synchronyIndex = 0;
    
    // Reset synapse weights to initial values
    this.synapses.forEach(synapse => {
      if (synapse.weightHistory.length > 0) {
        synapse.weight = synapse.weightHistory[0];
        synapse.weightHistory = [synapse.weight];
      }
    });
  }
}