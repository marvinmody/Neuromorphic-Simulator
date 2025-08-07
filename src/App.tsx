import React, { useState, useEffect, useRef } from 'react';
import { Neuron } from './lib/Neuron';
import { Network, Synapse, NetworkTopology } from './lib/Network';
import { Simulator } from './lib/Simulator';
import NetworkGraph from './components/NetworkGraph';
import ControlPanel from './components/ControlPanel';
import MetricsDashboard from './components/MetricsDashboard';
import './App.css';

function App() {
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [synapses, setSynapses] = useState<Synapse[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedNeuron, setSelectedNeuron] = useState<number | null>(null);

  const simulatorRef = useRef<Simulator | null>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    initializeNetwork();
    return () => {
      simulatorRef.current?.pause();
    };
  }, []);

  const initializeNetwork = () => {
    const network = new Network();
    networkRef.current = network;

    // Create default network
    network.createTopology('random', 8);
    
    // Add some input stimulation
    const inputNeuron = network.addNeuron(new Neuron(0.5, 0.9)); // Lower threshold, faster decay
    network.neurons[inputNeuron].membranePotential = 1.2;
    
    // Connect input to first few neurons
    for (let i = 0; i < Math.min(3, network.neurons.length - 1); i++) {
      network.addSynapse({
        from: inputNeuron,
        to: i,
        weight: 0.8,
        delay: Math.floor(Math.random() * 3) + 1
      });
    }
    
    // Self-excitation for continuous input
    network.addSynapse({
      from: inputNeuron,
      to: inputNeuron,
      weight: 1.1,
      delay: 1
    });

    const onUpdate = (updatedNetwork: Network, time: number) => {
      setNeurons([...updatedNetwork.neurons]);
      setSynapses([...updatedNetwork.synapses]);
      setCurrentTime(time);
    };

    simulatorRef.current = new Simulator(network, onUpdate, 60);
    simulatorRef.current.setInputPattern('Random');
    
    setNeurons([...network.neurons]);
    setSynapses([...network.synapses]);
  };

  const handlePlayPause = () => {
    const simulator = simulatorRef.current;
    if (!simulator) return;

    if (isRunning) {
      simulator.pause();
    } else {
      simulator.play();
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    const simulator = simulatorRef.current;
    if (!simulator) return;

    simulator.pause();
    simulator.reset();
    setIsRunning(false);
    setCurrentTime(0);
    
    if (networkRef.current) {
      setNeurons([...networkRef.current.neurons]);
      setSynapses([...networkRef.current.synapses]);
    }
  };

  const handleTopologyChange = (topology: NetworkTopology, size: number) => {
    const network = networkRef.current;
    if (!network) return;

    // Pause simulation
    const wasRunning = isRunning;
    if (wasRunning) {
      simulatorRef.current?.pause();
      setIsRunning(false);
    }

    // Create new topology
    network.createTopology(topology, size);
    
    // Update state
    setNeurons([...network.neurons]);
    setSynapses([...network.synapses]);
    setCurrentTime(0);
    setSelectedNeuron(null);

    // Resume if was running
    if (wasRunning) {
      setTimeout(() => {
        simulatorRef.current?.play();
        setIsRunning(true);
      }, 100);
    }
  };

  const handleNodeClick = (nodeIndex: number) => {
    setSelectedNeuron(nodeIndex === selectedNeuron ? null : nodeIndex);
  };

  const handleLinkClick = (link: any) => {
    console.log('Clicked synapse:', link);
    // Could implement synapse editing here
  };

  if (!simulatorRef.current || !networkRef.current) {
    return <div className="loading">Initializing simulator...</div>;
  }

  return (
    <div className="App">
      <header>
        <h1>Neuromorphic Computing Simulator</h1>
        <div className="header-info">
          <span>Time: {currentTime}</span>
          <span>|</span>
          <span>Neurons: {neurons.length}</span>
          <span>|</span>
          <span>Synapses: {synapses.length}</span>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          <ControlPanel
            simulator={simulatorRef.current}
            network={networkRef.current}
            isRunning={isRunning}
            onPlayPause={handlePlayPause}
            onReset={handleReset}
            onTopologyChange={handleTopologyChange}
          />
        </aside>

        <main className="content">
          <div className="visualization-container">
            <NetworkGraph
              neurons={neurons}
              synapses={synapses}
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
            />
          </div>

          {selectedNeuron !== null && (
            <div className="neuron-details">
              <h3>Neuron {selectedNeuron} Details</h3>
              <div className="neuron-stats">
                <div>Membrane Potential: {neurons[selectedNeuron]?.membranePotential.toFixed(3)}</div>
                <div>Threshold: {neurons[selectedNeuron]?.threshold.toFixed(3)}</div>
                <div>Total Spikes: {neurons[selectedNeuron]?.totalSpikes}</div>
                <div>Firing Rate: {neurons[selectedNeuron]?.getSpikeRate().toFixed(3)}</div>
                <div>Is Firing: {neurons[selectedNeuron]?.hasFired() ? 'Yes' : 'No'}</div>
                <div>In Refractory: {neurons[selectedNeuron]?.isInRefractoryPeriod(currentTime) ? 'Yes' : 'No'}</div>
              </div>
            </div>
          )}
        </main>

        <aside className="metrics-sidebar">
          <MetricsDashboard
            network={networkRef.current}
            time={currentTime}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;