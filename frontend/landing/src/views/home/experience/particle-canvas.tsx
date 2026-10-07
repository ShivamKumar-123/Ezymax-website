"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { subscribeToTicker } from "@/lib/animation/ticker";

import {
  backgroundFragmentShader,
  backgroundVertexShader,
} from "./shaders/background";
import {
  particleFragmentShader,
  particleVertexShader,
} from "./shaders/particles";
import { experienceProgress, useExperiencePhase } from "./experience";

/** How many viewport-heights the intro experience spans. The wrapper's scroll
 *  driver + stage fade use the same value so the morph resolves within it. */
export const EXPERIENCE_SCREENS = 8;

/**
 * The fixed WebGL backdrop: an aurora shader + the scroll-driven particle morph
 * + UnrealBloom, ported from script.js.
 *
 * Smoothing lives in Lenis (the shared scroll layer), so reading `scrollY` each
 * frame already yields a smoothed value — this is the single source of scroll
 * progress that also feeds the overlay phases, keeping morph and UI locked
 * together. The render loop runs on the shared ticker (the supported extension
 * point for loop-based animation; see animation-system.md).
 */
export const ParticleCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const glow = glowRef.current;
    if (!container || !glow) return;

    // Reduced-motion still opts out entirely.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Phones run this too now, but not at desktop cost. The sphere below is
    // rendered as one point per vertex, so segment counts are the whole budget:
    // 200x600 is ~121k points, which is fine on a desktop GPU and is not what
    // you want a mid-range phone driving alongside a bloom pass. A third of the
    // points and a lower pixel-ratio ceiling keep the same look at a size where
    // the moire rings read anyway.
    const small = window.innerWidth < 768;
    const segW = small ? 120 : 200;
    const segH = small ? 300 : 600;
    const maxDpr = small ? 1.5 : 2;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    // --- AURORA BACKGROUND SETUP ---
    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    const bgGeometry = new THREE.PlaneGeometry(2, 2);
    const bgMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0.0 },
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        color1: { value: new THREE.Color("#ff4c33") },
        color2: { value: new THREE.Color("#3366ff") },
      },
      vertexShader: backgroundVertexShader,
      fragmentShader: backgroundFragmentShader,
      depthWrite: false,
    });
    const bgQuad = new THREE.Mesh(bgGeometry, bgMaterial);
    bgScene.add(bgQuad);

    // Dense SphereGeometry rendered as Points — the moiré rings come for free.
    const geometry = new THREE.SphereGeometry(4.2, segW, segH);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0.0 },
        uIntro: { value: 0.0 },
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    // Keep visible when stretched far below the original bounding sphere.
    particles.frustumCulled = false;
    scene.add(particles);

    // --- POST-PROCESSING (BLOOM) ---
    const composer = new EffectComposer(renderer);

    const renderBg = new RenderPass(bgScene, bgCamera);
    composer.addPass(renderBg);

    const renderFg = new RenderPass(scene, camera);
    renderFg.clear = false;
    renderFg.clearDepth = true;
    composer.addPass(renderFg);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, // strength
      0.5, // radius
      0.05, // threshold
    );
    composer.addPass(bloomPass);

    let time = 0;

    // On-load intro: the sphere appears filled and close, then dollies back to
    // its resting position while the centre hollows into the ring. Time-driven
    // (not scroll), starting on the first rendered frame.
    const INTRO_MS = 2600;
    let introStart = 0;

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
      bgMaterial.uniforms.uResolution.value.set(
        window.innerWidth,
        window.innerHeight,
      );
    };
    window.addEventListener("resize", handleResize);

    const render = (now: number) => {
      time += 0.005;

      // Intro progress (eased), driven by wall-clock since the first frame.
      if (introStart === 0) introStart = now;
      const introRaw = Math.min((now - introStart) / INTRO_MS, 1);
      const introEased = 1 - Math.pow(1 - introRaw, 3); // easeOutCubic
      material.uniforms.uIntro.value = introEased;

      // Progress is scoped to the experience height (EXPERIENCE_SCREENS), not
      // the whole page, so the full morph resolves within the intro block and
      // the Ezymex content sections below scroll normally afterwards.
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const expHeight = window.innerHeight * EXPERIENCE_SCREENS;
      const currentScroll = expHeight > 0 ? Math.min(scrollTop / expHeight, 1) : 0;

      material.uniforms.uTime.value = time;
      material.uniforms.uScroll.value = currentScroll;
      bgMaterial.uniforms.uTime.value = time;
      bgMaterial.uniforms.uScroll.value = currentScroll;

      // --- CAMERA & ROTATION LOGIC ---
      const panProgress = Math.min(currentScroll / 0.5, 1.0);
      const smoothPan = panProgress * panProgress * (3.0 - 2.0 * panProgress);

      const flyPhase =
        currentScroll < 0.5
          ? 0.0
          : Math.min((currentScroll - 0.5) / 0.35, 1.0);

      const blackHoleDive =
        currentScroll < 0.8
          ? 0.0
          : Math.min((currentScroll - 0.8) / 0.12, 1.0);

      camera.position.y = -38.0 * smoothPan + 5.0 * Math.pow(blackHoleDive, 2.0);
      camera.position.z = 8.0 - 4.0 * smoothPan - 55.0 * flyPhase;

      const galaxyPullback =
        currentScroll < 0.93
          ? 0.0
          : Math.min((currentScroll - 0.93) / 0.07, 1.0);
      const smoothPullback =
        galaxyPullback * galaxyPullback * (3.0 - 2.0 * galaxyPullback);

      camera.position.z += 75.0 * smoothPullback;
      camera.position.y += 35.0 * smoothPullback;

      const lookX = 0.0;
      let waveTilt = 0.0;
      if (currentScroll > 0.3 && currentScroll < 0.7) {
        const tiltProgress = (currentScroll - 0.3) / 0.4;
        waveTilt = Math.sin(tiltProgress * Math.PI) * 15.0;
      }

      const lookY = THREE.MathUtils.lerp(
        camera.position.y + waveTilt,
        -33.0,
        smoothPullback,
      );
      const lookZ = THREE.MathUtils.lerp(
        camera.position.z - 100.0,
        -120.0,
        smoothPullback,
      );

      // Intro dolly — start ~3 units closer (sphere fills the view) and ease
      // back to the resting z. Faded out past the top so scrolling mid-intro
      // doesn't fight the scroll-driven camera. Applied after lookZ is derived,
      // so the focal point stays put and the eye simply dollies in.
      const introZoom =
        (1 - introEased) * -3.0 * (1 - Math.min(currentScroll / 0.05, 1));
      camera.position.z += introZoom;

      camera.lookAt(new THREE.Vector3(lookX, lookY, lookZ));

      particles.rotation.y = smoothPan * Math.PI * 2.0;
      particles.rotation.x = Math.sin(smoothPan * Math.PI) * 0.15;
      camera.rotation.z = 0.0;

      // --- BIG BANG FLASH (0.90 → 0.95) ---
      const glowScaleProgress =
        currentScroll < 0.9 ? 0.0 : Math.min((currentScroll - 0.9) / 0.03, 1.0);
      const glowScale = Math.pow(glowScaleProgress, 4.0) * 400.0;
      const hideGlow =
        currentScroll < 0.93
          ? 0.0
          : Math.min((currentScroll - 0.93) / 0.02, 1.0);
      glow.style.transform = `translate(-50%, -50%) scale(${glowScale})`;
      glow.style.opacity = `${1.0 - hideGlow}`;

      // Publish progress for overlays (module value for per-frame card motion,
      // store for phase-boundary re-renders).
      experienceProgress.current = currentScroll;
      useExperiencePhase.getState().sync(currentScroll);

      composer.render();
    };

    const unsubscribe = subscribeToTicker(render, () => 0);

    return () => {
      unsubscribe();
      window.removeEventListener("resize", handleResize);
      renderer.domElement.remove();
      geometry.dispose();
      material.dispose();
      bgGeometry.dispose();
      bgMaterial.dispose();
      bloomPass.dispose();
      composer.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
      {/* Big-bang white flash that scales out of the singularity. */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-25 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,1) 40%, rgba(255,255,255,0) 80%)",
        }}
      />
    </>
  );
};
