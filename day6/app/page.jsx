"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Volume2, ShieldCheck, Lock, Phone, PhoneOff, Loader2, ShieldAlert, Radio, Mic
} from "lucide-react";

export default function Home() {
  // --- STATES ---
  const [isCallActive, setIsCallActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("System Standby");
  
  // Logic State
  const [caseState, setCaseState] = useState({
    step: "GREETING",
    status: "PENDING_REVIEW" 
  });

  // Fake Data (Used internally for logic)
  const caseData = {
      user: "John Doe",
      id: "STB-8821-X",
      cardEnding: "4242",
      merchant: "Apple Store NYC",
      amount: "$1,299.00"
  };

  // --- REFS ---
  const audioRef = useRef(null);
  const recorder = useRef(null);
  const sessionRef = useRef(caseState); 
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => { sessionRef.current = caseState; }, [caseState]);

  // Audio Events
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.onplay = () => setIsSpeaking(true);
        audioRef.current.onended = () => {
            setIsSpeaking(false);
            if (isCallActive && !sessionRef.current.shouldHangUp) {
                setTimeout(() => startRecording(), 500);
            }
            if (sessionRef.current.shouldHangUp) {
                setTimeout(() => handleEndCall(), 3000);
            }
        };
    }
  }, [isCallActive]);

  // --- SILENCE DETECTION ---
  const setupSilenceDetection = (stream) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaStreamSource(stream);
    analyser.fftSize = 512;
    source.connect(analyser);
    
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastSound = Date.now();
    
    const detect = () => {
        if (!recorder.current || recorder.current.state !== "recording") return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0; for(let i=0; i<dataArray.length; i++) sum+=dataArray[i];
        const volume = sum / dataArray.length;

        if (volume > 15) lastSound = Date.now();
        else if (Date.now() - lastSound > 1200) { 
            stopRecording(); 
            return;
        }
        animationFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  // --- RECORDING ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
        cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach(t => t.stop());
        
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size > 0) await processAudio(blob);
      };
      mediaRecorder.start();
      setRecording(true);
      setTranscript("Listening...");
      setupSilenceDetection(stream);
    } catch (err) { handleEndCall(); }
  };

  const stopRecording = () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      setRecording(false);
  };

  // --- API CALL ---
  const processAudio = async (blob) => {
    setProcessing(true);
    try {
        const ab = await blob.arrayBuffer();
        
        const transRes = await fetch("/api/transcribe", { method: "POST", body: ab });
        const transData = await transRes.json();
        if (!transData.transcript || !transData.transcript.trim()) {
            setProcessing(false);
            if (isCallActive) startRecording();
            return;
        }
        setTranscript("Analyzing Input...");

        const genRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transData.transcript, currentCase: sessionRef.current })
        });
        const genData = await genRes.json();
        
        setProcessing(false);
        setTranscript(genData.reply); // Show what AI is saying

        if (genData.updatedState) {
            setCaseState(prev => ({ 
                ...prev, 
                ...genData.updatedState, 
                shouldHangUp: genData.shouldHangUp 
            }));
        }

        if (genData.audio && audioRef.current) {
            audioRef.current.src = genData.audio;
            audioRef.current.play();
        }
    } catch (e) { console.error(e); setProcessing(false); }
  };

  // --- HANDLERS ---
  const handleStartCall = () => {
      setIsCallActive(true);
      setCaseState({ step: "GREETING", status: "PENDING_REVIEW" });
      setTranscript("Establishing Secure Link...");
      setTimeout(() => { processAudioPipelineMockStart(); }, 1500);
  };

  const processAudioPipelineMockStart = async () => {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Call Connected", currentCase: { step: "GREETING" } })
      });
      const genData = await genRes.json();
      setTranscript(genData.reply);
      if (genData.audio && audioRef.current) {
          audioRef.current.src = genData.audio;
          audioRef.current.play();
      }
  };

  const handleEndCall = () => {
      setIsCallActive(false);
      setRecording(false);
      if (audioRef.current) audioRef.current.pause();
      setTranscript("Connection Terminated.");
      setCaseState({ step: "GREETING", status: "PENDING_REVIEW" });
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
      cancelAnimationFrame(animationFrameRef.current);
  };

  return (
    <main className="secure-terminal">
      <div className="bg-effects">
        <div className="noise"></div>
        <div className="gradient-glow"></div>
      </div>

      {/* CENTER CONSOLE */}
      <div className="console-wrapper">
        
        {/* TOP STATUS */}
        <div className="secure-header">
            <div className="shield-icon">
                <ShieldCheck size={24} />
            </div>
            <div className="header-text">
                <h1>SENTINEL TRUST</h1>
                <span className="subtitle">SECURE FRAUD OPS</span>
            </div>
            <div className={`live-tag ${isCallActive ? 'on' : 'off'}`}>
                <div className="pulse-dot"></div>
                {isCallActive ? "LIVE" : "OFFLINE"}
            </div>
        </div>

        {/* VISUALIZER CORE */}
        <div className="core-stage">
            <div className={`energy-ring r1 ${isCallActive ? 'active' : ''} ${recording ? 'listening' : ''}`}></div>
            <div className={`energy-ring r2 ${isCallActive ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}></div>
            
            <div className="avatar-core">
                {processing ? <Loader2 size={48} className="spin"/> :
                 isSpeaking ? <Volume2 size={48} className="pulse-icon"/> :
                 recording ? <Mic size={48} /> :
                 <Lock size={48} />}
            </div>
        </div>

        {/* DYNAMIC STATUS TEXT */}
        <div className="status-readout">
            {processing ? "ENCRYPTING DATA STREAM..." : 
             isSpeaking ? "INCOMING SECURE MESSAGE..." : 
             recording ? "LISTENING TO CHANNEL..." : 
             isCallActive ? "CHANNEL OPEN - STANDBY" : "READY TO CONNECT"}
        </div>

        {/* TRANSCRIPT PILL */}
        <div className="transcript-pill">
             <span className="msg-text">{transcript}</span>
        </div>

        {/* CONTROLS */}
        <div className="control-dock">
            {!isCallActive ? (
                <button className="big-btn start" onClick={handleStartCall}>
                    <Phone size={24} fill="currentColor" />
                    <span>Pickup Call</span>
                </button>
            ) : (
                <button className="big-btn end" onClick={handleEndCall}>
                    <PhoneOff size={24} />
                    <span>Terminate</span>
                </button>
            )}
        </div>

      </div>

      <audio ref={audioRef} className="hidden" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500&display=swap');
        
        :root {
            --bg: #02040a;
            --card: #0f172a;
            --accent: #3b82f6; /* Blue */
            --accent-glow: rgba(59, 130, 246, 0.4);
            --green: #10b981;
            --red: #ef4444;
            --white: #f8fafc;
            --text-dim: #64748b;
        }
        
        body { margin: 0; background: var(--bg); color: var(--white); font-family: 'Inter', sans-serif; overflow: hidden; }
        .hidden { display: none; }
        
        .secure-terminal { height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; position: relative; }
        
        /* BACKGROUND FX */
        .noise { position: absolute; inset: 0; opacity: 0.04; background: url('https://grainy-gradients.vercel.app/noise.svg'); pointer-events: none; }
        .gradient-glow { position: absolute; width: 600px; height: 600px; background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%); top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.3; filter: blur(80px); pointer-events: none; }

        /* CONSOLE CONTAINER */
        .console-wrapper { 
            width: 420px; min-height: 650px; background: rgba(15, 23, 42, 0.6); 
            backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); 
            border-radius: 32px; display: flex; flex-direction: column; 
            align-items: center; justify-content: space-between; padding: 40px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            position: relative; z-index: 10;
        }

        /* HEADER */
        .secure-header { width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .shield-icon { color: var(--accent); }
        .header-text { flex: 1; margin-left: 12px; }
        .header-text h1 { font-size: 16px; font-weight: 800; margin: 0; letter-spacing: 0.5px; }
        .subtitle { font-size: 10px; font-weight: 600; color: var(--text-dim); letter-spacing: 1px; }
        
        .live-tag { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: var(--text-dim); transition: 0.3s; }
        .live-tag.on { border-color: var(--green); color: var(--green); background: rgba(16, 185, 129, 0.1); }
        .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .on .pulse-dot { animation: blink 2s infinite; }

        /* VISUALIZER */
        .core-stage { position: relative; width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; margin: 30px 0; }
        .avatar-core { width: 100px; height: 100px; background: #020617; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 5; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); transition: 0.3s; color: var(--text-dim); }
        
        .energy-ring { position: absolute; border-radius: 50%; border: 1px solid transparent; transition: 0.5s; inset: 0; opacity: 0; }
        
        /* STATES */
        .r1.active { border-color: var(--accent); opacity: 0.2; transform: scale(1.2); }
        .r2.active { border-color: var(--accent); opacity: 0.1; transform: scale(1.4); }

        .listening .r1 { border-color: var(--green); opacity: 0.5; animation: ripple 1.5s infinite; }
        .listening ~ .avatar-core { color: var(--green); border-color: var(--green); box-shadow: 0 0 30px rgba(16, 185, 129, 0.3); }

        .speaking .r2 { border-color: var(--accent); opacity: 0.6; animation: ripple 2s infinite reverse; }
        .speaking ~ .avatar-core { color: var(--accent); border-color: var(--accent); transform: scale(1.1); }

        .spin { animation: spin 1s linear infinite; }
        .pulse-icon { animation: pulse 1s infinite; }

        /* TEXT */
        .status-readout { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 15px; height: 20px; }
        
        .transcript-pill { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; width: 100%; min-height: 80px; display: flex; align-items: center; justify-content: center; text-align: center; margin-bottom: 30px; }
        .msg-text { font-size: 14px; line-height: 1.5; color: #cbd5e1; font-weight: 500; }

        /* CONTROLS */
        .control-dock { width: 100%; }
        .big-btn { width: 100%; padding: 18px; border-radius: 16px; font-size: 14px; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s; letter-spacing: 0.5px; }
        
        .big-btn.start { background: var(--accent); color: #fff; box-shadow: 0 4px 20px var(--accent-glow); }
        .big-btn.start:hover { background: #2563eb; transform: translateY(-2px); }
        
        .big-btn.end { background: rgba(239, 68, 68, 0.1); color: var(--red); border: 1px solid rgba(239, 68, 68, 0.3); }
        .big-btn.end:hover { background: rgba(239, 68, 68, 0.2); }

        /* ANIMATIONS */
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.9); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes blink { 50% { opacity: 0.4; } }
        
        @media (max-height: 700px) { .console-wrapper { transform: scale(0.9); } }
      `}</style>
    </main>
  );
}