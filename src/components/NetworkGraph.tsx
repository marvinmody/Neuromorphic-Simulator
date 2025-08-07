import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import ForceGraph2d from 'react-force-graph-2d';
import { Neuron } from '../lib/Neuron';
import { Synapse } from '../lib/Network';

interface NetworkGraphProps {
  neurons: Neuron[];
  synapses: Synapse[];
  onNodeClick?: (nodeIndex: number) => void;
  onLinkClick?: (link: any) => void;
  showVoltageTraces?: boolean;
  showWeightEvolution?: boolean;
}

interface GraphNode {
  id: number;
  name: string;
  neuronRef: Neuron;
  firingRate: number;
  totalSpikes: number;
  x?: number;
  y?: number;
  layer?: number;
}

interface GraphLink {
  source: number | GraphNode;
  target: number | GraphNode;
  weight: number;
  delay: number;
  id: string;
  initialWeight: number;
  weightChange: number;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ 
  neurons, 
  synapses, 
  onNodeClick,
  onLinkClick,
  showVoltageTraces = false,
  showWeightEvolution = false
}) => {
  const [highlightNodes, setHighlightNodes] = useState(new Set<number>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  
  // Voltage trace canvas
  const voltageCanvasRef = useRef<HTMLCanvasElement>(null);

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = neurons.map((neuron, index) => ({
      id: index,
      name: `N${index}`,
      neuronRef: neuron,
      firingRate: neuron.getInstantaneousFiringRate(),
      totalSpikes: neuron.totalSpikes,
      layer: Math.floor(index / 4), // Assuming 4 neurons per layer
    }));

    const links: GraphLink[] = synapses.map(synapse => {
      const initialWeight = synapse.weightHistory[0] || synapse.weight;
      return {
        source: synapse.from,
        target: synapse.to,
        weight: synapse.weight,
        delay: synapse.delay,
        id: synapse.id,
        initialWeight,
        weightChange: synapse.weight - initialWeight,
      };
    });

    return { nodes, links };
  }, [neurons, synapses]);

  // Draw voltage traces
  useEffect(() => {
    if (!showVoltageTraces || selectedNode === null) return;
    
    const canvas = voltageCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const neuron = neurons[selectedNode];
    if (!neuron) return;
    
    drawVoltageTrace(ctx, neuron, canvas.width, canvas.height);
  }, [neurons, selectedNode, showVoltageTraces]);

  const drawVoltageTrace = (ctx: CanvasRenderingContext2D, neuron: Neuron, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    
    const voltages = neuron.voltageHistory;
    if (voltages.length < 2) return;
    
    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = (height / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw voltage trace
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const minV = -80;
    const maxV = -40;
    const voltageRange = maxV - minV;
    
    voltages.forEach((voltage, index) => {
      const x = (index / (voltages.length - 1)) * width;
      const normalizedV = (voltage - minV) / voltageRange;
      const y = height - (normalizedV * height);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw threshold line
    const thresholdY = height - ((neuron.config.threshold - minV) / voltageRange * height);
    ctx.strokeStyle = '#ff4444';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText(`${neuron.config.threshold.toFixed(1)}mV`, 5, thresholdY - 5);
    ctx.fillText(`${minV}mV`, 5, height - 5);
    ctx.fillText(`${maxV}mV`, 5, 15);
  };

  const nodePaint = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const neuron = node.neuronRef;
    if (!neuron) return;

    const radius = 8;
    const isHighlighted = highlightNodes.has(node.id);
    const isSelected = selectedNode === node.id;
    
    ctx.save();
    
    // Enhanced neuron visualization based on biological state
    const potentialNorm = neuron.getMembranePotentialNormalized();
    const firingRate = neuron.getInstantaneousFiringRate();
    
    // Color coding based on multiple factors
    if (neuron.hasFired()) {
      // Bright flash for action potential
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ffff00';
      ctx.fillStyle = '#ffff88';
      
      // Spike wave animation
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius + 8, 0, 2 * Math.PI);
      ctx.stroke();
    } else {
      ctx.shadowBlur = 0;
      
      // Color based on membrane potential and firing rate
      const red = Math.round(50 + 150 * potentialNorm);
      const green = Math.round(100 + 100 * Math.min(firingRate / 50, 1));
      const blue = Math.round(255 - 200 * potentialNorm);
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.9)`;
      
      // Adaptation visualization (neuron size changes with adaptation)
      const adaptationRadius = radius + (neuron.adaptationCurrent * 3);
      if (adaptationRadius > radius) {
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, adaptationRadius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // Selection highlight
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius + 4, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (isHighlighted) {
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius + 2, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Main neuron body
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Membrane potential indicator (inner circle)
    const innerRadius = radius * potentialNorm * 0.8;
    if (innerRadius > 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, innerRadius, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Neuron border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();

    // Labels and info
    const fontSize = 10 / globalScale;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(node.name, node.x || 0, (node.y || 0) + radius + 12);
    
    // Detailed info for hovered/selected nodes
    if ((hoverNode && hoverNode.id === node.id) || isSelected) {
      const info = [
        `V: ${neuron.membranePotential.toFixed(1)}mV`,
        `Rate: ${firingRate.toFixed(1)}Hz`,
        `Spikes: ${neuron.totalSpikes}`,
        `Adapt: ${neuron.adaptationCurrent.toFixed(2)}`
      ];
      
      info.forEach((text, i) => {
        ctx.fillText(text, node.x || 0, (node.y || 0) - radius - 15 - (i * 12));
      });
    }
  }, [highlightNodes, hoverNode, selectedNode]);

  const linkPaint = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const start = typeof link.source === 'object' ? link.source : null;
    const end = typeof link.target === 'object' ? link.target : null;
    
    if (!start || !end || typeof start.x !== 'number' || typeof start.y !== 'number' ||
        typeof end.x !== 'number' || typeof end.y !== 'number') return;

    const isHighlighted = highlightLinks.has(link.id);
    
    ctx.save();
    
    // Advanced synapse visualization
    const weightNorm = Math.abs(link.weight) / 2;
    const alpha = Math.max(0.3, Math.min(1, weightNorm));
    const lineWidth = Math.max(1, Math.abs(link.weight) * 3);
    
    // Color based on weight change (plasticity visualization)
    let color;
    if (showWeightEvolution && Math.abs(link.weightChange) > 0.01) {
      if (link.weightChange > 0) {
        color = `rgba(0, 255, 150, ${alpha})`; // Green for potentiation
      } else {
        color = `rgba(255, 100, 50, ${alpha})`; // Red for depression  
      }
    } else if (link.weight > 0) {
      color = `rgba(0, 200, 255, ${alpha})`; // Blue for excitatory
    } else {
      color = `rgba(255, 50, 50, ${alpha})`; // Red for inhibitory
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = isHighlighted ? lineWidth + 2 : lineWidth;
    
    // Draw synapse with activity visualization
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // Directional arrow
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowLength = 12;
    const arrowAngle = Math.PI / 6;
    
    const arrowX1 = end.x - arrowLength * Math.cos(angle - arrowAngle);
    const arrowY1 = end.y - arrowLength * Math.sin(angle - arrowAngle);
    const arrowX2 = end.x - arrowLength * Math.cos(angle + arrowAngle);
    const arrowY2 = end.y - arrowLength * Math.sin(angle + arrowAngle);
    
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(arrowX1, arrowY1);
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(arrowX2, arrowY2);
    ctx.stroke();
    
    // Weight and delay labels for highlighted synapses
    if (isHighlighted) {
      const midX = (start.x + end.x) / 2;
      const midY = (