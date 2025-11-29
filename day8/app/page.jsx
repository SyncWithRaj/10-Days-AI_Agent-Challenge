"use client";

import { useState, useRef, useEffect } from "react";
// ✅ Added "Flame" to the imports below
import { 
  Sword, Shield, Heart, Zap, Map, Backpack, Skull, Mic, Volume2, Loader2, Play, X, Ghost, Sparkles, Scroll, Crown, Flame
} from "lucide-react";

export default function Home() {
  // --- STATES ---
  const [isActive, setIsActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const [eventFX, setEventFX] = useState("NONE"); // DAMAGE, HEAL, LOOT

  // Game State
  const [gameState, setGameState] = useState({
    player: { name: "Traveler", hp: 100, max_hp: 100, gold: 0, inventory: ["Rusty Sword", "Potion"] },
    location: { name: "The Void", description: "Waiting for destiny..." },
    game_log: []
  });

  // Refs
  const audioRef = useRef(null);
  const recorder = useRef(null);
  const gameStateRef = useRef(gameState);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [gameState.game_log]);

  // Audio Player
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.onplay = () => setSpeaking(true);
        audioRef.current.onended = () => {
            setSpeaking(false);
            setEventFX("NONE"); 
            if (isActive && gameState.player.hp > 0) setTimeout(() => startRecording(), 500);
        };
    }
  }, [isActive, gameState.player.hp]);

  // --- SILENCE DETECTION ---
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
        else if (Date.now() - lastSound > 1500) { 
            stopRecording(); 
            return;
        }
        animationFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  };

  // --- RECORDING ---
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
      setupSilenceDetection(stream);
    } catch (err) { console.error(err); setIsActive(false); }
  };

  const stopRecording = () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      setRecording(false);
  };

  // --- GAME LOGIC ---
  const processTurn = async (blob) => {
    setProcessing(true);
    try {
        const ab = await blob.arrayBuffer();
        const transRes = await fetch("/api/transcribe", { method: "POST", body: ab });
        const transData = await transRes.json();
        
        if (!transData.transcript?.trim()) {
            setProcessing(false);
            if (isActive) startRecording();
            return;
        }
        setLastAction(transData.transcript);

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
        player: { name: "Traveler", hp: 100, max_hp: 100, gold: 50, inventory: ["Rusty Sword", "Potion"] },
        location: { name: "The Whispering Crypt", description: "A place of shadows." },
        game_log: ["Welcome to the Whispering Crypt..."]
      });
      
      setTimeout(() => {
          const introAudio = async () => {
              const res = await fetch("/api/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: "START_ADVENTURE", gameState: { player: { name: "Hero", hp: 100 }, location: { name: "Start" }, game_log: [] } }) 
              });
              const d = await res.json();
              if(d.audio && audioRef.current) {
                  audioRef.current.src = d.audio;
                  audioRef.current.play();
              }
          };
          introAudio();
      }, 500);
  };

  return (
    <main className={`rpg-ui ${eventFX}`}>
      <div className="fx-layer"></div>
      <div className="particles"></div>
      <div className="vignette"></div>
      
      {/* HEADER HUD */}
      <header className="hud-header glass-panel">
        <div className="player-section">
            <div className="avatar-container">
                <div className={`avatar-ring ${gameState.player.hp < 30 ? 'critical' : ''}`}>
                    <Ghost size={28} className="avatar-icon"/>
                </div>
            </div>
            
            <div className="status-bars">
                <div className="name-tag">
                    <span className="char-name">{gameState.player.name}</span>
                    <span className="char-lvl text-gold">LVL 1</span>
                </div>
                <div className="bar-wrapper hp-wrapper">
                    <div className="bar-fill hp-fill" style={{width: `${(gameState.player.hp / gameState.player.max_hp) * 100}%`}}>
                        <div className="liquid-shine"></div>
                    </div>
                    <span className="bar-text">{gameState.player.hp} / {gameState.player.max_hp} HP</span>
                </div>
            </div>
        </div>

        <div className="center-logo">
            <Crown size={24} className="text-gold"/>
            <span>ELDTRITCH <span className="thin">REALMS</span></span>
        </div>

        <div className="location-section">
            <div className="location-icon-box">
                <Map size={18} />
            </div>
            <div className="location-info">
                <span className="loc-label">LOCATION</span>
                <span className="loc-name">{gameState.location.name}</span>
            </div>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <div className="main-viewport">
        
        {/* LEFT: INVENTORY */}
        <aside className="side-panel left glass-panel">
            <div className="panel-header">
                <Backpack size={16} className="text-dim"/>
                <span>SATCHEL</span>
            </div>
            
            <div className="inventory-grid">
                {gameState.player.inventory.map((item, i) => (
                    <div key={i} className="item-slot occupied" title={item}>
                        <div className="item-icon">
                            {item.toLowerCase().includes("potion") ? <Heart size={20} className="icon-potion"/> : 
                             item.toLowerCase().includes("sword") || item.toLowerCase().includes("dagger") ? <Sword size={20} className="icon-weapon"/> :
                             item.toLowerCase().includes("torch") ? <Flame size={20} className="icon-fire"/> :
                             <Shield size={20} className="icon-shield"/>}
                        </div>
                        <span className="item-name">{item}</span>
                    </div>
                ))}
                {[...Array(Math.max(0, 6 - gameState.player.inventory.length))].map((_, i) => (
                    <div key={`empty-${i}`} className="item-slot empty"></div>
                ))}
            </div>

            <div className="currency-display">
                <div className="gold-icon-outer">
                    <div className="gold-coin"></div>
                </div>
                <span className="gold-amount">{gameState.player.gold}</span>
                <span className="gold-label">GP</span>
            </div>
        </aside>

        {/* CENTER: RUNE & LOG */}
        <section className="center-stage">
            
            {/* VISUALIZER */}
            <div className="rune-container">
                <div className={`arcane-circle ${processing ? 'processing' : speaking ? 'speaking' : recording ? 'listening' : 'idle'}`}>
                    <div className="ring outer-ring"></div>
                    <div className="ring mid-ring"></div>
                    <div className="ring inner-ring"></div>
                    <div className="core-symbol">
                        {processing ? <Loader2 size={54} className="animate-spin"/> : 
                         speaking ? <Volume2 size={54} className="pulse-icon"/> : 
                         recording ? <Mic size={54} className="glow-icon"/> :
                         <Skull size={54} className="idle-icon"/>}
                    </div>
                    <div className="particles-rune"></div>
                </div>

                <div className="status-message">
                    {processing ? "COMMUNING WITH SPIRITS..." : 
                     speaking ? "THE DUNGEON MASTER SPEAKS" : 
                     recording ? "LISTENING TO YOUR FATE..." : 
                     "AWAITING COMMAND"}
                </div>
            </div>

            {/* GAME LOG */}
            <div className="narrative-log glass-panel">
                <div className="log-header-sm"><Scroll size={12}/> CHRONICLE</div>
                <div className="log-content">
                    {gameState.game_log.slice(-4).map((log, i) => (
                        <div key={i} className={`log-entry ${log.startsWith(">") ? "entry-user" : "entry-gm"}`}>
                            {log.startsWith(">") ? (
                                <>
                                    <span className="log-icon user"><Mic size={12}/></span>
                                    <p>"{log.replace("> ", "")}"</p>
                                </>
                            ) : (
                                <>
                                    <span className="log-icon gm"><Sparkles size={12}/></span>
                                    <p>{log}</p>
                                </>
                            )}
                        </div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </div>
        </section>

      </div>

      {/* FOOTER CONTROLS */}
      <div className="hud-controls">
        {!isActive ? (
            <button className="btn-epic start" onClick={startGame}>
                <span className="btn-text"><Play size={18} fill="currentColor"/> ENTER WORLD</span>
                <div className="btn-glow"></div>
            </button>
        ) : (
            <div className={`mic-visualizer ${recording ? "active" : ""}`}>
                <div className="mic-label">{recording ? "REC" : "IDLE"}</div>
                <div className="bar"></div><div className="bar"></div><div className="bar"></div><div className="bar"></div>
            </div>
        )}
      </div>

      <audio ref={audioRef} className="hidden" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=MedievalSharp&display=swap');

        :root {
            --bg-deep: #050202;
            --gold: #d4af37;
            --gold-dim: #5c4d32;
            --red-blood: #8a0b0b;
            --red-bright: #ff3333;
            --blue-magic: #4deeea;
            --glass: rgba(10, 5, 5, 0.85);
            --border-light: rgba(207, 170, 110, 0.2);
            --text-main: #e0d0b8;
            --text-dim: #8a8070;
        }

        body { margin: 0; background: var(--bg-deep); color: var(--text-main); font-family: 'MedievalSharp', cursive; overflow: hidden; }
        .hidden { display: none; }

        /* --- FX LAYERS --- */
        .rpg-ui { position: relative; height: 100vh; display: flex; flex-direction: column; z-index: 10; transition: 0.5s; background: radial-gradient(circle at center, #1a0b0b 0%, #000 100%); }
        .fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; opacity: 0; transition: opacity 0.3s; }
        
        /* Event Flashes */
        .rpg-ui.DAMAGE .fx-layer { background: radial-gradient(circle, transparent 40%, var(--red-blood) 100%); opacity: 1; animation: shake 0.4s; }
        .rpg-ui.HEAL .fx-layer { background: radial-gradient(circle, transparent 40%, rgba(50, 255, 100, 0.2) 100%); opacity: 1; }
        .rpg-ui.LOOT .fx-layer { background: radial-gradient(circle, transparent 40%, rgba(212, 175, 55, 0.2) 100%); opacity: 1; }

        .vignette { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, transparent 50%, #000 100%); z-index: 1; pointer-events: none; }
        .glass-panel { background: var(--glass); backdrop-filter: blur(8px); border: 1px solid var(--border-light); box-shadow: 0 4px 30px rgba(0,0,0,0.6); border-radius: 12px; }

        /* --- HEADER --- */
        .hud-header { height: 90px; padding: 0 40px; display: flex; justify-content: space-between; align-items: center; z-index: 20; position: relative; }
        
        .player-section { display: flex; gap: 20px; align-items: center; }
        .avatar-ring { width: 60px; height: 60px; border-radius: 50%; border: 2px solid var(--gold); display: flex; align-items: center; justify-content: center; background: #080404; box-shadow: 0 0 15px rgba(207, 170, 110, 0.3); }
        .avatar-ring.critical { border-color: var(--red-bright); animation: pulse-red 1s infinite; }

        .name-tag { display: flex; justify-content: space-between; align-items: baseline; font-family: 'Cinzel', serif; margin-bottom: 5px; }
        .char-name { font-weight: 700; color: var(--gold); font-size: 18px; letter-spacing: 1px; }
        .char-lvl { font-size: 10px; color: var(--text-dim); }

        .hp-wrapper { width: 240px; height: 16px; background: rgba(0,0,0,0.8); border: 1px solid #442222; border-radius: 4px; position: relative; overflow: hidden; }
        .hp-fill { height: 100%; background: linear-gradient(90deg, #5a0000, #cc0000); position: relative; transition: width 0.5s ease-out; box-shadow: 0 0 10px var(--red-blood); }
        .liquid-shine { position: absolute; top: 0; left: 0; width: 100%; height: 50%; background: rgba(255,255,255,0.1); }
        .bar-text { position: absolute; top: 0; width: 100%; text-align: center; font-size: 10px; font-weight: 700; line-height: 16px; color: #fff; text-shadow: 0 1px 2px #000; }

        .center-logo { display: flex; flex-direction: column; align-items: center; font-family: 'Cinzel', serif; font-size: 18px; color: var(--text-main); letter-spacing: 2px; }
        .thin { font-weight: 400; font-size: 12px; opacity: 0.7; }

        .location-section { display: flex; align-items: center; gap: 15px; padding: 10px 20px; border: 1px solid var(--border-light); border-radius: 30px; background: rgba(0,0,0,0.6); }
        .location-icon-box { color: var(--gold); }
        .location-info { display: flex; flex-direction: column; align-items: flex-end; }
        .loc-label { font-size: 8px; letter-spacing: 2px; color: var(--text-dim); }
        .loc-name { font-family: 'Cinzel', serif; font-size: 14px; color: #fff; }

        /* --- VIEWPORT --- */
        .main-viewport { flex: 1; display: flex; padding: 20px 60px; gap: 40px; overflow: hidden; justify-content: center; align-items: center; z-index: 10; }

        /* LEFT PANEL */
        .side-panel { width: 300px; padding: 20px; display: flex; flex-direction: column; height: 500px; }
        .panel-header { display: flex; align-items: center; gap: 10px; font-family: 'Cinzel', serif; color: var(--text-dim); border-bottom: 1px solid var(--border-light); padding-bottom: 15px; margin-bottom: 20px; font-size: 14px; letter-spacing: 1px; }
        
        .inventory-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; overflow-y: auto; }
        .item-slot { aspect-ratio: 1; background: rgba(0,0,0,0.4); border: 1px solid #332222; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: 0.2s; position: relative; }
        .item-slot.occupied { border-color: var(--gold-dim); cursor: help; background: radial-gradient(circle, rgba(207, 170, 110, 0.05) 0%, transparent 70%); }
        .item-slot:hover.occupied { border-color: var(--gold); box-shadow: 0 0 15px rgba(207, 170, 110, 0.1); transform: translateY(-2px); }
        
        .item-icon { margin-bottom: 5px; color: #ccc; filter: drop-shadow(0 2px 2px #000); }
        .icon-potion { color: var(--red-bright); } .icon-weapon { color: #ccc; } .icon-shield { color: var(--gold); } .icon-fire { color: #f97316; }
        .item-name { font-size: 10px; text-align: center; color: var(--text-main); line-height: 1.1; max-width: 90%; }
        
        .currency-display { margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center; gap: 10px; }
        .gold-coin { width: 14px; height: 14px; background: var(--gold); border-radius: 50%; box-shadow: 0 0 8px var(--gold); border: 1px solid #fff; }
        .gold-amount { font-family: 'Cinzel', serif; font-size: 22px; color: var(--gold); }

        /* CENTER STAGE */
        .center-stage { flex: 1; max-width: 600px; display: flex; flex-direction: column; gap: 40px; align-items: center; justify-content: center; }

        .rune-container { display: flex; flex-direction: column; align-items: center; position: relative; }
        .arcane-circle { width: 220px; height: 220px; position: relative; display: flex; align-items: center; justify-content: center; transition: 0.5s; }
        
        .ring { position: absolute; border-radius: 50%; border: 1px solid rgba(255,255,255,0.05); transition: 0.5s; }
        .outer-ring { width: 100%; height: 100%; border: 2px dashed var(--gold-dim); animation: spin 30s linear infinite; }
        .mid-ring { width: 70%; height: 70%; border: 1px solid var(--border-light); animation: spin-rev 20s linear infinite; }
        .inner-ring { width: 40%; height: 40%; border: 2px solid var(--gold); opacity: 0.5; }
        .core-symbol { z-index: 5; color: rgba(255,255,255,0.1); transition: 0.3s; }

        /* RUNE STATES */
        .arcane-circle.listening .outer-ring { border-color: var(--blue-magic); box-shadow: 0 0 20px rgba(77, 238, 234, 0.2); animation-duration: 10s; }
        .arcane-circle.listening .core-symbol { color: var(--blue-magic); transform: scale(1.1); }
        
        .arcane-circle.speaking .outer-ring { border-color: var(--gold); box-shadow: 0 0 40px rgba(207, 170, 110, 0.4); animation-duration: 5s; }
        .arcane-circle.speaking .mid-ring { border-color: var(--gold); animation-duration: 5s; }
        .arcane-circle.speaking .core-symbol { color: var(--gold); transform: scale(1.2); filter: drop-shadow(0 0 15px var(--gold)); }
        
        .arcane-circle.processing .inner-ring { border-color: #fff; animation: spin 1s linear infinite; }
        .arcane-circle.processing .core-symbol { color: #fff; }

        .status-message { margin-top: 40px; font-family: 'Cinzel', serif; letter-spacing: 4px; font-size: 12px; color: var(--text-dim); text-shadow: 0 2px 4px #000; }

        /* LOG */
        .narrative-log { width: 100%; height: 200px; padding: 20px; display: flex; flex-direction: column; position: relative; }
        .log-header-sm { font-size: 10px; color: var(--gold-dim); border-bottom: 1px solid #221111; padding-bottom: 5px; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; letter-spacing: 1px; font-weight: 700; }
        .log-content { overflow-y: auto; display: flex; flex-direction: column; gap: 12px; scrollbar-width: none; mask-image: linear-gradient(to bottom, transparent, black 10%); }
        
        .log-entry { display: flex; gap: 10px; font-size: 15px; line-height: 1.5; animation: fade-in 0.4s ease-out; }
        .log-icon { margin-top: 4px; opacity: 0.5; }
        .log-entry p { margin: 0; }
        
        .entry-user { color: var(--blue-magic); font-style: italic; justify-content: flex-end; text-align: right; }
        .entry-user .log-icon { order: 2; } .entry-user p { order: 1; }
        .entry-gm { color: var(--text-main); text-shadow: 0 1px 1px #000; }
        .entry-gm .log-icon { color: var(--gold); }

        /* CONTROLS */
        .hud-controls { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); z-index: 20; }
        
        .btn-epic { background: #000; border: 1px solid var(--gold); padding: 5px; cursor: pointer; transition: 0.3s; position: relative; overflow: hidden; border-radius: 50px; }
        .btn-epic:hover { transform: scale(1.05); box-shadow: 0 0 20px rgba(212, 175, 55, 0.3); }
        .btn-text { background: var(--gold); color: #110a0a; padding: 12px 40px; font-family: 'Cinzel', serif; font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 8px; border-radius: 45px; position: relative; z-index: 2; }
        
        .mic-visualizer { display: flex; gap: 6px; height: 24px; align-items: flex-end; background: rgba(0,0,0,0.8); padding: 10px 25px; border-radius: 30px; border: 1px solid #333; }
        .mic-label { font-size: 10px; font-weight: 700; color: var(--red-bright); margin-right: 8px; letter-spacing: 1px; display: flex; align-items: center; height: 100%; }
        .bar { width: 4px; height: 100%; background: var(--red-bright); border-radius: 2px; animation: wave 0.5s infinite alternate; }
        .bar:nth-child(2) { animation-delay: 0.1s; } .bar:nth-child(3) { animation-delay: 0.2s; }

        /* UTILS */
        .text-gold { color: var(--gold); } .text-red { color: var(--red-bright); } .text-dim { color: var(--text-dim); }
        .text-blue { color: var(--blue-magic); } .text-purple { color: var(--purple); }

        /* ANIMATIONS */
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes spin-rev { 100% { transform: rotate(-360deg); } }
        @keyframes wave { 0% { height: 30%; } 100% { height: 100%; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
        @keyframes pulse-red { 0% { box-shadow: 0 0 5px var(--red-blood); } 50% { box-shadow: 0 0 20px var(--red-bright); } 100% { box-shadow: 0 0 5px var(--red-blood); } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  );
}