import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Thermometer, 
  Droplets, 
  Wind, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  Calendar, 
  Egg, 
  RefreshCw, 
  Camera, 
  Volume2, 
  Layers 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar 
} from 'recharts';

// ============================================================================
// MOCK DATA GENERATOR (Fallback if API is offline)
// ============================================================================
const generateMockData = () => {
  const coops = [
    { id: 1, name: 'Cage Coop A', type: 'cage', capacity: 312 },
    { id: 2, name: 'Cage Coop B', type: 'cage', capacity: 310 },
    { id: 3, name: 'Litter Coop 1', type: 'deep_litter', capacity: 104 },
    { id: 4, name: 'Litter Coop 2', type: 'deep_litter', capacity: 104 },
    { id: 5, name: 'Litter Coop 3', type: 'deep_litter', capacity: 104 },
    { id: 6, name: 'Litter Coop 4', type: 'deep_litter', capacity: 104 },
    { id: 7, name: 'Litter Coop 5', type: 'deep_litter', capacity: 104 },
    { id: 8, name: 'Litter Coop 6', type: 'deep_litter', capacity: 104 },
  ];

  const now = new Date();
  
  // Historical telemetry (24h)
  const telemetryHistory = [];
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    coops.forEach(coop => {
      const baseTemp = coop.type === 'cage' ? 24.5 : 22.0;
      const baseHum = coop.type === 'cage' ? 55 : 60;
      const baseNh3 = coop.type === 'deep_litter' ? 12.5 : 0.0;

      // Add a bit of random walk
      const randomOffset = Math.sin(i / 3) * 2;
      telemetryHistory.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        coop_id: coop.id,
        avg_temp: parseFloat((baseTemp + randomOffset + Math.random() * 0.5).toFixed(1)),
        avg_humidity: parseFloat((baseHum - randomOffset * 2 + Math.random() * 2).toFixed(1)),
        avg_nh3: coop.type === 'deep_litter' ? parseFloat((baseNh3 + (randomOffset * 0.8) + Math.random() * 0.8).toFixed(1)) : 0.0,
      });
    });
  }

  // Live telemetry
  const liveTelemetry = coops.map(coop => {
    const isLitter = coop.type === 'deep_litter';
    return {
      coop_id: coop.id,
      time: now.toISOString(),
      temperature: parseFloat((isLitter ? 21.8 + Math.random() * 1.2 : 24.2 + Math.random() * 1.5).toFixed(1)),
      humidity: parseFloat((isLitter ? 61.5 + Math.random() * 4 : 54.2 + Math.random() * 5).toFixed(1)),
      nh3_level: isLitter ? parseFloat((11.4 + Math.random() * 3.5).toFixed(1)) : 0.0,
    };
  });

  // Live Stress Inferences
  const liveStress = coops.map(coop => {
    const isLitter = coop.type === 'deep_litter';
    return {
      coop_id: coop.id,
      coop_name: coop.name,
      coop_type: coop.type,
      acoustic_stress: parseFloat((0.15 + Math.random() * 0.12).toFixed(2)),
      peak_frequency: parseFloat((850 + Math.random() * 150).toFixed(1)),
      huddling_index: parseFloat((0.22 + Math.random() * 0.15).toFixed(2)),
      bird_count: coop.type === 'cage' ? 312 : 104,
      active_birds: coop.type === 'cage' ? Math.floor(250 + Math.random() * 30) : Math.floor(80 + Math.random() * 15),
    };
  });

  // Egg yields (last 7 days)
  const eggYieldHistory = [];
  for (let i = 7; i > 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    coops.forEach(coop => {
      const dailyCap = coop.capacity * 0.88; // 88% lay rate baseline
      eggYieldHistory.push({
        time: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        coop_id: coop.id,
        quantity: Math.floor(dailyCap - Math.random() * 12),
        cracked: Math.floor(Math.random() * 4),
        dirty: Math.floor(Math.random() * 6),
      });
    });
  }

  const financials = {
    capEx: 44300,
    monthlyTarget: 59400,
    eggPrice: 1.83,
    last30Days: {
      eggsProduced: 32680,
      cracked: 114,
      dirty: 182,
      revenue: 59804,
      revenueProtected: 4320,
      mitigationEvents: 3,
      percentOfTarget: 100.68
    },
    amortization: {
      standardMonths: 7.4,
      heatStressDays: 22,
      currentProgressPercent: 135.0
    }
  };

  return { coops, liveTelemetry, telemetryHistory, liveStress, eggYieldHistory, financials };
};

