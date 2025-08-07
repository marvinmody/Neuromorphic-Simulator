import React, { useState } from 'react';
import { NetworkTopology, Network } from '../lib/Network';
import { Simulator } from '../lib/Simulator';

interface ControlPanelProps {
  simulator: Simulator;
  network: Network;
  isRunning: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onTopologyChange: (topology: NetworkTopology, size: number) => void;
  onVisualizationChange: (showVoltage: boolean, showWeights: boolean) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  simulator,
  network,
  isRunning,
  onPlayPause,
  onReset,
  onTopologyChange,
  onVisualizationChange
}) => {
  const [selectedTopology, setSelectedTopology] = useState<NetworkTopology>('cortical-column');
  const [networkSize, setNetworkSize] = useState(8);
  const [simulationSpeed, setSimulationSpeed] = useState(60);
  const [inputPattern, setInputPattern] = useState('Poisson');
  const [inputStrength, setInputStrength] = useState(0.5);
  const [showVoltageTraces, setShowVoltageTraces] = useState(false);
  const [showWeightEvolution, setShowWeightEvolution] = useState(true);

  // STDP Parameters
  const [stdpEnabled, setStdpEnabled] = useState(true);
  const [stdpAPlus, setStdpAPlus] = useState(0.01);
  const [stdpAMinus, setStdpAMinus] = useState(0.0105);
  const [stdpTauPlus, setStdpTauPlus] = useState(20);
  const [stdpTauMinus, setStdpTauMinus] = useState(20);

  // Homeostasis
  const [homeostasisEnabled, setHomeostasisEnabled] = useState(true);
  const [targetFiringRate, setTargetFiringRate] = useState(10);

  const handleSpeedChange = (newSpeed: number) => {
    setSimulationSpeed(newSpeed);
    simulator.setSpeed(newSpeed);
  };

  const handlePatternChange = (pattern: string) => {
    setInputPattern(pattern);
    simulator.setInputPattern(pattern === 'None' ? null : pattern);
  };

  const handleInputStrengthChange = (strength: number) => {
    setInputStrength(strength);
    simulator.setInputStrength(strength);
  };

  const handleSTDPChange = () => {
    network.globalPlasticityEnabled = stdpEnabled;
    // Update all synapses with new STDP parameters
    network.synapses.forEach(synapse => {
      synapse.plasticity.enabled = stdpEnabled;
      synapse.plasticity.aPlus = stdpAPlus;
      synapse.plasticity.aMinus = stdpAMinus;
      synapse.plasticity.tauPlus = stdpTauPlus;
      synapse.plasticity.tauMinus = stdpTauMinus;
    });
  };

  const handleHomeostasisChange = () => {
    network.homeostasisEnabled = homeostasisEnabled;
    network.targetFiringRate = targetFiringRate;
  };

  const handleTopologyCreate = () => {
    if (selectedTopology === 'cortical-column') {
      network.createCorticalColumn([4, 6, 4, 2]);
    } else {
      onTopologyChange(selectedTopology, networkSize);
    }
  };

  const handleVisualizationToggle = () => {
    onVisualizationChange(showVoltageTraces, showWeightEvolution);
  };

  React.useEffect(() => {
    handleSTDPChange();
  }, [stdpEnabled, stdpAPlus, stdpAMinus, stdpTauPlus, stdpTauMinus]);

  React.useEffect(() => {
    handleHomeostasisChange();
  }, [homeostasisEnabled, targetFiringRate]);

  React.useEffect(() => {
    handleVisualizationToggle();
  }, [showVoltageTraces, showWeightEvolution]);

  const stats = network.getNetworkStats();

  return (
    <div className="control-panel">
      {/* Simulation Controls */}
      <div className="control-section">
        <h3>🎮 Simulation Control</h3>
        <div className="button-group">
          <button 
            onClick={onPlayPause} 
            className={isRunning ? 'pause' : 'play'}
            title={isRunning ? 'Pause simulation' : 'Start simulation'}
          >
            {isRunning ? '⏸️ Pause' : '▶️ Play'}
          </button>
          <button onClick={onReset} title="Reset network state">
            🔄 Reset
          </button>
        </div>
        
        <div className="control-group">
          <label>
            ⚡ Speed: {simulationSpeed}fps
            <span className="help-text">Higher = faster simulation</span>
          </label>
          <input
            type="range"
            min="1"
            max="120"
            value={simulationSpeed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
          />
        </div>

        <div className="time-display">
          Time: {stats.currentTime.toFixed(1)}ms
        </div>
      </div>

      {/* Network Architecture */}
      <div className="control-section">
        <h3>🧠 Network Architecture</h3>
        <div className="control-group">
          <label>Topology:</label>
          <select
            value={selectedTopology}
            onChange={(e) => setSelectedTopology(e.target.value as NetworkTopology)}
          >
            <option value="cortical-column">Cortical Column</option>
            <option value="feedforward">Feedforward</option>
            <option value="random">Random</option>
            <option value="small-world">Small World</option>
            <option value="ring">Ring</option>
          </select>
        </div>
        
        {selectedTopology !== 'cortical-column' && (
          <div className="control-group">
            <label>Size: {networkSize} neurons</label>
            <input
              type="range"
              min="4"
              max="25"
              value={networkSize}
              onChange={(e) => setNetworkSize(Number(e.target.value))}
            />
          </div>
        )}
        
        <button onClick={handleTopologyCreate} className="create-btn">
          🏗️ Create Network
        </button>
      </div>

      {/* Input Stimulation */}
      <div className="control-section">
        <h3>⚡ Input Stimulation</h3>
        <div className="control-group">
          <label>Pattern:</label>
          <select
            value={inputPattern}
            onChange={(e) => handlePatternChange(e.target.value)}
          >
            <option value="None">None</option>
            <option value="Poisson">Poisson Spikes</option>
            <option value="Rhythmic">Rhythmic Bursts</option>
            <option value="Random">Random</option>
            <option value="Pulse Train">Pulse Train</option>
            <option value="Wave">Traveling Wave</option>
          </select>
        </div>
        
        <div className="control-group">
          <label>
            Strength: {inputStrength.toFixed(2)}
            <span className="help-text">Current injection amplitude</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={inputStrength}
            onChange={(e) => handleInputStrengthChange(Number(e.target.value))}
          />
        </div>
      </div>

      {/* STDP Learning */}
      <div className="control-section">
        <h3>🧪 Synaptic Plasticity (STDP)</h3>
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={stdpEnabled}
              onChange={(e) => setStdpEnabled(e.target.checked)}
            />
            Enable STDP Learning
          </label>
        </div>
        
        {stdpEnabled && (
          <>
            <div className="control-group">
              <label>
                LTP Amplitude (A+): {stdpAPlus.toFixed(4)}
                <span className="help-text">Potentiation strength</span>
              </label>
              <input
                type="range"
                min="0.001"
                max="0.05"
                step="0.001"
                value={stdpAPlus}
                onChange={(e) => setStdpAPlus(Number(e.target.value))}
              />
            </div>
            
            <div className="control-group">
              <label>
                LTD Amplitude (A-): {stdpAMinus.toFixed(4)}
                <span className="help-text">Depression strength</span>
              </label>
              <input
                type="range"
                min="0.001"
                max="0.05"
                step="0.001"
                value={stdpAMinus}
                onChange={(e) => setStdpAMinus(Number(e.target.value))}
              />
            </div>
            
            <div className="control-group">
              <label>
                Time Constant (τ): {stdpTauPlus}ms
                <span className="help-text">STDP time window</span>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={stdpTauPlus}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setStdpTauPlus(val);
                  setStdpTauMinus(val);
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Homeostasis */}
      <div className="control-section">
        <h3>⚖️ Homeostasis</h3>
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={homeostasisEnabled}
              onChange={(e) => setHomeostasisEnabled(e.target.checked)}
            />
            Enable Homeostatic Regulation
          </label>
        </div>
        
        {homeostasisEnabled && (
          <div className="control-group">
            <label>
              Target Rate: {targetFiringRate}Hz
              <span className="help-text">Desired average firing rate</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={targetFiringRate}
              onChange={(e) => setTargetFiringRate(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      {/* Visualization Options */}
      <div className="control-section">
        <h3>👁️ Visualization</h3>
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showVoltageTraces}
              onChange={(e) => setShowVoltageTraces(e.target.checked)}
            />
            Show Voltage Traces
          </label>
        </div>
        
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showWeightEvolution}
              onChange={(e) => setShowWeightEvolution(e.target.checked)}
            />
            Show Weight Changes
          </label>
        </div>
      </div>

      {/* Network Statistics */}
      <div className="control-section">
        <h3>📊 Network Metrics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Neurons:</span>
            <span className="stat-value">{network.neurons.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Synapses:</span>
            <span className="stat-value">{stats.totalSynapses}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Spikes:</span>
            <span className="stat-value">{stats.totalSpikes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Rate:</span>
            <span className="stat-value">{stats.avgFiringRate.toFixed(1)}Hz</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Active Neurons:</span>
            <span className="stat-value">{stats.activeNeurons}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Synchrony:</span>
            <span className="stat-value">{stats.synchronyIndex.toFixed(3)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Weight:</span>
            <span className="stat-value">{stats.avgWeight.toFixed(3)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Connectivity:</span>
            <span className="stat-value">{(stats.connectivity * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;