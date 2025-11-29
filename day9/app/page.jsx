"use client";

import { useState, useRef, useEffect } from "react";
import { 
  ShoppingBag, Mic, Volume2, Loader2, Search, ShoppingCart, CheckCircle, Package, X, Tag, Play, Power
} from "lucide-react";

export default function Home() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("Tap to Start Shopping");
  
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]); 
  const [total, setTotal] = useState(0);

  const audioRef = useRef(null);
  const recorder = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);

  const sessionActiveRef = useRef(false);
  const cartRef = useRef(cart);

  useEffect(() => { cartRef.current = cart; }, [cart]);

  useEffect(() => {
    const t = cart.reduce((acc, item) => acc + (Number(item.price) * Number(item.qty)), 0);
    setTotal(t);
  }, [cart]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.onplay = () => setSpeaking(true);
        audioRef.current.onended = () => {
            setSpeaking(false);
            if (sessionActiveRef.current) {
                setTimeout(() => startRecording(), 500);
            }
        };
    }
  }, []);

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
        let sum = 0; 
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
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
        
        if (!sessionActiveRef.current) return;

        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size > 0) await processCommand(blob);
      };

      mediaRecorder.start();
      setRecording(true);
      setTranscript("Listening...");
      setupSilenceDetection(stream);
    } catch (err) {
      console.error(err);
      setIsSessionActive(false);
    }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  };

  const processCommand = async (blob) => {
    setProcessing(true);

    try {
      const ab = await blob.arrayBuffer();
      const transRes = await fetch("/api/transcribe", { method: "POST", body: ab });
      const transData = await transRes.json();

      if (!sessionActiveRef.current) return;

      if (!transData.transcript?.trim()) {
        setProcessing(false);
        if (sessionActiveRef.current) startRecording();
        return;
      }

      setTranscript(`"${transData.transcript}"`);

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transData.transcript, cart: cartRef.current })
      });
      const genData = await genRes.json();

      if (!sessionActiveRef.current) return;

      setProcessing(false);

      if (genData.cart) setCart(genData.cart);
      if (genData.matches?.length > 0) setProducts(genData.matches);

      if (genData.audio && audioRef.current) {
        audioRef.current.src = genData.audio;
        audioRef.current.play();
      }

      if (genData.isOrderPlaced) {
        setTranscript("Order Placed Successfully.");
        setTimeout(() => {
          setCart([]);
          handleStop();
        }, 5000);
      }
    } catch (e) {
      console.error(e);
      setProcessing(false);
    }
  };

  const handleStart = () => {
    setIsSessionActive(true);
    sessionActiveRef.current = true;
    setTranscript("Connecting to StyleSync...");
    setTimeout(() => startRecording(), 1000);
  };

  const handleStop = () => {
    setIsSessionActive(false);
    sessionActiveRef.current = false;
    stopRecording();
    if (audioRef.current) audioRef.current.pause();
  };

  return (
    <main className="fashion-ui">
      
      {/* HEADER */}
      <header className="nav-header">
        <div className="logo">
            <span className="logo-icon">S</span> STYLE<span className="thin">SYNC</span>
        </div>

        <div className={`live-badge ${isSessionActive ? 'active' : ''}`}>
            <div className="dot"></div> 
            {isSessionActive ? "LIVE SESSION" : "OFFLINE"}
        </div>
      </header>

      <div className="main-layout">
         
         {/* LEFT: CATALOG */}
         <div className="catalog-section">
             <div className="section-title">
                 <h2>{products.length > 0 ? "Filtered Selection" : "New Arrivals"}</h2>
                 <span className="count">{products.length} items</span>
             </div>

             {products.length === 0 && (
                 <div className="empty-catalog">
                     <Package size={48} className="dim"/>
                     <p>Ask StyleSync to find your look.</p>
                 </div>
             )}

             <div className="product-grid">
                 {products.map((p) => (
                     <div key={p.id} className="fashion-card">
                         <div className="card-img">{p.image}</div>
                         <div className="card-details">
                             <div className="card-top">
                                 <h3>{p.name}</h3>
                                 <span className="price">₹{p.price}</span>
                             </div>
                             <div className="card-tags">
                                 <span>{p.category}</span>
                                 <span>{p.color}</span>
                             </div>
                         </div>
                     </div>
                 ))}
             </div>
         </div>

         {/* RIGHT: CART & ASSISTANT */}
         <div className="sidebar">
             
             {/* ASSISTANT */}
             <div className="assistant-card">
                 <div className={`visualizer-ring ${speaking ? "speaking" : processing ? "thinking" : recording ? "listening" : "idle"}`}>
                     {processing ? <Loader2 className="spin"/> : speaking ? <Volume2 /> : <Mic />}
                 </div>

                 <div className="transcript-box">{transcript}</div>

                 <div className="controls">
                     {!isSessionActive ? (
                         <button className="btn-start" onClick={handleStart}>
                           <Play size={16}/> START SHOPPING
                         </button>
                     ) : (
                         <button className="btn-stop" onClick={handleStop}>
                           <Power size={16}/> END SESSION
                         </button>
                     )}
                 </div>
             </div>

             {/* CART */}
             <div className="cart-widget">
                 <div className="cart-header">
                     <ShoppingBag size={16} /> YOUR BAG
                 </div>

                 <div className="cart-list">
                     {cart.length === 0 ? (
                         <p className="empty-text">Your bag is empty.</p>
                     ) : (
                         cart.map((item, i) => (
                             <div key={i} className="cart-item">
                                 <div className="item-left">
                                     <span className="item-qty">x{item.qty}</span>
                                     <span className="item-name">{item.name}</span>
                                 </div>
                                 <span className="item-price">₹{item.price * item.qty}</span>
                             </div>
                         ))
                     )}
                 </div>

                 <div className="cart-total">
                     <span>TOTAL</span>
                     <span className="total-price">₹{total}</span>
                 </div>
             </div>

         </div>

      </div>

      <audio ref={audioRef} className="hidden" />

      {/* GLOBAL + RESPONSIVE STYLES */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato:wght@300;400;700&display=swap');

        :root {
            --bg: #f8f8f8;
            --black: #111;
            --gray: #f0f0f0;
            --text: #333;
            --accent: #d4af37;
        }

        body {
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font-family: 'Lato', sans-serif;
          overflow: hidden;
        }

        .hidden { display: none; }
        .fashion-ui { height: 100vh; display: flex; flex-direction: column; }

        /* HEADER */
        .nav-header {
          height: 80px;
          padding: 0 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
          border-bottom: 1px solid #eee;
        }

        .logo {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon {
          background: var(--black);
          color: #fff;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          border-radius: 50%;
        }

        .thin { font-weight: 400; }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          letter-spacing: 1px;
          font-weight: 700;
          color: #999;
        }

        .live-badge.active { color: var(--black); }
        .dot { width: 6px; height: 6px; background: #ccc; border-radius: 50%; }
        .active .dot { background: #10b981; box-shadow: 0 0 10px #10b981; animation: pulse 2s infinite; }

        /* MAIN */
        .main-layout { flex: 1; display: flex; overflow: hidden; }

        /* CATALOG */
        .catalog-section {
          flex: 1;
          padding: 40px 60px;
          overflow-y: auto;
        }

        .section-title {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 30px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 15px;
        }

        h2 {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 400;
          margin: 0;
        }

        .count { color: #888; font-size: 14px; }

        .empty-catalog {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: #aaa;
          gap: 15px;
        }

        .dim { opacity: 0.2; }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 30px;
        }

        .fashion-card {
          background: #fff;
          padding: 20px;
          transition: 0.3s;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .fashion-card:hover {
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          transform: translateY(-5px);
          border-color: #eee;
        }

        .card-img {
          font-size: 64px;
          text-align: center;
          margin-bottom: 20px;
          background: #fafafa;
          padding: 30px;
        }

        .card-details h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 5px 0;
          color: var(--black);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .price { color: #666; }

        .card-tags {
          display: flex;
          gap: 10px;
          margin-top: 10px;
          font-size: 10px;
          text-transform: uppercase;
          color: #999;
        }

        /* SIDEBAR */
        .sidebar {
          width: 400px;
          background: #fff;
          border-left: 1px solid #eee;
          display: flex;
          flex-direction: column;
        }

        .assistant-card {
          height: 250px;
          background: var(--black);
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          gap: 20px;
          text-align: center;
        }

        .visualizer-ring {
          width: 70px;
          height: 70px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.3s;
        }

        .visualizer-ring.speaking {
          border-color: var(--accent);
          color: var(--accent);
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(212,175,55,0.3);
        }

        .visualizer-ring.listening {
          border-color: #fff;
          animation: pulse 1.5s infinite;
        }

        .transcript-box {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          min-height: 50px;
        }

        .btn-start {
          background: #fff;
          color: #000;
          border: none;
          padding: 12px 30px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-start:hover { background: var(--accent); color: #fff; }

        .btn-stop {
          background: transparent;
          border: 1px solid #fff;
          color: #fff;
          padding: 12px 30px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cart-widget {
          flex: 1;
          padding: 30px;
          display: flex;
          flex-direction: column;
        }

        .cart-header {
          font-size: 12px;
          letter-spacing: 2px;
          font-weight: 700;
          border-bottom: 1px solid #eee;
          padding-bottom: 15px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cart-list { flex: 1; overflow-y: auto; }

        .cart-item {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          margin-bottom: 15px;
        }

        .item-qty { font-weight: 700; margin-right: 10px; color: var(--accent); }

        .cart-total {
          margin-top: auto;
          border-top: 1px solid #eee;
          padding-top: 20px;
          display: flex;
          justify-content: space-between;
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 700;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 50% { opacity: 0.5; transform: scale(1.05); } }

        /* ----------------------------------------------------
           RESPONSIVE DESIGN STARTS HERE  
        ---------------------------------------------------- */

        /* Tablets / Small Laptops */
        @media (max-width: 1100px) {
          .nav-header { padding: 0 30px; }
          .catalog-section { padding: 30px; }
          .sidebar { width: 320px; }
        }

        /* Mobile Layout */
        @media (max-width: 900px) {
          body { overflow: auto; }

          .main-layout {
            flex-direction: column;
            height: auto;
          }

          .sidebar {
            width: 100%;
            border-left: none;
            border-top: 1px solid #eee;
          }

          .assistant-card {
            height: auto;
            padding: 20px;
          }

          .catalog-section {
            padding: 20px;
          }

          .product-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 20px;
          }

          .nav-header {
            padding: 0 20px;
          }
        }

        /* Phones */
        @media (max-width: 600px) {
          .logo { font-size: 20px; }
          h2 { font-size: 26px; }
          .assistant-card { padding: 15px; }
          .visualizer-ring { width: 60px; height: 60px; }
          .transcript-box { font-size: 16px; }

          .product-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }

          .fashion-card { padding: 15px; }
          .card-img { padding: 20px; font-size: 48px; }
        }

        /* Small Phones */
        @media (max-width: 400px) {
          .product-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .btn-start,
          .btn-stop {
            padding: 10px 20px;
          }
        }

      `}</style>
    </main>
  );
}
