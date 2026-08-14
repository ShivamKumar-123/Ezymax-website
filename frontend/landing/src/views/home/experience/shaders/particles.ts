/**
 * Particle morph shader — ported verbatim from the source script.js. A dense
 * `SphereGeometry` rendered as points morphs through seven scroll phases:
 * sphere → funnel → DNA → wave → tunnel → black-hole singularity → spiral
 * galaxy, driven entirely by the `uScroll` (0–1) and `uTime` uniforms.
 */

export const particleVertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uScroll;
    uniform float uIntro; // 0 = on-load filled/appearing, 1 = settled
    varying float vEdgeFade;
    varying vec3 vColor;

    // 3D Simplex Noise
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
      vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    float random(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    }

    void main() {
        vec3 normalVec = normalize(position);

        // --- SPHERE POS ---
        // Increased uTime multipliers to make deformation faster
        float noiseVal = snoise(position * 0.5 + uTime * 0.8);
        noiseVal += 0.5 * snoise(position * 1.5 - uTime * 1.2);
        vec3 spherePos = position + normalVec * (noiseVal * 0.5);

        // --- STRETCHED Y FOR FUNNEL & DNA ---
        // Original position.y is roughly +4.2 to -4.2.
        // We stretch it heavily downwards so the camera can pan along it.
        float stretchedY = position.y * 7.0 - 8.0; // Ranges from +16.5 down to -32.5

        // --- FUNNEL POS ---
        // Wide at the top, narrow at the bottom
        float funnelRadius = 1.0 + smoothstep(-32.0, 16.0, stretchedY) * 5.0;
        float angle = atan(position.z, position.x) + stretchedY * 0.3; // Twist the funnel
        vec3 funnelPos = vec3(funnelRadius * cos(angle), stretchedY, funnelRadius * sin(angle));
        // Add organic noise to the funnel walls
        // Increased uTime multiplier to make funnel deformation faster
        funnelPos += normalVec * (snoise(funnelPos * 0.3 + uTime * 3.0) * 1.0);

        // --- DNA POS (Volumetric Thick Tubes) ---
        float rnd1 = random(position);
        float rnd2 = random(position + vec3(1.0));
        float rnd3 = random(position + vec3(2.0));

        float t = stretchedY; // Height along helix
        float twistMultiplier = 0.65;
        float twist = t * twistMultiplier;
        float dnaRadius = 1.0; // Scaled down radius
        float strandThickness = 0.35; // Scaled down strands

        vec3 dnaPos;
        if (rnd1 < 0.40) { // Strand 1 (40% of particles)
            vec3 core = vec3(dnaRadius * cos(twist), t, dnaRadius * sin(twist));
            vec3 offset = vec3(rnd1 - 0.2, rnd2 - 0.5, rnd3 - 0.5) * 2.0 * strandThickness;
            dnaPos = core + offset;
        } else if (rnd1 < 0.80) { // Strand 2 (40% of particles)
            vec3 core = vec3(dnaRadius * cos(twist + 3.14159), t, dnaRadius * sin(twist + 3.14159));
            vec3 offset = vec3(rnd1 - 0.6, rnd2 - 0.5, rnd3 - 0.5) * 2.0 * strandThickness;
            dnaPos = core + offset;
        } else { // Rungs (20% of particles)
            float rungT = (rnd1 - 0.80) * 5.0;
            // Dense, distinct rungs
            float discreteT = floor(t * 2.5) / 2.5;
            float discreteTwist = discreteT * twistMultiplier;
            vec3 p1 = vec3(dnaRadius * cos(discreteTwist), discreteT, dnaRadius * sin(discreteTwist));
            vec3 p2 = vec3(dnaRadius * cos(discreteTwist + 3.14159), discreteT, dnaRadius * sin(discreteTwist + 3.14159));

            vec3 core = mix(p1, p2, rungT);
            vec3 offset = vec3(rnd1 - 0.9, rnd2 - 0.5, rnd3 - 0.5) * 2.0 * 0.10; // thinner rungs
            dnaPos = core + offset;
        }

        // Optional: slight organic waving to the whole structure
        dnaPos.x += snoise(vec3(0.0, t * 0.2, uTime * 0.2)) * 0.5;
        dnaPos.z += snoise(vec3(t * 0.2, 0.0, uTime * 0.2)) * 0.5;

        // --- 4-PHASE TIMELINE ---
        // Phase 1 (0.0 to 0.15): Sphere morphs into Funnel
        // Phase 2 (0.15 to 0.30): Funnel morphs into DNA
        float phase1 = smoothstep(0.0, 0.15, uScroll);
        float phase2 = smoothstep(0.15, 0.30, uScroll);

        vec3 step1Pos = mix(spherePos, funnelPos, phase1);
        vec3 step2Pos = mix(step1Pos, dnaPos, phase2);

        // Phase 3 (0.30 to 0.50): DNA melts into the Wave
        // Phase 4 (0.50 to 1.00): 50% of the massive 1200vh scroll is purely flying!
        float meltProgress = smoothstep(0.30, 0.50, uScroll);

        // meltY must go high enough (max stretchedY is 37.0, plus 45.0 transition = 82.0)
        // so that EVERY single particle finishes melting!
        float meltY = mix(-50.0, 90.0, meltProgress);

        // Mathematically safe melt calculation (avoids undefined WebGL behavior)
        // depth is 0 at the top of the melt line, and 45.0 at the bottom of the transition zone.
        float depthBelowMeltLine = meltY - stretchedY;
        float localMelt = smoothstep(0.0, 45.0, depthBelowMeltLine);

        // Wave Pos
        // Z stretch to create a deeply infinite ocean while preserving density
        // Reverted back to -45.0 to keep DNA animation alignment perfectly intact
        vec3 targetWavePos = vec3(position.x * 7.0, -45.0, position.z * 25.0);

        // Offset X to separate orange and blue particles into a gradient
        targetWavePos.x += position.y * 6.0;

        // Restore beautiful rolling Simplex noise hills (as seen in user's screenshot)
        float waveNoise = snoise(vec3(targetWavePos.x * 0.08, targetWavePos.z * 0.08, uTime * 0.15)) * 2.0;
        waveNoise += snoise(vec3(targetWavePos.x * 0.16, targetWavePos.z * 0.16, uTime * 0.3)) * 0.8;
        targetWavePos.y += waveNoise;

        // Phase 5 (0.65 to 0.80): Flat wave curls up into a massive cylindrical Tunnel
        float tunnelProgress = smoothstep(0.65, 0.80, uScroll);

        // Phase 6 (0.80 to 0.92): Tunnel pinches into a singularity
        // Fix: Replaced smoothstep with a pure ease-in (pow) so the collapse accelerates instead of slowing down!
        float blackHoleLinear = clamp((uScroll - 0.80) / 0.12, 0.0, 1.0);
        float blackHoleProgress = pow(blackHoleLinear, 2.0);

        float tunnelR = 12.0;

        // Pinch the radius of the tunnel based on Z-depth.
        // The farthest particles are at Z = -87.5.
        // We want the far end to mathematically pinch to exactly 0 to create a perfect singularity point!
        float pinchFactor = clamp((targetWavePos.z + 80.0) / 100.0, 0.0, 1.0);
        tunnelR = mix(tunnelR, tunnelR * pinchFactor, blackHoleProgress);

        // Reverted back to -33.0 to keep physical center aligned with DNA scatter
        float tunnelCy = -33.0;

        // Normalize X to close the cylinder perfectly
        float currentSliceRadius = sqrt(max(0.0, 17.64 - position.z * position.z));
        float maxSliceWidth = 9.2195 * currentSliceRadius;
        float normalizedX = targetWavePos.x / (maxSliceWidth + 0.001);
        float tunnelAngle = normalizedX * 3.14159265;

        // Tunnel Chaos: Particles rip around the walls
        // Fix: Use linear progress so it doesn't "ease out" and slow down at the end!
        float tunnelLinear = clamp((uScroll - 0.70) / 0.22, 0.0, 1.0);
        // Accelerate continuously towards the end (ease-in only, NO ease-out)
        float tunnelEnd = pow(tunnelLinear, 3.0);

        float jitterAngle = snoise(vec3(position.x * 15.0, position.y * 15.0, uTime * 0.1)) * 0.35;
        float jitterZ = snoise(vec3(position.y * 15.0, position.z * 15.0, uTime * 0.1)) * 4.0;

        // We now use smooth bounded time noise for ambient swirl, and scroll for the massive twist.
        float ambientSwirl = snoise(vec3(position.x * 5.0, position.y * 5.0, uTime * 0.2)) * 3.0;
        float diveTwist = snoise(vec3(position.x * 5.0, position.y * 5.0, 0.0)) * 30.0 * tunnelEnd;
        float vortexSpeed = (ambientSwirl + diveTwist) * tunnelLinear;

        tunnelAngle += jitterAngle + vortexSpeed;
        float tunnelZ = targetWavePos.z + jitterZ;

        float dynamicR = tunnelR - waveNoise;
        vec3 tunnelPos = vec3(dynamicR * sin(tunnelAngle), tunnelCy - dynamicR * cos(tunnelAngle), tunnelZ);

        // Morph the wave into the tunnel
        vec3 morphedWave = mix(targetWavePos, tunnelPos, tunnelProgress);

        // Interpolate directly
        vec3 tunnelFinalPos = mix(step2Pos, morphedWave, localMelt);

        // --- PHASE 7: SPIRAL GALAXY ---
        // Instantly snap the geometry to the galaxy while the screen is 100% white at 0.93
        float galaxyPhase = step(0.93, uScroll);

        // 1. Density Distribution (No Banding!)
        // We generate completely independent pseudo-random variables for each particle
        // to ensure smooth, organic distribution without aliasing/Moiré patterns.
        float gRnd1 = fract(sin(dot(position.xyz, vec3(12.989, 78.233, 45.164))) * 43758.545);
        float gRnd2 = fract(sin(dot(position.xyz, vec3(93.989, 67.345, 54.256))) * 24634.634);
        float gRnd3 = fract(sin(dot(position.xyz, vec3(43.332, 11.235, 89.234))) * 56475.234);
        float gRnd4 = fract(sin(dot(position.xyz, vec3(75.321, 32.123, 23.456))) * 35432.123);

        // Dense exponential distribution for a bright, organic core, with a soft fuzzy outer edge
        float galaxyR = pow(gRnd1, 2.0) * 60.0 + pow(gRnd2, 3.0) * 30.0; // Soft edge without a hard wall

        // 2. Spiral Angle
        // The arms wrap around naturally
        float swirl = pow(galaxyR, 1.1) * 0.08;

        // 2 main arms
        float armIndex = floor(gRnd2 * 2.0);
        float baseAngle = armIndex * 3.14159265;

        // Angle dispersion: Unify the arms and the dust into a smooth continuous distribution!
        // Instead of a hard cut (Yin-Yang look), we use an exponential cluster around the arm.
        float uniformTheta = gRnd3 * 2.0 - 1.0;
        // pow(x, 5) creates a massive dense spike exactly at the arm, and soft falloff for ambient dust
        float dTheta = pow(uniformTheta, 5.0) * 3.14159;

        // Fix: Reduced rotation speed as requested to make the galaxy feel more majestic and less chaotic
        float theta = baseAngle + swirl + dTheta + (uTime * 0.4);

        float gx = galaxyR * cos(theta);
        float gz = galaxyR * sin(theta);

        // 3. Bulge & Thickness (Y axis)
        // Edges are a flat disc, but the core is completely decoupled to form a perfect random 3D sphere!
        float gyDisc = pow(gRnd4 * 2.0 - 1.0, 3.0) * 1.5; // Base flat disc height
        vec3 basePos = vec3(gx, gyDisc, gz);

        // Create a perfectly spherical Bulge in the center
        // We give particles a random 3D offset that is MASSIVE at the center, and 0 at the edges.
        float bulgeStrength = smoothstep(25.0, 0.0, galaxyR); // 1.0 at center, 0 at R=25

        // Generate a random vector inside a sphere
        // Need 3 more independent randoms to prevent any banding
        float gRnd5 = fract(sin(gRnd1 * 44.44 + gRnd2) * 555.55);
        float gRnd6 = fract(sin(gRnd3 * 66.66 + gRnd4) * 777.77);
        float gRnd7 = fract(sin(gRnd5 * 88.88 + gRnd6) * 999.99);

        float phi = acos(gRnd5 * 2.0 - 1.0); // Mathematically uniform spherical distribution
        // Fix: Slow down the core rotation as well
        float thetaSphere = gRnd6 * 6.2831853 + (uTime * 0.8);
        // pow(x, 2.0) makes the core extremely dense in the very middle
        float rSphere = pow(gRnd7, 2.0) * 18.0;


        vec3 bulgeOffset = vec3(
            rSphere * sin(phi) * cos(thetaSphere),
            rSphere * cos(phi),
            rSphere * sin(phi) * sin(thetaSphere)
        );

        // Pull the disc particles into the spherical bulge near the center!
        // If bulgeStrength = 1.0 (center), we completely ignore the disc position and use the solid sphere!
        vec3 galaxyPos = mix(basePos, bulgeOffset, bulgeStrength);

        // Reverted back to -33.0 to match the tunnel singularity center
        galaxyPos.y -= 33.0; // Place it vertically where the black hole was
        galaxyPos.z -= 120.0; // Push deep into Z-space

        // Fade from Tunnel to Galaxy during the black screen!
        vec3 finalPos = mix(tunnelFinalPos, galaxyPos, galaxyPhase);

        vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);

        // Fresnel / Edge fade
        vec3 viewDir = normalize(-mvPosition.xyz);
        vec3 worldNormal = normalize(normalMatrix * normalVec); // approximate normal

        float rim = 1.0 - abs(dot(viewDir, worldNormal));

        // Make the center dark and edges glowing for sphere, but fully visible for DNA
        float edgeFadeSphere = smoothstep(0.4, 0.9, rim);
        float edgeFadeDNA = 1.0;

        // Morph value from 0 to 1 representing the total transition to DNA/Wave
        float morph = smoothstep(0.0, 0.30, uScroll);

        // --- DYNAMIC OPACITY & SIZE ---
        // Because the particle density changes drastically (dense sphere -> dense DNA -> massive wave -> scattered tunnel),
        // we must dynamically adjust the brightness and size so it never blows out and never gets too dim.

        float opacityMultiplier = 0.8;
        float sizeMultiplier = 1.5;

        // DNA Phase: Extremely dense, reduce opacity to prevent white-out
        float dnaPhase = smoothstep(0.15, 0.30, uScroll);
        opacityMultiplier = mix(opacityMultiplier, 0.25, dnaPhase);
        sizeMultiplier = mix(sizeMultiplier, 4.0, dnaPhase);

        // Wave Phase: Flat plane has massive overlap at grazing angles. Keep opacity low to preserve rich colors!
        float wavePhase = smoothstep(0.30, 0.50, uScroll);
        opacityMultiplier = mix(opacityMultiplier, 0.35, wavePhase);
        sizeMultiplier = mix(sizeMultiplier, 4.0, wavePhase);

        // Tunnel Phase: Scattered into chaos on the walls.
        float tunnelPhase = smoothstep(0.65, 0.80, uScroll);
        opacityMultiplier = mix(opacityMultiplier, 0.6, tunnelPhase);
        sizeMultiplier = mix(sizeMultiplier, 10.0, tunnelPhase);

        // Phase 7 Spiral Galaxy:
        // Identify 2% of particles to become massive glowing Supergiant stars!
        // We use gRnd1 to avoid banding!
        float isOrb = step(0.98, fract(gRnd1 * 77.77)); // 1.0 if it's an orb, 0.0 otherwise
        // Slightly increased base particle size (from 3.0 to 5.0) to make dust more visible
        float starSize = mix(5.0, 16.0, isOrb);

        // Reduced opacity further (from 0.45 to 0.25) to practically eliminate excessive bloom
        opacityMultiplier = mix(opacityMultiplier, 0.25, galaxyPhase);
        sizeMultiplier = mix(sizeMultiplier, starSize, galaxyPhase);

        // Intro: at uIntro=0 the sphere is fully filled (whole disc visible);
        // as uIntro→1 the centre hollows back to the fresnel rim. A short fade
        // (smoothstep) brings the whole cloud up from nothing on load.
        float introSphere = mix(1.0, edgeFadeSphere, uIntro);
        vEdgeFade = mix(introSphere, edgeFadeDNA, morph) * opacityMultiplier;
        vEdgeFade *= smoothstep(0.0, 0.2, uIntro);

        // --- COLORS ---
        // Original, pure blue-to-orange gradient exactly as it is on the wave and sphere
        vec3 cBottom = vec3(0.2, 0.4, 1.0); // Deep Blue
        vec3 cTop = vec3(1.0, 0.3, 0.2);    // Blazing Orange

        // 1. Base color mix (used for sphere, DNA, wave)
        float baseColorMix = smoothstep(-3.0, 3.0, position.y + position.x * 0.5);
        vec3 normalColor = mix(cBottom, cTop, clamp(baseColorMix, 0.0, 1.0));

        // 2. Galaxy color mix: mapped geometrically to the galaxy radius!
        // Pure Orange core fading into Deep Blue edges, EXACTLY matching the first sphere's colors!
        float orangeMix = smoothstep(80.0, 0.0, galaxyR);
        vec3 galaxyColor = mix(cBottom, cTop, clamp(orangeMix, 0.0, 1.0));

        vColor = mix(normalColor, galaxyColor, galaxyPhase);

        // Use the dynamically calculated sizeMultiplier
        gl_PointSize = sizeMultiplier * (10.0 / -mvPosition.z);

        // Ensure a minimum size so that distant stars in the tunnel don't disappear into subpixel darkness!
        gl_PointSize = max(gl_PointSize, 1.5);

        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const particleFragmentShader = /* glsl */ `
    varying float vEdgeFade;
    varying vec3 vColor;

    void main() {
        vec2 xy = gl_PointCoord.xy - vec2(0.5);
        float ll = length(xy);
        if(ll > 0.5) discard;

        // Soft white points
        float pointAlpha = smoothstep(0.5, 0.1, ll);

        // Color is driven by vertex vColor, opacity driven by edge fade
        gl_FragColor = vec4(vColor, vEdgeFade * pointAlpha * 0.9);
    }
`;
