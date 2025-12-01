"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { 
  OrbitControls, Environment, SpotLight, Text, 
  Float, MeshReflectorMaterial 
} from "@react-three/drei";

// --- ANIMATED CHARACTER ---
function AnimatedCharacter({ position, rotation, color, isTalking, nameTag }) {
  const ref = useRef();
  const [baseY] = useState(position[1]);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.getElapsedTime();
    
    // Idle Animation
    ref.current.position.y = baseY + Math.sin(time * 2) * 0.05;
    
    // Talking Animation
    if (isTalking) {
        ref.current.position.y += Math.sin(time * 15) * 0.08;
        ref.current.scale.setScalar(1 + Math.sin(time * 15) * 0.02);
        ref.current.material.emissive.set(color);
    } else {
        ref.current.scale.setScalar(1);
        ref.current.material.emissive.set('#000000');
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <Float speed={2} rotationIntensity={0} floatIntensity={0.5} position={[0, 2.8, 0]}>
        <Text font="/fonts/Inter-Bold.woff" fontSize={0.25} color={color} anchorY="bottom">
          {nameTag}
        </Text>
      </Float>
      
      {/* Body */}
      <mesh ref={ref} castShadow receiveShadow position={[0, 1.2, 0]}>
        <capsuleGeometry args={[0.6, 1.5, 4, 16]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.3} 
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}

// --- STAGE CONTENT ---
function ImprovStage({ speaking, recording }) {
  return (
    <>
      <ambientLight intensity={0.2} />
      <SpotLight
        position={[-5, 8, 5]} angle={0.3} penumbra={0.5} intensity={speaking ? 200 : 50} castShadow
        color="#ffbd59" target-position={[-3, 0, 0]}
      />
      <SpotLight
        position={[5, 8, 5]} angle={0.3} penumbra={0.5} intensity={recording ? 200 : 50} castShadow
        color="#3b82f6" target-position={[3, 0, 0]}
      />
      <directionalLight position={[0, 5, -10]} intensity={1} color="#ffffff" />

      <Environment preset="city" />
      <fog attach="fog" args={['#050505', 8, 25]} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <MeshReflectorMaterial
          blur={[400, 100]} resolution={1024} mixBlur={1} mixStrength={15} roughness={0.5}
          depthScale={1} minDepthThreshold={0.85} maxDepthThreshold={1} color="#101010" metalness={0.6}
        />
      </mesh>

      {/* Host Desk */}
      <group position={[-3, 0.75, 0.5]}>
        <mesh castShadow receiveShadow>
            <boxGeometry args={[3, 1.5, 1.5]} />
            <meshStandardMaterial color="#3e2723" roughness={0.6} />
        </mesh>
        {/* Bottle */}
        <mesh position={[0.8, 1, 0.3]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.5, 16]} />
            <meshPhysicalMaterial color="#aedfff" transmission={1} thickness={0.5} roughness={0.1} />
        </mesh>
      </group>

      {/* Mic Stand */}
      <group position={[2.5, 0, 1]}>
        <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 3, 16]} />
            <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.025, 0]} receiveShadow>
            <boxGeometry args={[0.8, 0.05, 0.8]} />
            <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0, 3, 0]}>
            <sphereGeometry args={[0.15, 32, 32]} />
            <meshStandardMaterial 
                color={recording ? "#ef4444" : "#555"} 
                emissive={recording ? "#ef4444" : "#000"}
                emissiveIntensity={recording ? 2 : 0}
                metalness={0.5}
            />
        </mesh>
      </group>

      <AnimatedCharacter position={[-3, 0, -1]} rotation={[0, 0.3, 0]} color="#ffbd59" isTalking={speaking} nameTag="HOST" />
      <AnimatedCharacter position={[3, 0, -1]} rotation={[0, -0.3, 0]} color="#ef4444" isTalking={recording} nameTag="YOU" />
    </>
  );
}

// --- MAIN EXPORT ---
export default function Scene({ speaking, recording }) {
  return (
    <Canvas shadows camera={{ position: [0, 2, 10], fov: 50 }}>
      <color attach="background" args={['#050505']} />
      <ImprovStage speaking={speaking} recording={recording} />
      <OrbitControls 
          makeDefault 
          minPolarAngle={Math.PI / 3} 
          maxPolarAngle={Math.PI / 2}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          enableZoom={false}
          enablePan={false}
      />
    </Canvas>
  );
}