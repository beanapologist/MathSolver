
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { jsPDF } from 'jspdf';
import { AxiomPrimeSolver } from './services/solverEngine';
import { queryQuantumFallback } from './services/geminiService';
import { AIMO3_BENCHMARK } from './services/aimoData';
import { AxiomPrimeTestSuite } from './services/testSuite';
import { InvariantType, SolverResult, SolverLog, ReferenceProblem, TestSuiteReport } from './types';
import { 
  Terminal, BrainCircuit, Zap, ShieldCheck, History, ChevronRight, 
  Calculator, Sparkles, RefreshCw, Mic, MicOff, Settings2, Camera, 
  X, ExternalLink, BookOpen, ChevronDown, ChevronUp, Globe, 
  ScrollText, Trash2, Clock, CheckCircle2, ListChecks, Info,
  Lightbulb, FileSearch, Quote, FileDown, Activity, AlertTriangle, Check, Upload,
  Copy, Atom, DraftingCompass, Workflow, Cpu, Layers
} from 'lucide-react';

interface HistoryItem {
  id: string;
  timestamp: string;
  problem: string;
  result: SolverResult;
  capturedImage: string | null;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const App: React.FC = () => {
  const [problem, setProblem] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [isHighReasoning, setIsHighReasoning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showBench, setShowBench] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<TestSuiteReport | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [allLogs, setAllLogs] = useState<SolverLog[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedStepIdx, setCopiedStepIdx] = useState<number | null>(null);
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const solverRef = useRef(new AxiomPrimeSolver());
  const testSuiteRef = useRef(new AxiomPrimeTestSuite());
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('axiom_prime_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('axiom_prime_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allLogs]);

  const addLogs = (logs: SolverLog[]) => {
    setAllLogs(prev => [...prev, ...logs]);
  };

