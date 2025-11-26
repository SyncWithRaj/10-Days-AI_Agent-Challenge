"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Mic, Square, Play, Power, Volume2, 
  User, Building, Users, Clock, Briefcase, CheckCircle, Loader2, Send, Zap, PhoneOff, Activity, Search, Bell, Settings, Sidebar
} from "lucide-react";

// --- COMPONENT: POSTMAN-STYLE VARIABLE ROW ---
const EnvironmentVar = ({ label, value, type = "default" }) => {
  const isFilled = value && value !== "";
  return (
    <div className={`env-row ${isFilled ? "filled" : ""}`}>
      <div className="col-key">
        <span className="var-name">{label}</span>
      </div>
      <div className="col-value">
        {isFilled ? (
          <span className="var-value">{value}</span>
        ) : (
          <span className="var-placeholder">...</span>
        )}
      </div>
      <div className="col-type">
        <span className="type-badge">{type}</span>
      </div>
      <div className="col-status">
        {isFilled && <CheckCircle size={14} className="text-green" />}
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
  const chunks = useRef([]);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  const sessionActiveRef = useRef(false); 
  const isClosingRef = useRef(false); // ✅ NEW: Tracks if we are in the "Goodbye" phase

  // --- SYNC STATE TO REF ---
  useEffect(() => {
    leadRef.current = lead;
  }, [lead]);

  // --- AUDIO EVENT HANDLING ---
  useEffect(() => { 
    if (audioRef.current) {
        audioRef.current.onplay = () => setIsSpeaking(true);
        
        // ✅ CRITICAL FIX: Wait for audio to end before closing or looping
        audioRef.current.onended = () => {
            setIsSpeaking(false);
            
            // If we are closing (Order Complete), disconnect NOW.
            if (isClosingRef.current) {
                handleEnd(); 
            } 
            // Otherwise, keep the conversation loop going
            else if(sessionActiveRef.current) {
                setTimeout(() => startRecording(), 500); 
            }
        };
    }
  }, [isSessionActive]);

  // ------------------------------------------------------------
  // 🧠 SILENCE DETECTION
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // 🎤 RECORDING
  // ------------------------------------------------------------
  const startRecording = async () => {
    if (recording || processing || isSpeaking || !sessionActiveRef.current || isClosingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      chunks.current = [];
      mediaRecorder.ondataavailable = (e) => chunks.current.push(e.data);
      mediaRecorder.onstop = async () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());

        if (!sessionActiveRef.current) return;

        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (blob.size > 0) {
            setRecording(false);
            setProcessing(true);
            await processAudioPipeline(blob);
        }
      };
      mediaRecorder.start();
      setRecording(true);
      setLiveTranscript("Listening...");
      setupSilenceDetection(stream);
    } catch (err) { console.error("Mic Error", err); }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") { recorder.current.stop(); }
  };

  // ------------------------------------------------------------
  // 🌐 API PIPELINE
  // ------------------------------------------------------------
  const processAudioPipeline = async (blob) => {
    try {
      const ab = await blob.arrayBuffer();
      
      // 1. Transcribe
      const transRes = await fetch("/api/transcribe", { method: "POST", body: ab });
      const transData = await transRes.json();
      
      if (!sessionActiveRef.current) return;

      if (!transData.transcript || transData.transcript.trim().length === 0) {
          setProcessing(false);
          if(sessionActiveRef.current && !isClosingRef.current) startRecording(); 
          return;
      }

      setLiveTranscript(`"${transData.transcript}"`); 

      // 2. Generate SDR Response
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            text: transData.transcript, 
            currentLead: leadRef.current  
        }),
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

      // ✅ FIX: If complete, set the flag so we disconnect AFTER audio ends
      if (genData.isComplete) {
          setIsSaved(true);
          isClosingRef.current = true; // Don't stop immediately, wait for onEnded
      }

    } catch (err) { 
        console.error(err); 
        setProcessing(false);
        setLiveTranscript("Connection Error.");
    }
  };

  // --- HANDLERS ---
  const handleStart = () => {
      setIsSessionActive(true);
      setIsSaved(false);
      sessionActiveRef.current = true; 
      isClosingRef.current = false;
      
      const newLead = { name: "", role: "", company: "", team_size: "", use_case: "", timeline: "" };
      setLead(newLead);
      leadRef.current = newLead;

      setLiveTranscript("Connecting to Alex (Postman SDR)...");
      
      setTimeout(() => {
          if (!sessionActiveRef.current) return;
          setLiveTranscript("Hello! I'm Alex from Postman. What brings you here today?");
          setTimeout(() => startRecording(), 2000);
      }, 1000);
  };

  const handleEnd = () => {
      setIsSessionActive(false);
      sessionActiveRef.current = false; 
      stopRecording();
      // Only pause if we force closed it, otherwise let it finish speaking the goodbye
      if (!isClosingRef.current && audioRef.current) audioRef.current.pause();
      
      setLiveTranscript(isClosingRef.current ? "Session Completed & Saved." : "Disconnected.");
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
      }
      cancelAnimationFrame(animationFrameRef.current);
  };

  return (
    <main className="postman-layout">
      
      {/* --- TOP NAVIGATION --- */}
      <header className="global-header">
        <div className="header-left">
            <div className="logo-circle"><Zap size={16} fill="white"/></div>
            <span className="nav-item active">Home</span>
            <span className="nav-item">Workspaces</span>
            <span className="nav-item">API Network</span>
        </div>
        <div className="header-center">
            <div className="search-bar">
                <Search size={14} className="search-icon"/>
                <span>Search Postman</span>
            </div>
        </div>
        <div className="header-right">
            <Settings size={16} />
            <Bell size={16} />
            <div className="user-avatar">ME</div>
        </div>
      </header>

      {/* --- SUB NAVIGATION --- */}
      <div className="workspace-header">
         <div className="ws-left">
            <div className="ws-icon"><Activity size={14}/></div>
            <span className="ws-name">My Workspace</span>
            <span className="divider">/</span>
            <span className="ws-context">SDR_Agent_Flow</span>
         </div>
         <div className="ws-right">
            <button className="btn-invite">Invite</button>
         </div>
      </div>

      {/* --- URL BAR --- */}
      <div className="url-bar-container">
        <div className="method-badge">POST</div>
        <div className="url-input">
            https://api.postman.com/sdr-agent/live-voice-channel
        </div>
        <button className={`btn-send ${isSessionActive ? 'stop' : 'start'}`} onClick={isSessionActive ? handleEnd : handleStart}>
            {isSessionActive ? "DISCONNECT" : "CONNECT"}
        </button>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="main-content">
        
        {/* LEFT SIDEBAR (VARIABLES) */}
        <div className="sidebar-panel">
            <div className="panel-title">
                <Sidebar size={14} />
                <span>Environment: <strong>Lead_Context</strong></span>
                {isSaved && <span className="saved-badge">SAVED</span>}
            </div>
            <div className="env-table">
                <div className="table-header">
                    <span>VARIABLE</span>
                    <span>CURRENT VALUE</span>
                    <span>TYPE</span>
                    <span>STATUS</span>
                </div>
                <div className="table-body">
                    <EnvironmentVar label="full_name" value={lead.name} type="string" />
                    <EnvironmentVar label="job_title" value={lead.role} type="string" />
                    <EnvironmentVar label="company_name" value={lead.company} type="string" />
                    <EnvironmentVar label="team_size" value={lead.team_size} type="number" />
                    <EnvironmentVar label="project_timeline" value={lead.timeline} type="date" />
                    <div className="env-divider">--- META DATA ---</div>
                    <EnvironmentVar label="intent_summary" value={lead.use_case} type="text" />
                </div>
            </div>
        </div>

        {/* RIGHT CENTER (VISUALIZER) */}
        <div className="center-stage">
            
            <div className="visualizer-wrapper">
                {/* THE ORB */}
                <div className={`postman-orb ${isSessionActive ? 'active' : ''} ${recording ? 'listening' : ''} ${processing ? 'thinking' : ''} ${isSpeaking ? 'speaking' : ''}`}>
                    <div className="orb-inner">
                        {processing ? <Loader2 size={40} className="spin"/> : 
                         isSpeaking ? <Volume2 size={40} /> :
                         <Mic size={40} />}
                    </div>
                    <div className="orb-ripple r1"></div>
                    <div className="orb-ripple r2"></div>
                </div>

                {/* STATUS TEXT */}
                <div className="orb-status">
                    {processing ? "Status: 200 OK (Processing...)" : 
                     isSpeaking ? "Status: Downloading Stream..." : 
                     recording ? "Status: Uploading Audio..." : 
                     isSessionActive ? "Status: Connected (Standby)" : "Status: 404 Disconnected"}
                </div>

                {/* TRANSCRIPT CARD */}
                <div className="transcript-card">
                    <div className="card-label">RESPONSE BODY</div>
                    <div className="card-text">
                        {liveTranscript || <span className="dim">Waiting for request...</span>}
                    </div>
                </div>
            </div>

        </div>

      </div>

      <audio ref={audioRef} className="hidden" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        :root {
            --pm-orange: #FF6C37;
            --pm-bg: #1C1C1C;
            --pm-sidebar: #212121;
            --pm-header: #262626;
            --pm-border: #333333;
            --text-main: #FFFFFF;
            --text-muted: #9b9b9b;
            --green: #00FF88;
        }

        body { margin: 0; background: var(--pm-bg); color: var(--text-main); font-family: 'Inter', sans-serif; overflow: hidden; }
        .postman-layout { height: 100vh; display: flex; flex-direction: column; }

        /* GLOBAL HEADER */
        .global-header { height: 48px; background: var(--pm-header); display: flex; justify-content: space-between; align-items: center; padding: 0 15px; border-bottom: 1px solid var(--pm-border); font-size: 13px; }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .logo-circle { width: 24px; height: 24px; background: var(--pm-orange); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .nav-item { color: var(--text-muted); cursor: pointer; transition: 0.2s; }
        .nav-item.active, .nav-item:hover { color: #fff; font-weight: 500; }
        
        .search-bar { background: #111; border: 1px solid var(--pm-border); border-radius: 4px; padding: 5px 10px; display: flex; align-items: center; gap: 8px; width: 300px; color: var(--text-muted); }
        .header-right { display: flex; align-items: center; gap: 15px; color: var(--text-muted); }
        .user-avatar { width: 24px; height: 24px; background: purple; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: bold; }

        /* WORKSPACE HEADER */
        .workspace-header { height: 40px; background: var(--pm-bg); border-bottom: 1px solid var(--pm-border); display: flex; justify-content: space-between; align-items: center; padding: 0 15px; font-size: 13px; }
        .ws-left { display: flex; align-items: center; gap: 8px; color: var(--text-muted); }
        .ws-name { color: #fff; font-weight: 600; }
        .btn-invite { background: var(--pm-orange); border: none; color: #fff; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; }

        /* URL BAR */
        .url-bar-container { height: 50px; background: var(--pm-bg); border-bottom: 1px solid var(--pm-border); display: flex; align-items: center; padding: 0 15px; gap: 10px; }
        .method-badge { color: var(--pm-orange); font-weight: 800; font-size: 13px; }
        .url-input { flex: 1; background: #111; border: 1px solid var(--pm-border); height: 36px; border-radius: 4px; display: flex; align-items: center; padding: 0 10px; color: var(--text-muted); font-family: monospace; font-size: 13px; }
        .btn-send { background: #0075FF; color: #fff; border: none; height: 36px; padding: 0 20px; border-radius: 4px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .btn-send:hover { background: #0063d1; }
        .btn-send.stop { background: #333; color: #ccc; }

        /* MAIN CONTENT */
        .main-content { flex: 1; display: flex; overflow: hidden; }
        
        /* SIDEBAR */
        .sidebar-panel { width: 450px; background: var(--pm-sidebar); border-right: 1px solid var(--pm-border); display: flex; flex-direction: column; }
        .panel-title { height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 15px; border-bottom: 1px solid var(--pm-border); color: var(--text-muted); font-size: 12px; font-weight: 600; justify-content: space-between; }
        .panel-title strong { color: #fff; }
        .saved-badge { background: var(--green); color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
        
        .env-table { padding: 15px; overflow-y: auto; }
        .table-header { display: flex; font-size: 10px; color: var(--text-muted); font-weight: 600; padding-bottom: 8px; border-bottom: 1px solid var(--pm-border); margin-bottom: 10px; }
        .table-header span { flex: 1; }
        
        .env-row { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #2a2a2a; transition: 0.3s; }
        .env-row.filled { background: rgba(255, 108, 55, 0.05); border-radius: 4px; padding-left: 8px; padding-right: 8px; border-bottom: none; margin-bottom: 2px; }
        
        .col-key { flex: 1; font-size: 12px; font-weight: 500; color: #fff; }
        
        /* ✅ UI FIX: Changed white-space to allow wrapping so long text is visible */
        .col-value { flex: 1.5; font-size: 12px; color: #fff; word-break: break-word; padding-right: 10px; }
        
        .var-placeholder { color: #444; font-style: italic; }
        .col-type { flex: 0.5; font-size: 10px; color: var(--text-muted); }
        .type-badge { border: 1px solid #444; padding: 2px 4px; border-radius: 3px; }
        .col-status { width: 20px; display: flex; justify-content: flex-end; }
        .text-green { color: var(--green); }
        .env-divider { margin: 15px 0 5px 0; font-size: 10px; color: #444; font-weight: 700; text-align: center; letter-spacing: 1px; }

        /* VISUALIZER STAGE */
        .center-stage { flex: 1; background: #151515; display: flex; align-items: center; justify-content: center; position: relative; }
        .visualizer-wrapper { display: flex; flex-direction: column; align-items: center; gap: 30px; width: 100%; max-width: 600px; }

        /* ORB */
        .postman-orb { width: 140px; height: 140px; position: relative; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .orb-inner { width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #2a2a2a, #111); border: 1px solid #333; display: flex; align-items: center; justify-content: center; z-index: 5; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transition: 0.3s; color: #666; }
        .orb-ripple { position: absolute; border-radius: 50%; border: 1px solid var(--pm-orange); opacity: 0; width: 100%; height: 100%; transition: 0.3s; }

        /* ORB STATES */
        .postman-orb.listening .orb-inner { border-color: var(--pm-orange); color: var(--pm-orange); background: radial-gradient(circle, rgba(255, 108, 55, 0.1) 0%, #111 70%); }
        .postman-orb.listening .orb-ripple { animation: ripple 1.5s infinite; opacity: 1; }
        
        .postman-orb.thinking .orb-inner { border-color: #fff; color: #fff; }
        .postman-orb.thinking .orb-ripple { border-color: #fff; animation: spin 1s linear infinite; border-style: dashed; opacity: 1; }
        
        .postman-orb.speaking .orb-inner { transform: scale(1.05); border-color: var(--green); color: var(--green); }
        .postman-orb.speaking .orb-ripple { border-color: var(--green); animation: wave 1s infinite; opacity: 0.6; }

        .orb-status { font-family: monospace; color: var(--text-muted); font-size: 12px; letter-spacing: 1px; }

        /* TRANSCRIPT CARD */
        .transcript-card { width: 100%; background: #1C1C1C; border: 1px solid var(--pm-border); border-radius: 6px; padding: 0; overflow: hidden; }
        .card-label { background: #222; padding: 8px 15px; font-size: 10px; color: var(--text-muted); font-weight: 700; border-bottom: 1px solid var(--pm-border); }
        .card-text { padding: 20px; font-size: 14px; line-height: 1.5; color: #ddd; min-height: 80px; font-family: monospace; }
        .dim { color: #444; }

        .hidden { display: none; }
        
        /* ANIMATIONS */
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes wave { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 0.4; } 100% { transform: scale(0.95); opacity: 0.8; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </main>
  );
}