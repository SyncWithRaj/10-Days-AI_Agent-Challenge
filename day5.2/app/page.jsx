"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Mic, Square, Play, Power, Volume2, 
  User, Building, Package, Clock, Briefcase, CheckCircle2, Loader2, Headphones, Zap, PhoneOff, Speaker, Anchor, Activity, Radio
} from "lucide-react";

// --- COMPONENT: NEON VARIABLE ROW ---
const EnvironmentVar = ({ label, value }) => {
  const isFilled = value && value !== "";
  return (
    <div className={`env-row ${isFilled ? "filled" : ""}`}>
      <div className="row-indicator"></div>
      <div className="col-key">
        <span className="var-name">{label}</span>
      </div>
      <div className="col-value">
        {isFilled ? (
          <span className="var-value typing-effect">{value}</span>
        ) : (
          <span className="var-placeholder">waiting_for_data...</span>
        )}
      </div>
      <div className="col-status">
        {isFilled && <div className="status-light"></div>}
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

  // --- BOAT LEAD STATE ---
  const [lead, setLead] = useState({
    name: "", role: "", company: "", quantity: "", requirement: "", timeline: ""
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

  useEffect(() => { leadRef.current = lead; }, [lead]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current) {
        transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveTranscript]);

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
    const SILENCE_DURATION = 1000; 

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
      setLiveTranscript(">> LISTENING_FOR_AUDIO_INPUT...");
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
        setLiveTranscript(">> ERROR: CONNECTION_LOST");
    }
  };

  // --- HANDLERS ---
  const handleStart = () => {
      setIsSessionActive(true);
      setIsSaved(false);
      sessionActiveRef.current = true; 
      isClosingRef.current = false;
      setLead({ name: "", role: "", company: "", quantity: "", requirement: "", timeline: "" });
      leadRef.current = { name: "", role: "", company: "", quantity: "", requirement: "", timeline: "" };
      setLiveTranscript(">> INITIALIZING_SECURE_UPLINK...");
      setTimeout(() => {
          if (!sessionActiveRef.current) return;
          setLiveTranscript("AMAN: Yo! Welcome to boAt Corporate. Aman here. What's the requirement today?");
          setTimeout(() => startRecording(), 2000);
      }, 1000);
  };

  const handleEnd = () => {
      setIsSessionActive(false);
      sessionActiveRef.current = false; 
      stopRecording();
      if (!isClosingRef.current && audioRef.current) audioRef.current.pause();
      setLiveTranscript(isClosingRef.current ? ">> SESSION_COMPLETE. DATA_ARCHIVED." : ">> DISCONNECTED.");
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
      cancelAnimationFrame(animationFrameRef.current);
  };

  return (
    <main className="cyber-layout">
      <div className="ambient-noise"></div>
      <div className="aurora-bg"></div>
      
      {/* --- HEADER --- */}
      <header className="pro-header">
        <div className="brand-container">
            <div className="logo-icon"><Anchor size={20} strokeWidth={3} /></div>
            <span className="brand-name">boAt <span className="brand-sub">ENTERPRISE</span></span>
        </div>
        
        <div className="status-container">
             <div className={`connection-pill ${isSessionActive ? "active" : ""}`}>
                <div className="indicator-dot"></div>
                <span>{isSessionActive ? "CHANNEL LIVE" : "DISCONNECTED"}</span>
             </div>
        </div>

        <div className="actions-container">
            <div className="icon-btn"><Radio size={18} /></div>
            <div className="icon-btn"><Headphones size={18} /></div>
            <div className="user-badge">ME</div>
        </div>
      </header>

      {/* --- MAIN WORKSPACE --- */}
      <div className="workspace">
         
         {/* LEFT SIDEBAR: ORDER MANIFEST */}
         <aside className="sidebar">
            <div className="sidebar-header">
                <Briefcase size={16} className="text-red" />
                <span>ORDER MANIFEST</span>
                {isSaved && <span className="tag saved">SAVED</span>}
            </div>
            
            <div className="data-scroller">
                <div className="group-label">CONTACT INFO</div>
                <EnvironmentVar label="Name" value={lead.name} />
                <EnvironmentVar label="Role" value={lead.role} />
                <EnvironmentVar label="Company" value={lead.company} />
                
                <div className="separator"></div>
                
                <div className="group-label">ORDER SPECS</div>
                <EnvironmentVar label="Quantity" value={lead.quantity} />
                <EnvironmentVar label="Timeline" value={lead.timeline} />
                
                <div className="req-card">
                    <span className="req-label">PRODUCT REQUIREMENT</span>
                    <div className={`req-content ${lead.requirement ? 'filled' : ''}`}>
                        {lead.requirement || "// Waiting for input..."}
                    </div>
                </div>
            </div>
         </aside>

         {/* CENTER STAGE: INTERFACE */}
         <section className="stage">
            
            {/* VISUALIZER */}
            <div className="visualizer-wrapper">
                
                {/* THE SONIC CORE */}
                <div className={`sonic-core ${isSessionActive ? 'active' : ''} ${processing ? 'thinking' : ''} ${isSpeaking ? 'speaking' : ''}`}>
                    <div className="wave w1"></div>
                    <div className="wave w2"></div>
                    <div className="wave w3"></div>
                    <div className="core-center">
                        {processing ? <Loader2 size={42} className="spin"/> : 
                         isSpeaking ? <Volume2 size={42} className="pulse"/> :
                         <Mic size={42} />}
                    </div>
                </div>

                {/* STATUS TEXT */}
                <div className="system-status">
                    {processing ? "PROCESSING DATA STREAM..." : 
                     isSpeaking ? "INCOMING TRANSMISSION..." : 
                     recording ? "LISTENING FOR INPUT..." : 
                     isSessionActive ? "LINK ESTABLISHED" : "SYSTEM READY"}
                </div>

                {/* TERMINAL TRANSCRIPT */}
                <div className="terminal-box">
                    <div className="term-header">
                        <div className="dots">
                            <span className="dot red"></span>
                            <span className="dot yellow"></span>
                            <span className="dot green"></span>
                        </div>
                        <span className="term-title">live_transcript.log</span>
                    </div>
                    <div className="term-body">
                        <div className="line-numbers">
                            <span>01</span><span>02</span><span>03</span><span>04</span><span>05</span>
                        </div>
                        <div className="term-content">
                            {liveTranscript || <span className="dim">// System Standby... Initialize to begin.</span>}
                            <div ref={transcriptEndRef} />
                        </div>
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="action-bar">
                    <button className={`cyber-btn ${isSessionActive ? 'terminate' : 'initiate'}`} onClick={isSessionActive ? handleEnd : handleStart}>
                        {isSessionActive ? "TERMINATE UPLINK" : "INITIATE UPLINK"}
                    </button>
                </div>

            </div>
         </section>
      </div>

      <audio ref={audioRef} className="hidden" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        :root {
            --red: #FF003C;
            --red-dim: rgba(255, 0, 60, 0.2);
            --dark: #050505;
            --panel: #0A0A0A;
            --border: #1F1F1F;
            --text: #EAEAEA;
            --font-ui: 'Space Grotesk', sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
        }

        body { margin: 0; background: var(--dark); color: var(--text); font-family: var(--font-ui); overflow: hidden; }
        
        /* CUSTOM SCROLLBAR */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--dark); }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--red); }

        .cyber-layout { height: 100vh; display: flex; flex-direction: column; position: relative; background: #030303; }
        .noise-overlay { position: absolute; inset: 0; background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.03; pointer-events: none; }
        .aurora-bg { position: absolute; top: -20%; left: 20%; width: 60%; height: 60%; background: radial-gradient(circle, rgba(255,0,60,0.15) 0%, transparent 70%); filter: blur(100px); z-index: 0; animation: drift 20s infinite alternate; }

        /* HEADER */
        .pro-header { height: 60px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; padding: 0 30px; background: rgba(10,10,10,0.8); backdrop-filter: blur(12px); z-index: 20; position: relative; }
        
        .brand-container { display: flex; align-items: center; gap: 12px; }
        .logo-box { color: var(--red); }
        .brand-name { font-weight: 700; font-size: 18px; letter-spacing: 1px; }
        .brand-sub { color: #666; font-weight: 400; font-size: 12px; margin-left: 5px; }

        .connection-pill { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; background: #000; padding: 6px 14px; border-radius: 20px; border: 1px solid #333; color: #555; transition: 0.3s; }
        .connection-pill.active { border-color: var(--red); color: var(--red); background: rgba(255,0,60,0.05); box-shadow: 0 0 15px rgba(255,0,60,0.1); }
        .indicator-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .active .indicator-dot { animation: blink 2s infinite; }

        .actions-container { display: flex; align-items: center; gap: 20px; }
        .icon-btn { color: #666; cursor: pointer; transition: 0.2s; } .icon-btn:hover { color: #fff; }
        .user-badge { width: 28px; height: 28px; background: #222; border: 1px solid #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }

        /* WORKSPACE */
        .workspace { flex: 1; display: flex; z-index: 10; overflow: hidden; }

        /* SIDEBAR */
        .sidebar { width: 380px; background: var(--panel); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 30px 25px; }
        .sidebar-title { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px; color: #888; margin-bottom: 25px; letter-spacing: 1px; }
        .text-red { color: var(--red); }
        .tag.saved { background: #00FF88; color: #000; font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-left: auto; font-weight: 800; }

        .data-scroller { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 5px; }
        .group-label { font-size: 10px; font-weight: 700; color: #444; margin-bottom: 4px; letter-spacing: 1px; }
        .separator { height: 1px; background: #1A1A1A; margin: 10px 0; }

        /* ENVIRONMENT VAR ROW */
        .env-row { display: flex; align-items: center; background: #111; border: 1px solid #1F1F1F; padding: 12px 15px; border-radius: 8px; transition: 0.3s; position: relative; overflow: hidden; }
        .env-row.filled { background: rgba(255,0,60,0.03); border-color: #333; }
        
        .row-indicator { width: 3px; height: 100%; position: absolute; left: 0; top: 0; background: #333; transition: 0.3s; }
        .filled .row-indicator { background: var(--red); box-shadow: 0 0 10px var(--red); }
        
        .col-key { width: 80px; font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; }
        .col-value { flex: 1; text-align: right; font-family: var(--font-mono); font-size: 12px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .col-status { width: 20px; display: flex; justify-content: flex-end; }
        .status-light { width: 5px; height: 5px; background: #00FF88; border-radius: 50%; box-shadow: 0 0 8px #00FF88; }
        .var-placeholder { color: #333; font-style: italic; }

        .req-card { margin-top: 15px; }
        .req-label { font-size: 10px; font-weight: 700; color: #555; display: block; margin-bottom: 8px; letter-spacing: 0.5px; }
        .req-content { background: #0F0F0F; border: 1px solid #222; border-radius: 8px; padding: 15px; min-height: 80px; font-family: var(--font-mono); font-size: 12px; line-height: 1.5; color: #666; transition: 0.3s; }
        .req-content.filled { color: #eee; border-color: #333; background: #141414; }

        /* STAGE */
        .stage { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; }
        .visualizer-wrapper { display: flex; flex-direction: column; align-items: center; gap: 35px; width: 100%; max-width: 650px; }

        /* SONIC CORE */
        .sonic-core { width: 160px; height: 160px; position: relative; display: flex; align-items: center; justify-content: center; }
        .core-center { width: 90px; height: 90px; background: #080808; border-radius: 50%; border: 1px solid #333; display: flex; align-items: center; justify-content: center; z-index: 10; color: #444; transition: 0.3s; box-shadow: inset 0 0 20px rgba(0,0,0,0.5); }
        .wave { position: absolute; border-radius: 50%; border: 1px solid transparent; transition: 0.5s; }
        .w1 { width: 120%; height: 120%; border-color: #222; opacity: 0.5; }
        .w2 { width: 150%; height: 150%; border-color: #1a1a1a; opacity: 0.3; }
        .w3 { width: 180%; height: 180%; border-color: #111; opacity: 0.1; }

        /* CORE STATES */
        .sonic-core.active .core-center { border-color: var(--red); color: var(--red); box-shadow: 0 0 30px rgba(255,0,60,0.2); }
        
        .sonic-core.speaking .core-center { transform: scale(1.1); background: var(--red); color: #000; border-color: var(--red); }
        .sonic-core.speaking .w1 { border-color: var(--red); animation: ripple 1.5s infinite; opacity: 0.6; }
        .sonic-core.speaking .w2 { border-color: var(--red); animation: ripple 1.5s infinite 0.2s; opacity: 0.3; }

        .sonic-core.thinking .core-center { border-color: #fff; color: #fff; }
        .sonic-core.thinking .w1 { border-top-color: #fff; animation: spin 1s infinite; }

        .system-status { font-family: var(--font-mono); font-size: 12px; letter-spacing: 2px; color: #555; font-weight: 700; text-transform: uppercase; }

        /* TERMINAL BOX */
        .terminal-box { width: 100%; background: #0A0A0A; border: 1px solid #222; border-radius: 8px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
        .term-header { height: 32px; background: #111; border-bottom: 1px solid #222; display: flex; align-items: center; padding: 0 12px; gap: 10px; }
        .dots { display: flex; gap: 6px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .red { background: #FF5F56; } .yellow { background: #FFBD2E; } .green { background: #27C93F; }
        .term-title { font-size: 10px; color: #666; font-family: var(--font-mono); }
        
        .term-body { display: flex; font-family: var(--font-mono); font-size: 13px; }
        .line-numbers { width: 35px; background: #0E0E0E; border-right: 1px solid #222; padding: 15px 0; text-align: center; color: #333; user-select: none; display: flex; flex-direction: column; gap: 5px; font-size: 11px; }
        
        /* ✅ FIX: PADDING & WRAPPING */
        .term-content { 
            flex: 1; 
            padding: 15px; 
            color: #ccc; 
            line-height: 1.6; 
            height: 120px; 
            overflow-y: auto; 
            white-space: pre-wrap; 
            word-break: break-word;
        }
        .dim { color: #444; font-style: italic; }

        /* CONTROLS */
        .action-bar { margin-top: 10px; }
        .cyber-btn { 
            background: transparent; border: 1px solid var(--red); color: var(--red);
            padding: 12px 40px; font-family: var(--font-mono); font-weight: 700; font-size: 12px;
            letter-spacing: 1px; cursor: pointer; transition: 0.3s; position: relative; overflow: hidden;
        }
        .cyber-btn:hover { background: rgba(255,0,60,0.1); box-shadow: 0 0 20px rgba(255,0,60,0.3); }
        .cyber-btn.initiate { border-color: #fff; color: #fff; }
        .cyber-btn.initiate:hover { background: rgba(255,255,255,0.1); box-shadow: 0 0 20px rgba(255,255,255,0.2); }

        /* ANIMATIONS */
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes drift { 0% { transform: translateX(-50px); } 100% { transform: translateX(50px); } }
        @keyframes blink { 50% { opacity: 0.3; } }
        .spin { animation: spin 1s linear infinite; }
        .pulse { animation: blink 1.5s infinite; }
        .hidden { display: none; }

        @media (max-width: 900px) { .workspace { flex-direction: column; overflow-y: auto; } .sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); height: auto; } }
      `}</style>
    </main>
  );
}