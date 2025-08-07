import React, { useEffect, useRef } from 'react';
import { Network } from '../lib/Network';

interface MetricsDashboardProps {
  network: Network;
  time: number;
}

interface PlotData {
  time: number[];
  values: number[];
  maxPoints: number;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ network, time }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firingRateData = useRef<PlotData>({ time: [], values: [], maxPoints: 200 });
  const weightData = useRef<PlotData>({ time: [], values: [], maxPoints: 200 });
  const spikeData = useRef<PlotData>({ time: [], values: [], maxPoints: 200 });

  useEffect(() => {
    const stats = network.getNetworkStats();
    
    // Update firing rate data
    firingRateData.current.time.push(time);
    firingRateData.current.values.push(stats.avgFiringRate);
    if (firingRateData.current.time.length > firingRateData.current.maxPoints) {
      firingRateData.current.time.shift();
      firingRateData.current.values.shift();
    }
    
    // Update weight data
    weightData.current.time.push(time);
    weightData.current.values.push(stats.avgWeight);
    if (weightData.current.time.length > weightData.current.maxPoints) {
      weightData.current.time.shift();
      weightData.current.values.shift();
    }
    
    // Update spike data
    const currentSpikes = network.neurons.reduce((sum, neuron) => 
      sum + (neuron.hasFired() ? 1 : 0), 0
    );
    spikeData.current.time.push(time);
    spikeData.current.values.push(currentSpikes);
    if (spikeData.current.time.length > spikeData.current.maxPoints) {
      spikeData.current.time.shift();
      spikeData.current.values.shift();
    }

    drawPlots();
  }, [network, time]);

  const drawPlots = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    const plotHeight = height / 3 - 10;
    const plotWidth = width - 80;
    const leftMargin = 60;
    
    // Plot firing rate
    drawPlot(ctx, firingRateData.current, leftMargin, 10, plotWidth, plotHeight, 
      'Firing Rate', '#00ff88', 0, 0.5);
    
    // Plot average weight
    drawPlot(ctx, weightData.current, leftMargin, plotHeight + 20, plotWidth, plotHeight,
      'Avg Weight', '#ff8800', 0, 2);
    
    // Plot current spikes
    drawPlot(ctx, spikeData.current, leftMargin, 2 * plotHeight + 30, plotWidth, plotHeight,
      'Active Spikes', '#ffff00', 0, network.neurons.length);
  };

  const drawPlot = (
    ctx: CanvasRenderingContext2D,
    data: PlotData,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    color: string,
    minY: number,
    maxY: number
  ) => {
    // Draw background
    ctx.strokeStyle = '#333';
    ctx.strokeRect(x, y, width, height);
    
    // Draw title
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText(title, x, y - 5);
    
    // Draw y-axis labels
    ctx.fillStyle = '#aaa';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(maxY.toFixed(2), x - 5, y + 10);
    ctx.fillText(((maxY + minY) / 2).toFixed(2), x - 5, y + height / 2);
    ctx.fillText(minY.toFixed(2), x - 5, y + height - 5);
    
    if (data.values.length < 2) return;
    
    // Draw data line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < data.values.length; i++) {
      const plotX = x + (i / (data.maxPoints - 1)) * width;
      const normalizedY = (data.values[i] - minY) / (maxY - minY);
      const plotY = y + height - (normalizedY * height);
      
      if (i === 0) {
        ctx.moveTo(plotX, plotY);
      } else {
        ctx.lineTo(plotX, plotY);
      }
    }
    
    ctx.stroke();
  };

  return (
    <div className="metrics-dashboard">
      <h3>Network Metrics</h3>
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        style={{ border: '1px solid #444', background: '#1a1a1a' }}
      />
    </div>
  );
};

export default MetricsDashboard;