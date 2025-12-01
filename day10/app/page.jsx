"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  OrbitControls, Environment, SpotLight, Text, 
  Cylinder, Sphere, Box, Torus, RoundedBox, Html, Stars, Cloud
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
      <group position={[0, -4.5, 0]}> {/* Move reference to floor */}
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
// TALL PODIUM TABLE (HOST DESK)
// ==========================================
function HostDesk() {
  return (
    <group position={[-3, 0, 0.8]} rotation={[0, 0.3, 0]}>
        {/* Main Body - TALL & NARROW PODIUM */}
        <Box args={[2.0, 2.0, 1.2]} position={[0, 1.0, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#2c1a12" roughness={0.4} metalness={0.3} />
        </Box>
        {/* Top Slab */}
        <Box args={[2.2, 0.1, 1.4]} position={[0, 2.05, 0]} castShadow>
            <meshStandardMaterial color="#4e342e" roughness={0.2} />
        </Box>

        {/* --- THE BANNER (Adjusted for narrow width) --- */}
        <group position={[0, 1.2, 0.61]}>
            <mesh>
                <planeGeometry args={[1.8, 0.8]} />
                <meshStandardMaterial color="#000" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
                <boxGeometry args={[1.9, 0.9, 0.05]} />
                <meshStandardMaterial color="#ffbd59" metalness={1} roughness={0.1} />
            </mesh>
            
            <Text 
                fontSize={0.20} 
                color="#000000" 
                position={[0.15, 0, 0.02]}
                anchorX="center" 
                anchorY="middle"
                outlineWidth={0.005}
                outlineColor="#000"
                maxWidth={1.5}
                textAlign="center"
                lineHeight={1}
            >
                MURF'S GOT LATENT
            </Text>

            {/* 3D Mic Logo on Banner */}
            <group position={[-0.7, 0, 0.1]} rotation={[0, 0, -0.2]}>
                <Sphere args={[0.12]} position={[0, 0.15, 0]}><meshStandardMaterial color="#ef4444" metalness={0.5} /></Sphere>
                <Cylinder args={[0.04, 0.03, 0.25]} position={[0, -0.1, 0]}><meshStandardMaterial color="#000000" metalness={1} /></Cylinder>
            </group>
        </group>

        {/* -- TABLE ITEMS (Moved Up) -- */}
        {/* Script */}
        <Box args={[0.5, 0.05, 0.7]} position={[-0.5, 2.12, 0.2]} rotation={[0, 0.2, 0]}>
            <meshStandardMaterial color="#ffffff" />
        </Box>
        {/* Water Bottle */}
        <group position={[0.7, 2.1, 0.3]}>
            <Cylinder args={[0.08, 0.08, 0.4]} position={[0, 0.2, 0]}>
                <meshPhysicalMaterial color="#aedfff" transmission={0.9} opacity={0.8} transparent roughness={0.1} />
            </Cylinder>
            <Cylinder args={[0.08, 0.08, 0.04]} position={[0, 0.42, 0]}>
                <meshStandardMaterial color="#222" />
            </Cylinder>
        </group>
        {/* Desk Mic */}
        <group position={[0, 2.1, -0.3]} rotation={[0, 0, 0]}>
            <Cylinder args={[0.02, 0.02, 0.4]} position={[0, 0.2, 0]}><meshStandardMaterial color="#111" /></Cylinder>
            <Sphere args={[0.08]} position={[0, 0.4, 0]}><meshStandardMaterial color="#333" metalness={0.8} roughness={0.4} /></Sphere>
            <Cylinder args={[0.15, 0.15, 0.05]} position={[0, 0, 0]}><meshStandardMaterial color="#111" /></Cylinder>
        </group>
    </group>
  );
}

// ==========================================
// TALL CHARACTERS
// ==========================================
// ==========================================
// TALL HOST DROID (With Legs & Arms)
// ==========================================
function HostDroid({ position, isTalking }) {
  const group = useRef();
  
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    // Breathing motion (Body moves slightly)
    group.current.position.y = position[1] + Math.sin(t * 1.5) * 0.03;
    
    // Arm swing (Natural idle)
    const armRotation = Math.sin(t * 1.5) * 0.1;
    // We can target specific children indices if we want complex anims, 
    // but here we keep it subtle on the main group or specific parts if refs were used.
    
    if (isTalking) {
        group.current.rotation.y = Math.sin(t * 10) * 0.1;
        // Head bob (Child index 0 is the Head Group)
        group.current.children[0].position.y = 3.9 + Math.sin(t * 15) * 0.05;
    } else {
        group.current.rotation.y = 0;
        group.current.children[0].position.y = 3.9;
    }
  });

  return (
    <group ref={group} position={position}>
        {/* --- HEAD (Shifted up to Y=3.9) --- */}
        <group position={[0, 3.9, 0]}>
            <RoundedBox args={[0.7, 0.9, 0.7]} radius={0.1}>
                <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.3} />
            </RoundedBox>
            {/* Glowing Eyes */}
            <mesh position={[-0.15, 0.1, 0.36]}><circleGeometry args={[0.08]} /><meshBasicMaterial color={isTalking ? "#ffbd59" : "#333"} toneMapped={false} /></mesh>
            <mesh position={[0.15, 0.1, 0.36]}><circleGeometry args={[0.08]} /><meshBasicMaterial color={isTalking ? "#ffbd59" : "#333"} toneMapped={false} /></mesh>
        </group>

        {/* --- NECK --- */}
        <Cylinder args={[0.1, 0.1, 0.6]} position={[0, 3.3, 0]}><meshStandardMaterial color="#222" metalness={1} /></Cylinder>
        
        {/* --- TORSO --- */}
        <RoundedBox args={[0.9, 1.8, 0.5]} radius={0.1} position={[0, 2.3, 0]}>
             <meshStandardMaterial color="#c0c0c0" metalness={0.6} roughness={0.4} />
        </RoundedBox>
        
        {/* --- SHOULDERS --- */}
        <RoundedBox args={[1.5, 0.4, 0.6]} radius={0.1} position={[0, 3.1, 0]}>
             <meshStandardMaterial color="#444" metalness={0.5} />
        </RoundedBox>

        {/* --- ARMS --- */}
        {/* Left Arm */}
        <group position={[-0.85, 2.9, 0]} rotation={[0, 0, 0.1]}>
            <Cylinder args={[0.12, 0.1, 1.4]} position={[0, -0.6, 0]}><meshStandardMaterial color="#c0c0c0" metalness={0.6} /></Cylinder>
            <Sphere args={[0.15]} position={[0, -1.4, 0]}><meshStandardMaterial color="#333" /></Sphere> {/* Hand */}
        </group>
        {/* Right Arm */}
        <group position={[0.85, 2.9, 0]} rotation={[0, 0, -0.1]}>
            <Cylinder args={[0.12, 0.1, 1.4]} position={[0, -0.6, 0]}><meshStandardMaterial color="#c0c0c0" metalness={0.6} /></Cylinder>
            <Sphere args={[0.15]} position={[0, -1.4, 0]}><meshStandardMaterial color="#333" /></Sphere> {/* Hand */}
        </group>

        {/* --- LEGS --- */}
        {/* Left Leg */}
        <Cylinder args={[0.15, 0.12, 1.6]} position={[-0.25, 0.8, 0]}><meshStandardMaterial color="#333" /></Cylinder>
        {/* Right Leg */}
        <Cylinder args={[0.15, 0.12, 1.6]} position={[0.25, 0.8, 0]}><meshStandardMaterial color="#333" /></Cylinder>

        {/* --- FEET --- */}
        <Box args={[0.35, 0.15, 0.6]} position={[-0.25, 0.075, 0.15]}><meshStandardMaterial color="#111" /></Box>
        <Box args={[0.35, 0.15, 0.6]} position={[0.25, 0.075, 0.15]}><meshStandardMaterial color="#111" /></Box>
    </group>
  );
}

