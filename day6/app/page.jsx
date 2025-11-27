"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Mic, Volume2, ShieldCheck, ShieldAlert, Lock, CreditCard, AlertTriangle, Phone, PhoneOff, Activity, Loader2, CheckCircle2, XCircle, User
} from "lucide-react";

export default function Home() {
  // States
  const [isCallActive, setIsCallActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState(""); 
  
  // Fraud Logic State
  const [caseState, setCaseState] = useState({
    step: "GREETING",
    status: "PENDING_REVIEW" 
  });

  // ✅ FIX: Converted to State so it can update dynamically from Backend
  const [caseData, setCaseData] = useState({
      userName: "---",         // Placeholder until load
      securityIdentifier: "---",
      cardEnding: "----",
      transaction: { 
          merchant: "---", 
          amount: "---", 
          location: "---", 
          date: "---" 
      },
      securityQuestion: "---"
  });

  // Refs
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
      setupSilenceDetection(stream);
    } catch (err) { alert("Mic Error"); handleEndCall(); }
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
        setTranscript(transData.transcript); // Update transcript state logic (hidden from UI)

        const genRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transData.transcript, currentCase: sessionRef.current })
        });
        const genData = await genRes.json();
        
        setProcessing(false);

        if (genData.updatedState) {
            setCaseState(prev => ({ 
                ...prev, 
                ...genData.updatedState, 
                shouldHangUp: genData.shouldHangUp 
            }));
        }

        // ✅ FIX: Update UI with Real Data from Backend
        if (genData.activeCase) {
            setCaseData(genData.activeCase);
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
      
      setTimeout(() => { processAudioPipelineMockStart(); }, 1500);
  };

  const processAudioPipelineMockStart = async () => {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Call Connected", currentCase: { step: "GREETING" } })
      });
      const genData = await genRes.json();
      
      // ✅ FIX: Update UI with Real Data on Start
      if (genData.activeCase) {
          setCaseData(genData.activeCase);
      }

      if (genData.audio && audioRef.current) {
          audioRef.current.src = genData.audio;
          audioRef.current.play();
      }
  };

  const handleEndCall = () => {
      setIsCallActive(false);
      setRecording(false);
      if (audioRef.current) audioRef.current.pause();
      setCaseState({ step: "GREETING", status: "PENDING_REVIEW" });
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
      cancelAnimationFrame(animationFrameRef.current);
  };

  const isBlurred = caseState.step === "GREETING" || caseState.step === "VERIFYING";

  return (
    <main className="bank-ui">
      <div className="noise-bg"></div>

      {/* HEADER */}
      <header className="nav-header">
        <div className="logo-section">
            <div className="logo-box"><ShieldCheck size={20} /></div>
            <span className="logo-text">Sentinel Trust</span>
        </div>
        <div className="security-pill">
            <Lock size={12} />
            <span>Secure 256-bit SSL</span>
        </div>
      </header>

      <div className="content-wrapper">
        
        {/* LEFT: CALL INTERFACE */}
        <div className="card call-card">
            <div className="card-bg-glow"></div>
            
            <div className="card-top">
                <div className={`status-indicator ${isCallActive ? 'active' : ''}`}>
                    <div className="pulse-dot"></div>
                    {isCallActive ? "SECURE VOICE LINE" : "READY TO CONNECT"}
                </div>
            </div>

            <div className="visualizer-area">
                <div className={`avatar-container ${isSpeaking ? "speaking" : processing ? "thinking" : ""}`}>
                    <div className="avatar-glow"></div>
                    <div className="avatar-circle">
                        {processing ? <Loader2 size={32} className="spin" color="#fff" /> :
                         <Volume2 size={32} color="#fff" />}
                    </div>
                </div>
                
                <div className="agent-details">
                    <h2>Agent Carter</h2>
                    <p>Fraud Prevention Specialist</p>
                </div>
                
                {/* Status Message instead of Transcript */}
                <div className="status-message">
                    {processing ? "Verifying information..." : 
                     isSpeaking ? "Incoming secure audio..." : 
                     recording ? "Listening..." : 
                     isCallActive ? "Channel Open" : "Standby"}
                </div>
            </div>

            <div className="action-area">
                {!isCallActive ? (
                    <button className="btn-primary" onClick={handleStartCall}>
                        <Phone size={18} fill="currentColor" /> 
                        <span>Start Secure Call</span>
                    </button>
                ) : (
                    <button className="btn-danger" onClick={handleEndCall}>
                        <PhoneOff size={18} /> 
                        <span>End Call</span>
                    </button>
                )}
            </div>
        </div>

        {/* RIGHT: CASE DETAILS */}
        <div className="card info-card">
            <div className="card-header">
                <div className="header-title">
                    <AlertTriangle size={18} className="text-orange"/>
                    <span>Suspicious Activity</span>
                </div>
                <div className={`status-badge ${caseState.status}`}>
                    {caseState.status === "PENDING_REVIEW" ? "Review Needed" : caseState.status.replace("CONFIRMED_", "")}
                </div>
            </div>

            <div className="info-body">
                <div className="section-label">Customer Identity</div>
                <div className="info-row">
                    <div className="icon-circle"><User size={16}/></div>
                    <div className="info-text">
                        <span className="label">Name</span>
                        <span className="val">{caseData.userName}</span>
                    </div>
                </div>
                <div className="info-row">
                    <div className="icon-circle"><CreditCard size={16}/></div>
                    <div className="info-text">
                        <span className="label">Card Number</span>
                        <span className="val">{caseData.cardEnding}</span>
                    </div>
                </div>

                <div className="divider"></div>

                <div className="section-label">Transaction Details</div>
                
                {/* SECURE BOX */}
                <div className={`secure-box ${isBlurred ? "locked" : "unlocked"}`}>
                    <div className="blur-content">
                        <div className="trans-row">
                            <span>Merchant</span>
                            <strong>{caseData.transaction.merchant}</strong>
                        </div>
                        <div className="trans-row">
                            <span>Amount</span>
                            <strong className="text-red">{caseData.transaction.amount}</strong>
                        </div>
                        <div className="trans-row">
                            <span>Location</span>
                            <strong>{caseData.transaction.location}</strong>
                        </div>
                        <div className="trans-row">
                            <span>Time</span>
                            <strong>{caseData.transaction.date}</strong>
                        </div>
                    </div>

                    {isBlurred && (
                        <div className="lock-overlay">
                            <div className="lock-icon-circle"><Lock size={20}/></div>
                            <span>Identity Verification Required</span>
                        </div>
                    )}
                </div>

                <div className="divider"></div>

                <div className="section-label">Security Challenge</div>
                <div className="challenge-box">
                    <p>"{caseData.securityQuestion}"</p>
                    <div className="status-row">
                        {caseState.step === "DECISION" || caseState.step === "COMPLETED" ? (
                            <span className="tag success"><CheckCircle2 size={12}/> Verified</span>
                        ) : caseState.status === "VERIFICATION_FAILED" ? (
                            <span className="tag fail"><XCircle size={12}/> Failed</span>
                        ) : (
                            <span className="tag pending">Pending...</span>
                        )}
                    </div>
                </div>
            </div>
        </div>

      </div>

      <audio ref={audioRef} className="hidden" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        :root {
            --bg: #050505;
            --card-bg: #121212;
            --text-main: #e5e5e5;
            --text-muted: #737373;
            --blue-primary: #3b82f6;
            --blue-soft: #1e3a8a;
            --red: #ef4444;
            --red-soft: #450a0a;
            --green: #10b981;
            --green-soft: #064e3b;
            --orange: #f59e0b;
            --border: #262626;
        }
        
        body { margin: 0; background: var(--bg); color: var(--text-main); font-family: 'Inter', sans-serif; overflow: hidden; }
        .hidden { display: none; }
        .bank-ui { height: 100vh; display: flex; flex-direction: column; }
        .noise-bg { position: absolute; inset: 0; opacity: 0.03; background: url('https://grainy-gradients.vercel.app/noise.svg'); pointer-events: none; }

        /* HEADER */
        .nav-header { height: 64px; background: #0a0a0a; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 40px; z-index: 20; }
        .logo-section { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 18px; color: var(--text-main); }
        .logo-box { width: 32px; height: 32px; background: var(--blue-primary); border-radius: 8px; color: #fff; display: flex; align-items: center; justify-content: center; }
        .security-pill { background: #111; color: var(--green); padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 6px; border: 1px solid #222; }

        /* LAYOUT */
        .content-wrapper { flex: 1; display: flex; justify-content: center; align-items: center; gap: 40px; padding: 40px; position: relative; z-index: 10; }
        
        .card { background: var(--card-bg); border-radius: 24px; border: 1px solid var(--border); box-shadow: 0 20px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; position: relative; }
        
        /* CALL CARD (LEFT) */
        .call-card { width: 400px; height: 600px; text-align: center; justify-content: space-between; }
        .card-bg-glow { position: absolute; top: 0; left: 0; right: 0; height: 250px; background: linear-gradient(180deg, rgba(37, 99, 235, 0.1) 0%, transparent 100%); z-index: 0; pointer-events: none; }
        
        .card-top { padding: 30px; position: relative; z-index: 1; display: flex; justify-content: center; }
        .status-indicator { background: #000; padding: 8px 16px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: var(--text-muted); border: 1px solid var(--border); }
        .status-indicator.active { color: var(--green); border-color: rgba(16, 185, 129, 0.3); }
        .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #444; }
        .active .pulse-dot { background: var(--green); animation: pulse 2s infinite; }

        .visualizer-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; position: relative; z-index: 1; }
        .avatar-container { width: 140px; height: 140px; position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
        .avatar-circle { width: 100px; height: 100px; background: #1a1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 2; border: 1px solid #333; transition: 0.3s; }
        
        .speaking .avatar-circle { transform: scale(1.1); border-color: var(--blue-primary); background: var(--blue-primary); }
        .thinking .avatar-circle { border-color: var(--orange); }
        
        .avatar-glow { position: absolute; inset: 0; border-radius: 50%; background: var(--blue-primary); opacity: 0; filter: blur(30px); transition: 0.3s; }
        .speaking .avatar-glow { opacity: 0.4; animation: breathe 2s infinite; }

        .agent-details h2 { font-size: 20px; font-weight: 700; color: var(--text-main); margin: 0 0 4px 0; }
        .agent-details p { font-size: 12px; font-weight: 500; color: var(--text-muted); margin: 0; text-transform: uppercase; letter-spacing: 1px; }

        .status-message { height: 40px; display: flex; align-items: center; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--blue-primary); letter-spacing: 1px; }

        .action-area { padding: 30px; width: 100%; border-top: 1px solid var(--border); }
        .btn-primary { width: 100%; background: var(--blue-primary); color: #fff; border: none; padding: 16px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; box-shadow: 0 0 20px rgba(37, 99, 235, 0.3); }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-2px); }
        .btn-danger { width: 100%; background: transparent; color: var(--red); border: 1px solid var(--red); padding: 16px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .btn-danger:hover { background: rgba(239, 68, 68, 0.1); }

        /* INFO CARD (RIGHT) */
        .info-card { width: 450px; height: 650px; }
        .card-header { padding: 25px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .header-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--text-main); }
        .text-orange { color: var(--orange); }
        
        .status-badge { font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .PENDING_REVIEW { background: #222; color: var(--text-muted); border: 1px solid #333; }
        .CONFIRMED_SAFE { background: var(--green-soft); color: var(--green); border: 1px solid #065f46; }
        .CONFIRMED_FRAUD { background: var(--red-soft); color: var(--red); border: 1px solid #7f1d1d; }

        .info-body { padding: 25px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; flex: 1; }
        .section-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .info-row { display: flex; align-items: center; gap: 12px; }
        .icon-circle { width: 32px; height: 32px; background: #1a1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); border: 1px solid var(--border); }
        .info-text { display: flex; flex-direction: column; }
        .label { font-size: 11px; color: var(--text-muted); font-weight: 500; }
        .val { font-size: 14px; font-weight: 600; color: var(--text-main); }

        .divider { height: 1px; background: var(--border); margin: 5px 0; }

        /* SECURE BOX */
        .secure-box { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; position: relative; background: #0a0a0a; transition: 0.3s; }
        .blur-content { padding: 15px; display: flex; flex-direction: column; gap: 12px; transition: 0.5s; }
        .locked .blur-content { filter: blur(8px); opacity: 0.4; user-select: none; }
        
        .lock-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; z-index: 10; color: var(--text-muted); font-size: 11px; font-weight: 600; background: rgba(10,10,10,0.6); }
        .lock-icon-circle { width: 40px; height: 40px; background: #1a1a1a; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); color: var(--text-main); border: 1px solid var(--border); }
        
        .trans-row { display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px dashed var(--border); padding-bottom: 8px; }
        .trans-row:last-child { border-bottom: none; padding-bottom: 0; }
        .trans-row span { color: var(--text-muted); }
        .trans-row strong { color: var(--text-main); }
        .text-red { color: var(--red) !important; }

        .challenge-box { background: #111; border: 1px solid var(--border); padding: 15px; border-radius: 12px; }
        .q-text { font-size: 13px; font-style: italic; color: var(--text-main); margin-bottom: 12px; }
        .tag { font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
        .tag.pending { color: var(--orange); }
        .tag.success { color: var(--green); }
        .tag.fail { color: var(--red); }

        /* ANIMATIONS */
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes breathe { 0% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.2; transform: scale(1.2); } 100% { opacity: 0.4; transform: scale(1); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 900px) { .content-wrapper { flex-direction: column; padding: 20px; } .card { width: 100%; height: auto; } }
      `}</style>
    </main>
  );
}