import React from 'react';
import { Network } from '../lib/Network';

interface MetricsDashboardProps {
  network: Network;
  time: number;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ network, time }) => {
  const stats = network.getNetworkStats();
  
  // Calculate recent activity (last 100 time steps)
  const recentActivity = network.networkActivity.slice(-100);
  const recentAvgActivity = recentActivity.length > 0 
    ? recentActivity.reduce((sum, val) => sum + val, 0) / recentActivity.length 
    : 0;

  // Spike rate distribution
  const firingRates = network.neurons.map(n => n.getInstantaneousFiringRate());
  const maxRate = Math.max(...firingRates, 1);
  const minRate = Math.min(...firingRates);

  // Weight statistics
  const weights = network.synapses.map(s => s.weight);
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
  const minWeight = weights.length > 0 ? Math.min(...weights) : 0;

  return (
    <div className="metrics-dashboard">
      <h3>📊 Real-time Metrics</h3>
      
      {/* Current Activity */}
      <div className="metric-section">
        <h4>Current Activity</h4>
        <div className="metric-item">
          <span>Active Neurons:</span>
          <span className="metric-value">{network.neurons.filter(n => n.hasFired()).length}/{network.neurons.length}</span>
        </div>
        <div className="metric-item">
          <span>Recent Avg Activity:</span>
          <span className="metric-value">{recentAvgActivity.toFixed(2)}</span>
        </div>
        <div className="metric-item">
          <span>Network Synchrony:</span>
          <span className="metric-value">{stats.synchronyIndex.toFixed(3)}</span>
        </div>
      </div>

      {/* Firing Rate Stats */}
      <div className="metric-section">
        <h4>Firing Rates</h4>
        <div className="metric-item">
          <span>Average:</span>
          <span className="metric-value">{stats.avgFiringRate.toFixed(2)}Hz</span>
        </div>
        <div className="metric-item">
          <span>Max:</span>
          <span className="metric-value">{maxRate.toFixed(2)}Hz</span>
        </div>
        <div className="metric-item">
          <span>Min:</span>
          <span className="metric-value">{minRate.toFixed(2)}Hz</span>
        </div>
      </div>

      {/* Weight Stats */}
      <div className="metric-section">
        <h4>Synaptic Weights</h4>
        <div className="metric-item">
          <span>Average:</span>
          <span className="metric-value">{stats.avgWeight.toFixed(3)}</span>
        </div>
        <div className="metric-item">
          <span>Max:</span>
          <span className="metric-value">{maxWeight.toFixed(3)}</span>
        </div>
        <div className="metric-item">
          <span>Min:</span>
          <span className="metric-value">{minWeight.toFixed(3)}</span>
        </div>
      </div>

      {/* Network Structure */}
      <div className="metric-section">
        <h4>Network Structure</h4>
        <div className="metric-item">
          <span>Total Synapses:</span>
          <span className="metric-value">{stats.totalSynapses}</span>
        </div>
        <div className="metric-item">
          <span>Connectivity:</span>
          <span className="metric-value">{(stats.connectivity * 100).toFixed(1)}%</span>
        </div>
        <div className="metric-item">
          <span>Total Spikes:</span>
          <span className="metric-value">{stats.totalSpikes}</span>
        </div>
      </div>

      {/* Simple Activity Visualization */}
      <div className="metric-section">
        <h4>Activity History</h4>
        <div className="activity-chart">
          {recentActivity.slice(-50).map((activity, i) => (
            <div
              key={i}
              className="activity-bar"
              style={{
                height: `${Math.max(2, (activity / Math.max(1, network.neurons.length)) * 50)}px`,
                backgroundColor: activity > 0 ? '#00ff88' : '#333',
                width: '3px',
                marginRight: '1px',
                display: 'inline-block'
              }}
            />
          ))}
        </div>
      </div>

      {/* Neuron Status */}
      <div className="metric-section">
        <h4>Neuron Status</h4>
        <div className="neuron-grid">
          {network.neurons.slice(0, 16).map((neuron, i) => (
            <div
              key={i}
              className="neuron-status"
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: neuron.hasFired() 
                  ? '#ffff00' 
                  : `hsl(240, 100%, ${20 + neuron.getMembranePotentialNormalized() * 60}%)`,
                border: '1px solid #666',
                borderRadius: '50%',
                margin: '2px',
                display: 'inline-block',
                fontSize: '8px',
                textAlign: 'center',
                lineHeight: '18px',
                color: '#fff'
              }}
              title={`Neuron ${i}: ${neuron.membranePotential.toFixed(1)}mV`}
            >
              {i}
            </div>
          ))}
          {network.neurons.length > 16 && (
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '5px' }}>
              ...and {network.neurons.length - 16} more
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .metrics-dashboard {
          padding: 15px;
          background: #1a1a1a;
          border-radius: 8px;
          color: #fff;
          max-height: 100vh;
          overflow-y: auto;
        }
        
        .metrics-dashboard h3 {
          margin-top: 0;
          color: #00ff88;
          border-bottom: 1px solid #333;
          padding-bottom: 10px;
        }
        
        .metric-section {
          margin-bottom: 20px;
          padding: 10px;
          background: #2a2a2a;
          border-radius: 6px;
        }
        
        .metric-section h4 {
          margin: 0 0 10px 0;
          color: #ccc;
          font-size: 14px;
        }
        
        .metric-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 13px;
        }
        
        .metric-value {
          color: #00ff88;
          font-weight: bold;
        }
        
        .activity-chart {
          height: 50px;
          display: flex;
          align-items: flex-end;
          background: #1a1a1a;
          padding: 5px;
          border-radius: 4px;
          overflow-x: auto;
        }
        
        .neuron-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
        }
      `}</style>
    </div>
  );
};

export default MetricsDashboard;