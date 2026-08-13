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
} from "./background";
import {
  particleFragmentShader,
  particleVertexShader,
} from "./particles";

/**
 * Fixed WebGL particle backdrop for the whole home page — ported from the
 * "New Era" scroll experience and decoupled from its overlay sections. It reads
 * the page's own scroll progress (0→1) each frame, so the aurora + particle
 * cloud morph as the visitor scrolls through the existing FXArtha sections,
 * which sit on top as translucent glass.
 *
 * Adaptations for use as an ambient background (vs. a standalone experience):
 *  - Aurora + particles recoloured to FXArtha Obsidian & Lime (lime + emerald).
 *  - The source "big-bang" white flash overlay is dropped (it belonged to the
 *    original staged reveal, not a background).
 *  - Softened: lower bloom + a dimmed container so overlay text stays readable.
 *  - Skipped on small screens and when the visitor prefers reduced motion —
 *    the sections fall back to the plain obsidian background there.
 */
export const ParticleBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Respect reduced-motion + skip the heavy WebGL loop on small screens.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced || window.innerWidth < 768) return;

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    // --- AURORA BACKGROUND (recoloured to lime + emerald) ---
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
        color1: { value: new THREE.Color("#ccff00") }, // lime
        color2: { value: new THREE.Color("#10b981") }, // emerald
      },
      vertexShader: backgroundVertexShader,
      fragmentShader: backgroundFragmentShader,
      depthWrite: false,
    });
    const bgQuad = new THREE.Mesh(bgGeometry, bgMaterial);
    bgScene.add(bgQuad);

    // Dense SphereGeometry rendered as Points — the moiré rings come for free.
    const geometry = new THREE.SphereGeometry(4.2, 200, 600);
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
    particles.frustumCulled = false;
    scene.add(particles);

    // --- POST-PROCESSING (BLOOM) — softened for a background ---
    const composer = new EffectComposer(renderer);
    const renderBg = new RenderPass(bgScene, bgCamera);
    composer.addPass(renderBg);
    const renderFg = new RenderPass(scene, camera);
    renderFg.clear = false;
    renderFg.clearDepth = true;
    composer.addPass(renderFg);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.0, // strength (source 1.5 — dimmed behind content)
      0.5, // radius
      0.05, // threshold
    );
    composer.addPass(bloomPass);

    let time = 0;
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

      if (introStart === 0) introStart = now;
      const introRaw = Math.min((now - introStart) / INTRO_MS, 1);
      const introEased = 1 - Math.pow(1 - introRaw, 3);
      material.uniforms.uIntro.value = introEased;

      const maxScroll =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const currentScroll = maxScroll > 0 ? scrollTop / maxScroll : 0;

      material.uniforms.uTime.value = time;
      material.uniforms.uScroll.value = currentScroll;
      bgMaterial.uniforms.uTime.value = time;
      bgMaterial.uniforms.uScroll.value = currentScroll;

      // --- CAMERA & ROTATION LOGIC (source choreography) ---
      const panProgress = Math.min(currentScroll / 0.5, 1.0);
      const smoothPan = panProgress * panProgress * (3.0 - 2.0 * panProgress);

      const flyPhase =
        currentScroll < 0.5 ? 0.0 : Math.min((currentScroll - 0.5) / 0.35, 1.0);

      const blackHoleDive =
        currentScroll < 0.8 ? 0.0 : Math.min((currentScroll - 0.8) / 0.12, 1.0);

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

      const introZoom =
        (1 - introEased) * -3.0 * (1 - Math.min(currentScroll / 0.05, 1));
      camera.position.z += introZoom;

      camera.lookAt(new THREE.Vector3(lookX, lookY, lookZ));

      particles.rotation.y = smoothPan * Math.PI * 2.0;
      particles.rotation.x = Math.sin(smoothPan * Math.PI) * 0.15;
      camera.rotation.z = 0.0;

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
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 opacity-60"
    />
  );
};
