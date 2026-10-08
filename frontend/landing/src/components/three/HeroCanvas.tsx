"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

const BLACK = "#050505";

function GlossyBlack() {
  return (
    <meshPhysicalMaterial
      color={BLACK}
      metalness={0.78}
      roughness={0.18}
      clearcoat={1}
      clearcoatRoughness={0.06}
      envMapIntensity={1.5}
    />
  );
}

/** The "zero": a thick glossy ring that nods to the brand name. */
function ZeroRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.08;
  });
  return (
    <mesh ref={ref} rotation={[-0.55, 0.35, 0]}>
      <torusGeometry args={[1.75, 0.56, 96, 256]} />
      <GlossyBlack />
    </mesh>
  );
}

function CoreKnot() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.x -= dt * 0.12;
    ref.current.rotation.y += dt * 0.18;
  });
  return (
    <mesh ref={ref} scale={0.9}>
      <torusKnotGeometry args={[0.52, 0.16, 256, 32, 2, 3]} />
      <GlossyBlack />
    </mesh>
  );
}

const SHARDS = Array.from({ length: 7 }, (_, i) => ({
  offset: (i / 7) * Math.PI * 2,
  speed: 0.22 + (i % 3) * 0.05,
  radius: 0.08 + ((i * 7) % 5) * 0.025,
  tilt: ((i % 4) - 1.5) * 0.35,
}));

function Shards() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    SHARDS.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      const a = t * s.speed + s.offset;
      m.position.set(Math.cos(a) * 2.9, Math.sin(a) * 1.15 + Math.sin(a * 2 + s.tilt) * 0.25, Math.sin(a) * 0.9);
      m.rotation.set(a, a * 0.7, 0);
    });
  });
  return (
    <>
      {SHARDS.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <sphereGeometry args={[s.radius, 32, 32]} />
          <GlossyBlack />
        </mesh>
      ))}
    </>
  );
}

function Parallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, pointer.current.x * 0.28, 2.5, dt);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, -pointer.current.y * 0.18, 2.5, dt);
  });
  return <group ref={ref}>{children}</group>;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <pointLight color="#ff6a00" intensity={70} decay={2} position={[4, 2, -2]} />
      <pointLight color="#ff8a3d" intensity={28} decay={2} position={[-3, -2, -1]} />
      <pointLight color="#b3121b" intensity={30} decay={2} position={[2, -4, -3]} />
      <directionalLight color="#ffffff" intensity={0.45} position={[0, 4, 5]} />
    </>
  );
}

/** Procedural environment: no HDR download. Orange rim, red counter rim, thin white specular line. */
function Env() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#050505"]} />
      <Lightformer form="rect" intensity={7} color="#ff6a00" position={[4, 1, -3]} scale={[3, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={3} color="#ff8a3d" position={[-4, -2, -2]} scale={[4, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.8} color="#b3121b" position={[2, -4, -2]} scale={[5, 2, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.7} color="#ffffff" position={[0, 5, 2]} scale={[8, 0.35, 1]} target={[0, 0, 0]} />
    </Environment>
  );
}

export default function HeroCanvas({ active }: { active: boolean }) {
  const [dpr, setDpr] = useState<[number, number]>([1, 1.5]);
  const [ready, setReady] = useState(false);

  return (
    <div
      className="absolute inset-0 transition-opacity duration-1000"
      style={{
        opacity: ready ? 1 : 0,
        maskImage: "radial-gradient(ellipse 58% 62% at 55% 50%, #000 40%, transparent 78%)",
        WebkitMaskImage: "radial-gradient(ellipse 58% 62% at 55% 50%, #000 40%, transparent 78%)",
      }}
    >
      <Canvas
        dpr={dpr}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, 7.2], fov: 35 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        onCreated={() => window.setTimeout(() => setReady(true), 120)}
      >
        <color attach="background" args={["#060606"]} />
        <PerformanceMonitor onDecline={() => setDpr([1, 1])} />
        <Suspense fallback={null}>
          <Env />
          <Lights />
          <Parallax>
            <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.6}>
              <group position={[0.4, 0, 0]}>
                <ZeroRing />
                <CoreKnot />
                <Shards />
              </group>
            </Float>
          </Parallax>
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.5} luminanceSmoothing={0.3} radius={0.7} />
            <Vignette offset={0.25} darkness={0.75} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
