"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Mic, ShoppingBag, Utensils, ChefHat, Receipt, CheckCircle2, Loader2, Volume2, PhoneOff, Play, ShoppingCart, Pizza, Apple, Coffee
} from "lucide-react";

export default function Home() {
  // States
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("Welcome to GourmetGo.");
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);

  // Refs
  const audioRef = useRef(null);
  const recorder = useRef(null);
  const cartRef = useRef(cart); // Sync for API
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sessionActiveRef = useRef(false);

  useEffect(() => { cartRef.current = cart; }, [cart]);

  // Calculate Total
  useEffect(() => {
    const t = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    setTotal(t.toFixed(2));
  }, [cart]);

  // Audio Events
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.onplay = () => setIsSpeaking(true);
        audioRef.current.onended = () => {
            setIsSpeaking(false);
            if (sessionActiveRef.current) setTimeout(() => startRecording(), 500);
        };
    }
  }, [isSessionActive]);

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
        if (!recorder.current || recorder.current.state !== "recording" || !sessionActiveRef.current) return;
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
    if (recording || processing || isSpeaking) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size > 0) await processAudio(blob);
      };
      mediaRecorder.start();
      setRecording(true);
      setTranscript("Listening for order...");
      setupSilenceDetection(stream);
    } catch (err) { console.error(err); handleEnd(); }
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
        
        if (!transData.transcript?.trim()) {
            setProcessing(false);
            if (sessionActiveRef.current) startRecording();
            return;
        }
        setTranscript(`"${transData.transcript}"`);

        const genRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transData.transcript, currentCart: cartRef.current })
        });
        const genData = await genRes.json();
        
        setProcessing(false);
        setTranscript(genData.reply);
        
        if (genData.cart) setCart(genData.cart);

        if (genData.audio && audioRef.current) {
            audioRef.current.src = genData.audio;
            audioRef.current.play();
        }

        if (genData.isComplete) {
            setTimeout(() => { handleEnd(); }, 5000);
        }

    } catch (e) { console.error(e); setProcessing(false); }
  };

  // --- HANDLERS ---
  const handleStart = () => {
      setIsSessionActive(true);
      sessionActiveRef.current = true;
      setCart([]);
      setTranscript("Connecting to Kitchen...");
      
      // Call Init API to get the welcome audio
      processAudioPipelineMockStart();
  };

  // New function to fetch the greeting audio
  const processAudioPipelineMockStart = async () => {
      try {
          const genRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: "INIT_SESSION", currentCart: [] })
          });
          const genData = await genRes.json();
          
          setTranscript(genData.reply);
          
          if (genData.audio && audioRef.current) {
              audioRef.current.src = genData.audio;
              audioRef.current.play();
          }
      } catch (e) {
          console.error("Init Error", e);
      }
  };

  const handleEnd = () => {
      setIsSessionActive(false);
      sessionActiveRef.current = false;
      stopRecording();
      if (audioRef.current) audioRef.current.pause();
      setTranscript("Order Placed. Bon Appétit!");
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
      }
      cancelAnimationFrame(animationFrameRef.current);
  };

  return (
    <main className="food-ui">
      {/* HEADER */}
      <header className="nav">
        <div className="brand">
            <div className="logo-circle"><ChefHat size={20} /></div>
            <span>Gourmet<span className="bold">Go</span></span>
        </div>
        <div className={`status-pill ${isSessionActive ? 'active' : ''}`}>
            {isSessionActive ? "KITCHEN OPEN" : "CLOSED"}
        </div>
      </header>

      <div className="grid-layout">
        
        {/* LEFT: RECEIPT */}
        <div className="panel receipt-panel">
            <div className="panel-head"><Receipt size={16}/> CURRENT ORDER</div>
            <div className="receipt-body">
                {cart.length === 0 ? (
                    <div className="empty-cart">
                        <ShoppingBag size={32} className="dim"/>
                        <p>Your cart is empty</p>
                    </div>
                ) : (
                    cart.map((item, i) => (
                        <div key={i} className="line-item">
                            <div className="item-info">
                                <span className="qty">x{item.qty}</span>
                                <span className="name">{item.name}</span>
                            </div>
                            {/* ✅ CHANGED TO RUPEES */}
                            <span className="price">₹{(item.price * item.qty).toFixed(2)}</span>
                        </div>
                    ))
                )}
            </div>
            <div className="receipt-footer">
                <div className="total-row">
                    <span>TOTAL</span>
                    {/* ✅ CHANGED TO RUPEES */}
                    <span>₹{total}</span>
                </div>
            </div>
        </div>

        {/* CENTER: VISUALIZER */}
        <div className="panel center-stage">
            <div className="visualizer-circle">
                <div className={`plate-ring ${isSpeaking ? "speaking" : processing ? "cooking" : ""}`}></div>
                <div className="food-icon">
                    {processing ? <Loader2 size={48} className="spin"/> : 
                     isSpeaking ? <Volume2 size={48} /> :
                     recording ? <Mic size={48} /> :
                     <Utensils size={48} />}
                </div>
            </div>

            <div className="transcript-bubble">
                {transcript}
            </div>

            <div className="controls">
                {!isSessionActive ? (
                    <button className="btn start" onClick={handleStart}><Play size={20} fill="currentColor"/> START ORDER</button>
                ) : (
                    <button className="btn stop" onClick={handleEnd}><PhoneOff size={20}/> CANCEL</button>
                )}
            </div>
        </div>

        {/* RIGHT: MENU SUGGESTIONS */}
        <div className="panel menu-panel">
             <div className="panel-head"><Pizza size={16}/> POPULAR COMBOS</div>
             <div className="menu-grid">
                <div className="menu-item"><Pizza size={24}/> <span>Pizza</span></div>
                <div className="menu-item"><ShoppingBag size={24}/> <span>Sandwich Kit</span></div>
                <div className="menu-item"><Coffee size={24}/> <span>Breakfast</span></div>
                <div className="menu-item"><Apple size={24}/> <span>Fresh Fruit</span></div>
             </div>
             <div className="promo-card">
                <span className="promo-tag">PRO TIP</span>
                <p>Try saying "I want to make a sandwich" to auto-add ingredients!</p>
             </div>
        </div>

      </div>

      <audio ref={audioRef} className="hidden" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap');
        :root { --bg: #fff8f0; --orange: #ff6b35; --dark: #2d2d2d; --green: #10b981; --shadow: rgba(0,0,0,0.05); }
        body { margin: 0; background: var(--bg); font-family: 'Poppins', sans-serif; color: var(--dark); overflow: hidden; }
        .hidden { display: none; }
        .food-ui { height: 100vh; display: flex; flex-direction: column; }

        /* NAV */
        .nav { height: 70px; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; background: #fff; border-bottom: 1px solid #eee; }
        .brand { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 600; }
        .logo-circle { background: var(--orange); color: #fff; padding: 8px; border-radius: 50%; }
        .bold { font-weight: 800; color: var(--orange); }
        .status-pill { font-size: 12px; font-weight: 700; padding: 6px 16px; background: #eee; border-radius: 20px; color: #888; }
        .status-pill.active { background: #d1fae5; color: var(--green); }

        /* GRID */
        .grid-layout { flex: 1; display: flex; padding: 30px; gap: 30px; justify-content: center; align-items: stretch; }
        .panel { background: #fff; border-radius: 24px; box-shadow: 0 10px 30px var(--shadow); display: flex; flex-direction: column; overflow: hidden; }
        
        /* RECEIPT */
        .receipt-panel { flex: 1; max-width: 350px; border: 1px solid #eee; }
        .panel-head { padding: 20px; border-bottom: 1px solid #f5f5f5; font-weight: 700; font-size: 12px; color: #888; display: flex; gap: 8px; align-items: center; }
        .receipt-body { flex: 1; padding: 20px; overflow-y: auto; }
        .empty-cart { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ccc; font-size: 14px; }
        .line-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #eee; animation: slideIn 0.3s; }
        .qty { font-weight: 700; color: var(--orange); margin-right: 10px; }
        .total-row { display: flex; justify-content: space-between; padding: 20px; font-size: 18px; font-weight: 800; background: #fafafa; }

        /* CENTER STAGE */
        .center-stage { flex: 1.5; align-items: center; justify-content: center; gap: 30px; background: transparent; box-shadow: none; }
        .visualizer-circle { width: 200px; height: 200px; position: relative; display: flex; align-items: center; justify-content: center; }
        .food-icon { font-size: 40px; color: var(--orange); z-index: 2; }
        .plate-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid #fff; background: #fff; box-shadow: 0 20px 50px rgba(255, 107, 53, 0.15); transition: 0.3s; }
        
        .plate-ring.speaking { transform: scale(1.1); border-color: var(--orange); }
        .plate-ring.cooking { border-top-color: var(--orange); animation: spin 1s infinite; }
        
        .transcript-bubble { background: #fff; padding: 20px 30px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); font-size: 16px; font-weight: 600; text-align: center; max-width: 80%; color: #444; min-height: 80px; display: flex; align-items: center; justify-content: center; }

        .btn { padding: 16px 32px; border-radius: 50px; font-weight: 800; border: none; cursor: pointer; display: flex; gap: 10px; align-items: center; transition: 0.2s; font-size: 14px; }
        .btn.start { background: var(--dark); color: #fff; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .btn.start:hover { transform: scale(1.05); }
        .btn.stop { background: #fff; border: 2px solid #eee; color: #888; }

        /* MENU PANEL */
        .menu-panel { flex: 1; max-width: 300px; padding: 20px; gap: 20px; }
        .menu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .menu-item { background: #fafafa; padding: 20px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; color: #666; transition: 0.2s; cursor: pointer; }
        .menu-item:hover { background: #fff; box-shadow: 0 5px 15px var(--shadow); color: var(--orange); }
        
        .promo-card { background: #fff3e0; padding: 20px; border-radius: 16px; font-size: 12px; color: #d97706; line-height: 1.5; }
        .promo-tag { background: #fbbf24; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 10px; margin-right: 5px; }

        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}