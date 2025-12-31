"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

function ParticleField(props: any) {
  const ref = useRef<THREE.Points>(null!);
  
  // Reduced particle count for performance (3000 -> 2000)
  const count = 2000;
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r = 50 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    // Rotation based on time
    ref.current.rotation.x -= delta / 30;
    ref.current.rotation.y -= delta / 40;
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]} {...props}>
      <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#a78bfa"
          size={0.15} // Slightly increased size to compensate for lack of bloom
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  );
}

function AutoCamera() {
    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        state.camera.position.x = Math.sin(time * 0.1) * 2;
        state.camera.position.y = Math.cos(time * 0.15) * 1;
        state.camera.lookAt(0, 0, 0);
    });
    return null;
}

export default function ThreeBackground({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#050505" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
        <Canvas 
            camera={{ position: [0, 0, 12], fov: 60 }} 
            dpr={[1, 2]} // Limit pixel ratio to 2 for high-DPI screens
            gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        >
          <ambientLight intensity={0.5} />
          <ParticleField />
          <AutoCamera />
          {/* Removed EffectComposer/Bloom for performance */}
        </Canvas>
      </div>
      <div style={{ position: "relative", zIndex: 1, height: "100%", width: "100%", pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto", height: "100%", width: "100%" }}>
            {children}
        </div>
      </div>
    </div>
  );
}
