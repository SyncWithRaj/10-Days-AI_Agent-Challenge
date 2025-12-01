"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  OrbitControls, Environment, SpotLight, Text, 
  Cylinder, Sphere, Box, Torus, RoundedBox, Html
} from "@react-three/drei";
import { Mic, Play, Power, Radio, Volume2, Zap } from "lucide-react";

// ==========================================
// REALISTIC TV SCREEN (WITH STAND)
// ==========================================
function TvScreen({ text }) {
  return (
    <group position={[0, 4.5, -7]}>
      {/* TV Frame */}
      <RoundedBox args={[11, 6, 0.5]} radius={0.2} position={[0, 0, -0.1]}>
        <meshStandardMaterial color="#222" metalness={0.9} roughness={0.1} />
      </RoundedBox>
      {/* Screen Surface (LED Black) */}
      <mesh position={[0, 0, 0.16]}>
        <planeGeometry args={[10.5, 5.5]} />
        <meshStandardMaterial color="#000" roughness={0.2} metalness={0.8} />
      </mesh>
      
      {/* LED Text Effect */}
      <Text 
        position={[0, 0, 0.2]} 
        fontSize={1.2} 
        color="#ffffff"
        anchorX="center" 
        anchorY="middle"
        maxWidth={9.5}
        textAlign="center"
        outlineWidth={0.02}
        outlineColor="#ff0000"
      >
        {text}
      </Text>

      {/* --- SCREEN STANDS (Legs) --- */}
      <group position={[0, -4.5, 0]}>
        {/* Left Leg */}
        <Cylinder args={[0.3, 0.3, 6]} position={[-4, 1.5, -0.2]}>
            <meshStandardMaterial color="#111" metalness={0.8} />
        </Cylinder>
        {/* Right Leg */}
        <Cylinder args={[0.3, 0.3, 6]} position={[4, 1.5, -0.2]}>
            <meshStandardMaterial color="#111" metalness={0.8} />
        </Cylinder>
        {/* Base weights */}
        <Box args={[1.5, 0.2, 1.5]} position={[-4, -1.4, -0.2]}><meshStandardMaterial color="#222" /></Box>
        <Box args={[1.5, 0.2, 1.5]} position={[4, -1.4, -0.2]}><meshStandardMaterial color="#222" /></Box>
      </group>
    </group>
  );
}

