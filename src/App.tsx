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

    // Create default network with better initialization
    network.createTopology('random', 12); // Increased size for better dynamics
    
    // Ensure we have some connectivity
    if (network.synapses.length === 0) {
      // Force some connections if random didn't create any
      for (let i = 0; i < Math.min(6, network.neurons.length - 1); i++) {
        const target = (i + 1) % network.neurons.length;
        network.addSynapse({
          from: i,
          to: target,
          weight: 0.5 + Math.random() * 0.5,
          delay: 1 + Math.floor(Math.random() * 3)
        });
      }
    }
    
    // Initialize some neurons with higher membrane potential to kickstart activity
    for (let i = 0; i < Math.min(3, network.neurons.length); i++) {
      network.neurons[i].membranePotential = -55 + Math.random() * 10; // Close to threshold
    }

    const onUpdate = (updatedNetwork: Network, time: number) => {
      setNeurons([...updatedNetwork.neurons]);
      setSynapses([...updatedNetwork.synapses]);
      setCurrentTime(time);
    };

    // Fixed: Use proper speed value and set initial pattern
    simulatorRef.current = new Simulator(network, onUpdate, 10);
    simulatorRef.current.setInputPattern('Poisson'); // Set a default pattern
    simulatorRef.current.setInputStrength(0.8); // Set reasonable input strength
    
    setNeurons([...network.neurons]);
    setSynapses([...network.synapses]);
    setCurrentTime(0);
  };

  const handlePlayPause = () => {
    const simulator = simulatorRef.current;
    if (!simulator) return;

    if (isRunning) {
      simulator.pause();
      setIsRunning(false);
    } else {
      simulator.play();
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    const simulator = simulatorRef.current;
    if (!simulator) return;

    simulator.pause();
    simulator.reset();
    setIsRunning(false);
    setCurrentTime(0);
    
    if (networkRef.current) {
      // Re-initialize some neurons after reset
      for (let i = 0; i < Math.min(3, networkRef.current.neurons.length); i++) {
        networkRef.current.neurons[i].membranePotential = -55 + Math.random() * 10;
      }
      
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
    
    // Initialize some neurons for activity
    for (let i = 0; i < Math.min(3, network.neurons.length); i++) {
      network.neurons[i].membranePotential = -55 + Math.random() * 10;
    }
    
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

  const handleVisualizationChange = (showVoltage: boolean, showWeights: boolean) => {
    // Store visualization preferences - could be passed to components
    console.log('Visualization changed:', { showVoltage, showWeights });
  };

  const handleNodeClick = (nodeIndex: number) => {
    setSelectedNeuron(nodeIndex === selectedNeuron ? null : nodeIndex);
  };

  const handleLinkClick = (link: any) => {
    console.log('Clicked synapse:', link);
  };

  if (!simulatorRef.current || !networkRef.current) {
    return <div className="loading">Initializing simulator...</div>;
  }

  const stats = networkRef.current.getNetworkStats();

  return (
    <div className="App">
      <header>
        <h1>Neuromorphic Computing Simulator</h1>
        <div className="header-info">
          <span>Time: {currentTime.toFixed(1)}ms</span>
          <span>|</span>
          <span>Neurons: {neurons.length}</span>
          <span>|</span>
          <span>Synapses: {synapses.length}</span>
          <span>|</span>
          <span>Active: {neurons.filter(n => n.hasFired()).length}</span>
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
            onVisualizationChange={handleVisualizationChange}
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

          {selectedNeuron !== null && selectedNeuron < neurons.length && (
            <div className="neuron-details">
              <h3>Neuron {selectedNeuron} Details</h3>
              <div className="neuron-stats">
                <div>Membrane Potential: {neurons[selectedNeuron]?.membranePotential.toFixed(3)}mV</div>
                <div>Threshold: {neurons[selectedNeuron]?.config.threshold.toFixed(3)}mV</div>
                <div>Total Spikes: {neurons[selectedNeuron]?.totalSpikes}</div>
                <div>Firing Rate: {neurons[selectedNeuron]?.getInstantaneousFiringRate().toFixed(3)}Hz</div>
                <div>Is Firing: {neurons[selectedNeuron]?.hasFired() ? 'Yes' : 'No'}</div>
                <div>In Refractory: {neurons[selectedNeuron]?.isInRefractoryPeriod(currentTime) ? 'Yes' : 'No'}</div>
                <div>Adaptation Current: {neurons[selectedNeuron]?.adaptationCurrent.toFixed(3)}</div>
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