// ==========================================
// TALL PLAYER DROID (With Legs & Arms)
// ==========================================
function PlayerDroid({ position, isTalking }) {
  const group = useRef();
  
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.position.y = position[1] + Math.sin(t * 1.8) * 0.03;
    if (isTalking) {
        group.current.scale.setScalar(1.02);
    } else {
        group.current.scale.setScalar(1);
    }
  });

  return (
    <group ref={group} position={position}>
        {/* --- HEAD --- */}
        <Sphere args={[0.45, 32, 32]} position={[0, 3.9, 0]}>
            <meshStandardMaterial color="#ff4444" metalness={0.8} roughness={0.2} />
        </Sphere>
        {/* Visor */}
        <mesh position={[0, 3.9, 0.4]}>
            <boxGeometry args={[0.6, 0.15, 0.1]} />
            <meshBasicMaterial color={isTalking ? "#ff0000" : "#550000"} toneMapped={false} />
        </mesh>
        
        {/* --- NECK --- */}
        <Cylinder args={[0.1, 0.1, 0.6]} position={[0, 3.3, 0]}><meshStandardMaterial color="#222" metalness={1} /></Cylinder>

        {/* --- TORSO --- */}
        <Cylinder args={[0.3, 0.2, 1.8]} position={[0, 2.3, 0]}>
             <meshStandardMaterial color="#333" metalness={0.8} roughness={0.5} />
        </Cylinder>

        {/* Floating Rings */}
        <Torus args={[0.5, 0.03, 16, 32]} rotation={[Math.PI/2, 0, 0]} position={[0, 1.6, 0]}><meshBasicMaterial color="#ff0000" toneMapped={false} /></Torus>
        <Torus args={[0.5, 0.03, 16, 32]} rotation={[Math.PI/2, 0, 0]} position={[0, 3.0, 0]}><meshBasicMaterial color="#ff0000" toneMapped={false} /></Torus>

        {/* --- SHOULDERS --- */}
        <Box args={[1.2, 0.3, 0.5]} position={[0, 3.1, 0]}><meshStandardMaterial color="#500000" /></Box>

        {/* --- ARMS --- */}
        {/* Left Arm */}
        <group position={[-0.7, 2.9, 0]} rotation={[0, 0, 0.1]}>
            <Cylinder args={[0.1, 0.08, 1.3]} position={[0, -0.6, 0]}><meshStandardMaterial color="#a52a2a" /></Cylinder>
            <Sphere args={[0.12]} position={[0, -1.3, 0]}><meshStandardMaterial color="#222" /></Sphere>
        </group>
        {/* Right Arm */}
        <group position={[0.7, 2.9, 0]} rotation={[0, 0, -0.1]}>
            <Cylinder args={[0.1, 0.08, 1.3]} position={[0, -0.6, 0]}><meshStandardMaterial color="#a52a2a" /></Cylinder>
            <Sphere args={[0.12]} position={[0, -1.3, 0]}><meshStandardMaterial color="#222" /></Sphere>
        </group>

        {/* --- LEGS --- */}
        <Cylinder args={[0.14, 0.1, 1.6]} position={[-0.25, 0.8, 0]}><meshStandardMaterial color="#222" /></Cylinder>
        <Cylinder args={[0.14, 0.1, 1.6]} position={[0.25, 0.8, 0]}><meshStandardMaterial color="#222" /></Cylinder>

        {/* --- FEET --- */}
        <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} position={[-0.25, 0.075, 0.15]}><meshStandardMaterial color="#111" /></RoundedBox>
        <RoundedBox args={[0.3, 0.15, 0.5]} radius={0.05} position={[0.25, 0.075, 0.15]}><meshStandardMaterial color="#111" /></RoundedBox>
    </group>
  );
}