  const handleCopy = () => {
    if (result?.answer) {
      navigator.clipboard.writeText(result.answer.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Answer copied to clipboard.' }]);
    }
  };

  const handleCopyStep = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStepIdx(index);
    setTimeout(() => setCopiedStepIdx(null), 2000);
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: `Step Phase_0${index + 1} copied to clipboard.` }]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
        addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Visual context loaded via file upload.' }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsTesting(true);
    setShowDiagnostics(true);
    setShowBench(false);
    setShowHistory(false);
    setShowAbout(false);
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Initiating Axiom Protocol stress tests...' }]);
    const report = await testSuiteRef.current.runDiagnostics();
    setDiagnosticReport(report);
    setIsTesting(false);
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: report.failCount > 0 ? 'warning' : 'success', message: `Diagnostics: ${report.passCount}/${report.totalTests} Invariants Validated.` }]);
  };

  const addToHistory = (prob: string, res: SolverResult, img: string | null) => {
    const newItem: HistoryItem = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), problem: prob, result: res, capturedImage: img };
    setHistory(prev => [newItem, ...prev].slice(0, 50));
  };

  const handleSolve = async () => {
    if (!problem.trim() && !capturedImage) return;
    setIsSolving(true);
    setResult(null);
    setShowReasoning(true);
    setAllLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: `Initializing deduction sequence...` }]);

    let finalResult: SolverResult | null = null;
    if (!capturedImage) {
      const localResult = await solverRef.current.solve(problem);
      if (localResult.invariantUsed) {
        addLogs(localResult.logs);
        setResult(localResult);
        finalResult = localResult;
        setIsSolving(false);
      }
    }

    if (!finalResult) {
      finalResult = await queryQuantumFallback(problem, isHighReasoning, capturedImage?.split(',')[1]);
      addLogs(finalResult.logs);
      setResult(finalResult);
      setIsSolving(false);
    }

    if (finalResult && finalResult.answer !== null) {
      addToHistory(problem, finalResult, capturedImage);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      liveSessionRef.current?.close();
      audioContextRef.current?.close();
      setIsRecording(false);
      return;
    }
    try {
      setIsRecording(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(session => session.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              setProblem(prev => prev + (prev ? ' ' : '') + msg.serverContent!.inputTranscription!.text);
            }
          },
          onclose: () => setIsRecording(false)
        },
        config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {} }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) { setIsRecording(false); }
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      (videoRef.current?.srcObject as MediaStream)?.getTracks().forEach(track => track.stop());
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) { videoRef.current.srcObject = stream; setIsCameraActive(true); }
    } catch (err) { addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'error', message: 'Camera access denied.' }]); }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0);
      setCapturedImage(canvasRef.current.toDataURL('image/jpeg'));
      setIsCameraActive(false);
      (videoRef.current.srcObject as MediaStream)?.getTracks().forEach(t => t.stop());
    }
  };

  const handleExportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(184, 134, 11);
    doc.text("AXIOM PRIME RESEARCH REPORT", 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Reference ID: ${crypto.randomUUID().substring(0, 8).toUpperCase()} // Date: ${new Date().toLocaleString()}`, 20, 30);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Problem Statement:", 20, 45);
    doc.setFontSize(10);
    const splitProblem = doc.splitTextToSize(problem || "Visual input provided.", 170);
    doc.text(splitProblem, 20, 52);
    
    doc.setFontSize(14);
    doc.text("Deduced Conclusion:", 20, 75);
    doc.setFontSize(18);
    doc.setTextColor(202, 138, 4);
    doc.text((result.answer ?? 'VOID').toString(), 20, 85);
    
    doc.save(`AxiomPrime_Report_${Date.now()}.pdf`);
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'success', message: 'Report exported to PDF.' }]);
  };

  return (
    <div className="min-h-screen p-4 md:p-10 max-w-[1600px] mx-auto flex flex-col gap-10">
      {/* HUD HEADER */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 pb-10 border-b border-yellow-500/10">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full group-hover:bg-yellow-500/30 transition-all duration-700" />
            <div className="relative glass-panel p-5 rounded-3xl border border-yellow-500/30 glow-hover transition-all duration-500">
              <BrainCircuit className="w-14 h-14 text-yellow-500" />
            </div>
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tight gold-gradient leading-tight uppercase font-mono">
              Axiom Prime
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20">
                <ScrollText className="w-3.5 h-3.5" /> Quantum Manifold
              </span>
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                <ShieldCheck className="w-3.5 h-3.5" /> Consensus Locked
              </span>
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full border border-purple-400/20">
                <Zap className="w-3.5 h-3.5" /> G_TRANS_88
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex bg-gray-900/50 p-1 rounded-2xl border border-gray-800">
            <button 
              onClick={handleRunDiagnostics}
              className={`px-5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 ${showDiagnostics ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'text-gray-500 hover:text-white'}`}
            >
              <Activity className="w-4 h-4" /> Diagnostics
            </button>
            <button 
              onClick={() => { setShowBench(!showBench); setShowDiagnostics(false); setShowHistory(false); setShowAbout(false); }}
              className={`px-5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 ${showBench ? 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'text-gray-500 hover:text-white'}`}
            >
              <BookOpen className="w-4 h-4" /> Benchmark
            </button>
            <button 
              onClick={() => { setShowHistory(!showHistory); setShowDiagnostics(false); setShowBench(false); setShowAbout(false); }}
              className={`px-5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 ${showHistory ? 'bg-blue-500 text-black shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'text-gray-500 hover:text-white'}`}
            >
              <History className="w-4 h-4" /> History
            </button>
            <button 
              onClick={() => { setShowAbout(!showAbout); setShowDiagnostics(false); setShowBench(false); setShowHistory(false); }}
              className={`px-5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 ${showAbout ? 'bg-purple-500 text-black shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'text-gray-500 hover:text-white'}`}
            >
              <Info className="w-4 h-4" /> Intel
            </button>
          </div>
          <button 
            onClick={() => setIsHighReasoning(!isHighReasoning)}
            className={`px-6 py-3 border text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center gap-3 transition-all ${isHighReasoning ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.2)]' : 'bg-gray-900/50 border-gray-800 text-gray-500 hover:border-gray-700'}`}
          >
            <Settings2 className="w-4 h-4" /> {isHighReasoning ? 'Hyper-Reasoning On' : 'Reasoning Standard'}
          </button>
        </div>
      </header>

      {/* OVERLAY PANELS */}
      <div className="relative">
        {showAbout && (
          <div className="absolute inset-0 z-50 glass-panel rounded-[2.5rem] p-12 flex flex-col gap-10 animate-in zoom-in-95 duration-300 overflow-y-auto terminal-scroll">
            <div className="flex items-center justify-between pb-6 border-b border-gray-800">
              <h3 className="text-2xl font-black gold-gradient tracking-[0.3em] uppercase flex items-center gap-6">
                <Info className="w-8 h-8 text-yellow-500" /> Project Intelligence
              </h3>
              <button onClick={() => setShowAbout(false)} className="p-3 hover:bg-white/5 rounded-full transition-colors"><X className="w-8 h-8" /></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              <div className="space-y-6">
                <div className="flex items-center gap-4 text-yellow-500">
                  <Atom className="w-6 h-6" />
                  <h4 className="font-black uppercase tracking-widest text-sm">Engine Philosophy</h4>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed font-serif italic">
                  Axiom Prime is not a calculator; it is a traversal engine for universal mathematical invariants. By identifying the underlying symmetries of a problem, it reduces infinite complexity to deterministic proofs.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 text-blue-500">
                  <Workflow className="w-6 h-6" />
                  <h4 className="font-black uppercase tracking-widest text-sm">Logic Stack</h4>
                </div>
                <ul className="space-y-3 text-[11px] font-mono text-gray-500 uppercase">
                  <li className="flex items-center gap-3"><ChevronRight className="w-3 h-3 text-blue-500" /> Polynomial Manifold Reduction</li>
                  <li className="flex items-center gap-3"><ChevronRight className="w-3 h-3 text-blue-500" /> Frobenius Denomination Bounds</li>
                  <li className="flex items-center gap-3"><ChevronRight className="w-3 h-3 text-blue-500" /> S_n Subset Intersection Invariant</li>
                  <li className="flex items-center gap-3"><ChevronRight className="w-3 h-3 text-blue-500" /> Modular Congruence Engines</li>
                </ul>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 text-purple-500">
                  <Cpu className="w-6 h-6" />
                  <h4 className="font-black uppercase tracking-widest text-sm">Quantum Fallback</h4>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  When internal invariants reach an undecidable state, the system engages Gemini 3.0 Pro's High-Reasoning Manifold. This provides high-entropy heuristic analysis and formal proof sketches for unresolved theorems.
                </p>
              </div>

              <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-gray-900">
                <div className="bg-black/40 p-8 rounded-[2rem] border border-gray-800 space-y-4">
                  <div className="flex items-center gap-4 text-green-500">
                    <Camera className="w-6 h-6" />
                    <h5 className="font-black uppercase tracking-widest text-[11px]">Optic Manifold (Vision)</h5>
                  </div>
                  <p className="text-[11px] text-gray-600 uppercase tracking-tighter leading-relaxed">
                    Visual processing engine capable of parsing handwritten proofs and geometric diagrams. Input is normalized and mapped to known axiomatic schemas for identification.
                  </p>
                </div>

                <div className="bg-black/40 p-8 rounded-[2rem] border border-gray-800 space-y-4">
                  <div className="flex items-center gap-4 text-red-500">
                    <Mic className="w-6 h-6" />
                    <h5 className="font-black uppercase tracking-widest text-[11px]">Acoustic Feed (Voice)</h5>
                  </div>
                  <p className="text-[11px] text-gray-600 uppercase tracking-tighter leading-relaxed">
                    Live mathematical transcription system allowing for conversational problem statement. Uses real-time latency optimization to ensure continuous deduction flow.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-10 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.5em] text-gray-800">
              <div className="flex items-center gap-6">
                <ShieldCheck className="w-5 h-5 opacity-20" />
                <span>Security Protocol: G_TRANSCEND_LEVEL_9</span>
              </div>
              <span className="gold-gradient">Consensus Reached // Axiom Primed</span>
            </div>
          </div>
        )}

        {showDiagnostics && (
          <div className="absolute inset-0 z-50 glass-panel rounded-[2.5rem] p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <h3 className="text-lg font-black gold-gradient tracking-widest uppercase flex items-center gap-4">
                <ShieldCheck className="w-6 h-6 text-yellow-500" /> Invariant Stress Tests
              </h3>
              <button onClick={() => setShowDiagnostics(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            {isTesting ? (
              <div className="flex-grow flex flex-col items-center justify-center gap-6">
                <RefreshCw className="w-16 h-16 text-yellow-500 animate-spin" />
                <p className="font-mono text-sm text-yellow-500 animate-pulse uppercase tracking-[0.5em]">Executing Axiom Verification...</p>
              </div>
            ) : diagnosticReport && (
              <div className="flex-grow overflow-y-auto pr-4 terminal-scroll space-y-4">
                <div className="grid grid-cols-3 gap-6 mb-8">
                  {[{l: 'Passed', v: diagnosticReport.passCount, c: 'text-green-500'}, {l: 'Failed', v: diagnosticReport.failCount, c: 'text-red-500'}, {l: 'Coverage', v: `${Math.round((diagnosticReport.passCount/diagnosticReport.totalTests)*100)}%`, c: 'text-blue-400'}].map((s,i)=>(
                    <div key={i} className="bg-black/40 border border-gray-800 p-6 rounded-3xl text-center">
                      <div className="text-[10px] text-gray-600 font-black uppercase mb-2 tracking-widest">{s.l}</div>
                      <div className={`text-3xl font-black ${s.c}`}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {diagnosticReport.results.map((r, i) => (
                  <div key={i} className={`p-6 rounded-3xl border transition-all flex items-center justify-between ${r.status === 'passed' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex gap-5 items-center">
                      <div className={`p-3 rounded-2xl ${r.status === 'passed' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {r.status === 'passed' ? <Check className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-200 uppercase tracking-tight">{r.name}</div>
                        <div className="text-[11px] font-mono text-gray-600">Latency: {r.duration.toFixed(2)}ms // Grounding Consensus</div>
                        {r.error && <div className="text-[11px] text-red-400 mt-2 font-mono bg-red-400/5 p-2 rounded-lg border border-red-400/10">{r.error}</div>}
                      </div>
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full ${r.status === 'passed' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{r.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showBench && (
          <div className="absolute inset-0 z-50 glass-panel rounded-[2.5rem] p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black gold-gradient tracking-widest uppercase">AIMO-3 Research Suite</h3>
              <button onClick={() => setShowBench(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 overflow-y-auto pr-2 terminal-scroll pb-4">
              {AIMO3_BENCHMARK.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => { setProblem(p.problem); setCapturedImage(null); setShowBench(false); setResult(null); }}
                  className="text-left p-6 bg-black/40 border border-gray-800 hover:border-yellow-500/50 rounded-[2rem] transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-yellow-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="text-[9px] text-gray-600 font-mono mb-3 uppercase tracking-widest border-b border-gray-900 pb-2">REF_BCH_{p.id}</div>
                  <div className="text-xs font-black text-gray-300 group-hover:text-yellow-500 mb-2 truncate uppercase">{p.title}</div>
                  <div className="text-[10px] text-gray-600 line-clamp-2 leading-relaxed">Complexity: High Invariant</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showHistory && (
          <div className="absolute inset-0 z-50 glass-panel rounded-[2.5rem] p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <h3 className="text-lg font-black gold-gradient tracking-widest uppercase flex items-center gap-4">
                <Clock className="w-6 h-6 text-blue-500" /> Deduction Archive
              </h3>
              <div className="flex items-center gap-4">
                {history.length > 0 && <button onClick={() => setHistory([])} className="text-[10px] text-red-500/60 hover:text-red-500 uppercase font-black tracking-widest transition-colors flex items-center gap-2"><Trash2 className="w-4 h-4"/> Purge Archive</button>}
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 terminal-scroll space-y-3">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-800 opacity-20"><History className="w-20 h-20 mb-4" /><p className="font-black uppercase tracking-[0.5em]">No Data Cached</p></div>
              ) : history.map(h => (
                <button 
                  key={h.id} 
                  onClick={() => { setProblem(h.problem); setResult(h.result); setCapturedImage(h.capturedImage); setShowHistory(false); }}
                  className="w-full text-left p-6 bg-black/40 border border-gray-800 hover:border-blue-500/50 rounded-[2rem] transition-all group flex flex-col gap-3"
                >
                  <div className="flex justify-between items-center border-b border-gray-900 pb-2">
                    <span className="text-[10px] font-mono text-gray-600 uppercase">{new Date(h.timestamp).toLocaleString()}</span>
                    <span className="text-[10px] font-black text-blue-500 uppercase bg-blue-500/10 px-3 py-1 rounded-full">{h.result.invariantUsed}</span>
                  </div>
                  <div className="text-sm text-gray-400 group-hover:text-white line-clamp-1 font-medium">{h.problem || "[Visual Analysis]"}</div>
                  <div className="text-[11px] font-black text-yellow-500 uppercase flex items-center gap-3"><Zap className="w-3.5 h-3.5 fill-current" /> Result: {h.result.answer}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MAIN CONSOLE GRID */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* LEFT: INPUT HUB */}
          <div className="lg:col-span-7 flex flex-col gap-10">
            <div className="glass-panel rounded-[3rem] p-10 relative overflow-hidden group scanline">
              <div className="flex items-center justify-between mb-8">
                <label className="text-xs font-black text-gray-500 uppercase tracking-[0.4em] flex items-center gap-4">
                  <Calculator className="w-6 h-6 text-yellow-500/40" /> Command Interface
                </label>
                <div className="flex gap-4">
                  <button onClick={() => fileInputRef.current?.click()} className="p-3.5 rounded-2xl bg-gray-900 text-gray-500 border border-gray-800 hover:text-green-400 hover:border-green-400/30 transition-all shadow-xl" title="Upload Schema">
                    <Upload className="w-5 h-5" />
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                  </button>
                  <button onClick={toggleCamera} className={`p-3.5 rounded-2xl transition-all shadow-xl border ${isCameraActive ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-gray-900 text-gray-500 border-gray-800 hover:text-blue-400'}`} title="Optic Analysis">
                    <Camera className="w-5 h-5" />
                  </button>
                  <button onClick={toggleRecording} className={`p-3.5 rounded-2xl transition-all shadow-xl border ${isRecording ? 'bg-red-500/20 text-red-500 border-red-500/40 animate-pulse' : 'bg-gray-900 text-gray-500 border-gray-800 hover:text-red-400'}`} title="Acoustic Feed">
                    <Mic className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="relative">
                {isCameraActive ? (
                  <div className="w-full aspect-video bg-black rounded-3xl border border-blue-500/30 overflow-hidden relative hud-border">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border border-blue-500/20 rounded-full animate-ping" />
                    </div>
                    <button onClick={captureFrame} className="absolute bottom-8 left-1/2 -translate-x-1/2 px-10 py-4 bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl hover:bg-blue-500 transition-all">Capture Axiom</button>
                  </div>
                ) : capturedImage ? (
                  <div className="w-full aspect-video bg-black/60 rounded-3xl border border-gray-800 overflow-hidden relative group">
                    <img src={capturedImage} className="w-full h-full object-contain p-6" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setCapturedImage(null)} className="p-4 bg-red-600 rounded-full hover:scale-110 transition-transform shadow-2xl"><X className="w-8 h-8 text-white"/></button>
                    </div>
                    <div className="absolute bottom-6 left-6 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-400/30 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md">Visual Priming Active</div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute top-4 left-4 pointer-events-none text-yellow-500/5 select-none">
                      <ScrollText className="w-32 h-32" />
                    </div>
                    <textarea
                      value={problem}
                      onChange={(e) => setProblem(e.target.value)}
                      placeholder="Declare theorem or complex problem sequence..."
                      className="w-full h-[320px] bg-transparent border-2 border-gray-900 rounded-[2.5rem] p-10 font-mono text-[15px] leading-relaxed resize-none focus:outline-none focus:border-yellow-500/20 transition-all placeholder:text-gray-800 text-gray-200"
                    />
                  </div>
                )}
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  onClick={handleSolve}
                  disabled={isSolving || (!problem && !capturedImage)}
                  className="group relative px-16 py-5 bg-yellow-600 disabled:bg-gray-900 disabled:text-gray-700 disabled:border-gray-800 text-black font-black uppercase tracking-[0.4em] rounded-[2rem] transition-all hover:bg-yellow-500 hover:scale-105 active:scale-95 shadow-2xl disabled:shadow-none"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    {isSolving ? <RefreshCw className="w-7 h-7 animate-spin" /> : <Zap className="w-7 h-7 fill-current" />}
                    <span>{isSolving ? 'Traversing' : 'Initialize Deduction'}</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-[2.5rem] h-64 flex flex-col overflow-hidden shadow-2xl relative">
              <div className="bg-white/5 px-8 py-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black font-mono text-gray-500 uppercase tracking-[0.5em] flex items-center gap-3">
                  <Terminal className="w-4 h-4 text-yellow-500/40" /> Telemetry Stream
                </span>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <div className="w-1.5 h-1.5 bg-yellow-500/20 rounded-full" />
                </div>
              </div>
              <div className="flex-grow p-8 overflow-y-auto terminal-scroll font-mono text-[12px] space-y-2 bg-black/40">
                {allLogs.length === 0 ? (
                  <p className="text-gray-800 italic uppercase tracking-tighter">System awaiting initialization...</p>
                ) : allLogs.map((l, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-gray-700 opacity-50 shrink-0">[{l.timestamp}]</span>
                    <span className={`${l.type === 'success' ? 'text-green-500' : l.type === 'error' ? 'text-red-500' : l.type === 'warning' ? 'text-yellow-500' : 'text-blue-400'}`}>
                      <span className="mr-2">»</span>{l.message}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>

          {/* RIGHT: RESEARCH OUTPUT */}
          <div className="lg:col-span-5 flex flex-col gap-10">
            <div className={`glass-panel rounded-[3.5rem] p-10 flex flex-col flex-grow transition-all duration-1000 relative overflow-hidden ${!result && !isSolving ? 'opacity-30 blur-[4px] grayscale' : 'opacity-100'}`}>
              <div className="absolute top-10 right-10 z-10">
                {result && !isSolving && (
                  <button onClick={handleExportPDF} className="group p-4 bg-yellow-500 text-black rounded-[1.5rem] hover:scale-110 transition-all shadow-2xl">
                    <FileDown className="w-6 h-6" />
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-5 mb-10">
                <div className="p-3.5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                  <ScrollText className="w-6 h-6 text-blue-500" />
                </div>
                <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.4em]">Research Payload Output</h2>
              </div>

              {isSolving ? (
                <div className="flex-grow flex flex-col items-center justify-center gap-10">
                  <div className="relative">
                    <div className="w-28 h-28 border-[4px] border-yellow-500/5 border-t-yellow-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-yellow-500/40 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-3">
                    <p className="font-mono text-sm text-yellow-500 font-black uppercase tracking-[0.6em] animate-pulse">Syncing Planes</p>
                    <p className="text-[10px] text-gray-700 uppercase tracking-widest font-black">Invariant Consensus Verification</p>
                  </div>
                </div>
              ) : result ? (
                <div className="flex-grow overflow-y-auto pr-4 terminal-scroll space-y-10 pb-6">
                  {/* RESULT SHIELD */}
                  <div className="bg-black border border-yellow-500/20 rounded-[3rem] p-10 relative overflow-hidden shadow-inner group transition-all hover:border-yellow-500/40">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><BrainCircuit className="w-24 h-24" /></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.5em] text-yellow-500/50">Deduction Result</label>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={handleCopy}
                            className={`p-2 rounded-lg transition-all ${copied ? 'text-green-500 bg-green-500/10' : 'text-yellow-500/40 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
                            title="Copy Answer"
                          >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <span className="text-[9px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-500 px-4 py-1.5 rounded-full border border-yellow-500/20">{result.invariantUsed}</span>
                        </div>
                      </div>
                      <div className={`font-mono gold-gradient tracking-tighter break-words ${result.answer?.toString().length > 10 ? 'text-3xl font-bold leading-relaxed' : 'text-7xl font-black'}`}>
                        {result.answer || 'VOID'}
                      </div>
                    </div>
                  </div>

                  {/* DERIVATION HUD */}
                  {result.reasoning && (
                    <div className="space-y-4">
                      <button onClick={()=>setShowReasoning(!showReasoning)} className="w-full flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-[1.5rem] hover:bg-white/10 transition-all group">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 flex items-center gap-4">
                          <BrainCircuit className="w-5 h-5 opacity-40 group-hover:opacity-100" /> Derivation Reasoning
                        </span>
                        {showReasoning ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
                      </button>
                      {showReasoning && (
                        <div className="p-8 bg-black/40 border border-gray-900 rounded-[2rem] relative overflow-hidden animate-in slide-in-from-top-4 duration-500">
                          <Quote className="absolute -top-4 -left-4 w-16 h-16 text-white/[0.03] rotate-12" />
                          <div className="relative z-10 text-[14px] leading-[1.8] text-gray-400 font-serif italic whitespace-pre-wrap">{result.reasoning}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TIMELINE */}
                  <div className="space-y-6">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600 flex items-center gap-4">
                      <ListChecks className="w-5 h-5 opacity-30" /> Invariant Sequence
                    </label>
                    <div className="relative space-y-10 pl-5">
                      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gradient-to-b from-yellow-500/30 via-gray-800 to-transparent" />
                      {result.steps.map((s, i) => (
                        <div key={i} className="flex gap-8 group">
                          <div className="relative z-10 w-3 h-3 bg-black border-[3px] border-gray-800 rounded-full group-hover:border-yellow-500 transition-all mt-1.5" />
                          <div className="flex flex-col gap-2 flex-grow">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black font-mono text-gray-700 uppercase tracking-widest">Phase_0{i+1}</span>
                              <button 
                                onClick={() => handleCopyStep(s, i)}
                                className={`p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 ${copiedStepIdx === i ? 'text-green-500 bg-green-500/10' : 'text-gray-600 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
                                title="Copy Step"
                              >
                                {copiedStepIdx === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <span className="text-[15px] text-gray-300 font-medium group-hover:text-white transition-colors leading-relaxed">{s}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SOURCES */}
                  {result.groundingSources && (
                    <div className="space-y-6 pt-10 border-t border-gray-900">
                      <label className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400/50 flex items-center gap-4">
                        <Globe className="w-5 h-5" /> External Validation
                      </label>
                      <div className="flex flex-col gap-4">
                        {result.groundingSources.map((s, i) => (
                          <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center justify-between p-5 bg-gray-900/40 border border-gray-800 rounded-[1.5rem] hover:border-blue-500/40 hover:bg-blue-500/[0.03] transition-all group">
                            <span className="truncate flex items-center gap-4 text-xs font-bold text-gray-400 group-hover:text-blue-400">
                              <FileSearch className="w-4 h-4 text-gray-700" /> {s.title}
                            </span>
                            <ExternalLink className="w-4 h-4 text-gray-800 group-hover:text-blue-400 group-hover:scale-110 transition-all" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center opacity-10 select-none grayscale">
                  <ScrollText className="w-24 h-24 mb-6" />
                  <p className="font-black uppercase tracking-[1em] text-sm">Standby</p>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/10 rounded-[2.5rem] p-8 flex gap-6">
              <div className="p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 shrink-0"><Lightbulb className="w-7 h-7 text-yellow-500" /></div>
              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-yellow-500/70">Deduction Protocol G5</h4>
                <p className="text-xs text-gray-500 leading-relaxed">System cross-references results with real-time mathematical databases. Final answer verified by Axiom consensus.</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* FOOTER HUD */}
      <footer className="mt-auto py-10 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-bold font-mono uppercase tracking-[0.3em] text-gray-700">
        <div className="flex items-center gap-6">
          <ShieldCheck className="w-4 h-4 text-green-900" />
          <span>Axiom Verification v3.0.1 PRO</span>
          <span className="opacity-10">//</span>
          <span className="text-yellow-900/40">G_CORE_ACTIVE</span>
        </div>
        <div className="flex items-center gap-10">
          <span className="hover:text-yellow-600 transition-colors cursor-default">Compliance Protocol</span>
          <div className="w-1.5 h-1.5 bg-gray-900 rounded-full" />
          <span className="text-blue-900/40">LATENCY: 12ms</span>
          <div className="w-1.5 h-1.5 bg-gray-900 rounded-full" />
          <span className="hover:text-white transition-colors cursor-default underline underline-offset-8 decoration-gray-900">Research Core v3</span>
        </div>
      </footer>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