// ==========================================
// HOST DESK WITH BANNER
// ==========================================
function HostDesk() {
  return (
    <group position={[-3, 0, 0.8]} rotation={[0, 0.3, 0]}>
        {/* Main Body */}
        <Box args={[3.8, 1.1, 1.5]} position={[0, 0.55, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#2c1a12" roughness={0.4} metalness={0.3} />
        </Box>
        {/* Top Slab */}
        <Box args={[4.0, 0.1, 1.7]} position={[0, 1.15, 0]} castShadow>
            <meshStandardMaterial color="#4e342e" roughness={0.2} />
        </Box>

        {/* BANNER */}
        <group position={[0, 0.55, 0.76]}>
            <mesh>
                <planeGeometry args={[3.6, 0.9]} />
                <meshStandardMaterial color="#000" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
                <boxGeometry args={[3.7, 1.0, 0.05]} />
                <meshStandardMaterial color="#ffbd59" metalness={1} roughness={0.1} />
            </mesh>
            
            <Text 
                fontSize={0.30} 
                color="#000000" 
                position={[0.3, 0, 0.02]}
                anchorX="center" 
                anchorY="middle"
                outlineWidth={0.01}
                outlineColor="#000"
            >
                MURF'S GOT LATENT
            </Text>

            <group position={[-1.4, 0, 0.1]} rotation={[0, 0, -0.2]}>
                <Sphere args={[0.15]} position={[0, 0.15, 0]}><meshStandardMaterial color="#ef4444" metalness={0.5} /></Sphere>
                <Cylinder args={[0.05, 0.04, 0.3]} position={[0, -0.1, 0]}><meshStandardMaterial color="#000000" metalness={1} /></Cylinder>
            </group>
        </group>

        {/* Props */}
        <Box args={[0.6, 0.05, 0.8]} position={[-0.8, 1.22, 0.3]} rotation={[0, 0.2, 0]}>
            <meshStandardMaterial color="#ffffff" />
        </Box>
        <group position={[1.2, 1.2, 0.4]}>
            <Cylinder args={[0.1, 0.1, 0.5]} position={[0, 0.25, 0]}>
                <meshPhysicalMaterial color="#aedfff" transmission={0.9} opacity={0.8} transparent roughness={0.1} />
            </Cylinder>
            <Cylinder args={[0.1, 0.1, 0.05]} position={[0, 0.52, 0]}><meshStandardMaterial color="#222" /></Cylinder>
        </group>
        <group position={[0.2, 1.2, -0.2]} rotation={[0, -0.2, 0]}>
            <Cylinder args={[0.02, 0.02, 0.3]} position={[0, 0.15, 0]}><meshStandardMaterial color="#111" /></Cylinder>
            <Sphere args={[0.08]} position={[0, 0.35, 0]}><meshStandardMaterial color="#333" metalness={0.8} roughness={0.4} /></Sphere>
            <Cylinder args={[0.15, 0.15, 0.05]} position={[0, 0, 0]}><meshStandardMaterial color="#111" /></Cylinder>
        </group>
    </group>
  );
}

// ==========================================
// TALL HOST DROID (Gold/Grey)
// ==========================================
function HostDroid({ position, isTalking }) {
  const group = useRef();
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    // Breathing motion
    group.current.position.y = position[1] + Math.sin(t * 1.5) * 0.03;
    
    if (isTalking) {
        group.current.rotation.y = Math.sin(t * 10) * 0.1;
        // Head bob
        group.current.children[0].position.y = 2.4 + Math.sin(t * 15) * 0.05;
    } else {
        group.current.rotation.y = 0;
        group.current.children[0].position.y = 2.4;
    }
  });

  return (
    <group ref={group} position={position}>
        {/* Head */}
        <group position={[0, 2.4, 0]}>
            <RoundedBox args={[0.7, 0.9, 0.7]} radius={0.1}>
                <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.3} />
            </RoundedBox>
            <mesh position={[-0.15, 0.1, 0.36]}><circleGeometry args={[0.08]} /><meshBasicMaterial color={isTalking ? "#ffbd59" : "#333"} toneMapped={false} /></mesh>
            <mesh position={[0.15, 0.1, 0.36]}><circleGeometry args={[0.08]} /><meshBasicMaterial color={isTalking ? "#ffbd59" : "#333"} toneMapped={false} /></mesh>
        </group>
        {/* Neck */}
        <Cylinder args={[0.1, 0.1, 0.6]} position={[0, 1.8, 0]}><meshStandardMaterial color="#222" metalness={1} /></Cylinder>
        {/* Body */}
        <RoundedBox args={[0.9, 1.8, 0.5]} radius={0.1} position={[0, 0.8, 0]}><meshStandardMaterial color="#c0c0c0" metalness={0.6} roughness={0.4} /></RoundedBox>
        <RoundedBox args={[1.3, 0.4, 0.6]} radius={0.1} position={[0, 1.6, 0]}><meshStandardMaterial color="#444" metalness={0.5} /></RoundedBox>
    </group>
  );
}

