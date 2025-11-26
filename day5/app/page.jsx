"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Mic, Square, Play, Power, Volume2, 
  User, Building, Users, Clock, Briefcase, CheckCircle2, Loader2, Zap, Activity, Search, Bell, Settings, Sidebar, Code2, Globe, ShieldCheck, Cpu
} from "lucide-react";

// --- COMPONENT: HOLOGRAPHIC VARIABLE ROW ---
const EnvironmentVar = ({ label, value, type = "string" }) => {
  const isFilled = value && value !== "";
  return (
    <div className={`env-row ${isFilled ? "filled" : ""}`}>
      <div className="col-status">
         <div className={`status-dot ${isFilled ? "active" : ""}`}></div>
      </div>
      <div className="col-key">
        <span className="var-name">{label}</span>
      </div>
      <div className="col-value">
        {isFilled ? (
          <span className="var-value typing-effect">{value}</span>
        ) : (
          <span className="var-placeholder">pending_input...</span>
        )}
      </div>
      <div className="col-type">
        <span className="type-badge">{type}</span>
      </div>
    </div>
  );
};

export default function Home() {
  // --- LOGIC STATES ---
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState(""); 
  const [isSaved, setIsSaved] = useState(false);

  // --- LEAD DATA STATE ---
  const [lead, setLead] = useState({
    name: "", role: "", company: "", team_size: "", use_case: "", timeline: ""
  });

  // --- REFS ---
  const leadRef = useRef(lead); 
  const recorder = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sessionActiveRef = useRef(false); 
  const isClosingRef = useRef(false);
  const transcriptEndRef = useRef(null);

  // --- SYNC STATE ---
  useEffect(() => { leadRef.current = lead; }, [lead]);

  // --- SCROLL ---
  useEffect(() => {
    if (transcriptEndRef.current) {
        transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveTranscript]);

  // --- AUDIO EVENTS ---
  useEffect(() => { 
    if (audioRef.current) {
        audioRef.current.onplay = () => setIsSpeaking(true);
        audioRef.current.onended = () => {
            setIsSpeaking(false);
            if (isClosingRef.current) {
                handleEnd(); 
            } else if(sessionActiveRef.current) {
                setTimeout(() => startRecording(), 500); 
            }
        };
    }
  }, [isSessionActive]);

  // --- SILENCE DETECTION ---
  const setupSilenceDetection = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 512;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastSpeakingTime = Date.now();
    const SILENCE_THRESHOLD = 15; 
    const SILENCE_DURATION = 1200; 

    const detect = () => {
        if (!recorder.current || recorder.current.state !== "recording" || !sessionActiveRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;

        if (average > SILENCE_THRESHOLD) {
            lastSpeakingTime = Date.now(); 
        } else {
            if (Date.now() - lastSpeakingTime > SILENCE_DURATION) {
                stopRecording(); 
                return;
            }
        }
        animationFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  // --- RECORDING ---
  const startRecording = async () => {
    if (recording || processing || isSpeaking || !sessionActiveRef.current || isClosingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
        cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());
        if (!sessionActiveRef.current) return;
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (blob.size > 0) {
            setRecording(false);
            setProcessing(true);
            await processAudioPipeline(blob);
        }
      };
      mediaRecorder.start();
      setRecording(true);
      setLiveTranscript(">> Listening for audio input...");
      setupSilenceDetection(stream);
    } catch (err) { console.error("Mic Error", err); }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") { recorder.current.stop(); }
  };

  // --- API PIPELINE ---
  const processAudioPipeline = async (blob) => {
    try {
      const ab = await blob.arrayBuffer();
      const transRes = await fetch("/api/transcribe", { method: "POST", body: ab });
      const transData = await transRes.json();
      
      if (!sessionActiveRef.current) return;

      if (!transData.transcript || transData.transcript.trim().length === 0) {
          setProcessing(false);
          if(sessionActiveRef.current && !isClosingRef.current) startRecording(); 
          return;
      }

      setLiveTranscript(`USER: "${transData.transcript}"`); 

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transData.transcript, currentLead: leadRef.current }),
      });
      const genData = await genRes.json();

      if (!sessionActiveRef.current) return;
      setProcessing(false);

      if (genData.lead) {
          setLead(genData.lead);
          leadRef.current = genData.lead; 
      }
      
      setLiveTranscript(genData.reply); 

      if (genData.audio && audioRef.current) {
          audioRef.current.src = genData.audio;
          audioRef.current.play();
      }

      if (genData.isComplete) {
          setIsSaved(true);
          isClosingRef.current = true; 
      }
    } catch (err) { 
        console.error(err); 
        setProcessing(false);
        setLiveTranscript(">> ERROR: Connection Lost.");
    }
  };

  // --- HANDLERS ---
  const handleStart = () => {
      setIsSessionActive(true);
      setIsSaved(false);
      sessionActiveRef.current = true; 
      isClosingRef.current = false;
      setLead({ name: "", role: "", company: "", team_size: "", use_case: "", timeline: "" });
      leadRef.current = { name: "", role: "", company: "", team_size: "", use_case: "", timeline: "" };
      setLiveTranscript(">> INITIALIZING SECURE UPLINK...");
      setTimeout(() => {
          if (!sessionActiveRef.current) return;
          setLiveTranscript("ALEX: Hello! I'm Alex from Postman. What brings you here today?");
          setTimeout(() => startRecording(), 2000);
      }, 1000);
  };

  const handleEnd = () => {
      setIsSessionActive(false);
      sessionActiveRef.current = false; 
      stopRecording();
      if (!isClosingRef.current && audioRef.current) audioRef.current.pause();
      setLiveTranscript(isClosingRef.current ? ">> SESSION COMPLETE. DATA ARCHIVED." : ">> DISCONNECTED.");
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
      cancelAnimationFrame(animationFrameRef.current);
  };

  return (
    <main className="cyber-layout">
      <div className="ambient-noise"></div>
      <div className="vignette"></div>
      
      {/* --- GLOBAL HEADER --- */}
      <header className="glass-header">
        <div className="left-section">
            <div className="logo-block">
                <Zap size={20} fill="currentColor" className="text-orange" />
                <span className="logo-text">POSTMAN <span className="pro-badge">AI ENTERPRISE</span></span>
            </div>
            <div className="nav-links">
                <span className="link active">Workspace</span>
                <span className="link">Analytics</span>
                <span className="link">Configure</span>
            </div>
        </div>
        
        <div className="center-section">
             <div className={`status-pill ${isSessionActive ? "online" : "offline"}`}>
                <Activity size={14} className={isSessionActive ? "pulse" : ""} />
                <span>{isSessionActive ? "SYSTEM ONLINE" : "SYSTEM OFFLINE"}</span>
             </div>
        </div>

        <div className="right-section">
            <Globe size={18} className="icon-dim" />
            <Bell size={18} className="icon-dim" />
            <div className="avatar">AD</div>
        </div>
      </header>

      {/* --- MAIN WORKSPACE --- */}
      <div className="workspace">
         
         {/* SIDEBAR: VARIABLES */}
         <aside className="sidebar">
            <div className="sidebar-header">
                <div className="title-group">
                    <Sidebar size={16} className="text-orange" />
                    <span>ENV: <strong>LEAD_CONTEXT</strong></span>
                </div>
                {isSaved && <span className="save-indicator"><CheckCircle2 size={12}/> SAVED</span>}
            </div>
            
            <div className="env-list">
                <div className="env-header-row">
                    <span className="pl-8">KEY</span>
                    <span className="pl-28">VALUE</span>
                    <span className="pl-40">TYPE</span>
                </div>
                <div className="scroller">
                    <EnvironmentVar label="full_name" value={lead.name} type="string" />
                    <EnvironmentVar label="job_title" value={lead.role} type="string" />
                    <EnvironmentVar label="company_name" value={lead.company} type="string" />
                    <EnvironmentVar label="team_size" value={lead.team_size} type="number" />
                    <EnvironmentVar label="timeline" value={lead.timeline} type="date" />
                    <div className="divider"><span>METADATA</span></div>
                    <EnvironmentVar label="intent_summary" value={lead.use_case} type="text" />
                </div>
            </div>
         </aside>

         {/* MAIN STAGE */}
         <section className="stage">
            
            {/* REQUEST BAR */}
            <div className="request-bar">
                <div className="method">POST</div>
                <div className="url">
                    api.postman.com/ai-sdr/voice-channel
                </div>
                <button className={`action-btn ${isSessionActive ? 'stop' : 'start'}`} onClick={isSessionActive ? handleEnd : handleStart}>
                    {isSessionActive ? "TERMINATE" : "CONNECT"}
                </button>
            </div>

            {/* VISUALIZER AREA */}
            <div className="visualizer-container">
                
                {/* 3D GYROSCOPE CORE */}
                <div className={`core-wrapper ${isSessionActive ? 'active' : ''} ${processing ? 'processing' : ''} ${isSpeaking ? 'speaking' : ''}`}>
                    <div className="ring r1"></div>
                    <div className="ring r2"></div>
                    <div className="ring r3"></div>
                    <div className="core-center">
                        {processing ? <Cpu size={40} className="spin-slow" /> : 
                         isSpeaking ? <Volume2 size={40} className="pulse-fast" /> :
                         <Mic size={40} />}
                    </div>
                    <div className="core-glow"></div>
                </div>

                {/* LIVE TRANSCRIPT TERMINAL */}
                <div className="terminal-card">
                    <div className="card-head">
                        <div className="tabs">
                            <span className="tab active">Body</span>
                            <span className="tab pt-2">Headers</span>
                            <span className="tab pt-2">Auth</span>
                        </div>
                        <span className="format">JSON</span>
                    </div>
                    <div className="card-body">
                        <div className="line-numbers">
                            {[1,2,3,4,5].map(n => <div key={n}>{n}</div>)}
                        </div>
                        <div className="code-content">
                             <span className="key">"response":</span> <span className="string">"{liveTranscript || "Waiting for request..."}"</span>
                             <div ref={transcriptEndRef} />
                        </div>
                    </div>
                </div>

                {/* STATUS FOOTER */}
                <div className="stage-footer">
                    <div className="stat-item">Status: <span className={isSessionActive ? "text-green" : "text-dim"}>{isSessionActive ? "200 OK" : "---"}</span></div>
                    <div className="stat-item">Time: <span className="text-green">{isSessionActive ? "LIVE" : "0ms"}</span></div>
                    <div className="stat-item">Size: <span className="text-green">{isSessionActive ? "Audio Stream" : "0 B"}</span></div>
                </div>

            </div>
         </section>
      </div>

      <audio ref={audioRef} className="hidden" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        :root {
            --orange: #FF6C37;
            --orange-glow: rgba(255, 108, 55, 0.5);
            --bg: #090909;
            --panel: #111111;
            --border: #2a2a2a;
            --text: #E0E0E0;
            --green: #00FF88;
            --blue: #0099FF;
            --font-main: 'Inter', sans-serif;
            --font-code: 'JetBrains Mono', monospace;
        }

        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font-main); overflow: hidden; }
        
        /* LAYOUT */
        .cyber-layout { height: 100vh; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 50%, #1a1a1a 0%, #000 100%); position: relative; }
        .ambient-noise { position: absolute; inset: 0; opacity: 0.03; background: url('https://grainy-gradients.vercel.app/noise.svg'); pointer-events: none; }
        .vignette { position: absolute; inset: 0; background: radial-gradient(circle, transparent 60%, #000 100%); pointer-events: none; }

        /* HEADER */
        .glass-header { height: 55px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: rgba(17,17,17,0.8); backdrop-filter: blur(10px); z-index: 20; }
        .left-section, .center-section, .right-section { display: flex; align-items: center; gap: 20px; }
        
        .logo-block { display: flex; align-items: center; gap: 10px; }
        .logo-text { font-weight: 700; letter-spacing: -0.5px; font-size: 16px; }
        .pro-badge { font-size: 9px; background: linear-gradient(90deg, var(--orange), #ff4400); padding: 2px 6px; border-radius: 4px; color: #000; font-weight: 800; margin-left: 5px; }
        .text-orange { color: var(--orange); }
        
        .nav-links { display: flex; gap: 20px; font-size: 13px; color: #888; }
        .link { cursor: pointer; transition: 0.2s; }
        .link:hover, .link.active { color: #fff; }

        .status-pill { background: #000; border: 1px solid var(--border); padding: 6px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: #666; transition: 0.3s; }
        .status-pill.online { border-color: var(--green); color: var(--green); background: rgba(0,255,136,0.05); box-shadow: 0 0 15px rgba(0,255,136,0.1); }
        .status-pill.online svg { filter: drop-shadow(0 0 5px var(--green)); }
        
        .icon-dim { color: #666; cursor: pointer; transition: 0.2s; }
        .icon-dim:hover { color: #fff; }
        .avatar { width: 28px; height: 28px; background: linear-gradient(45deg, #6a11cb, #2575fc); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }

        /* WORKSPACE */
        .workspace { flex: 1; display: flex; overflow: hidden; position: relative; z-index: 10; }

        /* SIDEBAR */
        .sidebar { width: 400px; background: var(--panel); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .sidebar-header { height: 45px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 15px; background: rgba(255,255,255,0.02); }
        .title-group { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #ccc; }
        .save-indicator { font-size: 10px; color: var(--green); display: flex; align-items: center; gap: 4px; font-weight: 700; }
        
        .env-list { flex: 1; overflow-y: auto; padding: 0; }
        .env-header-row { display: grid; grid-template-columns: 30px 1fr 1.5fr 0.5fr; padding: 10px 15px; font-size: 10px; color: #666; font-weight: 700; border-bottom: 1px solid var(--border); }
        .scroller { padding: 10px 0; }
        
        .env-row { display: grid; grid-template-columns: 30px 1fr 1.5fr 0.5fr; align-items: center; padding: 8px 15px; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); transition: 0.3s; }
        .env-row:hover { background: rgba(255,255,255,0.02); }
        .env-row.filled { background: rgba(255, 108, 55, 0.05); border-left: 2px solid var(--orange); }
        
        .col-status { display: flex; justify-content: center; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #333; }
        .status-dot.active { background: var(--green); box-shadow: 0 0 8px var(--green); }
        
        .col-key { color: #fff; font-weight: 500; font-family: var(--font-code); }
        .col-value { color: #ffbd80; font-family: var(--font-code); white-space: normal; word-break: break-word; line-height: 1.4; padding-right: 10px; }
        .var-placeholder { color: #444; font-style: italic; }
        .col-type { color: #666; font-size: 10px; text-align: right; }
        
        .divider { padding: 15px; font-size: 10px; color: #444; font-weight: 800; letter-spacing: 1px; border-bottom: 1px solid var(--border); margin-bottom: 5px; text-align: center; }

        /* STAGE */
        .stage { flex: 1; display: flex; flex-direction: column; background: #0e0e0e; position: relative; }
        
        .request-bar { height: 60px; display: flex; align-items: center; padding: 0 30px; border-bottom: 1px solid var(--border); gap: 15px; background: var(--panel); }
        .method { font-weight: 800; color: var(--orange); font-size: 14px; }
        .url { flex: 1; background: #000; border: 1px solid var(--border); height: 40px; border-radius: 6px; display: flex; align-items: center; padding: 0 15px; font-family: var(--font-code); font-size: 13px; color: #888; letter-spacing: 0.5px; }
        
        .action-btn { height: 40px; padding: 0 30px; border: none; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.3s; color: #fff; letter-spacing: 0.5px; }
        .action-btn.start { background: #0075FF; box-shadow: 0 4px 15px rgba(0,117,255,0.3); }
        .action-btn.start:hover { background: #0063d1; transform: translateY(-1px); }
        .action-btn.stop { background: #222; border: 1px solid #444; color: #ff4444; }
        .action-btn.stop:hover { border-color: #ff4444; background: rgba(255,68,68,0.1); }

        .visualizer-container { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; position: relative; }

        /* 3D CORE ORB */
        .core-wrapper { width: 160px; height: 160px; position: relative; display: flex; align-items: center; justify-content: center; perspective: 1000px; }
        .core-center { width: 80px; height: 80px; background: #000; border-radius: 50%; z-index: 10; display: flex; align-items: center; justify-content: center; border: 1px solid #333; box-shadow: inset 0 0 20px rgba(255,255,255,0.05); color: #444; transition: 0.5s; }
        .core-glow { position: absolute; inset: 0; background: radial-gradient(circle, var(--orange) 0%, transparent 70%); opacity: 0; transition: 0.5s; filter: blur(40px); z-index: 0; }
        
        .ring { position: absolute; border-radius: 50%; border: 2px solid transparent; transition: 0.5s; }
        .r1 { width: 100%; height: 100%; border-top: 2px solid #444; border-bottom: 2px solid #444; opacity: 0.3; }
        .r2 { width: 120%; height: 120%; border-left: 1px solid #444; border-right: 1px solid #444; opacity: 0.2; }
        .r3 { width: 80%; height: 80%; border: 1px dashed #444; opacity: 0.2; }

        /* STATES */
        .core-wrapper.active .core-center { border-color: #fff; color: #fff; box-shadow: 0 0 30px rgba(255,255,255,0.2); }
        .core-wrapper.active .r1 { animation: spin 10s linear infinite; border-color: #666; }
        .core-wrapper.active .r2 { animation: spin-rev 15s linear infinite; border-color: #666; }

        .core-wrapper.processing .core-center { color: var(--orange); border-color: var(--orange); }
        .core-wrapper.processing .core-glow { opacity: 0.4; background: radial-gradient(circle, var(--orange) 0%, transparent 70%); }
        .core-wrapper.processing .r1 { border-color: var(--orange); animation-duration: 2s; }

        .core-wrapper.speaking .core-center { color: var(--blue); border-color: var(--blue); transform: scale(1.1); }
        .core-wrapper.speaking .core-glow { opacity: 0.5; background: radial-gradient(circle, var(--blue) 0%, transparent 70%); }
        .core-wrapper.speaking .r3 { border-color: var(--blue); animation: pulse 1s infinite; opacity: 0.8; }

        /* TERMINAL CARD */
        .terminal-card { width: 600px; height: 300px; background: #050505; border: 1px solid #333; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .card-head { height: 36px; background: #111; border-bottom: 1px solid #222; display: flex; align-items: center; padding: 0 15px; justify-content: space-between; }
        .tabs { display: flex; gap: 20px; font-size: 11px; color: #666; }
        .tab.active { color: var(--orange); border-bottom: 2px solid var(--orange); height: 36px; display: flex; align-items: center; }
        .format { font-size: 10px; color: #444; font-weight: 700; }
        
        .card-body { flex: 1; display: flex; font-family: var(--font-code); font-size: 13px; overflow: hidden; }
        .line-numbers { width: 40px; background: #0a0a0a; border-right: 1px solid #222; color: #444; text-align: right; padding: 15px 10px; user-select: none; line-height: 1.6; }
        .code-content { flex: 1; padding: 15px; color: #ce9178; line-height: 1.6; overflow-y: auto; }
        .key { color: #9cdcfe; } .string { color: #ce9178; } 

        /* FOOTER */
        .stage-footer { height: 30px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 20px; padding: 0 20px; font-size: 11px; color: #666; width: 100%; background: var(--panel); position: absolute; bottom: 0; }
        .text-green { color: var(--green); } .text-dim { color: #444; }

        /* ANIMATIONS */
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes pulse { 0% { opacity: 0.3; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0.3; transform: scale(0.95); } }
        .pulse { animation: pulse 2s infinite; }
        .spin-slow { animation: spin 4s linear infinite; }
        .pulse-fast { animation: pulse 0.5s infinite; }
        .hidden { display: none; }
      `}</style>
    </main>
  );
}