// ==========================================
// OPEN STAGE SCENE (OUTDOORS)
// ==========================================
function ImprovStage({ speaking, recording, scenarioText }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      
      {/* Outdoor Sun/Moon Light */}
      <directionalLight position={[10, 10, 5]} intensity={1} color="#ffdca8" castShadow />

      {/* Spotlights for Characters */}
      <SpotLight position={[-3, 10, 4]} angle={0.2} penumbra={0.2} intensity={speaking ? 1500 : 0} castShadow color="white" target-position={[-3, 1.5, 0]} />
      <SpotLight position={[3, 10, 4]} angle={0.2} penumbra={0.2} intensity={recording ? 1500 : 0} castShadow color="white" target-position={[3, 1.5, 0]} />

      {/* OPEN ENVIRONMENT: Sunset Sky */}
      <Environment preset="sunset" background blur={0.6} />
      {/* Light Fog to blend floor with horizon */}
      <fog attach="fog" args={['#202030', 10, 60]} />

      {/* STAGE FLOOR (Circular Open Stage) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[15, 64]} />
        <meshStandardMaterial 
            color="#1a1a1a" 
            roughness={0.2} 
            metalness={0.5} 
        />
      </mesh>
      
      {/* Decorative Floor Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[14.8, 0.2, 16, 100]} />
        <meshStandardMaterial color="#333" emissive="#555" emissiveIntensity={0.5} />
      </mesh>

      {/* Props & Characters */}
      <TvScreen text={scenarioText} />
      <HostDesk />

      {/* Player Mic Stand */}
      <group position={[3, 0, 0.4]} rotation={[0, -0.3, 0]}>
        {/* Pole: Taller (4.5 units) and Dark Gray (#333) */}
        <Cylinder args={[0.03, 0.03, 5]} position={[0, 1, 0]} castShadow>
            <meshStandardMaterial color="#333" metalness={0.9} />
        </Cylinder>
        {/* Base */}
        <Cylinder args={[0.6, 0.6, 0.05]} position={[0, 0.025, 0]} receiveShadow>
            <meshStandardMaterial color="#222" />
        </Cylinder>
        {/* Mic Head: Moved up to 4.5 */}
        <Sphere args={[0.18]} position={[0, 3.5, 0]}>
            <meshStandardMaterial 
                color={recording ? "#ef4444" : "#888"} 
                emissive={recording ? "#ef4444" : "#000"} 
                emissiveIntensity={2} 
            />
        </Sphere>
      </group>

      <HostDroid position={[-3, 0, -1]} isTalking={speaking} />
      <PlayerDroid position={[3, 0, -1]} isTalking={recording} />
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
        
        <audio ref={audioRef} className="hidden" />

        <style jsx global>{`
            @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Inter:wght@400;700;900&display=swap');
        `}</style>
    </main>
  );
}