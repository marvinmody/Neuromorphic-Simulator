# Neuromorphic Simulator 🧠⚡
An interactive, web-based sandbox for **Spiking Neural Networks (SNNs)**.  
Explore how simple, event-driven rules give rise to complex, emergent behavior—no heavyweight ML libraries required.

---

## 📸 Preview
>  
> *A running network with neurons (nodes) and synapses (links). Colors represent membrane potential; flashes indicate spikes.*

---

## 🔬 Core Concepts

### 1 · Leaky Integrate-and-Fire (LIF) Neurons  
Each neuron’s membrane potential \(V\) evolves as

\[
V(t+1)=\delta\,V(t)+I(t)
\]

where  
• \(\delta\) — decay factor (leak)  
• \(I(t)\) — total input current from presynaptic spikes at time \(t\)

A spike is emitted when \(V\) crosses a threshold, after which \(V\) is reset.

### 2 · Spike-Timing-Dependent Plasticity (STDP)  
Synaptic weight change \(\Delta w\) depends on the timing difference  
\(\Delta t = t_{\text{post}} - t_{\text{pre}}\):

\[
\Delta w =
\begin{cases}
A_{+}\,e^{-\Delta t/\tau_{+}}, & \text{if } \Delta t>0 \quad (\text{LTP})\\[6pt]
-A_{-}\,e^{\;\Delta t/\tau_{-}}, & \text{if } \Delta t<0 \quad (\text{LTD})
\end{cases}
\]

---

## 🌟 Features
- **🧠 Biologically-Plausible Neurons** — first-principles LIF implementation  
- **🔗 Dynamic Topologies** — Random, Feed-forward, Small-World, etc.  
- **⚡ Real-Time Visualization** — force-directed graph (react-force-graph-2d)  
- **⏰ Event-Driven Engine** — spike propagation with configurable delays  
- **🧪 On-line STDP** — weights update live based on spike timing  
- **📊 Interactive Controls** — tweak speed, input patterns, learning rates; view firing rates & weight stats

---

## 📦 Tech Stack
| Layer      | Tech |
|------------|------|
| **Frontend** | React + TypeScript (Vite) |
| **Visualization** | `react-force-graph-2d` (HTML5 Canvas) |
| **Simulation Engine** | Custom TypeScript (no TensorFlow/PyTorch) |

---

## 🛠️ Getting Started

### Prerequisites
- Node ≥ 18  
- npm ≥ 9

### Installation
```bash
git clone https://github.com/yourusername/neuromorphic-simulator.git
cd neuromorphic-simulator
npm install
npm run dev
