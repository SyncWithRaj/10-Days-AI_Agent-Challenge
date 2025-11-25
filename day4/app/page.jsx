"use client";

import { useState, useRef, useEffect } from "react";
import {
  Terminal, Wifi, Cpu, Zap, Activity, Lock,
  Unlock, Globe, Database, Fingerprint, ShieldAlert, Mic, Volume2, Loader2, BookOpen, GraduationCap, BrainCircuit
} from "lucide-react";

// --- UTILS ---
const generateHex = (length) => {
  let result = '';
  const characters = '0123456789ABCDEF';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// --- COMPONENT: DECRYPT TEXT ---
const DecryptText = ({ text, speed = 50 }) => {
  const [display, setDisplay] = useState("");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";
  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(
        text.split("").map((letter, index) => {
          if (index < iteration) return text[index];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join("")
      );
      if (iteration >= text.length) clearInterval(interval);
      iteration += 1 / 3;
    }, speed);
    return () => clearInterval(interval);
  }, [text]);
  return <span>{display}</span>;
};

// --- COMPONENT: FREQUENCY WING ---
const FrequencyWing = ({ active, color, reverse = false }) => {
  return (
    <div className={`freq-wing ${reverse ? 'reverse' : ''}`}>
      {[...Array(15)].map((_, i) => (
        <div key={i} className="freq-bar" style={{
            backgroundColor: active ? color : '#1a1a1a',
            boxShadow: active ? `0 0 15px ${color}` : 'none',
            height: active ? `${Math.random() * 90 + 10}%` : '10%',
            maxHeight: `${100 - (i * 5)}%`,
            transition: 'height 0.08s ease, background-color 0.2s',
            opacity: active ? 1 : 0.4
          }}></div>
      ))}
    </div>
  );
};

// --- COMPONENT: TUTOR MONITOR ---
const TutorMonitor = ({ context }) => {
  const getModeColor = () => {
      if (context.mode === 'LEARN') return '#00f3ff'; // Cyan
      if (context.mode === 'QUIZ') return '#ffee00'; // Yellow
      if (context.mode === 'TEACH_BACK') return '#ff0055'; // Red/Pink
      return '#fff';
  };

  const getPersona = () => {
      if (context.mode === 'LEARN') return 'MATTHEW [INSTRUCTOR]';
      if (context.mode === 'QUIZ') return 'ALICIA [EXAMINER]';
      if (context.mode === 'TEACH_BACK') return 'KEN [EVALUATOR]';
      return 'STANDBY';
  };

  return (
    <div className="hex-panel">
      <div className="panel-header"><GraduationCap size={12} /> ACTIVE_MODULE</div>
      <div className="order-content">
        
        <div className="metric-row">
            <div className="metric-label">CURRENT_MODE</div>
            <div className="mode-display" style={{ color: getModeColor(), borderColor: getModeColor() }}>
                {context.mode || "IDLE"}
            </div>
        </div>

        <div className="order-row">
            <span className="field-label">AI_PERSONA:</span>
            <span className="field-value">{getPersona()}</span>
        </div>

        <div className="order-row">
            <span className="field-label">SUBJECT:</span>
            <span className="field-value cyan">{context.topic ? context.topic.toUpperCase() : "SELECTING..."}</span>
        </div>

        <div className="order-row extras">
          <span className="field-label">AVAILABLE_MODES:</span>
          <div className="goals-list">
             <div className="goal-item" style={{color: '#00f3ff'}}>{">>"} LEARN (Concepts)</div>
             <div className="goal-item" style={{color: '#ffee00'}}>{">>"} QUIZ (Test)</div>
             <div className="goal-item" style={{color: '#ff0055'}}>{">>"} TEACH_BACK (Recall)</div>
          </div>
        </div>

      </div>
    </div>
  );
};

