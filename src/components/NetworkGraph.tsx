import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2d from 'react-force-graph-2d';
import { Neuron } from '../lib/Neuron';
import { Synapse } from '../lib/Network';

interface NetworkGraphProps {
  neurons: Neuron[];
  synapses: Synapse[];
  onNodeClick?: (nodeIndex: number) => void;
  onLinkClick?: (link: any) => void;
}

// Define proper types for the graph data
interface GraphNode {
  id: number;
  name: string;
  neuronRef: Neuron;
  firingRate: number;
  totalSpikes: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: number | GraphNode;
  target: number | GraphNode;
  weight: number;
  delay: number;
  id: string;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ 
  neurons, 
  synapses, 
  onNodeClick,
  onLinkClick 
}) => {
  const [highlightNodes, setHighlightNodes] = useState(new Set<number>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = neurons.map((neuron, index) => ({
      id: index,
      name: `N${index}`,
      neuronRef: neuron,
      firingRate: neuron.getSpikeRate(),
      totalSpikes: neuron.totalSpikes,
    }));

    const links: GraphLink[] = synapses.map(synapse => ({
      source: synapse.from,
      target: synapse.to,
      weight: synapse.weight,
      delay: synapse.delay,
      id: synapse.id,
    }));

    return { nodes, links };
  }, [neurons, synapses]);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());

    if (node) {
      const newHighlightNodes = new Set([node.id]);
      const newHighlightLinks = new Set<string>();

      // Highlight connected links and nodes
      graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (sourceId === node.id || targetId === node.id) {
          newHighlightLinks.add(link.id);
          newHighlightNodes.add(sourceId);
          newHighlightNodes.add(targetId);
        }
      });

      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
    }
    
    setHoverNode(node);
  }, [graphData.links]);

  const nodePaint = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const originalNeuron = node.neuronRef;
    if (!originalNeuron) return;

    const radius = 6;
    const fontSize = 10 / globalScale;
    const isHighlighted = highlightNodes.has(node.id);
    
    // Enhanced visual effects
    ctx.save();
    
    // Glow effect for firing neurons
    if (originalNeuron.hasFired()) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffff00';
      ctx.fillStyle = '#ffff88';
      
      // Extra ring for recent firing
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius + 3, 0, 2 * Math.PI);
      ctx.stroke();
    } else {
      ctx.shadowBlur = 0;
      // Color based on membrane potential
      const potentialRatio = Math.max(0, Math.min(1, originalNeuron.membranePotential / originalNeuron.threshold));
      const red = Math.round(100 + 155 * potentialRatio);
      const green = Math.round(50 + 100 * potentialRatio);
      const blue = Math.round(255 - 200 * potentialRatio);
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 1)`;
    }

    // Highlight effect
    if (isHighlighted) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius + 2, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Main neuron circle
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Label
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(node.name, node.x || 0, (node.y || 0) + radius + 8);

    // Show stats for hovered node
    if (hoverNode && hoverNode.id === node.id) {
      const stats = [
        `Potential: ${originalNeuron.membranePotential.toFixed(2)}`,
        `Spikes: ${originalNeuron.totalSpikes}`,
        `Rate: ${originalNeuron.getSpikeRate().toFixed(2)}`
      ];
      
      const lineHeight = fontSize + 2;
      stats.forEach((stat, i) => {
        ctx.fillText(stat, node.x || 0, (node.y || 0) - radius - 15 - (i * lineHeight));
      });
    }
  }, [highlightNodes, hoverNode]);

  const linkPaint = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const start = typeof link.source === 'object' ? link.source : null;
    const end = typeof link.target === 'object' ? link.target : null;
    
    if (!start || !end || typeof start.x !== 'number' || typeof start.y !== 'number' ||
        typeof end.x !== 'number' || typeof end.y !== 'number') return;

    const isHighlighted = highlightLinks.has(link.id);
    
    // Enhanced link visualization
    ctx.save();
    
    // Color and width based on weight
    const normalizedWeight = Math.max(0, Math.min(1, link.weight / 2));
    const alpha = isHighlighted ? 0.8 : Math.max(0.2, normalizedWeight);
    const width = Math.max(1, link.weight * 2);
    
    if (link.weight > 0) {
      ctx.strokeStyle = `rgba(0, 255, 100, ${alpha})`;
    } else {
      ctx.strokeStyle = `rgba(255, 100, 0, ${alpha})`;
    }
    
    ctx.lineWidth = isHighlighted ? width + 2 : width;
    
    // Draw connection
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // Draw arrowhead
    const headlen = 8;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowX = end.x - headlen * Math.cos(angle - Math.PI/6);
    const arrowY = end.y - headlen * Math.sin(angle - Math.PI/6);
    const arrowX2 = end.x - headlen * Math.cos(angle + Math.PI/6);
    const arrowY2 = end.y - headlen * Math.sin(angle + Math.PI/6);
    
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(arrowX, arrowY);
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(arrowX2, arrowY2);
    ctx.stroke();
    
    // Weight label for highlighted links
    if (isHighlighted) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Sans-Serif';
      ctx.textAlign = 'center';
      ctx.fillText(`w:${link.weight.toFixed(2)}`, midX, midY - 10);
      ctx.fillText(`d:${link.delay}`, midX, midY + 10);
    }
    
    ctx.restore();
  }, [highlightLinks]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
  }, [onNodeClick]);

  const handleLinkClick = useCallback((link: GraphLink) => {
    if (onLinkClick) {
      onLinkClick(link);
    }
  }, [onLinkClick]);

  return (
    <div style={{ 
      border: '1px solid #444', 
      borderRadius: '8px', 
      overflow: 'hidden', 
      background: '#0a0a0a',
      position: 'relative'
    }}>
      <ForceGraph2d
        graphData={graphData}
        nodeLabel=""
        nodeCanvasObject={nodePaint}
        linkCanvasObject={linkPaint}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
        cooldownTicks={100}
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.2}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
      
      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.8)',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        color: '#ffffff'
      }}>
        <div>🟡 Firing Neuron</div>
        <div>🔵 Resting Neuron</div>
        <div>🟢 Excitatory Synapse</div>
        <div>🟠 Inhibitory Synapse</div>
      </div>
    </div>
  );
};

export default NetworkGraph;