// ==========================================
// TALL PLAYER DROID (Red Theme, Full Body)
// ==========================================
function PlayerDroid({ position, isTalking }) {
  const group = useRef();
  
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.position.y = position[1] + 0.15;
    if (isTalking) {
        group.current.scale.setScalar(1.02);
    } else {
        group.current.scale.setScalar(1);
    }
  });

  return (
    <group ref={group} position={position}>
        {/* Head */}
        <group position={[0, 2.4, 0]}>
            <RoundedBox args={[0.7, 0.9, 0.7]} radius={0.1}>
                {/* Dark Red Head */}
                <meshStandardMaterial color="#8b0000" metalness={0.6} roughness={0.3} />
            </RoundedBox>
            {/* Eyes (Glow Red when talking) */}
            <mesh position={[-0.15, 0.1, 0.36]}><circleGeometry args={[0.08]} /><meshBasicMaterial color={isTalking ? "#ff0000" : "#330000"} toneMapped={false} /></mesh>
            <mesh position={[0.15, 0.1, 0.36]}><circleGeometry args={[0.08]} /><meshBasicMaterial color={isTalking ? "#ff0000" : "#330000"} toneMapped={false} /></mesh>
        </group>
        
        {/* Neck */}
        <Cylinder args={[0.1, 0.1, 0.6]} position={[0, 1.8, 0]}><meshStandardMaterial color="#222" metalness={1} /></Cylinder>
        
        {/* Body (Reddish Brown) */}
        <RoundedBox args={[0.9, 1.8, 0.5]} radius={0.1} position={[0, 0.8, 0]}>
             <meshStandardMaterial color="#a52a2a" metalness={0.5} roughness={0.4} />
        </RoundedBox>
        
        {/* Shoulders (Darker Red) */}
        <RoundedBox args={[1.3, 0.4, 0.6]} radius={0.1} position={[0, 1.6, 0]}>
             <meshStandardMaterial color="#500000" metalness={0.5} />
        </RoundedBox>

        {/* Arms */}
        <group position={[-0.8, 1.4, 0]} rotation={[0, 0, 0.1]}>
            <Cylinder args={[0.12, 0.1, 1.4]} position={[0, -0.6, 0]}><meshStandardMaterial color="#8b4513" /></Cylinder>
            <Sphere args={[0.15]} position={[0, -1.4, 0]}><meshStandardMaterial color="#222" /></Sphere>
        </group>
        <group position={[0.8, 1.4, 0]} rotation={[0, 0, -0.1]}>
            <Cylinder args={[0.12, 0.1, 1.4]} position={[0, -0.6, 0]}><meshStandardMaterial color="#8b4513" /></Cylinder>
            <Sphere args={[0.15]} position={[0, -1.4, 0]}><meshStandardMaterial color="#222" /></Sphere>
        </group>

        {/* Legs */}
        <Cylinder args={[0.14, 0.1, 1.6]} position={[-0.25, -0.8, 0]}><meshStandardMaterial color="#222" /></Cylinder>
        <Cylinder args={[0.14, 0.1, 1.6]} position={[0.25, -0.8, 0]}><meshStandardMaterial color="#222" /></Cylinder>

        {/* Feet */}
        <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} position={[-0.25, -1.6, 0.15]}><meshStandardMaterial color="#111" /></RoundedBox>
        <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} position={[0.25, -1.6, 0.15]}><meshStandardMaterial color="#111" /></RoundedBox>
    </group>
  );
}

// ==========================================
// STAGE SCENE
// ==========================================
function ImprovStage({ speaking, recording, scenarioText }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      
      {/* Fill Lights */}
      <SpotLight position={[-6, 6, 6]} angle={0.5} penumbra={1} intensity={50} color="#ffbd59" target-position={[-3, 0.5, 0]} />
      <SpotLight position={[6, 6, 6]} angle={0.5} penumbra={1} intensity={50} color="#ff4444" target-position={[3, 0.5, 0]} />
      <SpotLight position={[0, 6, -8]} angle={1} intensity={100} color="#aaaaff" target-position={[0, 1, 0]} />

      {/* FOCUS SPOTLIGHTS */}
      <SpotLight position={[-3, 10, 4]} angle={0.2} penumbra={0.2} intensity={speaking ? 1500 : 0} castShadow color="white" target-position={[-3, 1.5, 0]} />
      <SpotLight position={[3, 10, 4]} angle={0.2} penumbra={0.2} intensity={recording ? 1500 : 0} castShadow color="white" target-position={[3, 1.5, 0]} />

      <Environment preset="sunset" background blur={0.6} />
      <fog attach="fog" args={['#202030', 10, 60]} />

      {/* STAGE FLOOR */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[15, 64]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.5} />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[14.8, 0.2, 16, 100]} />
        <meshStandardMaterial color="#333" emissive="#555" emissiveIntensity={0.5} />
      </mesh>

      <TvScreen text={scenarioText} />
      <HostDesk />

      {/* REALISTIC MIC STAND */}
      <group position={[3, 0, 0.5]} rotation={[0, -0.3, 0]}>
        <Cylinder args={[0.03, 0.03, 5]} position={[0, 1, 0]} castShadow><meshStandardMaterial color="#333" metalness={0.9} /></Cylinder>
        <Cylinder args={[0.6, 0.6, 0.05]} position={[0, 0.025, 0]} receiveShadow><meshStandardMaterial color="#222" /></Cylinder>
        <Sphere args={[0.18]} position={[0, 3.5, 0]}>
            <meshStandardMaterial 
                color={recording ? "#ef4444" : "#888"} 
                emissive={recording ? "#ef4444" : "#000"} 
                emissiveIntensity={2} 
            />
        </Sphere>
      </group>

      <group position={[0, 0, -8]}>
        <Cylinder args={[0.15, 0.15, 14]} position={[-6, 7, 0]}><meshStandardMaterial color="#222" metalness={1}/></Cylinder>
        <Cylinder args={[0.15, 0.15, 14]} position={[6, 7, 0]}><meshStandardMaterial color="#222" metalness={1}/></Cylinder>
        <Cylinder args={[0.15, 0.15, 12]} rotation={[0, 0, Math.PI/2]} position={[0, 14, 0]}><meshStandardMaterial color="#222" metalness={1}/></Cylinder>
      </group>

      <HostDroid position={[-3, 0, -1]} isTalking={speaking} />
      <PlayerDroid position={[3, 1.5, -1]} isTalking={recording} />
    </>
  );
}