const mock = generateMockData();

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCoop, setSelectedCoop] = useState(1);
  const [coops, setCoops] = useState(mock.coops);
  const [liveTelemetry, setLiveTelemetry] = useState(mock.liveTelemetry);
  const [historyData, setHistoryData] = useState(mock.telemetryHistory);
  const [liveStress, setLiveStress] = useState(mock.liveStress);
  const [yieldHistory, setYieldHistory] = useState(mock.eggYieldHistory);
  const [financials, setFinancials] = useState(mock.financials);
  const [isSyncing, setIsSyncing] = useState(false);
  const [simulatedAlert, setSimulatedAlert] = useState(null);

  const syncTimeoutRef = React.useRef(null);

  // Fetch real data from API on mount
  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const coopsRes = await fetch('http://localhost:5000/api/coops');
      if (coopsRes.ok) {
        const data = await coopsRes.json();
        setCoops(data);
      }

      const liveRes = await fetch('http://localhost:5000/api/telemetry/live');
      if (liveRes.ok) {
        const data = await liveRes.json();
        setLiveTelemetry(data);
      }

      const historyRes = await fetch('http://localhost:5000/api/telemetry/history?range=24h');
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistoryData(data);
      }

      const stressRes = await fetch('http://localhost:5000/api/stress/live');
      if (stressRes.ok) {
        const data = await stressRes.json();
        setLiveStress(data);
      }

      const yieldRes = await fetch('http://localhost:5000/api/yield');
      if (yieldRes.ok) {
        const data = await yieldRes.json();
        setYieldHistory(data.history);
      }

      const finRes = await fetch('http://localhost:5000/api/financials');
      if (finRes.ok) {
        const data = await finRes.json();
        setFinancials(data);
      }
      console.log('⚡ Fetched fresh data from local PLF Engine API.');
    } catch (err) {
      console.warn('⚠️ API offline or unreachable. Utilizing edge fallback simulation data.');
    } finally {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => setIsSyncing(false), 600);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // sync every 10s
    return () => {
      clearInterval(interval);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // Simulate a Heat Stress Event
  const triggerSimulation = (type) => {
    if (type === 'heat') {
      setSimulatedAlert({
        title: 'CRITICAL WARNING: HEAT STRESS DETECTED',
        coop: 'Cage Coop A',
        coop_id: 1,
        target_tab: 'overview',
        message: 'Acoustic stress index spiked to 0.84. Huddling index is 0.76. Automating misting systems.',
        level: 'danger'
      });
      // Temporarily spike the values
      setLiveTelemetry(prev => prev.map(t => t.coop_id === 1 ? { ...t, temperature: 34.2, humidity: 72.4 } : t));
      setLiveStress(prev => prev.map(s => s.coop_id === 1 ? { ...s, acoustic_stress: 0.84, huddling_index: 0.76 } : s));
    } else if (type === 'nh3') {
      setSimulatedAlert({
        title: 'WARNING: AMMONIA (NH3) LEVEL ELEVATED',
        coop: 'Litter Coop 1',
        coop_id: 3,
        target_tab: 'telemetry',
        message: 'Electrochemical NH3 probe reports 22.4 ppm. Recommended: Activate auxiliary ventilation.',
        level: 'warning'
      });
      setLiveTelemetry(prev => prev.map(t => t.coop_id === 3 ? { ...t, nh3_level: 22.4 } : t));
    } else {
      setSimulatedAlert(null);
      fetchData(); // reset
    }
  };

  // Click alert → navigate to the affected coop and relevant tab
  const handleAlertClick = () => {
    if (!simulatedAlert) return;
    setSelectedCoop(simulatedAlert.coop_id || 1);
    setActiveTab(simulatedAlert.target_tab || 'overview');
  };

  // Generate cage-battery or deep-litter visualization per coop
  const getCageRows = (coopId, stressLevel) => {
    // Each coop has a unique cage layout — rows × cages per row, hens per cage (2 or 3)
    const layouts = {
      1: { rows: 4, cages: [6,5,5,4], henGroups: [[3,2,3,2,3,2],[2,3,2,3,2],[3,2,3,2,3],[2,3,2,3]] },
      2: { rows: 4, cages: [5,5,4,5], henGroups: [[2,3,2,3,2],[3,2,3,2,3],[2,3,2,3],[3,2,3,2,3]] },
      3: { rows: 3, cages: [6,6,5], henGroups: [[3,2,3,2,3,2],[2,3,2,3,2,3],[3,2,3,2,3]] },    // actually deep-litter
      4: { rows: 3, cages: [5,6,5], henGroups: [[2,3,2,3,2],[3,2,3,2,3,2],[2,3,2,3,2]] },
      5: { rows: 4, cages: [4,5,5,4], henGroups: [[3,2,3,2],[2,3,2,3,2],[3,2,3,2,3],[2,3,2,3]] },
      6: { rows: 3, cages: [6,5,6], henGroups: [[2,3,2,3,2,3],[3,2,3,2,3],[2,3,2,3,2,3]] },
      7: { rows: 4, cages: [5,4,5,4], henGroups: [[2,3,2,3,2],[3,2,3,2],[2,3,2,3,2],[3,2,3,2]] },
      8: { rows: 3, cages: [5,6,4], henGroups: [[3,2,3,2,3],[2,3,2,3,2,3],[3,2,3,2]] },
    };
    const layout = layouts[coopId] || layouts[1];
    const rowH = 100 / (layout.rows + 1);
    const cages = [];
    layout.cages.forEach((nCages, ri) => {
      const cageW = 80 / (nCages + 1);
      const topPct = rowH * (ri + 0.5) - rowH * 0.3;
      const groups = layout.henGroups[ri];
      for (let ci = 0; ci < nCages; ci++) {
        const leftPct = 10 + cageW * (ci + 0.5) - cageW * 0.35;
        const hens = groups[ci] || 2;
        const huddling = stressLevel > 0.6; // hens cluster when stressed
        cages.push({
          top: `${topPct}%`,
          left: `${leftPct}%`,
          w: `${cageW * 0.7}%`,
          h: `${rowH * 0.6}%`,
          hens,
          huddling,
        });
      }
    });
    return cages;
  };

  // Deep-litter hen scatter locations — unique per coop
  const getLitterHens = (coopId) => {
    const layouts = {
      1: [{t:22,l:28},{t:18,l:55},{t:35,l:42},{t:42,l:28},{t:50,l:58},{t:38,l:68},{t:55,l:40},{t:28,l:70},{t:48,l:20},{t:60,l:52},{t:20,l:40},{t:65,l:35}],
      2: [{t:20,l:25},{t:25,l:50},{t:35,l:30},{t:48,l:55},{t:28,l:65},{t:55,l:35},{t:40,l:60},{t:50,l:20},{t:60,l:48},{t:22,l:60},{t:65,l:55},{t:18,l:42}],
      3: [{t:15,l:40},{t:28,l:28},{t:45,l:30},{t:40,l:55},{t:55,l:60},{t:22,l:55},{t:50,l:42},{t:38,l:68},{t:60,l:35},{t:30,l:48},{t:65,l:45},{t:18,l:30}],
      4: [{t:30,l:35},{t:20,l:60},{t:42,l:25},{t:50,l:50},{t:55,l:38},{t:35,l:55},{t:45,l:65},{t:60,l:55},{t:28,l:48},{t:22,l:38},{t:58,l:25},{t:65,l:42}],
      5: [{t:40,l:25},{t:25,l:45},{t:35,l:60},{t:50,l:30},{t:55,l:50},{t:28,l:32},{t:45,l:42},{t:60,l:60},{t:22,l:58},{t:52,l:65},{t:65,l:30},{t:18,l:48}],
      6: [{t:22,l:35},{t:35,l:28},{t:48,l:38},{t:42,l:55},{t:55,l:45},{t:30,l:55},{t:50,l:60},{t:25,l:48},{t:60,l:35},{t:38,l:65},{t:58,l:55},{t:20,l:28}],
      7: [{t:28,l:25},{t:22,l:52},{t:40,l:35},{t:48,l:48},{t:35,l:62},{t:55,l:30},{t:50,l:55},{t:60,l:45},{t:30,l:42},{t:42,l:20},{t:58,l:60},{t:65,l:38}],
      8: [{t:18,l:30},{t:32,l:45},{t:45,l:28},{t:42,l:58},{t:52,l:40},{t:28,l:55},{t:55,l:55},{t:38,l:20},{t:58,l:32},{t:25,l:38},{t:62,l:50},{t:20,l:62}],
    };
    return layouts[coopId] || layouts[1];
  };

  // Check if selected coop currently has an active alert
  const hasActiveAlert = simulatedAlert && selectedCoop === simulatedAlert.coop_id;

  // Filter history data for selected coop
  const selectedCoopHistory = historyData.filter(h => h.coop_id === selectedCoop);
  const selectedCoopLive = liveTelemetry.find(t => t.coop_id === selectedCoop) || { temperature: 0, humidity: 0, nh3_level: 0 };
  const selectedCoopStress = liveStress.find(s => s.coop_id === selectedCoop) || { acoustic_stress: 0, huddling_index: 0, bird_count: 0, active_birds: 0 };
  const selectedCoopMeta = coops.find(c => c.id === selectedCoop) || { name: 'Unknown', type: 'cage', capacity: 0 };

  return (
    <div className="min-h-screen bg-[#0a0c14] text-slate-100 flex flex-col antialiased selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* ============================================================================
          HEADER
          ============================================================================ */}
      <header className="border-b border-white/5 bg-[#0d101c]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-400 glow-text-teal">
            <Layers className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans tracking-tight text-white m-0 flex items-center gap-2">
              BOONDUCKS FARM <span className="text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-mono">PLF ENGINE v2.0</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Precision Livestock Farming • 1,242-Layer Flock Node</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Simulation Controls */}
          <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-white/5">
            <span className="text-[10px] uppercase font-mono text-slate-400 px-2">Simulate:</span>
            <button 
              onClick={() => triggerSimulation('heat')}
              className="text-xs bg-red-950/40 border border-red-500/20 hover:border-red-500/50 text-red-400 px-2.5 py-1 rounded transition"
            >
              Heat Stress
            </button>
            <button 
              onClick={() => triggerSimulation('nh3')}
              className="text-xs bg-amber-950/40 border border-amber-500/20 hover:border-amber-500/50 text-amber-400 px-2.5 py-1 rounded transition"
            >
              Ammonia Spike
            </button>
            {simulatedAlert && (
              <button 
                onClick={() => triggerSimulation('reset')}
                className="text-xs bg-slate-800 border border-white/10 text-white px-2.5 py-1 rounded transition"
              >
                Reset
              </button>
            )}
          </div>

          {/* Sync Status */}
          <button 
            onClick={fetchData}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-950/30 border border-teal-500/20 hover:border-teal-500/50 rounded-lg text-xs text-teal-400 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="font-mono">{isSyncing ? 'Syncing...' : 'Synced'}</span>
          </button>
        </div>
      </header>

      {/* ============================================================================
          SIMULATION ALERTS
          ============================================================================ */}
      <AnimatePresence>
        {simulatedAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-6 mt-4"
          >
            <div
              onClick={handleAlertClick}
              className={`p-4 rounded-xl border flex gap-3 cursor-pointer transition-all hover:scale-[1.01] ${
                simulatedAlert.level === 'danger'
                  ? 'bg-red-950/30 border-red-500/40 text-red-200 hover:border-red-400'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-200 hover:border-amber-400'
              }`}
            >
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 animate-bounce" />
              <div className="flex-1">
                <h3 className="text-sm font-bold uppercase tracking-wider">{simulatedAlert.title}</h3>
                <p className="text-xs mt-1 opacity-90">{simulatedAlert.message}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded font-mono">Coop: {simulatedAlert.coop}</span>
                  <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-mono">Automated Mitigation Active</span>
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-mono">Click to navigate →</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================================
          MAIN NAVIGATION & BENCHMARKS
          ============================================================================ */}
      <div className="p-3 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6 shrink-0">
        <div className="lg:col-span-3 flex gap-2 border-b border-white/5 pb-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: Activity },
            { id: 'telemetry', label: 'Environmental Telemetry', icon: Thermometer },
            { id: 'edge_ai', label: 'Edge-AI Stress Analytics', icon: Camera },
            { id: 'financials', label: 'Financial Protection', icon: DollarSign },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-teal-500/10 border border-teal-500/30 text-teal-400' 
                    : 'hover:bg-white/5 text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Global Protection KPI */}
        <div className="bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400">
              <Egg className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono text-slate-400">Daily Revenue Protected</p>
              <h4 className="text-sm font-bold text-white mt-0.5">R {financials.last30Days.revenueProtected.toLocaleString()}</h4>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
              +{financials.last30Days.percentOfTarget.toFixed(1)}% Target
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================================
          TABS VIEWPORT
          ============================================================================ */}
      <main className="flex-1 px-6 pb-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            
            {/* ------------------------------------------------------------------
                TAB: OVERVIEW
                ------------------------------------------------------------------ */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 8-Coop Status Grid */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-teal-400" /> Coop Live Matrix
                    </h2>
                    <span className="text-xs text-slate-400">Select coop to view details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {coops.map(coop => {
                      const tel = liveTelemetry.find(t => t.coop_id === coop.id) || { temperature: 24, humidity: 55, nh3_level: 0 };
                      const str = liveStress.find(s => s.coop_id === coop.id) || { acoustic_stress: 0.1, huddling_index: 0.1 };
                      const isSelected = selectedCoop === coop.id;
                      
                      // Highlight stress levels
                      const isHeatStress = tel.temperature > 32;
                      const isNh3High = tel.nh3_level > 20;
                      const hasWarning = isHeatStress || isNh3High;

                      return (
                        <div
                          key={coop.id}
                          onClick={() => setSelectedCoop(coop.id)}
                          className={`glass-panel p-4 rounded-xl cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-teal-500/50 bg-teal-950/10 shadow-lg shadow-teal-500/5' 
                              : 'hover:border-white/10'
                          } ${hasWarning ? 'border-red-500/40 bg-red-950/5' : ''}`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-sm font-bold text-white">{coop.name}</h3>
                              <span className="text-[10px] uppercase font-mono text-slate-400">
                                {coop.type === 'cage' ? 'Cage System' : 'Deep Litter'}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {isHeatStress && <span className="w-2 h-2 rounded-full bg-red-500 pulse-teal-dot" title="Heat Stress!" />}
                              {isNh3High && <span className="w-2 h-2 rounded-full bg-amber-500 pulse-teal-dot" title="High Ammonia!" />}
                              {!hasWarning && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Temperature</span>
                              <span className={`text-xs font-bold ${isHeatStress ? 'text-red-400' : 'text-slate-200'}`}>
                                {tel.temperature}°C
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Humidity</span>
                              <span className="text-xs font-bold text-slate-200">{tel.humidity}%</span>
                            </div>
                            {coop.type === 'deep_litter' && (
                              <div className="col-span-2 pt-1">
                                <span className="text-[10px] text-slate-400 block">Ammonia (NH3)</span>
                                <span className={`text-xs font-bold ${isNh3High ? 'text-amber-400' : 'text-slate-200'}`}>
                                  {tel.nh3_level} ppm
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400">
                            <span>Acoustic: {Math.round(str.acoustic_stress * 100)}%</span>
                            <span>Huddle: {Math.round(str.huddling_index * 100)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Historical Analytics Widget */}
                  <div className="glass-panel p-6 rounded-xl">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-bold text-white">Environmental Trends ({selectedCoopMeta.name})</h2>
                          {hasActiveAlert && (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              simulatedAlert.level === 'danger'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              ⚠ ACTIVE ALERT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">24-hour sensor telemetry logs</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-red-400"><Thermometer className="w-3.5 h-3.5" /> Temp</span>
                        <span className="flex items-center gap-1.5 text-xs text-teal-400"><Droplets className="w-3.5 h-3.5" /> Hum</span>
                        {selectedCoopMeta.type === 'deep_litter' && (
                          <span className="flex items-center gap-1.5 text-xs text-amber-400"><Wind className="w-3.5 h-3.5" /> NH3</span>
                        )}
                      </div>
                    </div>

                    <div className="h-48 md:h-64">
                      {selectedCoopHistory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={selectedCoopHistory}>
                            <defs>
                              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f87171" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#0d101c', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                            <Area type="monotone" dataKey="avg_temp" stroke="#f87171" strokeWidth={2} fillOpacity={1} fill="url(#colorTemp)" />
                            <Area type="monotone" dataKey="avg_humidity" stroke="#2dd4bf" strokeWidth={2} fillOpacity={1} fill="url(#colorHum)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 text-sm font-mono">
                          No historical telemetry data synced. Polling active...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Sidebar: Selected Coop Details & AI Inferences */}
                <div className="space-y-6">
                  <div className="glass-panel p-6 rounded-xl">
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2 flex-wrap">
                      Coop Insight: {selectedCoopMeta.name}
                      {hasActiveAlert && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          simulatedAlert.level === 'danger'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {simulatedAlert.level === 'danger' ? 'CRITICAL' : 'WARNING'}
                        </span>
                      )}
                    </h2>
                    
                    <div className="space-y-4">
                      {/* Live Indicators */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#121624] p-3 rounded-lg border border-white/5">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Temperature</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Thermometer className="w-4 h-4 text-red-400" />
                            <span className="text-base font-bold text-white">{selectedCoopLive.temperature}°C</span>
                          </div>
                        </div>
                        <div className="bg-[#121624] p-3 rounded-lg border border-white/5">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">Humidity</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Droplets className="w-4 h-4 text-teal-400" />
                            <span className="text-base font-bold text-white">{selectedCoopLive.humidity}%</span>
                          </div>
                        </div>
                      </div>

                      {/* AI Acoustic Analysis */}
                      <div className="border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                            <Volume2 className="w-4 h-4 text-cyan-400" /> XGBoost Acoustics
                          </h3>
                          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                            selectedCoopStress.acoustic_stress > 0.6 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {selectedCoopStress.acoustic_stress > 0.6 ? 'HIGH STRESS' : 'STABLE'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Stress Index</span>
                            <span className="text-white font-mono">{Math.round(selectedCoopStress.acoustic_stress * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                selectedCoopStress.acoustic_stress > 0.6 ? 'bg-red-500' : 'bg-teal-500'
                              }`}
                              style={{ width: `${selectedCoopStress.acoustic_stress * 100}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1">
                            <span>Peak Freq: {selectedCoopStress.peak_frequency} Hz</span>
                            <span>Flock Stress Index</span>
                          </div>
                        </div>
                      </div>

                      {/* AI Vision Analysis */}
                      <div className="border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                            <Camera className="w-4 h-4 text-cyan-400" /> YOLOv8-nano Vision
                          </h3>
                          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                            selectedCoopStress.huddling_index > 0.6 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {selectedCoopStress.huddling_index > 0.6 ? 'HUDDLING' : 'DISPERSED'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Huddling Index</span>
                            <span className="text-white font-mono">{Math.round(selectedCoopStress.huddling_index * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                selectedCoopStress.huddling_index > 0.6 ? 'bg-red-500' : 'bg-teal-500'
                              }`}
                              style={{ width: `${selectedCoopStress.huddling_index * 100}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1">
                            <span>Birds Tracked: {selectedCoopStress.bird_count}</span>
                            <span>Active Ratio: {Math.round((selectedCoopStress.active_birds / selectedCoopStress.bird_count) * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Protection Widget */}
                  <div className="glass-panel p-6 rounded-xl space-y-4">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-teal-400" /> Amortization Progress
                    </h2>

                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">CapEx Investment</span>
                        <span className="text-white font-bold">R {financials.capEx.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">30-Day Gross Revenue</span>
                        <span className="text-emerald-400 font-bold">R {financials.last30Days.revenue.toLocaleString()}</span>
                      </div>
                      
                      <div className="pt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">CapEx Amortized</span>
                          <span className="text-white font-bold font-mono">100% + Recouped</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>

                      <div className="bg-[#121624] p-3 rounded-lg border border-white/5 text-[11px] space-y-1.5">
                        <div className="flex justify-between text-slate-400">
                          <span>Standard Break-even:</span>
                          <span className="text-slate-200 font-bold">{financials.amortization.standardMonths} Months</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Summer Stress Break-even:</span>
                          <span className="text-teal-400 font-bold">{financials.amortization.heatStressDays} Days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------
                TAB: TELEMETRY
                ------------------------------------------------------------------ */}
            {activeTab === 'telemetry' && (
              <div className="space-y-6">
                <div className="glass-panel p-6 rounded-xl">
                  <h2 className="text-lg font-bold text-white mb-4">Environmental Sensor Grid</h2>
                  <p className="text-xs text-slate-400 mb-6">Real-time data streams from XY-MD02 RS485 Modbus and Electrochemical NH3 probes.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {coops.map(coop => {
                      const tel = liveTelemetry.find(t => t.coop_id === coop.id) || { temperature: 0, humidity: 0, nh3_level: 0 };
                      return (
                        <div key={coop.id} className={`bg-[#121624] p-5 rounded-xl border space-y-4 ${
                          simulatedAlert && simulatedAlert.coop_id === coop.id
                            ? simulatedAlert.level === 'danger'
                              ? 'border-red-500/40 bg-red-950/10'
                              : 'border-amber-500/40 bg-amber-950/10'
                            : 'border-white/5'
                        }`}>
                          <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              {coop.name}
                              {simulatedAlert && simulatedAlert.coop_id === coop.id && (
                                <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                                  simulatedAlert.level === 'danger'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {simulatedAlert.level === 'danger' ? 'HEAT' : 'NH3'}
                                </span>
                              )}
                            </h3>
                            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-400">
                              ID: {coop.id}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5" /> Temp</span>
                              <span className="text-white font-bold">{tel.temperature}°C</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" /> Humidity</span>
                              <span className="text-white font-bold">{tel.humidity}%</span>
                            </div>
                            {coop.type === 'deep_litter' && (
                              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-white/5">
                                <span className="text-slate-400 flex items-center gap-1.5"><Wind className="w-3.5 h-3.5" /> NH3 (Ammonia)</span>
                                <span className={`font-bold ${tel.nh3_level > 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {tel.nh3_level} ppm
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expanded Telemetry Analytics */}
                <div className="glass-panel p-6 rounded-xl">
                  <h2 className="text-base font-bold text-white mb-6">
                      Historical Telemetry Aggregates (24 Hours) — {selectedCoopMeta.name}
                      {hasActiveAlert && (
                        <span className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded align-middle ${
                          simulatedAlert.level === 'danger'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          ⚠ ACTIVE — {simulatedAlert.title.split(':')[0]}
                        </span>
                      )}
                    </h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedCoopHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0d101c', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                        <Line type="monotone" dataKey="avg_temp" name="Avg Temp (°C)" stroke="#f87171" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="avg_humidity" name="Avg Humidity (%)" stroke="#2dd4bf" strokeWidth={2.5} dot={false} />
                        {selectedCoopMeta.type === 'deep_litter' && (
                          <Line type="monotone" dataKey="avg_nh3" name="Avg NH3 (ppm)" stroke="#fbbf24" strokeWidth={2.5} dot={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------
                TAB: EDGE_AI
                ------------------------------------------------------------------ */}
            {activeTab === 'edge_ai' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Acoustic Stress Monitor */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-xl space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-cyan-400" /> Acoustic Stress Monitor (XGBoost)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Vocalisation frequency and stress classification via edge audio node.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Live Audio Spectrogram (Mock Graphic) */}
                    <div className="bg-[#121624] p-4 rounded-xl border border-white/5 flex flex-col justify-between h-40 md:h-56">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Live Audio Stream Spectrogram</span>
                      <div className="flex-1 flex items-end gap-1 justify-center py-4">
                        {[40, 60, 20, 80, 100, 30, 45, 90, 70, 55, 30, 80, 60, 40, 20, 95, 40, 60, 80].map((height, idx) => (
                          <motion.div
                            key={idx}
                            className={`w-2.5 rounded-t ${
                              simulatedAlert && simulatedAlert.level === 'danger' && idx % 3 === 0 
                                ? 'bg-red-500' 
                                : 'bg-teal-500'
                            }`}
                            initial={{ height: '10%' }}
                            animate={{ height: `${height}%` }}
                            transition={{ repeat: Infinity, duration: 0.5 + idx * 0.05, repeatType: 'reverse' }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-slate-400">
                        <span>0 Hz</span>
                        <span>Center: 1.2 kHz</span>
                        <span>4.5 kHz</span>
                      </div>
                    </div>

                    {/* Acoustic Inferences Stats */}
                    <div className="space-y-4 justify-between flex flex-col">
                      <div className="bg-[#121624] p-4 rounded-xl border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono">Stress Index</span>
                        <h3 className="text-2xl font-bold text-white mt-1">
                          {Math.round(selectedCoopStress.acoustic_stress * 100)}%
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Calculated from vocalization amplitude and peak frequency.
                        </p>
                      </div>

                      <div className="bg-[#121624] p-4 rounded-xl border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono">Vocalisation Alerts</span>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span className="text-xs text-slate-200">Stress frequency matches baseline signatures</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spatial YOLOv8-nano Vision Monitor */}
                <div className="glass-panel p-6 rounded-xl space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Camera className="w-5 h-5 text-cyan-400" /> YOLOv8 Vision Feed
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Spatial tracking and huddling index estimation.</p>
                  </div>

                  {/* Coop-specific Camera Visualizer */}
                  <div className="relative aspect-video bg-[#121624] rounded-xl border border-white/5 overflow-hidden">
                    {/* Gradient background tinted by stress level */}
                    <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] transition-all duration-700 ${
                      selectedCoopStress.acoustic_stress > 0.6
                        ? 'from-red-500/15 via-red-950/10 to-transparent'
                        : 'from-teal-500/5 via-transparent to-transparent'
                    }`} />

                    {selectedCoopMeta.type === 'cage' ? (
                      /* ── CAGE COOP: Battery cage rows with 2-3 hens per cage ── */
                      <div className="absolute inset-0 p-[5%]">
                        {getCageRows(selectedCoop, selectedCoopStress.acoustic_stress).map((cage, i) => {
                          const isStressed = selectedCoopStress.acoustic_stress > 0.6;
                          const stressColor = isStressed ? 'rgba(239,68,68,0.5)' : 'rgba(45,212,191,0.5)';
                          return (
                            <div
                              key={i}
                              className="absolute"
                              style={{ top: cage.top, left: cage.left, width: cage.w, height: cage.h }}
                            >
                              {/* Cage wire frame */}
                              <div
                                className="absolute inset-0 rounded-sm border"
                                style={{
                                  borderColor: stressColor,
                                  background: isStressed ? 'rgba(239,68,68,0.04)' : 'rgba(45,212,191,0.04)',
                                  boxShadow: `inset 0 0 6px ${stressColor.replace('0.5','0.15')}`,
                                }}
                              >
                                {/* Wire mesh vertical lines */}
                                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                                  <line x1="25" y1="0" x2="25" y2="100" stroke={isStressed ? '#ef4444' : '#14b8a6'} strokeWidth="0.3" />
                                  <line x1="50" y1="0" x2="50" y2="100" stroke={isStressed ? '#ef4444' : '#14b8a6'} strokeWidth="0.3" />
                                  <line x1="75" y1="0" x2="75" y2="100" stroke={isStressed ? '#ef4444' : '#14b8a6'} strokeWidth="0.3" />
                                  <line x1="0" y1="33" x2="100" y2="33" stroke={isStressed ? '#ef4444' : '#14b8a6'} strokeWidth="0.3" />
                                  <line x1="0" y1="66" x2="100" y2="66" stroke={isStressed ? '#ef4444' : '#14b8a6'} strokeWidth="0.3" />
                                </svg>
                                {/* Label */}
                                <span className="absolute -top-2.5 left-0 text-[5px] font-mono text-slate-500 bg-[#121624] px-0.5 rounded">
                                  CAGE {i + 1}
                                </span>
                              </div>
                              {/* 2-3 Hens inside the cage */}
                              {Array.from({ length: cage.hens }).map((_, hi) => {
                                const isHuddling = cage.huddling && cage.hens > 2;
                                const pos = isHuddling
                                  ? { top: `${30 + hi * 20}%`, left: `${20 + hi * 25}%` }  // huddled together
                                  : { top: `${20 + hi * 15 + (i % 2) * 10}%`, left: `${15 + hi * 30 + (i % 3) * 8}%` };
                                return (
                                  <div
                                    key={hi}
                                    className="absolute flex items-center justify-center"
                                    style={{
                                      ...pos,
                                      width: cage.huddling ? '30%' : '28%',
                                      height: cage.huddling ? '45%' : '40%',
                                    }}
                                  >
                                    {/* Hen body (oval) */}
                                    <div
                                      className="rounded-full opacity-90"
                                      style={{
                                        width: '80%',
                                        height: '65%',
                                        background: isStressed
                                          ? `radial-gradient(ellipse, #fbbf24 40%, #b45309 100%)`
                                          : `radial-gradient(ellipse, #f5f5f4 40%, #a8a29e 100%)`,
                                        boxShadow: `0 1px 2px rgba(0,0,0,0.3)`,
                                      }}
                                    >
                                      {/* Comb (small red dot on top) */}
                                      <div
                                        className="mx-auto rounded-full"
                                        style={{
                                          width: '20%',
                                          height: '18%',
                                          background: '#dc2626',
                                          marginTop: '-2px',
                                        }}
                                      />
                                      {/* Eye */}
                                      <div
                                        className="mx-auto rounded-full"
                                        style={{
                                          width: '12%',
                                          height: '12%',
                                          background: '#000',
                                          marginTop: '2px',
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* ── DEEP LITTER COOP: Scattered hens with bounding boxes ── */
                      <div className="absolute inset-0">
                        {/* Floor line */}
                        <div className="absolute bottom-[15%] left-[5%] right-[5%] h-[2px] opacity-20"
                          style={{ background: 'linear-gradient(90deg, transparent, #78716c, transparent)' }} />
                        {getLitterHens(selectedCoop).map((hen, i) => {
                          const isStressed = selectedCoopStress.acoustic_stress > 0.6;
                          const stressColor = isStressed ? 'rgba(239,68,68,0.6)' : 'rgba(45,212,191,0.6)';
                          return (
                            <div
                              key={i}
                              className="absolute border rounded bg-opacity-5 flex items-start p-0.5 transition-all duration-500"
                              style={{
                                top: `${hen.t}%`,
                                left: `${hen.l}%`,
                                width: '48px',
                                height: '36px',
                                borderColor: stressColor,
                                backgroundColor: isStressed ? 'rgba(239,68,68,0.05)' : 'rgba(45,212,191,0.05)',
                                transform: `rotate(${(i * 17 + 5) % 30 - 15}deg)`,
                              }}
                            >
                              {/* Hen silhouette inside box */}
                              <div
                                className="rounded-full mx-auto mt-0.5"
                                style={{
                                  width: '70%',
                                  height: '65%',
                                  background: isStressed
                                    ? 'radial-gradient(ellipse, #fbbf24 40%, #b45309 100%)'
                                    : 'radial-gradient(ellipse, #f5f5f4 40%, #a8a29e 100%)',
                                }}
                              >
                                <div className="mx-auto rounded-full bg-red-600"
                                  style={{ width: '16%', height: '16%', marginTop: '-1px' }} />
                              </div>
                              <span className="text-[5px] font-mono text-teal-400 bg-slate-900/80 px-0.5 rounded absolute -bottom-3 left-0 whitespace-nowrap">
                                layer_hen {(87 + i * 2) % 99}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Camera Feed HUD */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-slate-950/80 px-2 py-0.5 rounded text-[8px] font-mono text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> {selectedCoopMeta.name.toUpperCase().replace(' ', '_')}_CAM
                    </div>
                    <div className="absolute top-2 right-2 bg-slate-950/80 px-2 py-0.5 rounded text-[8px] font-mono text-slate-400">
                      {selectedCoopMeta.type === 'cage' ? 'CAGE' : 'DEEP_LITTER'} · {selectedCoopMeta.capacity} CAP
                    </div>

                    {/* Sensor Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent px-3 py-2">
                      <div className="flex gap-3 text-[9px] font-mono">
                        <span className={selectedCoopLive.temperature > 32 ? 'text-red-400' : selectedCoopLive.temperature > 28 ? 'text-amber-400' : 'text-teal-400'}>
                          🌡 {selectedCoopLive.temperature}°C
                        </span>
                        <span className="text-cyan-400">💧 {selectedCoopLive.humidity}%</span>
                        <span className={selectedCoopStress.acoustic_stress > 0.6 ? 'text-red-400' : 'text-slate-300'}>
                          🔊 {Math.round(selectedCoopStress.acoustic_stress * 100)}% stress
                        </span>
                        <span className="text-slate-400">
                          🐔 {selectedCoopStress.active_birds}/{selectedCoopStress.bird_count}
                        </span>
                      </div>
                    </div>

                    <Camera className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-slate-700/50" />
                  </div>

                  <div className="bg-[#121624] p-4 rounded-xl border border-white/5 space-y-2">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Spatial Distribution</span>
                    <div className="flex justify-between text-xs">
                      <span>Huddling Index</span>
                      <span className="font-bold text-white">{selectedCoopStress.huddling_index}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Total Birds Tracked</span>
                      <span className="font-bold text-white">{selectedCoopStress.bird_count}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ------------------------------------------------------------------
                TAB: FINANCIALS
                ------------------------------------------------------------------ */}
            {activeTab === 'financials' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Financial Overview */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-xl space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white">Revenue Protection Dashboard</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Evaluating CapEx amortization and stress mitigation value.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-[#121624] p-4 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">CapEx Investment</span>
                      <h3 className="text-xl font-bold text-white mt-1">R {financials.capEx.toLocaleString()}</h3>
                      <span className="text-[10px] text-slate-400 block mt-1">Total hardware deployment</span>
                    </div>

                    <div className="bg-[#121624] p-4 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Monthly Revenue Target</span>
                      <h3 className="text-xl font-bold text-white mt-1">R {financials.monthlyTarget.toLocaleString()}</h3>
                      <span className="text-[10px] text-slate-400 block mt-1">Based on 1,080 eggs/day</span>
                    </div>

                    <div className="bg-[#121624] p-4 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Revenue Protected</span>
                      <h3 className="text-xl font-bold text-emerald-400 mt-1">R {financials.last30Days.revenueProtected.toLocaleString()}</h3>
                      <span className="text-[10px] text-emerald-500 block mt-1">From automated mitigations</span>
                    </div>
                  </div>

                  {/* Production vs Baseline Chart */}
                  <div className="pt-4">
                    <h3 className="text-sm font-bold text-white mb-4">Daily Egg Yield (Last 7 Days)</h3>
                    <div className="h-48 md:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yieldHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                          <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: '#0d101c', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                          <Bar dataKey="quantity" name="Egg Quantity" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Amortization Analysis */}
                <div className="glass-panel p-6 rounded-xl space-y-6">
                  <h2 className="text-base font-bold text-white">Investment Return & Amortization</h2>
                  
                  <div className="space-y-4">
                    <div className="border border-white/5 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold text-white uppercase font-mono block">Standard Payback Period</span>
                      <div className="flex justify-between items-end">
                        <span className="text-3xl font-bold text-white">7.4</span>
                        <span className="text-xs text-slate-400 mb-1">Months to break even</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Based on standard laying rate improvements and feed conversions.
                      </p>
                    </div>

                    <div className="border border-white/5 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold text-teal-400 uppercase font-mono block">Critical Heat Stress Payback</span>
                      <div className="flex justify-between items-end">
                        <span className="text-3xl font-bold text-teal-400">22</span>
                        <span className="text-xs text-teal-500 mb-1">Days in summer cycle</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Preventing a major flock mortality or yield drop event during extreme summer heat waves pays back the entire CapEx in 22 days.
                      </p>
                    </div>

                    <div className="bg-[#121624] p-4 rounded-xl border border-white/5 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">30-Day Egg Production</span>
                        <span className="text-white font-bold">{financials.last30Days.eggsProduced.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cracked Rate</span>
                        <span className="text-white font-bold">
                          {((financials.last30Days.cracked / financials.last30Days.eggsProduced) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Dirty Rate</span>
                        <span className="text-white font-bold">
                          {((financials.last30Days.dirty / financials.last30Days.eggsProduced) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ============================================================================
          FOOTER
          ============================================================================ */}
      <footer className="border-t border-white/5 bg-[#080910] px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
        <div>Boonducks Farm Precision Livestock Farming (PLF) Engine.</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>V.E.R.S. Node Ingestion In Sync</span>
        </div>
      </footer>

    </div>
  );
}