// --- COMPONENT: TYPEWRITER ---
const HackerTypewriter = ({ text = "", onComplete }) => { 
  const [display, setDisplay] = useState("");
  useEffect(() => {
    if (!text) return; 
    let i = 0;
    const timer = setInterval(() => {
      setDisplay(text.slice(0, i) + "█");
      i++;
      if (i > text.length) { clearInterval(timer); setDisplay(text); if (onComplete) onComplete(); }
    }, 15);
    return () => clearInterval(timer);
  }, [text, onComplete]);
  return <span className="cmd-output">{display}</span>;
};

export default function Home() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [audioUrl, setAudioUrl] = useState(null);

  const [tutorContext, setTutorContext] = useState({
    mode: "LEARN",
    topic: "INTRODUCTION"
  });

  const [currentTime, setCurrentTime] = useState("00:00:00");
  const [ramUsage, setRamUsage] = useState(14);
  const [cpuGraphData, setCpuGraphData] = useState(Array(10).fill(10));

  const recorder = useRef(null);
  const chunks = useRef([]);
  const audioRef = useRef(null);
  const consoleEndRef = useRef(null);
  const sessionActiveRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => { consoleEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, transcribing, processing]);
  useEffect(() => { if (audioUrl && audioRef.current && sessionActiveRef.current) audioRef.current.play().catch(e => console.error(e)); }, [audioUrl]);

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
      setRamUsage(Math.floor(Math.random() * 30) + 20);
      setCpuGraphData(Array(10).fill(0).map(() => Math.random() * 80 + 10));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const setupSilenceDetection = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastSpeakingTime = Date.now();
    const detect = () => {
      if (!sessionActiveRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0; for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const average = sum / bufferLength;
      if (average > 15) lastSpeakingTime = Date.now();
      else if (Date.now() - lastSpeakingTime > 1500) { stopRecording(); return; }
      animationFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  const startRecording = async () => {
    if (!sessionActiveRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      chunks.current = [];
      mediaRecorder.ondataavailable = (e) => chunks.current.push(e.data);
      mediaRecorder.onstop = async () => {
        if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
        cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach((t) => t.stop());
        if (!sessionActiveRef.current) return;
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (blob.size > 0) {
          setMessages(p => [...p, { type: 'info', text: ">> ANALYZING_INPUT..." }]);
          await processAudioPipeline(blob);
        }
      };
      mediaRecorder.start();
      setRecording(true);
      setupSilenceDetection(stream);
    } catch (err) { alert("MIC ERROR"); handleEndSession(); }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") { recorder.current.stop(); setRecording(false); }
  };

  const processAudioPipeline = async (blob) => {
    setTranscribing(true);
    try {
      const ab = await blob.arrayBuffer();
      if (!sessionActiveRef.current) return;
      const transRes = await fetch("/api/transcribe", { method: "POST", body: ab });
      if (!sessionActiveRef.current) return;
      const transData = await transRes.json();
      setMessages(p => p.filter(m => m.type !== 'info'));
      setTranscribing(false);

      if (transData.error || !transData.transcript.trim()) {
        if (sessionActiveRef.current) setTimeout(() => startRecording(), 100);
        return;
      }

      setMessages(p => [...p, { type: 'user', text: transData.transcript }]);
      setProcessing(true);

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transData.transcript, currentContext: tutorContext }),
      });

      if (!sessionActiveRef.current) return;
      const genData = await genRes.json();
      setProcessing(false);

      if (genData.newContext) setTutorContext(genData.newContext);

      setMessages(p => [...p, { type: 'ai', text: genData.reply }]);
      if (sessionActiveRef.current) setAudioUrl(genData.audio);

    } catch (err) { setTranscribing(false); setProcessing(false); }
  };

  const handleStartSession = () => {
    setIsSessionActive(true);
    sessionActiveRef.current = true;
    setTutorContext({ mode: "LEARN", topic: "INTRODUCTION" });
    setMessages([{ type: 'system', text: "LOADING KNOWLEDGE CORE v4.0..." }]);
    startRecording();
  };

  const handleEndSession = () => {
    setIsSessionActive(false);
    sessionActiveRef.current = false;
    stopRecording();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
    cancelAnimationFrame(animationFrameRef.current);
    setAudioUrl(null);
    setProcessing(false);
    setTranscribing(false);
  };

  const handleAudioEnded = () => {
    if (sessionActiveRef.current) setTimeout(() => startRecording(), 300);
  };

  const isSpeaking = audioUrl && !recording && !processing && !transcribing;

  return (
    <main className="crt-wrapper">
      <div className="screen-layer">
        <div className="matrix-bg"></div>
        <div className="top-bar">
          <div className="bar-group"><Terminal size={14} className="icon-pulse" /> <span className="term-title">NEXUS // TUTOR_CORE</span></div>
          <div className="bar-group center">
            {isSessionActive ? <span className="secure">SYSTEM_ONLINE</span> : <span className="offline">OFFLINE</span>}
            {isSessionActive ? <Lock size={12} color="#0f0" /> : <Unlock size={12} color="#f00" />}
          </div>
          <div className="bar-group right"><Activity size={14} /> {currentTime}</div>
        </div>

        <div className="main-grid">
          <div className="side-panel left">
            <div className="panel-box">
              <div className="panel-header"><BrainCircuit size={12} /> COGNITIVE_LOAD</div>
              <div className="graph-container">
                {cpuGraphData.map((h, i) => <div key={i} className="bar" style={{ height: `${h}%`, opacity: i < 8 ? 1 : 0.3 }}></div>)}
              </div>
              <div className="stat-row"><span>SYNAPSE_RATE</span><span className="val">{ramUsage}%</span></div>
            </div>
            <div className="panel-box globe-box">
              <div className="panel-header"><Globe size={12} /> ACADEMY_LOC</div>
              <div className="wireframe-globe"></div>
              <div className="geo-text">VIRTUAL_CAMPUS<br />NODE_01</div>
            </div>
          </div>

          <div className="terminal-window">
            <div className="terminal-header">
              <div className="traffic-lights"><div className="l red"></div><div className="l yellow"></div><div className="l green"></div></div>
              <div className="tab active">/bin/tutor_bot</div>
            </div>
            <div className="terminal-body">
              {!isSessionActive && (
                // ✅ UPDATED ASCII ART: CLEAR NEXUS LOGO
                <div className="ascii-art">
                  {`
  _   _  _______  __   __  _   _   _____ 
 | \\ | ||  _____| \\ \\ / / | | | | / ____|
 |  \\| || |__      \\ V /  | | | |( (___  
 | . \` ||  __|      > <   | | | | \\___ \\ 
 | |\\  || |____    / . \\  | |_| | ____) |
 |_| \\_||______|  /_/ \\_\\  \\___/ |_____/ 
`}
                  <div className="intro-text"><br /><DecryptText text=">> INITIALIZE LEARNING PROTOCOL..." /></div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`log-line ${msg.type}`}>
                  <span className="prompt">{msg.type === 'user' ? 'student@smarty:~$ ' : msg.type === 'ai' ? 'nexus@tutor:~$ ' : 'sys:~$ '}</span>
                  {msg.type === 'ai' ? <HackerTypewriter text={msg.text} /> : <span className="msg-text">{msg.text}</span>}
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>

          <div className="side-panel right">
            <div className="panel-box">
              <div className="panel-header"><Fingerprint size={12} /> STUDENT_ID</div>
              <div className="auth-key">ID: <span className="blur">SMARTY-EDU</span></div>
            </div>
            <TutorMonitor context={tutorContext} />
          </div>
        </div>

        <div className="control-deck">
          <div className="deck-wing left"><div className="wing-label"><Mic size={12} /> STUDENT</div><FrequencyWing active={recording} color="#00f3ff" reverse={true} /></div>
          <div className="deck-center">
            {!isSessionActive && (<button className="main-button start" onClick={handleStartSession}><div className="btn-content"><BookOpen size={24} /><span>START_CLASS</span></div><div className="btn-ring"></div></button>)}
            {isSessionActive && (<div className="active-controls"><button className={`main-button active ${recording ? 'recording' : ''}`} onClick={stopRecording} disabled={!recording}><div className="btn-content">{recording ? <><div className="rec-dot"></div><span>LISTENING</span></> : <><Loader2 size={24} className="spin" /><span>THINKING</span></>}</div><div className="btn-ring"></div></button><button className="abort-btn" onClick={handleEndSession}><ShieldAlert size={16} /> EXIT</button></div>)}
          </div>
          <div className="deck-wing right"><div className="wing-label"><Volume2 size={12} /> TUTOR</div><FrequencyWing active={isSpeaking} color="#bd00ff" reverse={false} /></div>
        </div>
      </div>
      <div className="scanlines"></div><div className="vignette"></div><audio ref={audioRef} src={audioUrl} onEnded={handleAudioEnded} className="hidden-audio" />
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;500;700&display=swap');
        :root { --g: #00ff41; --d: #0d0208; --dim: #003b00; --err: #ff0033; --cyan: #00ffff; --purp: #bd00ff; --yel: #ffee00; }
        body { margin: 0; background: #000; overflow: hidden; font-family: 'Fira Code', monospace; color: var(--g); }
        .crt-wrapper { height: 100vh; width: 100vw; background: #000; position: relative; overflow: hidden; }
        .screen-layer { height: 100%; width: 100%; background: radial-gradient(circle at center, #111 0%, #000 100%); display: flex; flex-direction: column; position: relative; z-index: 2; transform: scale(0.99); }
        .scanlines { position: fixed; inset: 0; pointer-events: none; z-index: 10; background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2)); background-size: 100% 4px; animation: scan 10s linear infinite; }
        .vignette { position: fixed; inset: 0; pointer-events: none; z-index: 11; background: radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 100%); box-shadow: inset 0 0 100px rgba(0,0,0,0.9); }
        .top-bar { height: 35px; border-bottom: 1px solid var(--dim); display: flex; justify-content: space-between; align-items: center; padding: 0 20px; background: rgba(0, 20, 0, 0.5); font-size: 12px; text-shadow: 0 0 5px var(--g); }
        .bar-group { display: flex; align-items: center; gap: 10px; }
        .secure { color: var(--g); } .offline { color: var(--err); }
        .main-grid { flex: 1; display: flex; padding: 20px; gap: 20px; overflow: hidden; }
        .side-panel { width: 250px; display: flex; flex-direction: column; gap: 20px; display: none; }
        @media (min-width: 1024px) { .side-panel { display: flex; } }
        .panel-box { border: 1px solid var(--dim); background: rgba(0,10,0,0.6); padding: 10px; position: relative; }
        .panel-header { font-size: 11px; font-weight: bold; color: var(--g); border-bottom: 1px solid var(--dim); padding-bottom: 5px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .graph-container { height: 60px; display: flex; align-items: flex-end; gap: 2px; margin-bottom: 5px; }
        .graph-container .bar { width: 100%; background: var(--g); opacity: 0.5; transition: height 0.2s; }
        .stat-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
        .stat-row .val { color: #fff; }
        .wireframe-globe { width: 80px; height: 80px; border-radius: 50%; margin: 10px auto; border: 1px dashed var(--g); background: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,255,65,0.1) 5px, rgba(0,255,65,0.1) 10px); animation: spin 10s linear infinite; }
        .geo-text { font-size: 10px; color: var(--cyan); text-align: center; }
        .terminal-window { flex: 1; border: 1px solid var(--dim); background: rgba(0,0,0,0.8); display: flex; flex-direction: column; box-shadow: 0 0 30px rgba(0,255,65,0.1); }
        .terminal-header { height: 30px; background: #111; border-bottom: 1px solid var(--dim); display: flex; align-items: center; padding: 0 10px; gap: 10px; }
        .traffic-lights { display: flex; gap: 5px; } .l { width: 10px; height: 10px; border-radius: 50%; } .red { background: #f55; } .yellow { background: #fb0; } .green { background: #27c93f; }
        .tab { font-size: 11px; padding: 4px 15px; color: #666; border-right: 1px solid #222; }
        .tab.active { background: #222; color: var(--g); }
        .terminal-body { flex: 1; padding: 20px; overflow-y: auto; font-size: 18px; line-height: 1.8; scrollbar-width: none; }
        .ascii-art { color: var(--g); font-weight: bold; font-size: 12px; white-space: pre; opacity: 0.8; text-shadow: 0 0 5px var(--g); }
        .log-line { margin-bottom: 12px; word-wrap: break-word; font-weight: 500; }
        .log-line.user .prompt { color: var(--cyan); } .log-line.ai .prompt { color: var(--purp); } .log-line.user .msg-text { color: #fff; } .log-line.ai .msg-text { color: var(--g); }
        .hex-panel { height: 100%; display: flex; flex-direction: column; border: 1px solid var(--dim); background: rgba(0,10,0,0.6); padding: 10px; }
        .order-content { flex: 1; display: flex; flex-direction: column; gap: 10px; padding-top: 10px; }
        .metric-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 5px; }
        .metric-label { font-size: 10px; color: #fff; }
        .mode-display { border: 1px solid; padding: 5px; text-align: center; font-weight: bold; letter-spacing: 2px; }
        .order-row { display: flex; justify-content: space-between; border-bottom: 1px dashed #222; padding-bottom: 5px; font-size: 12px; }
        .field-label { color: #666; } .field-value { color: #fff; display: flex; align-items: center; gap: 5px; }
        .field-value.cyan { color: var(--cyan); }
        .filled .field-value { color: var(--cyan); text-shadow: 0 0 5px var(--cyan); }
        .auth-key { font-size: 10px; margin-bottom: 5px; } .blur { filter: blur(2px); }
        .goals-list { display: flex; flex-direction: column; gap: 2px; width: 100%; }
        .goal-item { font-size: 10px; border-left: 2px solid var(--g); padding-left: 5px; margin-top: 2px; }
        .control-deck { height: 140px; border-top: 1px solid var(--dim); display: flex; align-items: center; justify-content: center; background: rgba(0,20,0,0.2); position: relative; padding: 0 20px; }
        .deck-wing { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 20px; }
        .deck-wing.left { align-items: flex-end; padding-right: 20px; }
        .deck-wing.right { align-items: flex-start; padding-left: 20px; }
        .wing-label { font-size: 10px; color: #666; margin-bottom: 5px; display: flex; align-items: center; gap: 5px; }
        .freq-wing { display: flex; align-items: flex-end; gap: 6px; height: 70px; }
        .freq-wing.reverse { flex-direction: row-reverse; }
        .freq-bar { width: 12px; background: #333; border-radius: 2px 2px 0 0; }
        .deck-center { width: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 20; }
        .main-button { width: 100px; height: 100px; border-radius: 50%; background: #000; border: 2px solid var(--g); color: var(--g); position: relative; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; box-shadow: 0 0 20px rgba(0,255,65,0.2); }
        .main-button:hover { box-shadow: 0 0 40px rgba(0,255,65,0.4); transform: scale(1.05); }
        .main-button .btn-content { z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 10px; font-weight: bold; letter-spacing: 1px; }
        .main-button.active { border-color: var(--cyan); color: var(--cyan); box-shadow: 0 0 30px rgba(0,255,255,0.2); }
        .main-button.recording { border-color: var(--err); color: var(--err); box-shadow: 0 0 50px rgba(255,0,51,0.4); animation: pulse-red 1.5s infinite; }
        .rec-dot { width: 12px; height: 12px; background: var(--err); border-radius: 50%; box-shadow: 0 0 10px var(--err); }
        .btn-ring { position: absolute; inset: -10px; border-radius: 50%; border: 1px dashed rgba(255,255,255,0.2); animation: spin 10s linear infinite; }
        .active-controls { display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .abort-btn { background: transparent; border: 1px solid #333; color: #555; font-size: 10px; padding: 5px 15px; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: 0.2s; }
        .abort-btn:hover { border-color: var(--err); color: var(--err); }
        @keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 var(--err); } 50% { box-shadow: 0 0 30px var(--err); } 100% { box-shadow: 0 0 0 var(--err); } }
        .blink { animation: blink 1s infinite; }
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hidden-audio { display: none; }
      `}</style>
    </main>
  );
}