// ==========================================
// MAIN PAGE
// ==========================================
export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [scenario, setScenario] = useState("MURF'S GOT LATENT 🎤");
  
  const [hostTranscript, setHostTranscript] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [gameState, setGameState] = useState({ round: 0, phase: 'start', userName: '', currentScenario: '', isGameOver: false });

  const audioRef = useRef(null);
  const clapRef = useRef(null); // Ref for Clap Sound
  const recorder = useRef(null);
  const audioContextRef = useRef(null);
  const sessionActiveRef = useRef(false);
  const gameStateRef = useRef(gameState);

  useEffect(() => { setIsClient(true); }, []);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  useEffect(() => {
    if (!isClient || !audioRef.current) return;
    audioRef.current.onplay = () => setSpeaking(true);
    audioRef.current.onended = () => {
        setSpeaking(false);
        if (sessionActiveRef.current && !gameStateRef.current.isGameOver) {
            setTimeout(() => startRecording(), 500);
        }
    };
  }, [isClient]);

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
        let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        if (sum / dataArray.length > 15) lastSound = Date.now();
        else if (Date.now() - lastSound > 1500) { stopRecording(); return; }
        requestAnimationFrame(detect);
    };
    detect();
  };

  const playClap = () => {
    if (clapRef.current) {
        clapRef.current.currentTime = 0;
        clapRef.current.play().catch(e => console.log("Clap blocked"));
    }
  };

  const startRecording = async () => {
    try {
      setUserTranscript(""); 
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
        stream.getTracks().forEach(t => t.stop());
        
        // PLAY CLAP WHEN RECORDING STOPS
        playClap();

        if (!sessionActiveRef.current) return;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size > 0) await processCommand(blob);
      };
      mediaRecorder.start();
      setRecording(true);
      setupSilenceDetection(stream);
    } catch (err) { setIsSessionActive(false); }
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
      
      setUserTranscript(transData.transcript);

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transData.transcript, gameState: gameStateRef.current })
      });
      const genData = await genRes.json();
      if (!sessionActiveRef.current) return;
      
      setProcessing(false);
      
      if (genData.subtitle) setHostTranscript(genData.subtitle);
      else if (genData.reply) setHostTranscript(genData.reply);

      if (genData.scenario) setScenario(genData.scenario);
      if (genData.gameState) setGameState(genData.gameState);
      
      if (genData.audio && audioRef.current) {
        audioRef.current.src = genData.audio;
        audioRef.current.play().catch(e => console.log(e));
      } else {
        setSpeaking(true);
        setTimeout(() => {
            setSpeaking(false);
            if (sessionActiveRef.current && !genData.gameState.isGameOver) startRecording();
        }, 3000);
      }
      
      if (genData.gameState?.isGameOver) {
        setIsSessionActive(false);
        sessionActiveRef.current = false;
      }
    } catch (e) { setProcessing(false); }
  };

  const handleStart = async () => {
    setIsSessionActive(true);
    sessionActiveRef.current = true;
    setScenario("CONNECTING...");
    setGameState({ round: 0, phase: 'start', userName: '', currentScenario: '', isGameOver: false });
    try {
        const genRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: "", gameState: { phase: 'start' } })
        });
        const genData = await genRes.json();
        if (genData.subtitle) setHostTranscript(genData.subtitle);
        if (genData.scenario) setScenario(genData.scenario);
        if (genData.gameState) setGameState(genData.gameState);
        if (genData.audio && audioRef.current) {
            audioRef.current.src = genData.audio;
            audioRef.current.play();
        }
    } catch(e) {}
  };

  const handleStop = () => {
    setIsSessionActive(false);
    sessionActiveRef.current = false;
    stopRecording();
    if (audioRef.current) audioRef.current.pause();
  };

  return (
    <main className="h-screen w-screen bg-[#050505] relative overflow-hidden font-['Inter']">
        
        {isClient && (
            <div className="absolute inset-0 z-0">
                <Canvas shadows camera={{ position: [0, 4, 14], fov: 50 }} gl={{ antialias: true, toneMappingExposure: 1.2 }}>
                    <color attach="background" args={['#050505']} />
                    <Suspense fallback={<Html center><div className="text-white text-xl tracking-widest font-bold">LOADING STAGE...</div></Html>}>
                        <ImprovStage 
                            speaking={speaking} 
                            recording={recording} 
                            scenarioText={scenario} 
                        />
                    </Suspense>
                    <OrbitControls 
                        makeDefault 
                        minPolarAngle={Math.PI / 2.5} 
                        maxPolarAngle={Math.PI / 2.1}
                        enableZoom={false}
                        enablePan={false}
                    />
                </Canvas>
            </div>
        )}

        {/* HINDI SUBTITLES OVERLAY */}
        {(speaking || (userTranscript && !recording)) && (
            <div className="absolute bottom-40 w-full flex justify-center z-20 pointer-events-none">
                <div className="w-[80%] md:w-[70%] bg-black/80 backdrop-blur-sm p-4 rounded-lg border-l-4 border-yellow-500 shadow-lg transition-all duration-300">
                    <p className="text-white text-lg md:text-2xl font-medium text-center leading-relaxed">
                        {speaking ? hostTranscript : userTranscript}
                    </p>
                </div>
            </div>
        )}

        {/* CONTROLS */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-8 z-10">
          <div className="w-full flex flex-col items-center gap-6 mb-8 pointer-events-auto">
            <div className="flex gap-6 text-sm font-bold tracking-widest bg-black/50 p-4 rounded-full backdrop-blur-sm border border-white/10">
                {recording ? <span className="text-red-500 flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full animate-ping"/> REC</span> : <span className="text-white/30 flex items-center gap-2"><Mic size={16}/></span>}
                {speaking ? <span className="text-yellow-500 flex items-center gap-2"><Volume2 size={16}/> LIVE</span> : <span className="text-white/30 flex items-center gap-2"><Volume2 size={16}/></span>}
                {processing && <span className="text-blue-400 flex items-center gap-2 animate-pulse"><Zap size={16}/></span>}
            </div>

            {!isSessionActive ? (
                <button onClick={handleStart} className="group relative bg-transparent border-2 border-yellow-400 text-yellow-400 px-12 py-4 font-black text-xl uppercase tracking-widest overflow-hidden hover:text-black transition-colors duration-300">
                    <div className="absolute inset-0 bg-yellow-400 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 -z-10"></div>
                    <span className="flex items-center gap-2"><Play fill="currentColor" /> START</span>
                </button>
            ) : (
                <button onClick={handleStop} className="group relative bg-transparent border-2 border-red-500 text-red-500 px-12 py-4 font-black text-xl uppercase tracking-widest overflow-hidden hover:text-white transition-colors duration-300">
                    <div className="absolute inset-0 bg-red-500 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 -z-10"></div>
                     <span className="flex items-center gap-2"><Power /> STOP</span>
                </button>
            )}
          </div>
        </div>
        
        {/* AUDIO FOR HOST */}
        <audio ref={audioRef} className="hidden" />
        
        {/* AUDIO FOR AUDIENCE CLAP */}
        {/* <audio ref={clapRef} src="https://www.soundjay.com/human/sounds/applause-01.mp3" className="hidden" /> */}

        <style jsx global>{`
            @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Inter:wght@400;700;900&display=swap');
        `}</style>
    </main>
  );
}