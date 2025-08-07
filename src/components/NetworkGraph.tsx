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

  // Performance optimization: track significant changes
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const updateThrottleMs = 50; // Limit updates to ~20fps for performance

  // Voltage trace canvas
  const voltageCanvasRef = useRef<HTMLCanvasElement>(null);

  // Animation state for spike propagation
  const [activeTransmissions, setActiveTransmissions] = useState<Map<string, number>>(new Map());

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = neurons.map((neuron, index) => ({
      id: index,
      name: `N${index}`,
      neuronRef: neuron,
      firingRate: neuron.getInstantaneousFiringRate(),
      totalSpikes: neuron.totalSpikes,
      layer: Math.floor(index / 4) // Assuming 4 neurons per layer
    }));

    const links: GraphLink[] = synapses.map(synapse => {
      const initialWeight =
        synapse.weightHistory && synapse.weightHistory.length > 0
          ? synapse.weightHistory[0]
          : synapse.weight;
      return {
        source: synapse.from,
        target: synapse.to,
        weight: synapse.weight,
        delay: synapse.delay,
        id: synapse.id,
        initialWeight,
        weightChange: synapse.weight - initialWeight
      };
    });

    return { nodes, links };
  }, [neurons, synapses]);

  // Performance optimization: throttled updates
  const shouldUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTime > updateThrottleMs) {
      setLastUpdateTime(now);
      return true;
    }
    return false;
  }, [lastUpdateTime, updateThrottleMs]);

  // Track spike propagation for animation
  useEffect(() => {
    setActiveTransmissions(prev => {
      const next = new Map<string, number>();

      // Start new transmissions for neurons that fired
      neurons.forEach((neuron, index) => {
        if (neuron.hasFired && neuron.hasFired()) {
          synapses.forEach(synapse => {
            if (synapse.from === index) {
              const transmissionId = `${synapse.from}-${synapse.to}-${Date.now()}`;
              next.set(transmissionId, 0);
            }
          });
        }
      });

      // Advance existing transmissions
      prev.forEach((progress, id) => {
        const newProgress = progress + 0.05; // Animation speed
        if (newProgress < 1) {
          next.set(id, newProgress);
        }
      });

      return next;
    });
  }, [neurons, synapses]);

  // Draw voltage traces with error handling
  useEffect(() => {
    if (!showVoltageTraces || selectedNode === null) return;

    const canvas = voltageCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const neuron = neurons[selectedNode];
    if (!neuron) return;

    try {
      drawVoltageTrace(ctx, neuron, canvas.width, canvas.height);
    } catch (error) {
      console.warn('Error drawing voltage trace:', error);
    }
  }, [neurons, selectedNode, showVoltageTraces]);

  const drawVoltageTrace = (
    ctx: CanvasRenderingContext2D,
    neuron: Neuron,
    width: number,
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);

    const voltages = neuron.voltageHistory || [];
    if (voltages.length < 2) {
      // Draw "No Data" message
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No voltage history available', width / 2, height / 2);
      return;
    }

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
      const y = height - normalizedV * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw threshold line
    const threshold = neuron.config?.threshold ?? -55; // Default threshold
    const thresholdY = height - ((threshold - minV) / voltageRange) * height;
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
    ctx.textAlign = 'left';
    ctx.fillText(`${threshold.toFixed(1)}mV`, 5, thresholdY - 5);
    ctx.fillText(`${minV}mV`, 5, height - 5);
    ctx.fillText(`${maxV}mV`, 5, 15);
  };

  const nodePaint = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const neuron = node.neuronRef;
      if (!neuron) return;

      // Pull positions into locals and guard against undefined for TS
      const x = node.x;
      const y = node.y;
      if (x === undefined || y === undefined) {
        return; // positions not ready yet
      }

      const radius = 8;
      const isHighlighted = highlightNodes.has(node.id);
      const isSelected = selectedNode === node.id;

      ctx.save();

      // Enhanced neuron visualization based on biological state
      const potentialNorm = neuron.getMembranePotentialNormalized
        ? neuron.getMembranePotentialNormalized()
        : Math.max(0, Math.min(1, (neuron.membranePotential + 70) / 30)); // Fallback normalization

      const firingRate = neuron.getInstantaneousFiringRate
        ? neuron.getInstantaneousFiringRate()
        : 0;

      // Color coding based on multiple factors with performance optimization
      if (neuron.hasFired && neuron.hasFired()) {
        // Bright flash for action potential
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ffff00';
        ctx.fillStyle = '#ffff88';

        // Spike wave animation - optimized
        if (shouldUpdate()) {
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, radius + 8, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else {
        ctx.shadowBlur = 0;

        // Color based on membrane potential and firing rate
        const red = Math.round(50 + 150 * potentialNorm);
        const green = Math.round(100 + 100 * Math.min(firingRate / 50, 1));
        const blue = Math.round(255 - 200 * potentialNorm);
        ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.9)`;

        // Adaptation visualization (neuron size changes with adaptation)
        const adaptationCurrent = neuron.adaptationCurrent || 0;
        const adaptationRadius = radius + adaptationCurrent * 3;
        if (adaptationRadius > radius) {
          ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, adaptationRadius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }

      // Selection highlight
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (isHighlighted) {
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Main neuron body
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Membrane potential indicator (inner circle)
      const innerRadius = radius * potentialNorm * 0.8;
      if (innerRadius > 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(x, y, innerRadius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Neuron border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.restore();

      // Labels and info - performance optimized
      if (globalScale > 0.5) {
        const fontSize = Math.max(8, 10 / globalScale);
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(node.name, x, y + radius + 12);

        // Detailed info for hovered/selected nodes
        if ((hoverNode && hoverNode.id === node.id) || isSelected) {
          const info = [
            `V: ${neuron.membranePotential.toFixed(1)}mV`,
            `Rate: ${firingRate.toFixed(1)}Hz`,
            `Spikes: ${neuron.totalSpikes || 0}`,
            `Adapt: ${(neuron.adaptationCurrent || 0).toFixed(2)}`
          ];

          info.forEach((text, i) => {
            ctx.fillText(text, x, y - radius - 15 - i * 12);
          });
        }
      }
    },
    [highlightNodes, hoverNode, selectedNode, shouldUpdate]
  );

  const linkPaint = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const startNode = typeof link.source === 'object' ? link.source : null;
      const endNode = typeof link.target === 'object' ? link.target : null;

      // Guard for undefined nodes and coordinates
      if (!startNode || !endNode) return;
      const x1 = startNode.x;
      const y1 = startNode.y;
      const x2 = endNode.x;
      const y2 = endNode.y;
      if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
        return; // positions not ready yet
      }

      const isHighlighted = highlightLinks.has(link.id);

      ctx.save();

      // Advanced synapse visualization
      const weightNorm = Math.abs(link.weight) / 2;
      const alpha = Math.max(0.3, Math.min(1, weightNorm));
      const lineWidth = Math.max(1, Math.abs(link.weight) * 3);

      // Color based on weight change (plasticity visualization)
      let color: string;
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

      // Draw synapse line
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Enhanced spike propagation animation
      const pairPrefix =
        startNode && endNode ? `${startNode.id}-${endNode.id}-` : undefined;

      if (pairPrefix) {
        activeTransmissions.forEach((progress, transmissionId) => {
          // Match transmissions for this specific (from->to) pair
          if (transmissionId.startsWith(pairPrefix)) {
            const x = x1 + (x2 - x1) * progress;
            const y = y1 + (y2 - y1) * progress;

            ctx.fillStyle = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffff00';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        });
      }

      // Directional arrow
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const arrowLength = 12;
      const arrowAngle = Math.PI / 6;

      const arrowX1 = x2 - arrowLength * Math.cos(angle - arrowAngle);
      const arrowY1 = y2 - arrowLength * Math.sin(angle - arrowAngle);
      const arrowX2 = x2 - arrowLength * Math.cos(angle + arrowAngle);
      const arrowY2 = y2 - arrowLength * Math.sin(angle + arrowAngle);

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(arrowX1, arrowY1);
      ctx.moveTo(x2, y2);
      ctx.lineTo(arrowX2, arrowY2);
      ctx.stroke();

      // Weight and delay labels for highlighted synapses
      if (isHighlighted) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';

        const text1 = `w:${link.weight.toFixed(3)}`;
        const text2 = `d:${link.delay}ms`;
        const text3 = showWeightEvolution
          ? `Δ:${link.weightChange > 0 ? '+' : ''}${link.weightChange.toFixed(3)}`
          : '';

        const textHeight = 12;
        const textY1 = midY - textHeight;
        const textY2 = midY;
        const textY3 = midY + textHeight;

        // Background rectangle
        const bgPadding = 3;
        const textWidth = 60;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(
          midX - textWidth / 2 - bgPadding,
          textY1 - textHeight / 2 - bgPadding,
          textWidth + 2 * bgPadding,
          textHeight * (text3 ? 3 : 2) + 2 * bgPadding
        );

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text1, midX, textY1);
        ctx.fillText(text2, midX, textY2);
        if (text3) {
          ctx.fillStyle = link.weightChange > 0 ? '#00ff88' : '#ff6666';
          ctx.fillText(text3, midX, textY3);
        }
      }

      ctx.restore();
    },
    [highlightLinks, showWeightEvolution, activeTransmissions]
  );

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());

      if (node) {
        const newHighlightNodes = new Set([node.id]);
        const newHighlightLinks = new Set<string>();

        graphData.links.forEach(link => {
          const sourceId =
            typeof link.source === 'object' ? link.source.id : link.source;
          const targetId =
            typeof link.target === 'object' ? link.target.id : link.target;

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
    },
    [graphData.links]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      const nodeId = node.id;
      setSelectedNode(selectedNode === nodeId ? null : nodeId);
      if (onNodeClick) {
        onNodeClick(nodeId);
      }
    },
    [selectedNode, onNodeClick]
  );

  const handleLinkClick = useCallback(
    (link: GraphLink) => {
      if (onLinkClick) {
        onLinkClick(link);
      }
    },
    [onLinkClick]
  );

  // Pattern validation warning
  const setInputPattern = useCallback((patternName: string | null) => {
    if (!patternName) {
      return;
    }
    // Add validation if needed for your patterns
    console.log(`Setting input pattern: ${patternName}`);
  }, []);

  return (
    <div
      style={{
        border: '1px solid #444',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#0a0a0a',
        position: 'relative',
        height: '100%'
      }}
    >
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
        nodeRelSize={1}
        // Widths/arrows are handled in custom painter
        linkWidth={0}
        linkDirectionalArrowLength={0}
      />

      {/* Enhanced Legend */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.9)',
          padding: '12px',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#ffffff',
          minWidth: '180px',
          border: '1px solid #444'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#00ff88' }}>
          Network Legend
        </div>
        <div style={{ marginBottom: '4px' }}>🟡 Action Potential</div>
        <div style={{ marginBottom: '4px' }}>🔵 Resting State</div>
        <div style={{ marginBottom: '4px' }}>⚪ Inner: Membrane Potential</div>
        <div style={{ marginBottom: '4px' }}>🟦 Excitatory Synapse</div>
        <div style={{ marginBottom: '4px' }}>🟥 Inhibitory Synapse</div>
        <div style={{ marginBottom: '4px' }}>💛 Spike Propagation</div>
        {showWeightEvolution && (
          <>
            <div style={{ marginBottom: '4px' }}>🟢 Potentiation (LTP)</div>
            <div style={{ marginBottom: '4px' }}>🟠 Depression (LTD)</div>
          </>
        )}
        <div style={{ marginTop: '8px', fontSize: '10px', color: '#aaa' }}>
          Click neuron for details
        </div>
      </div>

      {/* Voltage Trace Panel */}
      {showVoltageTraces && selectedNode !== null && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.9)',
            border: '1px solid #444',
            borderRadius: '6px',
            padding: '8px',
            width: '300px',
            height: '150px'
          }}
        >
          <div style={{ color: '#fff', fontSize: '12px', marginBottom: '4px' }}>
            Neuron {selectedNode} - Membrane Potential
          </div>
          <canvas
            ref={voltageCanvasRef}
            width={284}
            height={120}
            style={{ border: '1px solid #666' }}
          />
        </div>
      )}

      {/* Network Activity Indicator */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.8)',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#fff'
        }}
      >
        <div>
          Active: {neurons.filter(n => n.hasFired && n.hasFired()).length}/{neurons.length}
        </div>
        <div>
          Avg Rate:{' '}
          {(
            neurons.reduce(
              (sum, n) => sum + (n.getInstantaneousFiringRate ? n.getInstantaneousFiringRate() : 0),
              0
            ) / neurons.length
          ).toFixed(1)}{' '}
          Hz
        </div>
      </div>
    </div>
  );
};

export default NetworkGraph;
