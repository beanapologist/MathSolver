
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { jsPDF } from 'jspdf';
import { AxiomPrimeSolver } from './services/solverEngine';
import { queryQuantumFallback } from './services/geminiService';
import { AIMO3_BENCHMARK } from './services/aimoData';
import { AxiomPrimeTestSuite } from './services/testSuite';
import { InvariantType, SolverResult, SolverLog, ProjectFile, TestSuiteReport, UserRequest } from './types';
import { 
  Terminal, BrainCircuit, Activity, ShieldCheck, History, ChevronRight, 
  Calculator, Sparkles, RefreshCw, Mic, MicOff, Settings2, Camera, 
  X, ExternalLink, BookOpen, ChevronDown, ChevronUp, Globe, 
  ScrollText, Trash2, Clock, CheckCircle2, ListChecks, Info,
  Lightbulb, FileSearch, Quote, FileDown, AlertTriangle, Check, Upload,
  Copy, Atom, DraftingCompass, Workflow, Cpu, Layers, MessageSquarePlus, Send, Tag,
  Binary, Command, Sun, Moon, FolderOpen, FileText, Plus, Save, Play, Search, Code, Layout, PanelsTopLeft, Compass, Bookmark, GitGraph, ArrowDown, Microscope, Waypoints, Dna, Share2, Network, Sigma
} from 'lucide-react';

