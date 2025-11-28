"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Radio, Flashlight, Heart, Zap, Map, Backpack, Skull, Mic, Volume2, Loader2, Play, X, Ghost, Bike, BrainCircuit
} from "lucide-react";

export default function Home() {
  const [isActive, setIsActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [eventFX, setEventFX] = useState("NONE"); 
  
  const [userBubble, setUserBubble] = useState("");
  const [gmBubble, setGmBubble] = useState("");

  const [gameState, setGameState] = useState({
    player: { name: "Will", hp: 100, max_hp: 100, sanity: 100, inventory: ["Flashlight"] },
    location: { name: "Hawkins", description: "A quiet town." },
    game_log: ["Initializing..."]
  });

  const audioRef = useRef(null);
  const recorder = useRef(null);
  const gameStateRef = useRef(gameState);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [gameState.game_log]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.onplay = () => setSpeaking(true);
        audioRef.current.onended = () => {
            setSpeaking(false);
            setEventFX("NONE");
            setUserBubble("");
            if (isActive && gameState.player.hp > 0) setTimeout(() => startRecording(), 500);
        };
    }
  }, [isActive, gameState.player.hp]);

  const setupSilenceDetection = (stream) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaStreamSource(stream);
    analyser.fftSize = 512;
    source.connect(analyser);
    audioContextRef.current = ctx;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastSound = Date.now();
    const detect = () => {
        if (!recorder.current || recorder.current.state !== "recording") return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0; for(let i=0; i<dataArray.length; i++) sum+=dataArray[i];
        const volume = sum / dataArray.length;
        if (volume > 15) lastSound = Date.now();
        else if (Date.now() - lastSound > 1500) { stopRecording(); return; }
        animationFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  const startRecording = async () => {
    if (gameState.player.hp <= 0) return; 
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
        if (blob.size > 0) await processTurn(blob);
      };
      mediaRecorder.start();
      setRecording(true);
      setUserBubble("Listening...");
      setupSilenceDetection(stream);
    } catch (err) { console.error(err); setIsActive(false); }
  };

  const stopRecording = () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      setRecording(false);
  };

  const processTurn = async (blob) => {
    setProcessing(true);
    setUserBubble("Thinking...");
    try {
        const ab = await blob.arrayBuffer();
        const transRes = await fetch("/api/transcribe", { method: "POST", body: ab });
        const transData = await transRes.json();
        
        if (!transData.transcript?.trim()) {
            setProcessing(false);
            if (isActive) startRecording();
            return;
        }
        setUserBubble(transData.transcript);

        const genRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transData.transcript, gameState: gameStateRef.current })
        });
        const genData = await genRes.json();
        
        setProcessing(false);
        
        if (genData.updatedState) {
            const newLog = [...gameStateRef.current.game_log, `> ${transData.transcript}`, genData.reply];
            setGameState({ ...genData.updatedState, game_log: newLog });
        }
        
        setGmBubble(genData.reply);
        if (genData.event) setEventFX(genData.event);

        if (genData.audio && audioRef.current) {
            audioRef.current.src = genData.audio;
            audioRef.current.play();
        }
    } catch (e) { console.error(e); setProcessing(false); }
  };

  const startGame = () => {
      setIsActive(true);
      setGameState({
        player: { name: "Will", hp: 100, max_hp: 100, sanity: 100, inventory: ["Flashlight"] },
        location: { name: "Hawkins", description: "A quiet town." },
        game_log: ["Initializing..."]
      });
      setProcessing(true);
      setTimeout(() => {
          const introAudio = async () => {
              const res = await fetch("/api/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: "START_ADVENTURE", gameState: { player: { name: "Will" }, location: { name: "Start" }, game_log: [] } }) 
              });
              const d = await res.json();
              setGmBubble(d.reply);
              if(d.audio && audioRef.current) {
                  audioRef.current.src = d.audio;
                  audioRef.current.play();
              }
              setProcessing(false);
          };
          introAudio();
      }, 500);
  };

  return (
    <main className={`stranger-ui ${eventFX}`}>
      <div className="upside-down-particles"></div>
      <div className="scanlines"></div>
      
      <header className="retro-header">
        <div className="title-box">
            <h1>STRANGER <br/> THINGS</h1>
        </div>
        <div className="location-box">
            <Map size={16} /> {gameState.location.name}
        </div>
      </header>

      <div className="crt-screen">
         
         {/* VISUALIZER */}
         <div className="rift-container">
            <div className={`rift-core ${speaking ? "active" : processing ? "loading" : "idle"}`}>
                {processing ? <Loader2 size={64} className="spin"/> : 
                 speaking ? <Volume2 size={64} className="pulse"/> : 
                 recording ? <Mic size={64} className="glow"/> :
                 <Ghost size={64} />}
            </div>
            <div className="rift-glow"></div>
         </div>

         {/* TEXT BUBBLES */}
         <div className={`gm-text ${speaking || processing ? "show" : ""}`}>
             {processing ? "ESTABLISHING CONNECTION..." : gmBubble}
         </div>

         <div className={`player-text ${userBubble ? "show" : ""}`}>
             <span className="label">WILL:</span> {userBubble}
         </div>

      </div>

      {/* HUD FOOTER */}
      <div className="retro-hud">
         
         <div className="panel stats">
             <div className="stat-row">
                 <Heart size={14} className="text-red" fill="currentColor"/> 
                 <div className="bar-track"><div className="bar-fill hp" style={{width: `${gameState.player.hp}%`}}></div></div>
             </div>
             <div className="stat-row">
                 <BrainCircuit size={14} className="text-purple" /> 
                 <div className="bar-track"><div className="bar-fill sanity" style={{width: `${gameState.player.sanity}%`}}></div></div>
             </div>
         </div>

         <div className="panel inventory">
             <div className="inv-title">BACKPACK</div>
             <div className="inv-list">
                 {gameState.player.inventory.map((item, i) => (
                     <div key={i} className="inv-item">
                         {item.includes("Walkie") ? <Radio size={14}/> : 
                          item.includes("Light") ? <Flashlight size={14}/> : <Backpack size={14}/>}
                         {item}
                     </div>
                 ))}
             </div>
         </div>

         <div className="panel controls">
             {!isActive ? (
                 <button className="btn-start" onClick={startGame}>PLAY TAPE</button>
             ) : (
                 <div className="rec-status">
                     <div className={`rec-dot ${recording ? "on" : ""}`}></div>
                     {recording ? "REC" : "PLAY"}
                 </div>
             )}
         </div>

      </div>

      <audio ref={audioRef} className="hidden" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Benguiat&family=Courier+Prime:wght@400;700&display=swap');

        :root {
            --red: #ff0000; --bg: #050505; --glow: #ff0033; --text: #dcdcdc;
        }

        body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Courier Prime', monospace; overflow: hidden; }
        .hidden { display: none; }
        .stranger-ui { height: 100vh; display: flex; flex-direction: column; position: relative; }

        /* FX */
        .DAMAGE { animation: shake 0.4s; box-shadow: inset 0 0 100px var(--red); }
        .HEAL { box-shadow: inset 0 0 80px #00ff00; }
        .PSYCHIC { box-shadow: inset 0 0 100px #a855f7; filter: contrast(1.2) hue-rotate(20deg); }
        
        .upside-down-particles { position: absolute; inset: 0; background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.08; z-index: 0; pointer-events: none; animation: float 10s linear infinite; }
        .scanlines { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 4px; z-index: 20; pointer-events: none; opacity: 0.4; }

        /* HEADER */
        .retro-header { height: 100px; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; z-index: 10; }
        .title-box h1 { 
            font-family: 'Benguiat', serif; font-weight: 700; font-size: 42px; color: transparent;
            -webkit-text-stroke: 1px var(--red); text-shadow: 0 0 10px var(--glow); letter-spacing: 2px;
            margin: 0; line-height: 0.9;
        }
        .location-box { color: #fff; border: 1px solid #444; padding: 8px 16px; border-radius: 4px; display: flex; gap: 8px; align-items: center; font-size: 12px; text-transform: uppercase; background: #000; }

        /* CRT SCREEN */
        .crt-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; position: relative; z-index: 5; }
        
        .rift-container { position: relative; width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; }
        .rift-core { font-size: 64px; color: #444; transition: 0.3s; z-index: 2; }
        .rift-glow { position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(255,0,0,0.2) 0%, transparent 70%); transition: 0.3s; }
        
        .active { color: var(--red); transform: scale(1.2); filter: drop-shadow(0 0 20px var(--red)); animation: pulse 0.2s infinite; }
        .loading { color: #fff; animation: spin 1s linear infinite; }
        .glow { color: #00ff00; filter: drop-shadow(0 0 15px #00ff00); }

        .gm-text { max-width: 600px; text-align: center; font-size: 18px; line-height: 1.5; color: #fff; text-shadow: 0 0 5px var(--red); opacity: 0; transform: translateY(20px); transition: 0.5s; }
        .gm-text.show { opacity: 1; transform: translateY(0); }

        .player-text { color: #00ff00; font-size: 14px; background: rgba(0, 20, 0, 0.6); padding: 10px 20px; border: 1px solid #00ff00; border-radius: 20px; opacity: 0; transition: 0.2s; margin-top: 20px; }
        .player-text.show { opacity: 1; }

        /* HUD */
        .retro-hud { height: 120px; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; background: #000; border-top: 2px solid #222; z-index: 10; }
        
        .panel { flex: 1; }
        .stats { display: flex; flex-direction: column; gap: 10px; max-width: 200px; }
        .stat-row { display: flex; align-items: center; gap: 10px; }
        .bar-track { flex: 1; height: 12px; background: #222; border: 1px solid #444; }
        .bar-fill.hp { height: 100%; background: var(--red); box-shadow: 0 0 10px var(--red); transition: width 0.3s; }
        .bar-fill.sanity { height: 100%; background: #a855f7; box-shadow: 0 0 10px #a855f7; transition: width 0.3s; }

        .inventory { display: flex; flex-direction: column; align-items: center; font-size: 12px; color: #888; }
        .inv-title { border-bottom: 1px solid #444; margin-bottom: 5px; width: 100%; text-align: center; }
        .inv-list { display: flex; gap: 15px; }
        .inv-item { display: flex; align-items: center; gap: 5px; color: #fff; }

        .controls { display: flex; justify-content: flex-end; }
        .btn-start { background: transparent; border: 2px solid var(--red); color: var(--red); padding: 15px 40px; font-family: 'Courier Prime'; font-weight: 700; font-size: 18px; cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 2px; }
        .btn-start:hover { background: var(--red); color: #000; box-shadow: 0 0 20px var(--red); }
        
        .rec-status { font-size: 24px; color: #00ff00; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .rec-dot { width: 12px; height: 12px; background: #00ff00; border-radius: 50%; opacity: 0.2; }
        .rec-dot.on { opacity: 1; animation: blink 1s infinite; }

        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes pulse { 50% { transform: scale(1.1); opacity: 0.8; } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .text-red { color: var(--red); } .text-purple { color: #a855f7; }
      `}</style>
    </main>
  );
}