import React from 'react';
import { NetworkTopology, Network } from '../lib/Network';
import { Simulator } from '../lib/Simulator';

interface ControlPanelProps {
  simulator: Simulator;
  network: Network;
  isRunning: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onTopologyChange: (topology: NetworkTopology, size: number) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  simulator,
  network,
  isRunning,
  onPlayPause,
  onReset,
  onTopologyChange
}) => {
  const [selectedTopology, setSelectedTopology] = React.useState<NetworkTopology>('random');
  const [networkSize, setNetworkSize] = React.useState(8);
  const [speed, setSpeed] = React.useState(60);
  const [inputPattern, setInputPattern] = React.useState('Random');
  const [noiseLevel, setNoiseLevel] = React.useState(0.1);

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    simulator.setSpeed(newSpeed);
  };

  const handlePatternChange = (pattern: string) => {
    setInputPattern(pattern);
    simulator.setInputPattern(pattern === 'None' ? null : pattern);
  };

  const handleNoiseChange = (level: number) => {
    setNoiseLevel(level);
    simulator.setNoiseLevel(level);
  };

  const handleSTDPToggle = (enabled: boolean) => {
    network.stdpEnabled = enabled;
  };

  const handleTopologyCreate = () => {
    onTopologyChange(selectedTopology, networkSize);
  };

  const stats = network.getNetworkStats();

  return (
    <div className="control-panel">
      {/* Simulation Controls */}
      <div className="control-section">
        <h3>Simulation</h3>
        <div className="button-group">
          <button onClick={onPlayPause} className={isRunning ? 'pause' : 'play'}>
            {isRunning ? 'Pause' : 'Play'}
          </button>
          <button onClick={onReset}>Reset</button>
        </div>
        
        <div className="control-group">
          <label>Speed: {speed}</label>
          <input
            type="range"
            min="1"
            max="120"
            value={speed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Network Topology */}
      <div className="control-section">
        <h3>Network Topology</h3>
        <div className="control-group">
          <label>Type:</label>
          <select
            value={selectedTopology}
            onChange={(e) => setSelectedTopology(e.target.value as NetworkTopology)}
          >
            <option value="random">Random</option>
            <option value="feedforward">Feedforward</option>
           <option value="small-world">Small World</option>
           <option value="ring">Ring</option>
         </select>
       </div>
       
       <div className="control-group">
         <label>Size: {networkSize}</label>
         <input
           type="range"
           min="4"
           max="20"
           value={networkSize}
           onChange={(e) => setNetworkSize(Number(e.target.value))}
         />
       </div>
       
       <button onClick={handleTopologyCreate}>Create Network</button>
     </div>

     {/* Input Patterns */}
     <div className="control-section">
       <h3>Input Patterns</h3>
       <div className="control-group">
         <label>Pattern:</label>
         <select
           value={inputPattern}
           onChange={(e) => handlePatternChange(e.target.value)}
         >
           <option value="None">None</option>
           {simulator.patterns.map(pattern => (
             <option key={pattern.name} value={pattern.name}>
               {pattern.name}
             </option>
           ))}
         </select>
       </div>
       
       <div className="control-group">
         <label>Noise Level: {noiseLevel.toFixed(2)}</label>
         <input
           type="range"
           min="0"
           max="1"
           step="0.01"
           value={noiseLevel}
           onChange={(e) => handleNoiseChange(Number(e.target.value))}
         />
       </div>
     </div>

     {/* Learning */}
     <div className="control-section">
       <h3>Learning (STDP)</h3>
       <div className="control-group">
         <label>
           <input
             type="checkbox"
             checked={network.stdpEnabled}
             onChange={(e) => handleSTDPToggle(e.target.checked)}
           />
           Enable STDP
         </label>
       </div>
       
       {network.stdpEnabled && (
         <>
           <div className="control-group">
             <label>Learning Rate: {network.stdpLearningRate}</label>
             <input
               type="range"
               min="0.001"
               max="0.1"
               step="0.001"
               value={network.stdpLearningRate}
               onChange={(e) => network.stdpLearningRate = Number(e.target.value)}
             />
           </div>
           
           <div className="control-group">
             <label>Time Constant: {network.stdpTimeConstant}</label>
             <input
               type="range"
               min="5"
               max="50"
               step="1"
               value={network.stdpTimeConstant}
               onChange={(e) => network.stdpTimeConstant = Number(e.target.value)}
             />
           </div>
         </>
       )}
     </div>

     {/* Network Statistics */}
     <div className="control-section">
       <h3>Statistics</h3>
       <div className="stats">
         <div>Neurons: {network.neurons.length}</div>
         <div>Synapses: {stats.totalSynapses}</div>
         <div>Total Spikes: {stats.totalSpikes}</div>
         <div>Avg Firing Rate: {stats.avgFiringRate.toFixed(3)}</div>
         <div>Avg Weight: {stats.avgWeight.toFixed(3)}</div>
         <div>Connectivity: {(stats.connectivity * 100).toFixed(1)}%</div>
       </div>
     </div>
   </div>
 );
};

export default ControlPanel;