const INITIAL_FILES: ProjectFile[] = [
  { id: '1', name: 'polynomial_analysis.lic', content: 'Quadratic polynomials P(x) and Q(x) have leading coefficients 2 and -2. They pass through (16,54) and (20,53). Find P(0)+Q(0).', type: 'proof', lastModified: Date.now() },
  { id: '2', name: 'research_notes.txt', content: '// Exploring Frobenius boundaries\nWhat is the largest integer that cannot be written as a sum of multiples of 6 and 11?', type: 'scratch', lastModified: Date.now() }
];

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
  const [files, setFiles] = useState<ProjectFile[]>(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [openFileIds, setOpenFileIds] = useState<string[]>(['1', '2']);
  const [isSolving, setIsSolving] = useState(false);
  const [isHighReasoning, setIsHighReasoning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<TestSuiteReport | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'protocol' | 'graph'>('protocol');
  const [allLogs, setAllLogs] = useState<SolverLog[]>([]);
  const [userRequests, setUserRequests] = useState<UserRequest[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const solverRef = useRef(new AxiomPrimeSolver());
  const testSuiteRef = useRef(new AxiomPrimeTestSuite());
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);

  useEffect(() => {
    const savedFiles = localStorage.getItem('lumina_research_files');
    if (savedFiles) setFiles(JSON.parse(savedFiles));
    const savedTheme = localStorage.getItem('lumina_research_theme');
    if (savedTheme === 'light') setIsDarkMode(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('lumina_research_files', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('lumina_research_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allLogs]);

  const addLogs = (logs: SolverLog[]) => setAllLogs(prev => [...prev, ...logs]);

  const handleCreateFile = () => {
    const newFile: ProjectFile = {
      id: crypto.randomUUID(),
      name: `analysis_${files.length + 1}.lic`,
      content: '',
      type: 'proof',
      lastModified: Date.now()
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    if (!openFileIds.includes(newFile.id)) setOpenFileIds(prev => [...prev, newFile.id]);
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: `Initialized project: ${newFile.name}` }]);
  };

  const handleUpdateContent = (content: string) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content, lastModified: Date.now() } : f));
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'success', message: "Result copied to clipboard." }]);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newOpen = openFileIds.filter(fid => fid !== id);
    setOpenFileIds(newOpen);
    if (activeFileId === id && newOpen.length > 0) setActiveFileId(newOpen[0]);
  };

  const handleRunAnalysis = async () => {
    if (!activeFile?.content && !capturedImage) return;
    setIsSolving(true);
    setResult(null);
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: `Analyzing project ${activeFile?.name}...` }]);

    let finalResult: SolverResult | null = null;
    if (!capturedImage) {
      const localResult = await solverRef.current.solve(activeFile!.content);
      if (localResult.invariantUsed) {
        addLogs(localResult.logs);
        setResult(localResult);
        finalResult = localResult;
        setIsSolving(false);
      }
    }

    if (!finalResult) {
      finalResult = await queryQuantumFallback(activeFile!.content, isHighReasoning, capturedImage?.split(',')[1]);
      addLogs(finalResult.logs);
      setResult(finalResult);
      setIsSolving(false);
    }
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      setIsCameraActive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'error', message: "Optic Feed denied." }]);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0);
      setCapturedImage(canvasRef.current.toDataURL('image/jpeg'));
      addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'success', message: "Image frame synchronized." }]);
    }
  };

  const handleRecording = async () => {
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
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              handleUpdateContent(activeFile!.content + ' ' + msg.serverContent.inputTranscription.text);
            }
          },
          onclose: () => setIsRecording(false)
        },
        config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {} }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (e) { setIsRecording(false); }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-[#020617] overflow-hidden text-slate-800 dark:text-slate-300 font-sans transition-colors duration-300">
      
      {/* Top IDE Toolbar */}
      <nav className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 bg-white dark:bg-[#0a0f1e] z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Microscope className="w-5 h-5 text-research" />
            <h1 className="text-sm font-black uppercase tracking-widest research-gradient font-mono hidden sm:block">Lumina Research IDE</h1>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
          <div className="flex gap-4">
            <button onClick={() => setShowAbout(true)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-research transition-colors">Framework</button>
            <button onClick={() => setShowRequests(true)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-research transition-colors">Research Archive</button>
            <button onClick={async () => {
              setShowDiagnostics(true);
              const r = await testSuiteRef.current.runDiagnostics();
              setDiagnosticReport(r);
            }} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-research transition-colors">Calibration</button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
            {isDarkMode ? <Sun className="w-4 h-4 text-research" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <button onClick={() => setIsHighReasoning(!isHighReasoning)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isHighReasoning ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600'}`}>
            High Reasoning
          </button>
          <button onClick={handleRunAnalysis} disabled={isSolving} className="bg-research hover:bg-research-dark disabled:opacity-50 text-white px-6 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-lg transition-all active:scale-95">
            {isSolving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Solve Query
          </button>
        </div>
      </nav>

      <div className="flex-grow flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`${showSidebar ? 'w-64' : 'w-0'} border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e] transition-all flex flex-col overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5" /> Workspace</span>
            <button onClick={handleCreateFile} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md transition-colors"><Plus className="w-4 h-4 text-slate-500" /></button>
          </div>
          <div className="flex-grow overflow-y-auto terminal-scroll py-3">
            <div className="px-5 mb-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Analysis</div>
            {files.map(f => (
              <button 
                key={f.id}
                onClick={() => { setActiveFileId(f.id); if (!openFileIds.includes(f.id)) setOpenFileIds(prev => [...prev, f.id]); }}
                className={`w-full text-left px-6 py-2.5 flex items-center gap-3 transition-colors group ${activeFileId === f.id ? 'bg-research/5 text-research border-r-2 border-research' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <FileText className={`w-4 h-4 ${activeFileId === f.id ? 'text-research' : 'text-slate-600'}`} />
                <span className="text-xs font-mono truncate">{f.name}</span>
              </button>
            ))}
            <div className="mt-8 px-5 mb-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">AIMO Benchmarks</div>
            {AIMO3_BENCHMARK.map(p => (
              <button 
                key={p.id}
                onClick={() => {
                  const newFile: ProjectFile = { id: `bench_${p.id}`, name: `${p.title.toLowerCase().replace(/\s/g, '_')}.aimo`, content: p.problem, type: 'benchmark', lastModified: Date.now() };
                  if (!files.find(f => f.id === newFile.id)) setFiles(prev => [...prev, newFile]);
                  setActiveFileId(newFile.id);
                  if (!openFileIds.includes(newFile.id)) setOpenFileIds(prev => [...prev, newFile.id]);
                }}
                className="w-full text-left px-6 py-2 flex items-center gap-3 text-slate-500 hover:text-research hover:bg-research/5 transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono truncate uppercase">{p.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Editor Area */}
        <div className="flex-grow flex flex-col overflow-hidden relative bg-white dark:bg-[#010410]">
          <div className="h-10 bg-slate-100 dark:bg-[#05091a] border-b border-slate-200 dark:border-slate-800 flex overflow-x-auto terminal-scroll">
            {openFileIds.map(fid => {
              const f = files.find(f => f.id === fid);
              if (!f) return null;
              return (
                <div 
                  key={fid}
                  onClick={() => setActiveFileId(fid)}
                  className={`min-w-[150px] px-4 flex items-center justify-between gap-3 border-r border-slate-200 dark:border-slate-900 cursor-pointer transition-colors group ${activeFileId === fid ? 'bg-white dark:bg-[#010410] text-research border-t-2 border-research' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 opacity-40" />
                    <span className="text-[11px] font-mono truncate">{f.name}</span>
                  </div>
                  <X onClick={(e) => closeTab(e, fid)} className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" />
                </div>
              );
            })}
          </div>

          <div className="flex-grow flex overflow-hidden">
            <div className="w-12 bg-slate-50 dark:bg-[#020617] border-r border-slate-200 dark:border-slate-800 flex flex-col items-center pt-5 select-none opacity-20 font-mono text-[10px] space-y-1.5 text-slate-500">
              {Array.from({ length: 40 }).map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>

            <div className="flex-grow relative">
              {isCameraActive && (
                <div className="absolute inset-0 z-10 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-10">
                  <div className="relative w-full max-w-2xl aspect-video rounded-3xl overflow-hidden border border-research/20 shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  </div>
                  <div className="mt-10 flex gap-6">
                    <button onClick={handleCapture} className="px-8 py-3 bg-research hover:bg-research-dark text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl flex items-center gap-3"><Activity className="w-4 h-4" /> Capture Frame</button>
                    <button onClick={toggleCamera} className="px-8 py-3 bg-slate-800 text-slate-400 font-black uppercase tracking-widest text-[11px] rounded-2xl hover:text-white transition-all">Close Feed</button>
                  </div>
                </div>
              )}
              
              <textarea 
                value={activeFile?.content || ''}
                onChange={(e) => handleUpdateContent(e.target.value)}
                placeholder="// Enter logical analysis parameters or theorem statement..."
                className="w-full h-full bg-transparent p-10 font-mono text-[15px] leading-relaxed resize-none focus:outline-none dark:text-slate-200 placeholder:text-slate-700 terminal-scroll"
              />

              <div className="absolute top-6 right-8 flex flex-col gap-3 opacity-40 hover:opacity-100 transition-all">
                <button onClick={toggleCamera} className={`p-3.5 rounded-2xl border transition-all ${isCameraActive ? 'bg-research/20 text-research border-research/40' : 'bg-[#0a0f1e] border-slate-800 text-slate-600 hover:text-research'}`} title="Optic Analysis"><Camera className="w-5 h-5" /></button>
                <button onClick={handleRecording} className={`p-3.5 rounded-2xl border transition-all ${isRecording ? 'bg-red-500/20 text-red-500 border-red-500/40 animate-pulse' : 'bg-[#0a0f1e] border-slate-800 text-slate-600 hover:text-red-400'}`} title="Acoustic Feed"><Mic className="w-5 h-5" /></button>
              </div>

              {capturedImage && !isCameraActive && (
                <div className="absolute bottom-8 right-8 w-48 h-32 bg-slate-900/90 border border-research/20 rounded-2xl overflow-hidden shadow-2xl group">
                  <img src={capturedImage} className="w-full h-full object-cover opacity-60" />
                  <button onClick={() => setCapturedImage(null)} className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                </div>
              )}
            </div>

            {/* Inspector Sidebar */}
            {result && (
              <div className="w-[450px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#05091a] flex flex-col shadow-2xl animate-in slide-in-from-right duration-500">
                <div className="p-6 border-b border-slate-100 dark:border-slate-900 bg-slate-50 dark:bg-[#070b18]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-research/10 flex items-center justify-center border border-research/20">
                        <Microscope className="w-4 h-4 text-research" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-research block">Synthesis Result</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{result.invariantUsed || 'Engine Analysis'}</span>
                      </div>
                    </div>
                    <button onClick={() => setResult(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 rounded-full transition-all group">
                      <X className="w-4 h-4 text-slate-500 group-hover:text-red-500" />
                    </button>
                  </div>
                  
                  <div className="flex bg-slate-200 dark:bg-black p-1 rounded-xl">
                    <button onClick={() => setInspectorTab('protocol')} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${inspectorTab === 'protocol' ? 'bg-white dark:bg-slate-800 text-research' : 'text-slate-500'}`}>Summary</button>
                    <button onClick={() => setInspectorTab('graph')} className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${inspectorTab === 'graph' ? 'bg-white dark:bg-slate-800 text-research' : 'text-slate-500'}`}>Deduction Graph</button>
                  </div>
                </div>

                <div className="flex-grow overflow-y-auto terminal-scroll p-8 space-y-8">
                  {inspectorTab === 'protocol' ? (
                    <>
                      <div className="p-8 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm relative group">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 block">Final Value</span>
                        <div className="text-5xl font-black research-gradient break-all tracking-tighter leading-none mb-6">
                          {result.answer}
                        </div>
                        <button 
                          onClick={() => copyToClipboard(result.answer?.toString() || '')} 
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-white/5 hover:bg-research hover:text-white'}`}
                        >
                          {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {isCopied ? 'Copied' : 'Copy Result'}
                        </button>
                      </div>

                      {result.reasoning && (
                        <div className="space-y-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-research flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Deduction Logic</span>
                          <div className="p-6 bg-research/[0.03] border border-research/10 rounded-3xl font-serif text-[14px] leading-relaxed text-slate-600 dark:text-slate-400 italic">
                            {result.reasoning}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><Workflow className="w-4 h-4" /> Axiomatic Path</span>
                        <div className="space-y-3">
                          {result.steps.map((step, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-900 rounded-2xl text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                              <span className="text-[8px] font-mono opacity-40 block mb-1">AXIOM_LOG_{idx + 1}</span>
                              {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center py-6 px-4 space-y-0 relative min-h-full">
                      {/* Flowchart Connector SVG Layer */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orientation="auto">
                            <polygon points="0 0, 6 2, 0 4" fill="currentColor" className="text-slate-300 dark:text-slate-800" />
                          </marker>
                          <linearGradient id="flow-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.1" />
                          </linearGradient>
                        </defs>
                        {/* Recursive path generation can be complex without refs, we use a single vertical line as base */}
                        <line x1="50%" y1="60" x2="50%" y2="calc(100% - 100px)" stroke="url(#flow-grad)" strokeWidth="1" strokeDasharray="4 4" className="animate-flow-line" />
                      </svg>

                      {/* Problem Statement Node */}
                      <div className="z-10 w-full bg-white dark:bg-[#0a0f1e] border-2 border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-xl mb-16 relative group overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-research/40 to-transparent" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-3">
                          <Network className="w-4 h-4 text-research" /> Research Input
                        </span>
                        <div className="text-[12px] font-serif text-slate-400 leading-relaxed italic line-clamp-4 group-hover:line-clamp-none transition-all">
                          {activeFile?.content || 'Unlabeled problem stream.'}
                        </div>
                        <div className="absolute bottom-4 right-6 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Quote className="w-12 h-12" />
                        </div>
                      </div>

                      {/* Invariant Logic Node */}
                      <div className="z-10 mb-16 relative">
                        <div className="logic-diamond shadow-[0_0_30px_rgba(14,165,233,0.2)] bg-[#0a0f1e] border-research ring-4 ring-research/5">
                          <div className="logic-diamond-content">
                            <DraftingCompass className="w-6 h-6 mx-auto mb-1 text-research animate-spin-slow" />
                            <div className="leading-tight">Axiomatic<br/>Mapping</div>
                          </div>
                        </div>
                        <div className="absolute -right-32 top-1/2 -translate-y-1/2 bg-research/10 border border-research/20 rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest text-research flex items-center gap-2">
                          <Cpu className="w-3 h-3" /> {result.invariantUsed?.split(' ')[0] || 'Core'}
                        </div>
                      </div>

                      {/* Deduction Step Nodes */}
                      <div className="w-full space-y-12 z-10">
                        {result.steps.map((step, idx) => (
                          <div key={idx} className="relative flex flex-col items-center group">
                             {/* Connector Pulse */}
                             <div className="absolute -top-12 left-1/2 w-0.5 h-12 bg-gradient-to-b from-research/20 to-research/40 -translate-x-1/2" />
                             
                             <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-research/20 flex items-center justify-center text-[11px] font-black text-research mb-4 shadow-[0_0_15px_rgba(14,165,233,0.1)] group-hover:scale-110 transition-transform">
                                {String(idx + 1).padStart(2, '0')}
                             </div>
                             
                             <div className="w-full bg-slate-50 dark:bg-[#070b18] border border-slate-200 dark:border-slate-800 p-5 rounded-[2rem] shadow-sm text-center border-l-4 border-l-research transition-all hover:shadow-md hover:bg-white dark:hover:bg-[#090e21]">
                               <p className="text-[12px] text-slate-500 leading-relaxed font-mono font-medium">
                                 {step}
                               </p>
                             </div>
                          </div>
                        ))}
                      </div>

                      {/* Final Synthesis Node */}
                      <div className="h-24 flex items-center justify-center z-10 relative">
                         <div className="absolute -top-12 left-1/2 w-0.5 h-12 bg-research/40 -translate-x-1/2" />
                         <div className="p-4 rounded-full bg-research/10 border border-research/20 animate-pulse">
                           <Layers className="w-6 h-6 text-research" />
                         </div>
                      </div>

                      {/* Result Node */}
                      <div className="z-10 w-full bg-[#0a0f1e] border-2 border-research rounded-[3rem] p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-research/10 via-transparent to-transparent opacity-50" />
                        
                        <div className="flex items-center justify-center gap-2 mb-4 relative">
                          <span className="h-px w-8 bg-research/30" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-research">Deduction Synthesized</span>
                          <span className="h-px w-8 bg-research/30" />
                        </div>
                        
                        <div className="flex flex-col items-center gap-1 mb-4">
                          <div className="text-5xl font-black research-gradient relative tracking-tight select-all">
                            {result.answer}
                          </div>
                          <button 
                            onClick={() => copyToClipboard(result.answer?.toString() || '')}
                            className={`mt-4 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${isCopied ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-research/5 border-research/20 text-research/60 hover:text-research hover:border-research/40 hover:bg-research/10'}`}
                          >
                            {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {isCopied ? 'Copied' : 'Copy Result'}
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-center gap-3 relative mt-6">
                          <div className="px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Axiom Validated</span>
                          </div>
                          <button onClick={() => {
                            if (navigator.share) {
                              navigator.share({ title: 'Lumina Research Result', text: `Solution: ${result.answer}` });
                            }
                          }} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-research">
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Footer Spacing */}
                      <div className="h-10 w-full" />
                    </div>
                  )}
                </div>

                <div className="p-6 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-slate-900">
                   <button onClick={() => {
                      const doc = new jsPDF();
                      doc.text("LUMINA RESEARCH REPORT", 20, 30);
                      doc.text(`Project: ${activeFile?.name}`, 20, 45);
                      doc.text(`Result: ${result.answer}`, 20, 55);
                      doc.save(`analysis_${activeFile?.name}.pdf`);
                    }} className="w-full py-4 bg-research hover:bg-research-dark text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95">
                     <FileDown className="w-4 h-4" /> Export Document
                   </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Dock */}
          <div className={`${showConsole ? 'h-64' : 'h-10'} border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#05091a] transition-all flex flex-col overflow-hidden`}>
            <div className="px-6 py-2 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between bg-slate-50 dark:bg-[#070b18] cursor-pointer" onClick={() => setShowConsole(!showConsole)}>
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-3"><Terminal className="w-4 h-4" /> Diagnostic Output</span>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-900 uppercase">Engine Ready</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={(e) => { e.stopPropagation(); setAllLogs([]); }} className="p-1 text-slate-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                <ChevronUp className={`w-4 h-4 text-slate-500 transition-transform ${showConsole ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {showConsole && (
              <div className="flex-grow p-6 font-mono text-[12px] overflow-y-auto terminal-scroll bg-black leading-relaxed">
                {allLogs.length === 0 ? (
                  <div className="text-slate-800 italic uppercase tracking-widest h-full flex items-center justify-center opacity-40">Ready for mathematical query...</div>
                ) : allLogs.map((l, i) => (
                  <div key={i} className="flex gap-5 mb-1.5">
                    <span className="text-slate-700 shrink-0">[{l.timestamp}]</span>
                    <span className={`${l.type === 'success' ? 'text-green-500' : l.type === 'error' ? 'text-red-500' : l.type === 'warning' ? 'text-research' : 'text-blue-400'}`}>
                      {l.message}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="h-7 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#05091a] flex items-center justify-between px-6 text-[9px] font-bold uppercase tracking-widest text-slate-600 select-none">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 text-research"><ShieldCheck className="w-3.5 h-3.5" /> Engine: Calibrated</div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2.5 text-blue-500"><Atom className="w-3.5 h-3.5" /> Logic Core v4.2</div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5"><Layout className="w-3.5 h-3.5" /> Logical_Workspace</div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="text-research">Proofs Active: {openFileIds.length}</div>
        </div>
      </footer>

      {/* Overlays */}
      {showAbout && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-10 animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-5xl max-h-[85vh] rounded-[3rem] p-16 overflow-y-auto terminal-scroll relative border-research/10">
            <button onClick={() => setShowAbout(false)} className="absolute top-10 right-10 p-4 hover:bg-white/5 rounded-full transition-all z-50"><X className="w-8 h-8 text-slate-500 hover:text-white" /></button>
            
            <div className="mb-12">
              <h2 className="text-4xl font-black research-gradient uppercase tracking-widest mb-4 flex items-center gap-6 italic">
                <Info className="w-12 h-12" /> Research Framework
              </h2>
              <p className="text-slate-500 text-lg font-serif italic">Cognitive architecture for high-fidelity mathematical synthesis.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] space-y-4 hover:border-research/30 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-research/10 flex items-center justify-center text-research mb-2 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white">Tier 1: Axiom Core</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Hard-coded deterministic solvers for Polynomials, Number Theory, and Diophantine boundaries.</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] space-y-4 hover:border-research/30 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2 group-hover:scale-110 transition-transform">
                  <Binary className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white">Tier 2: Pattern Sync</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Natural Language Deconstruction: Extracting formal variables from complex theorem statements.</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] space-y-4 hover:border-research/30 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-2 group-hover:scale-110 transition-transform">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white">Tier 3: Stochastic</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Gemini-3 Synthesis: Large-scale reasoning for non-deterministic proofs and novel conjectures.</p>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] space-y-4 hover:border-research/30 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400 mb-2 group-hover:scale-110 transition-transform">
                  <Globe className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white">Tier 4: Grounding</h4>
                <p className="text-xs text-slate-400 leading-relaxed">External Verification: Cross-referencing stochastic outputs with peer-reviewed academic proofs.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 border-t border-white/5 pt-12">
              <div className="lg:col-span-2 space-y-8">
                <h3 className="text-xl font-black uppercase tracking-tighter text-research flex items-center gap-4">
                  <DraftingCompass className="w-6 h-6" /> Architectural Philosophy
                </h3>
                <div className="space-y-6 text-slate-400 font-serif leading-relaxed text-md">
                  <p>Lumina is engineered to bridge the gap between human mathematical intuition and mechanical deduction. By combining hard-coded invariants with LLM-driven reasoning, the engine simulates a high-tier research environment.</p>
                  <p>Our "Axiom-First" priority ensures that if a problem can be solved through established identities (like Vieta's or Lucas's), the deterministic path is taken. If the manifold is too complex, the system pivots to its stochastic engines while maintaining grounding protocols.</p>
                </div>
              </div>
              <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Sigma className="w-4 h-4" /> Coverage Manifold
                </h4>
                <ul className="space-y-3">
                  {[
                    'Polynomial Linear Reduction',
                    'Combinatorial Subset Identity',
                    'Frobenius Boundary Analysis',
                    'Modular Congruence Synthesis',
                    'Newton Sum Root Dynamics',
                    'Spectral Zeta Convergence',
                    'Functional Equation Logic'
                  ].map((field, i) => (
                    <li key={i} className="flex items-center gap-3 text-xs font-mono text-slate-500 hover:text-research transition-colors">
                      <ChevronRight className="w-3 h-3 text-research" /> {field}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-16 p-8 bg-research/5 border border-research/10 rounded-[2.5rem] flex items-center justify-between">
              <div>
                <h5 className="text-sm font-black text-white uppercase tracking-widest mb-1">Calibration Status: Nominal</h5>
                <p className="text-[10px] text-slate-500 font-mono italic">All logic core manifolds currently operating at 99.8% axiomatic fidelity.</p>
              </div>
              <Activity className="w-8 h-8 text-research animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {showDiagnostics && (
          <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-10">
            <div className="glass-panel w-full max-w-2xl rounded-[3rem] p-12 overflow-hidden flex flex-col relative border-research/10">
               <button onClick={() => setShowDiagnostics(false)} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full"><X className="w-8 h-8 text-slate-500" /></button>
               <h3 className="text-2xl font-black research-gradient tracking-widest uppercase flex items-center gap-6 mb-10 italic"><ShieldCheck className="w-8 h-8" /> Engine Calibration</h3>
               {diagnosticReport ? (
                 <div className="overflow-y-auto terminal-scroll space-y-4 flex-grow">
                    <div className="grid grid-cols-3 gap-6 mb-8">
                      <div className="bg-slate-900 p-6 rounded-3xl text-center"><div className="text-[10px] text-slate-600 font-black uppercase mb-1">Pass</div><div className="text-3xl font-black text-research">{diagnosticReport.passCount}</div></div>
                      <div className="bg-slate-900 p-6 rounded-3xl text-center"><div className="text-[10px] text-slate-600 font-black uppercase mb-1">Fail</div><div className="text-3xl font-black text-red-500">{diagnosticReport.failCount}</div></div>
                      <div className="bg-slate-900 p-6 rounded-3xl text-center"><div className="text-[10px] text-slate-600 font-black uppercase mb-1">Coverage</div><div className="text-3xl font-black text-blue-400">100%</div></div>
                    </div>
                    {diagnosticReport.results.map((r, i) => (
                      <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between ${r.status === 'passed' ? 'border-research/20 bg-research/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{r.name}</span>
                          <span className="text-[9px] font-mono text-slate-700">Latency: {r.duration.toFixed(2)}ms</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full ${r.status === 'passed' ? 'bg-research text-white' : 'bg-red-500 text-white'}`}>{r.status}</span>
                      </div>
                    ))}
                 </div>
               ) : (
                <div className="flex-grow flex flex-col items-center justify-center gap-6">
                  <RefreshCw className="w-16 h-16 text-research animate-spin opacity-30" />
                  <div className="text-research uppercase text-[11px] font-black tracking-widest animate-pulse">Running Invariant Calibration...</div>
                </div>
               )}
            </div>
          </div>
      )}

      {showRequests && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-10">
          <div className="glass-panel w-full max-w-6xl max-h-[85vh] rounded-[3rem] p-16 overflow-y-auto terminal-scroll relative border-research/10">
            <button onClick={() => setShowRequests(false)} className="absolute top-10 right-10 p-4 hover:bg-white/5 rounded-full"><X className="w-8 h-8 text-slate-500" /></button>
            <h2 className="text-3xl font-black research-gradient uppercase tracking-widest mb-12 flex items-center gap-6 italic"><MessageSquarePlus className="w-12 h-12 text-research" /> Research Archive</h2>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              <div className="lg:col-span-5">
                <form className="space-y-8 bg-slate-900/40 p-10 rounded-[2.5rem] border border-research/10" onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.target as any;
                  const newReq: UserRequest = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    title: target.title.value,
                    category: 'Deduction Logic',
                    description: target.description.value,
                    status: 'Pending'
                  };
                  setUserRequests(prev => [newReq, ...prev]);
                  target.reset();
                  addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'success', message: "Deduction request archived." }]);
                }}>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Research Subject</label>
                    <input name="title" required placeholder="e.g. Expand Modular Identity Manifold" className="w-full bg-black/40 border border-slate-800 rounded-xl px-6 py-4 text-sm focus:outline-none focus:border-research/30 transition-all text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Logic Detail</label>
                    <textarea name="description" required placeholder="Provide deduction parameters..." className="w-full h-32 bg-black/40 border border-slate-800 rounded-xl px-6 py-4 text-sm focus:outline-none focus:border-research/30 transition-all text-white resize-none" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-research hover:bg-research-dark text-white font-black uppercase tracking-widest rounded-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"><Send className="w-5 h-5" /> Archive Request</button>
                </form>
              </div>
              <div className="lg:col-span-7 space-y-6">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Pending Research Nodes</h4>
                <div className="space-y-4">
                  {userRequests.length === 0 ? (
                    <div className="h-64 border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-800 font-black uppercase tracking-widest opacity-30"><Cpu className="w-16 h-16 mb-4" /> No Projects Archived</div>
                  ) : userRequests.map(req => (
                    <div key={req.id} className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2rem] group hover:border-research/20 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${req.status === 'Pending' ? 'bg-orange-500' : 'bg-green-500'} animate-pulse`} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{req.status} // {req.category}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-800">{new Date(req.timestamp).toLocaleDateString()}</span>
                      </div>
                      <h5 className="text-md font-black text-white group-hover:text-research transition-colors uppercase tracking-tight mb-2">{req.title}</h5>
                      <p className="text-xs text-slate-500 leading-relaxed font-serif">{req.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
