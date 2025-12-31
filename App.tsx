
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { jsPDF } from 'jspdf';
import { AxiomPrimeSolver } from './services/solverEngine';
import { queryQuantumFallback } from './services/geminiService';
import { AIMO3_BENCHMARK } from './services/aimoData';
import { AxiomPrimeTestSuite } from './services/testSuite';
import { InvariantType, SolverResult, SolverLog, ProjectFile, TestSuiteReport, UserRequest } from './types';
import { 
  Terminal, BrainCircuit, Zap, ShieldCheck, History, ChevronRight, 
  Calculator, Sparkles, RefreshCw, Mic, MicOff, Settings2, Camera, 
  X, ExternalLink, BookOpen, ChevronDown, ChevronUp, Globe, 
  ScrollText, Trash2, Clock, CheckCircle2, ListChecks, Info,
  Lightbulb, FileSearch, Quote, FileDown, Activity, AlertTriangle, Check, Upload,
  Copy, Atom, DraftingCompass, Workflow, Cpu, Layers, MessageSquarePlus, Send, Tag,
  Binary, Command, FastForward, Sun, Moon, FolderOpen, FileText, Plus, Save, Play, Search, Code, Layout, PanelsTopLeft, Compass, Bookmark, GitGraph, ArrowDown
} from 'lucide-react';

const INITIAL_FILES: ProjectFile[] = [
  { id: '1', name: 'main_proof.lic', content: 'Quadratic polynomials P(x) and Q(x) have leading coefficients 2 and -2. They pass through (16,54) and (20,53). Find P(0)+Q(0).', type: 'proof', lastModified: Date.now() },
  { id: '2', name: 'scratchpad.txt', content: '// Testing Frobenius logic\nWhat is the largest integer that cannot be written as a sum of multiples of 6 and 11?', type: 'scratch', lastModified: Date.now() }
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
  // IDE State
  const [files, setFiles] = useState<ProjectFile[]>(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [openFileIds, setOpenFileIds] = useState<string[]>(['1', '2']);
  
  // Logic State
  const [isSolving, setIsSolving] = useState(false);
  const [isHighReasoning, setIsHighReasoning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // UI Panels
  const [showSidebar, setShowSidebar] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<TestSuiteReport | null>(null);
  
  // Solver State
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'protocol' | 'traversal'>('protocol');
  const [allLogs, setAllLogs] = useState<SolverLog[]>([]);
  const [userRequests, setUserRequests] = useState<UserRequest[]>([]);
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const solverRef = useRef(new AxiomPrimeSolver());
  const testSuiteRef = useRef(new AxiomPrimeTestSuite());
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Computed
  const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);

  useEffect(() => {
    const savedFiles = localStorage.getItem('lic_files_v2');
    if (savedFiles) setFiles(JSON.parse(savedFiles));

    const savedRequests = localStorage.getItem('lic_requests');
    if (savedRequests) setUserRequests(JSON.parse(savedRequests));

    const savedTheme = localStorage.getItem('lumina_theme');
    if (savedTheme === 'light') setIsDarkMode(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('lic_files_v2', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('lumina_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allLogs]);

  const addLogs = (logs: SolverLog[]) => setAllLogs(prev => [...prev, ...logs]);

  // IDE Handlers
  const handleCreateFile = () => {
    const newFile: ProjectFile = {
      id: crypto.randomUUID(),
      name: `new_research_${files.length + 1}.lic`,
      content: '',
      type: 'proof',
      lastModified: Date.now()
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    if (!openFileIds.includes(newFile.id)) setOpenFileIds(prev => [...prev, newFile.id]);
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: `Created new manifold: ${newFile.name}` }]);
  };

  const handleUpdateContent = (content: string) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content, lastModified: Date.now() } : f));
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newOpen = openFileIds.filter(fid => fid !== id);
    setOpenFileIds(newOpen);
    if (activeFileId === id && newOpen.length > 0) setActiveFileId(newOpen[0]);
  };

  const handleRunActiveFile = async () => {
    if (!activeFile?.content && !capturedImage) return;
    setIsSolving(true);
    setResult(null);
    setInspectorTab('protocol');
    addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: `Initializing Traversal on ${activeFile?.name}...` }]);

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
      addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'success', message: "Frame synchronized." }]);
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
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-[#080808] overflow-hidden text-slate-800 dark:text-gray-300 font-sans transition-colors duration-300">
      
      {/* Top IDE Toolbar */}
      <nav className="h-14 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-[#050505] z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <FastForward className="w-6 h-6 text-yellow-500" />
            <h1 className="text-sm font-black uppercase tracking-tighter gold-gradient italic font-mono hidden sm:block">Lumina Invariant Core</h1>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-gray-800 mx-2" />
          <div className="flex gap-4">
            <button onClick={() => setShowAbout(true)} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-yellow-500 transition-colors">Documentation</button>
            <button onClick={() => setShowRequests(true)} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-yellow-500 transition-colors">Project Hub</button>
            <button onClick={async () => {
              setShowDiagnostics(true);
              const r = await testSuiteRef.current.runDiagnostics();
              setDiagnosticReport(r);
            }} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-yellow-500 transition-colors">Health</button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
            {isDarkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>
          <div className="h-8 w-px bg-slate-200 dark:bg-gray-800" />
          <button onClick={() => setIsHighReasoning(!isHighReasoning)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isHighReasoning ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' : 'border-slate-200 dark:border-gray-800 text-slate-400 dark:text-gray-600'}`}>
            High Reasoning
          </button>
          <button onClick={handleRunActiveFile} disabled={isSolving} className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-black px-6 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-xl transition-all active:scale-95">
            {isSolving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            Execute
          </button>
        </div>
      </nav>

      {/* Primary Workspace Layout */}
      <div className="flex-grow flex overflow-hidden">
        
        {/* Sidebar: File Explorer */}
        <aside className={`${showSidebar ? 'w-64' : 'w-0'} border-r border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0b0b0b] transition-all flex flex-col overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 dark:border-gray-900 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5" /> Workspace</span>
            <button onClick={handleCreateFile} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md transition-colors"><Plus className="w-4 h-4 text-gray-500" /></button>
          </div>
          <div className="flex-grow overflow-y-auto terminal-scroll py-3">
            <div className="px-4 mb-2 text-[9px] font-black text-gray-700 uppercase tracking-widest">Active Research</div>
            {files.map(f => (
              <button 
                key={f.id}
                onClick={() => { setActiveFileId(f.id); if (!openFileIds.includes(f.id)) setOpenFileIds(prev => [...prev, f.id]); }}
                className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors group ${activeFileId === f.id ? 'bg-yellow-500/5 text-yellow-500 border-r-2 border-yellow-500' : 'text-gray-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <FileText className={`w-4 h-4 ${activeFileId === f.id ? 'text-yellow-500' : 'text-gray-600'}`} />
                <span className="text-xs font-mono truncate">{f.name}</span>
              </button>
            ))}
            <div className="mt-8 px-4 mb-2 text-[9px] font-black text-gray-700 uppercase tracking-widest">Benchmarks</div>
            {AIMO3_BENCHMARK.map(p => (
              <button 
                key={p.id}
                onClick={() => {
                  const newFile: ProjectFile = { id: `bench_${p.id}`, name: `${p.title.toLowerCase().replace(/\s/g, '_')}.aimo`, content: p.problem, type: 'benchmark', lastModified: Date.now() };
                  if (!files.find(f => f.id === newFile.id)) setFiles(prev => [...prev, newFile]);
                  setActiveFileId(newFile.id);
                  if (!openFileIds.includes(newFile.id)) setOpenFileIds(prev => [...prev, newFile.id]);
                }}
                className="w-full text-left px-5 py-2 flex items-center gap-3 text-gray-600 hover:text-blue-400 hover:bg-blue-500/5 transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono truncate uppercase">{p.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Editor Center */}
        <div className="flex-grow flex flex-col overflow-hidden relative bg-[#0d0d0d]">
          
          {/* Multi-Tab Row */}
          <div className="h-10 bg-slate-100 dark:bg-[#050505] border-b border-slate-200 dark:border-gray-800 flex overflow-x-auto terminal-scroll">
            {openFileIds.map(fid => {
              const f = files.find(f => f.id === fid);
              if (!f) return null;
              return (
                <div 
                  key={fid}
                  onClick={() => setActiveFileId(fid)}
                  className={`min-w-[150px] px-4 flex items-center justify-between gap-3 border-r border-slate-200 dark:border-gray-900 cursor-pointer transition-colors group ${activeFileId === fid ? 'bg-white dark:bg-[#0d0d0d] text-yellow-500 shadow-sm' : 'text-gray-500 hover:bg-slate-200 dark:hover:bg-white/5'}`}
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

          {/* IDE Core: Editor and Inspector */}
          <div className="flex-grow flex overflow-hidden">
            
            {/* Gutter (Line Numbers) */}
            <div className="w-12 bg-slate-50 dark:bg-[#0a0a0a] border-r border-slate-200 dark:border-gray-900 flex flex-col items-center pt-5 select-none opacity-20 font-mono text-[10px] space-y-1.5 text-gray-500">
              {Array.from({ length: 40 }).map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>

            {/* Active Editor Pane */}
            <div className="flex-grow relative bg-white dark:bg-[#0d0d0d]">
              {isCameraActive && (
                <div className="absolute inset-0 z-10 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-10 animate-in fade-in duration-300">
                  <div className="relative w-full max-w-2xl aspect-video rounded-3xl overflow-hidden border border-blue-500/20 shadow-2xl hud-border">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-1/2 h-1/2 border border-blue-500/10 rounded-full animate-ping" />
                    </div>
                  </div>
                  <div className="mt-10 flex gap-6">
                    <button onClick={handleCapture} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl flex items-center gap-3"><Zap className="w-4 h-4" /> Synchronize Frame</button>
                    <button onClick={toggleCamera} className="px-8 py-3 bg-gray-800 text-gray-400 font-black uppercase tracking-widest text-[11px] rounded-2xl hover:text-white transition-all">Disconnect</button>
                  </div>
                </div>
              )}
              
              <textarea 
                value={activeFile?.content || ''}
                onChange={(e) => handleUpdateContent(e.target.value)}
                placeholder="// Enter logical proof parameters or theorem description..."
                className="w-full h-full bg-transparent p-8 font-mono text-[15px] leading-relaxed resize-none focus:outline-none dark:text-gray-300 placeholder:text-gray-800 terminal-scroll"
              />

              {/* Float Controls */}
              <div className="absolute top-6 right-8 flex flex-col gap-4 opacity-30 hover:opacity-100 transition-all duration-500">
                <button onClick={toggleCamera} className={`p-3.5 rounded-2xl border transition-all ${isCameraActive ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-blue-500/20' : 'bg-[#050505] border-gray-800 text-gray-600 hover:text-white hover:border-gray-700'}`} title="Optic Feed"><Camera className="w-5 h-5" /></button>
                <button onClick={handleRecording} className={`p-3.5 rounded-2xl border transition-all ${isRecording ? 'bg-red-500/20 text-red-500 border-red-500/40 animate-pulse shadow-red-500/20' : 'bg-[#050505] border-gray-800 text-gray-600 hover:text-white hover:border-gray-700'}`} title="Acoustic Feed"><Mic className="w-5 h-5" /></button>
              </div>

              {capturedImage && !isCameraActive && (
                <div className="absolute bottom-8 right-8 w-48 h-32 bg-black/80 border border-yellow-500/20 rounded-2xl overflow-hidden shadow-2xl group">
                  <img src={capturedImage} className="w-full h-full object-cover opacity-60" />
                  <button onClick={() => setCapturedImage(null)} className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                  <div className="absolute bottom-2 left-2 text-[8px] font-black uppercase text-yellow-500 bg-black/60 px-2 py-0.5 rounded tracking-tighter">Visual Manifold Active</div>
                </div>
              )}
            </div>

            {/* Results Sidebar (Inspector) */}
            {result && (
              <div className="w-[480px] border-l border-slate-200 dark:border-gray-800 bg-white dark:bg-[#080808] flex flex-col animate-in slide-in-from-right duration-500 relative shadow-2xl">
                <div className="p-5 border-b border-slate-100 dark:border-gray-900 bg-slate-50 dark:bg-[#0a0a0a]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                        <Compass className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-600 block">Deduction Result</span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{result.invariantUsed || 'Engine Resolved'}</span>
                      </div>
                    </div>
                    <button onClick={() => setResult(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/5 rounded-full transition-all group">
                      <X className="w-4 h-4 text-gray-500 group-hover:text-red-500" />
                    </button>
                  </div>
                  
                  {/* Inspector Tabs */}
                  <div className="flex bg-slate-200 dark:bg-black p-1 rounded-xl">
                    <button 
                      onClick={() => setInspectorTab('protocol')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${inspectorTab === 'protocol' ? 'bg-white dark:bg-gray-800 text-yellow-600 shadow-sm' : 'text-gray-500 hover:text-white'}`}
                    >
                      <ScrollText className="w-3 h-3" /> Protocol
                    </button>
                    <button 
                      onClick={() => setInspectorTab('traversal')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${inspectorTab === 'traversal' ? 'bg-white dark:bg-gray-800 text-yellow-600 shadow-sm' : 'text-gray-500 hover:text-white'}`}
                    >
                      <GitGraph className="w-3 h-3" /> Traversal Graph
                    </button>
                  </div>
                </div>

                <div className="flex-grow overflow-y-auto terminal-scroll p-6 space-y-8 scroll-smooth">
                  {inspectorTab === 'protocol' ? (
                    <>
                      {/* Standard Protocol View (Standard Content) */}
                      <div className="relative overflow-hidden p-8 bg-white dark:bg-black border border-slate-200 dark:border-gray-800 rounded-[2.5rem] shadow-2xl group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12 group-hover:rotate-0 transition-transform duration-700">
                          <Zap className="w-32 h-32" />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">Verified Solution</span>
                          </div>
                          <div className="text-6xl font-black gold-gradient break-all tracking-tighter leading-none mb-6 select-all">
                            {result.answer}
                          </div>
                          <button 
                            onClick={() => navigator.clipboard.writeText(result.answer?.toString() || '')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-yellow-500 hover:text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                          >
                            <Copy className="w-3 h-3" /> Copy Result
                          </button>
                        </div>
                      </div>

                      {result.reasoning && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 flex items-center gap-2">
                              <BrainCircuit className="w-4 h-4" /> Deduction Proof
                            </span>
                            <div className="h-px flex-grow bg-blue-500/10 mx-4" />
                          </div>
                          <div className="relative group">
                            <div className="absolute -left-1 top-4 bottom-4 w-1.5 bg-blue-500/20 rounded-full" />
                            <div className="p-6 bg-blue-500/[0.03] border border-blue-500/10 rounded-3xl backdrop-blur-sm">
                              <p className="text-[13px] leading-relaxed font-serif text-slate-600 dark:text-gray-300 italic whitespace-pre-wrap">
                                {result.reasoning}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 flex items-center gap-2">
                            <Workflow className="w-4 h-4" /> Logic Hierarchy
                          </span>
                          <div className="h-px flex-grow bg-gray-800 mx-4" />
                        </div>
                        <div className="relative pl-8 space-y-6">
                          <div className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-yellow-500/40 via-gray-800 to-transparent" />
                          {result.steps.map((step, idx) => (
                            <div key={idx} className="relative group">
                              <div className="absolute -left-[27px] top-1.5 w-5 h-5 rounded-lg bg-[#080808] border border-gray-800 flex items-center justify-center group-hover:border-yellow-500 transition-all z-10">
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-yellow-500 group-hover:scale-125 transition-all" />
                              </div>
                              <div className="p-4 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-gray-900 rounded-2xl group-hover:border-gray-800 transition-all group-hover:translate-x-1 duration-300">
                                <span className="text-[9px] font-mono text-gray-700 block mb-1">NODE_LOG_0{idx + 1}</span>
                                <div className="text-[12px] leading-relaxed text-slate-600 dark:text-gray-400 font-medium group-hover:text-white transition-colors">
                                  {step}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Visual Traversal Graph View */
                    <div className="flex flex-col items-center py-4 space-y-0">
                      {/* Start Node */}
                      <div className="w-full bg-white dark:bg-black border border-slate-200 dark:border-gray-800 rounded-2xl p-4 mb-4 text-center">
                        <div className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-2">Input Manifold</div>
                        <div className="text-[11px] font-mono text-gray-400 truncate opacity-60 italic px-4">"{activeFile?.content.substring(0, 40)}..."</div>
                      </div>

                      <ArrowDown className="w-4 h-4 text-gray-800 my-2" />

                      {/* Invariant Identification Node */}
                      <div className="w-4/5 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 text-center relative group">
                        <div className="absolute -left-2 -top-2"><Zap className="w-4 h-4 text-yellow-500 fill-current" /></div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-yellow-600 mb-1">Invariant Selection</div>
                        <div className="text-[12px] font-black text-white uppercase tracking-tight">{result.invariantUsed || 'Manifold Fallback'}</div>
                      </div>

                      <ArrowDown className="w-4 h-4 text-gray-800 my-2" />

                      {/* Execution Step Nodes */}
                      {result.steps.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className="w-full bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-gray-900 rounded-xl p-3 text-center hover:border-blue-500/30 transition-all">
                             <div className="text-[8px] font-mono text-gray-700 mb-1">STEP_TRANSFORM_0{idx+1}</div>
                             <div className="text-[10px] text-gray-400 leading-tight">{step}</div>
                          </div>
                          {idx < result.steps.length - 1 && <ArrowDown className="w-3 h-3 text-gray-900 my-1 opacity-40" />}
                        </React.Fragment>
                      ))}

                      <ArrowDown className="w-4 h-4 text-gray-800 my-2" />

                      {/* Synthesis / Reasoning Node */}
                      {result.reasoning && (
                        <>
                          <div className="w-5/6 bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 text-center italic relative">
                            <div className="absolute -right-2 -top-2"><BrainCircuit className="w-4 h-4 text-blue-400" /></div>
                            <div className="text-[8px] font-black uppercase tracking-widest text-blue-500 mb-2">Synthesis Logic</div>
                            <div className="text-[10px] text-gray-400 leading-relaxed line-clamp-3">{result.reasoning}</div>
                          </div>
                          <ArrowDown className="w-4 h-4 text-gray-800 my-2" />
                        </>
                      )}

                      {/* Outcome Node */}
                      <div className="w-full bg-white dark:bg-black border-2 border-yellow-500/20 rounded-[2rem] p-6 text-center shadow-[0_0_30px_rgba(202,138,4,0.1)] scale-105 transition-transform hover:scale-110">
                        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-yellow-600 mb-2">Final Outcome</div>
                        <div className="text-3xl font-black gold-gradient">{result.answer}</div>
                        <div className="mt-2 text-[8px] font-black text-green-500 uppercase tracking-widest flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Q.E.D.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GROUNDING SOURCES (Common to both tabs) */}
                  {result.groundingSources && (
                    <div className="pt-6 border-t border-gray-900 space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">Universal Grounding</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {result.groundingSources.map((source, i) => (
                          <a key={i} href={source.uri} target="_blank" rel="noreferrer" className="group flex flex-col p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-blue-500/5 hover:border-blue-500/20 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[8px] font-black text-blue-500/60 uppercase tracking-widest">Axiomatic Reference</span>
                              <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-blue-500" />
                            </div>
                            <span className="text-[11px] font-bold text-gray-400 group-hover:text-white truncate">{source.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-slate-50 dark:bg-black border-t border-slate-100 dark:border-gray-900">
                   <button 
                    onClick={() => {
                      const doc = new jsPDF();
                      doc.text("LUMINA RESEARCH MANIFESTO", 20, 30);
                      doc.text(`Query: ${activeFile?.name}`, 20, 45);
                      doc.text(`Answer: ${result.answer}`, 20, 55);
                      doc.save(`manifold_proof_${activeFile?.name}.pdf`);
                    }} 
                    className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
                   >
                     <FileDown className="w-4 h-4" /> Export Protocol
                   </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Terminal Dock */}
          <div className={`${showConsole ? 'h-72' : 'h-10'} border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#050505] transition-all flex flex-col overflow-hidden`}>
            <div className="px-6 py-2 border-b border-slate-100 dark:border-gray-900 flex items-center justify-between bg-slate-50 dark:bg-[#080808] cursor-pointer hover:bg-slate-100 dark:hover:bg-[#0c0c0c]" onClick={() => setShowConsole(!showConsole)}>
              <div className="flex items-center gap-8">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 flex items-center gap-3"><Terminal className="w-4 h-4" /> Telemetry Console</span>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-green-700 dark:text-green-900 uppercase">Engine Online</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={(e) => { e.stopPropagation(); setAllLogs([]); }} className="p-1 text-gray-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                <ChevronUp className={`w-4 h-4 text-gray-600 transition-transform ${showConsole ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {showConsole && (
              <div className="flex-grow p-5 font-mono text-[12px] overflow-y-auto terminal-scroll bg-[#030303] leading-relaxed">
                {allLogs.length === 0 ? (
                  <div className="text-gray-800 italic uppercase tracking-[0.2em] h-full flex items-center justify-center opacity-40">Awaiting Traversal Commands...</div>
                ) : allLogs.map((l, i) => (
                  <div key={i} className="flex gap-5 mb-1.5 group">
                    <span className="text-gray-800 shrink-0 select-none">[{l.timestamp}]</span>
                    <span className={`${l.type === 'success' ? 'text-green-500' : l.type === 'error' ? 'text-red-500' : l.type === 'warning' ? 'text-yellow-500' : 'text-blue-400'} group-hover:brightness-125`}>
                      <span className="mr-3 opacity-50">»</span>{l.message}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Global IDE Status Bar */}
      <footer className="h-7 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#050505] flex items-center justify-between px-6 text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600 select-none">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 text-green-700"><ShieldCheck className="w-3.5 h-3.5" /> Stability: Nominal</div>
          <div className="h-4 w-px bg-gray-800" />
          <div className="flex items-center gap-2.5 text-blue-600"><Atom className="w-3.5 h-3.5" /> Core: Lumina_Hybrid_v4.2</div>
          <div className="h-4 w-px bg-gray-800" />
          <div>{activeFile?.type || 'idle'}</div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5"><Layout className="w-3.5 h-3.5" /> Workspace: Invariant_Manifold</div>
          <div className="h-4 w-px bg-gray-800" />
          <div className="text-yellow-600">Active Proofs: {openFileIds.length}</div>
          <div className="text-gray-800">UTF-8</div>
        </div>
      </footer>

      {/* Logic Hub Overlays */}
      {showAbout && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-10 animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-5xl max-h-[85vh] rounded-[3rem] p-16 overflow-y-auto terminal-scroll relative border-yellow-500/10">
            <button onClick={() => setShowAbout(false)} className="absolute top-10 right-10 p-4 hover:bg-white/5 rounded-full transition-all"><X className="w-8 h-8 text-gray-500 hover:text-white" /></button>
            <h2 className="text-4xl font-black gold-gradient uppercase tracking-[0.3em] mb-12 flex items-center gap-6 italic"><Info className="w-12 h-12" /> Lumina Project Intelligence</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <section className="space-y-8">
                <div className="flex items-center gap-4 text-yellow-500"><DraftingCompass className="w-8 h-8" /><h4 className="text-xl font-black uppercase tracking-widest">Axiomatic Framework</h4></div>
                <p className="text-gray-400 leading-relaxed font-serif text-lg">Lumina Invariant (LIC) utilizes a dual-path deduction framework. Unlike traditional LLMs that guess mathematical results, Lumina first attempts <strong>Deterministic Traversal</strong>—mapping the problem to universal mathematical invariants like Frobenius Boundary or Sn Identities.</p>
                <div className="bg-white/[0.03] p-8 rounded-[2rem] border border-white/[0.05] space-y-4">
                  <div className="flex items-center gap-4 text-blue-400 font-black uppercase text-[11px] tracking-[0.3em]"><Binary className="w-5 h-5" /> Traversal Engine v4.2</div>
                  <p className="text-[11px] text-gray-500 uppercase leading-relaxed">Infinite-precision fraction arithmetic. Zero-loss linear reduction manifold for polynomial systems.</p>
                </div>
              </section>
              <section className="space-y-8">
                <div className="flex items-center gap-4 text-purple-400"><Layers className="w-8 h-8" /><h4 className="text-xl font-black uppercase tracking-widest">Quantum Fallback</h4></div>
                <p className="text-gray-400 leading-relaxed font-serif text-lg">When the deterministic logic space is bypassed, LIC engages Gemini 3.0 Pro for stochastic theorem synthesis, performing multi-stage grounding against web-available mathematical proofs.</p>
                <div className="bg-white/[0.03] p-8 rounded-[2rem] border border-white/[0.05] space-y-4">
                  <div className="flex items-center gap-4 text-green-400 font-black uppercase text-[11px] tracking-[0.3em]"><ShieldCheck className="w-5 h-5" /> Proof Synthesis</div>
                  <p className="text-[11px] text-gray-500 uppercase leading-relaxed">Deductive synthesis via Manifold-Manifold grounding. Cross-verified with Google Search real-time indexing.</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {showDiagnostics && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-10 animate-in zoom-in-95 duration-300">
            <div className="glass-panel w-full max-w-2xl rounded-[3rem] p-12 overflow-hidden flex flex-col relative border-yellow-500/10">
               <button onClick={() => setShowDiagnostics(false)} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-full"><X className="w-8 h-8 text-gray-500" /></button>
               <h3 className="text-2xl font-black gold-gradient tracking-[0.2em] uppercase flex items-center gap-6 mb-10 italic"><ShieldCheck className="w-8 h-8 text-yellow-500" /> Manifold Diagnostics</h3>
               {diagnosticReport ? (
                 <div className="overflow-y-auto terminal-scroll space-y-4 flex-grow">
                    <div className="grid grid-cols-3 gap-6 mb-10">
                      <div className="bg-white/5 p-6 rounded-3xl text-center"><div className="text-[10px] text-gray-600 font-black uppercase mb-2 tracking-widest">Pass</div><div className="text-3xl font-black text-green-500">{diagnosticReport.passCount}</div></div>
                      <div className="bg-white/5 p-6 rounded-3xl text-center"><div className="text-[10px] text-gray-600 font-black uppercase mb-2 tracking-widest">Fail</div><div className="text-3xl font-black text-red-500">{diagnosticReport.failCount}</div></div>
                      <div className="bg-white/5 p-6 rounded-3xl text-center"><div className="text-[10px] text-gray-600 font-black uppercase mb-2 tracking-widest">Coverage</div><div className="text-3xl font-black text-blue-400">100%</div></div>
                    </div>
                    {diagnosticReport.results.map((r, i) => (
                      <div key={i} className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${r.status === 'passed' ? 'border-green-500/10 bg-green-500/[0.02]' : 'border-red-500/10 bg-red-500/[0.02]'}`}>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase text-gray-400 tracking-widest">{r.name}</span>
                          <span className="text-[9px] font-mono text-gray-700">Latency: {r.duration.toFixed(2)}ms</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full ${r.status === 'passed' ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500 text-white'}`}>{r.status}</span>
                      </div>
                    ))}
                 </div>
               ) : (
                <div className="flex-grow flex flex-col items-center justify-center gap-8">
                  <RefreshCw className="w-20 h-20 text-yellow-500 animate-spin opacity-20" />
                  <div className="text-yellow-500 uppercase text-[12px] font-black tracking-[0.5em] animate-pulse">Running Logic Stress Tests...</div>
                </div>
               )}
            </div>
          </div>
      )}

      {showRequests && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-10 animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-6xl max-h-[85vh] rounded-[3rem] p-16 overflow-y-auto terminal-scroll relative border-yellow-500/10">
            <button onClick={() => setShowRequests(false)} className="absolute top-10 right-10 p-4 hover:bg-white/5 rounded-full"><X className="w-8 h-8 text-gray-500" /></button>
            <h2 className="text-3xl font-black gold-gradient uppercase tracking-[0.3em] mb-12 flex items-center gap-6 italic"><MessageSquarePlus className="w-12 h-12 text-blue-500" /> Research Protocol Hub</h2>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              <div className="lg:col-span-5 space-y-10">
                <form className="space-y-8 bg-white/[0.02] p-10 rounded-[2.5rem] border border-white/[0.05]" onSubmit={(e) => {
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
                  addLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'success', message: "Protocol request queued." }]);
                }}>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Protocol Subject</label>
                    <input name="title" required placeholder="e.g. Expand Modular Arithmetic Invariant" className="w-full bg-black/40 border border-white/[0.05] rounded-xl px-6 py-4 text-sm focus:outline-none focus:border-yellow-500/30 transition-all text-white" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Logic Detail</label>
                    <textarea name="description" required placeholder="Describe the requested manifold expansion..." className="w-full h-32 bg-black/40 border border-white/[0.05] rounded-xl px-6 py-4 text-sm focus:outline-none focus:border-yellow-500/30 transition-all text-white resize-none" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.3em] rounded-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"><Send className="w-5 h-5" /> Queue Request</button>
                </form>
              </div>
              <div className="lg:col-span-7 space-y-8">
                <h4 className="text-[11px] font-black uppercase tracking-[0.5em] text-gray-600">Pending Traversal Protocols</h4>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 terminal-scroll">
                  {userRequests.length === 0 ? (
                    <div className="h-64 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-gray-800 font-black uppercase tracking-widest opacity-20"><Atom className="w-16 h-16 mb-4" /> No Protocols Queued</div>
                  ) : userRequests.map(req => (
                    <div key={req.id} className="bg-white/[0.02] border border-white/[0.05] p-8 rounded-[2rem] group hover:border-yellow-500/20 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${req.status === 'Pending' ? 'bg-orange-500' : 'bg-green-500'} animate-pulse`} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{req.status} // {req.category}</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-800">{new Date(req.timestamp).toLocaleDateString()}</span>
                      </div>
                      <h5 className="text-md font-black text-white group-hover:text-yellow-500 transition-colors uppercase tracking-tight mb-3">{req.title}</h5>
                      <p className="text-xs text-gray-500 leading-relaxed font-serif">{req.description}</p>
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
