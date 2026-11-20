import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSceneTextures } from './textures';
import { createCoastalTrack } from './track';
import { createTigerBikeRig } from './tigerBike';
import { createCoastalEnvironment, TimeOfDay } from './environment';
import { CoastalAudio } from './audio';

export type CameraPreset = 'side' | 'chase' | 'front' | 'scenic';

export interface SceneHUDState {
  isPlaying: boolean;
  speedKmh: number;
  cadenceRpm: number;
  cameraPreset: CameraPreset;
  timeOfDay: TimeOfDay;
  isMuted: boolean;
}

export interface CoastalSceneController {
  setPlaying: (playing: boolean) => void;
  setTargetSpeed: (speedMs: number) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setTimeOfDay: (mode: TimeOfDay) => void;
  ringBell: () => void;
  setSteerInput: (dir: number) => void;
  setZoomEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

const _worldUp = new THREE.Vector3(0, 1, 0);
const _travelFwd = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _left = new THREE.Vector3();
const _up = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _prevTigerPos = new THREE.Vector3();
const _deltaTigerPos = new THREE.Vector3();
const _desiredOffset = new THREE.Vector3();
const _currentOffset = new THREE.Vector3();
const _targetFocus = new THREE.Vector3();

export function mountCoastalScene(
  container: HTMLElement,
  audio: CoastalAudio,
  onTelemetry: (speedKmh: number, cadenceRpm: number) => void,
  onContextLost: (lost: boolean) => void
): CoastalSceneController {
  const isSoftwareGl = detectSoftwareWebGL();

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const handleContextLost = (e: Event) => {
    e.preventDefault();
    onContextLost(true);
  };
  const handleContextRestored = () => {
    onContextLost(false);
  };
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

  const scene = new THREE.Scene();

  // Procedural studio environment map for crisp metallic/clearcoat PBR reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(44, width / height, 0.15, 450);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.9;
  controls.maxDistance = 26;
  controls.maxPolarAngle = Math.PI * 0.485; // Keep camera above the road/ocean plane
  controls.minPolarAngle = 0.12;
  controls.enablePan = false;
  controls.enableZoom = false; // Prevent scroll-trapping when embedded in website; enabled in fullscreen

  // Build Textures, Coastal Track, Environment, and Tiger + Bicycle Rig
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const textures = createSceneTextures(maxAnisotropy);
  const track = createCoastalTrack();

  const roadGroup = track.buildRoadMesh(
    textures.asphaltRoad,
    textures.asphaltNormal,
    textures.basaltStone
  );
  scene.add(roadGroup);

  const environment = createCoastalEnvironment(scene, track, textures, isSoftwareGl);
  const tigerBike = createTigerBikeRig(textures);
  scene.add(tigerBike.root);

  // Simulation state
  let isPlaying = true;
  let targetSpeed = 4.6; // ~16.5 km/h pleasant coastal cruise
  let currentSpeed = 4.6;
  // Travel counter-clockwise (-tangent) so the ocean-side lane (+bikeLaneOffset) is the RIGHT-hand lane (우측통행)
  let trackDistance = track.length * 0.14; // Start cruising toward the scenic east lighthouse & coastal sign
  let lateralWeave = 0; // -0.85m .. +0.85m interactive offset inside the right-hand lane
  let steerInput = 0; // -1 (right) .. +1 (left)
  let currentSteerAngle = 0;
  let currentLeanAngle = 0;
  let bellTimer = 0;
  let timeOfDay: TimeOfDay = 'morning';
  let activePreset: CameraPreset | null = 'side';
  let cameraTransitioning = false;

  // Initial tiger placement
  const initSample = track.sampleAtDistance(trackDistance, track.bikeLaneOffset);
  tigerBike.root.position.copy(initSample.position);
  _prevTigerPos.copy(initSample.position);

  // Position initial camera at Side Hero view
  function computePresetOffset(
    preset: CameraPreset,
    travelFwd: THREE.Vector3,
    oceanDir: THREE.Vector3,
    out: THREE.Vector3
  ) {
    out.set(0, 0, 0);
    switch (preset) {
      case 'side':
        // Inland side 3/4 view framing the 4-wheel ATV, large front Hallabong basket, big rear Taewak & ocean
        out.addScaledVector(oceanDir, -3.75);
        out.addScaledVector(travelFwd, 1.55);
        out.y = 1.62;
        break;
      case 'chase':
        out.addScaledVector(travelFwd, -4.15);
        out.addScaledVector(oceanDir, -0.95);
        out.y = 1.98;
        break;
      case 'front':
        out.addScaledVector(travelFwd, 3.65);
        out.addScaledVector(oceanDir, -1.18);
        out.y = 1.50;
        break;
      case 'scenic':
        out.addScaledVector(oceanDir, -6.5);
        out.addScaledVector(travelFwd, -4.8);
        out.y = 5.5;
        break;
    }
  }

  _targetFocus.copy(initSample.position).add(new THREE.Vector3(0, 0.85, 0));
  controls.target.copy(_targetFocus);
  _travelFwd.copy(initSample.tangent).negate();
  computePresetOffset('side', _travelFwd, initSample.left, _desiredOffset);
  camera.position.copy(_targetFocus).add(_desiredOffset);
  controls.update();

  // Cancel preset camera interpolation immediately when user drags OrbitControls
  const handleControlStart = () => {
    cameraTransitioning = false;
    activePreset = null;
  };
  controls.addEventListener('start', handleControlStart);

  // Pre-warm shaders once on hardware GPUs
  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // ResizeObserver for crisp viewport sizing
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  // Animation loop with Software WebGL afterDraw pacing
  const clock = new THREE.Clock();
  let frameId = 0;
  let disposed = false;
  let telemetryAccum = 0;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function tick() {
    if (disposed) return;

    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05); // Clamp dt to keep kinematics rock-solid on tab switches
    const elapsed = clock.elapsedTime;

    // 1. Speed & forward distance along coastal track (decreasing distance = right-hand traffic on ocean lane)
    const desiredSpeed = isPlaying ? targetSpeed : 0;
    currentSpeed = THREE.MathUtils.damp(currentSpeed, desiredSpeed, 4.5, dt);
    const ds = currentSpeed * dt;
    trackDistance = (((trackDistance - ds) % track.length) + track.length) % track.length;

    // 2. Interactive lateral weaving within the right-hand ocean-side driving lane
    // Note: sample.left points ocean-ward (rider's RIGHT), so steerInput (+1 left) decreases offset
    const weaveRate = steerInput * 1.5 * Math.min(1, currentSpeed / 2.2);
    lateralWeave = THREE.MathUtils.clamp(lateralWeave - weaveRate * dt, -0.85, 0.85);
    if (steerInput === 0) {
      // Gentle automatic return toward center of the right-hand ocean-side lane
      lateralWeave = THREE.MathUtils.damp(lateralWeave, 0, 1.1, dt);
    }

    const sample = track.sampleAtDistance(trackDistance, track.bikeLaneOffset + lateralWeave);
    tigerBike.root.position.copy(sample.position);

    // 3. Orient ATV along travel direction (-sample.tangent) + weave yaw
    _travelFwd.copy(sample.tangent).negate();
    const weaveYaw = steerInput * 0.14 * Math.min(1, currentSpeed / 2.0);
    _fwd.copy(_travelFwd);
    _fwd.applyAxisAngle(_worldUp, weaveYaw).normalize();
    _left.crossVectors(_worldUp, _fwd).normalize();
    _up.crossVectors(_fwd, _left).normalize();
    _basis.makeBasis(_left, _up, _fwd);
    tigerBike.root.quaternion.setFromRotationMatrix(_basis);

    // 4. Compute natural steering handlebar angle & turn lean angle
    // Curvature sign is inverted when traveling along -sample.tangent
    const roadSteer = THREE.MathUtils.clamp(-sample.curvature * 5.2, -0.34, 0.34);
    const targetSteer = THREE.MathUtils.clamp(roadSteer + steerInput * 0.24, -0.45, 0.45);
    currentSteerAngle = THREE.MathUtils.damp(currentSteerAngle, targetSteer, 7.5, dt);

    const targetLean = THREE.MathUtils.clamp(
      -currentSteerAngle * (0.28 + currentSpeed * 0.035),
      -0.22,
      0.22
    );
    currentLeanAngle = THREE.MathUtils.damp(currentLeanAngle, targetLean, 6.5, dt);

    // 5. Decay bell cheer timer
    if (bellTimer > 0) {
      bellTimer = Math.max(0, bellTimer - dt * 0.72);
    }

    // 6. Update Tiger & ATV Rig (wheels, suspension, IK legs, IK arms, tail, scarf, blink)
    tigerBike.update({
      dt,
      elapsed,
      distanceDelta: ds,
      speed: currentSpeed,
      steerAngle: currentSteerAngle,
      leanAngle: currentLeanAngle,
      bellActive: bellTimer,
      isTwilight: timeOfDay === 'twilight',
    });

    // 7. Update Ocean, Sky, Sun Shadow Frustum, Seagulls & Petals
    environment.applyTimeOfDay(timeOfDay, dt, renderer);
    environment.update(dt, elapsed, sample.position);

    // 8. Smooth Camera Following + OrbitControls Co-Movement
    _deltaTigerPos.copy(sample.position).sub(_prevTigerPos);
    _prevTigerPos.copy(sample.position);

    // Move camera & orbit target with the moving ATV so OrbitControls stay locked around the tiger
    camera.position.add(_deltaTigerPos);
    controls.target.add(_deltaTigerPos);

    if (activePreset && cameraTransitioning) {
      computePresetOffset(activePreset, _travelFwd, sample.left, _desiredOffset);
      _currentOffset.copy(camera.position).sub(controls.target);
      _currentOffset.x = THREE.MathUtils.damp(_currentOffset.x, _desiredOffset.x, 4.5, dt);
      _currentOffset.y = THREE.MathUtils.damp(_currentOffset.y, _desiredOffset.y, 4.5, dt);
      _currentOffset.z = THREE.MathUtils.damp(_currentOffset.z, _desiredOffset.z, 4.5, dt);
      camera.position.copy(controls.target).add(_currentOffset);

      if (_currentOffset.distanceTo(_desiredOffset) < 0.04) {
        cameraTransitioning = false;
      }
    } else if (activePreset === 'chase' && !cameraTransitioning) {
      // Gently follow behind the curving road in Chase mode when user isn't orbiting
      computePresetOffset('chase', _travelFwd, sample.left, _desiredOffset);
      _currentOffset.copy(camera.position).sub(controls.target);
      _currentOffset.x = THREE.MathUtils.damp(_currentOffset.x, _desiredOffset.x, 2.2, dt);
      _currentOffset.y = THREE.MathUtils.damp(_currentOffset.y, _desiredOffset.y, 2.2, dt);
      _currentOffset.z = THREE.MathUtils.damp(_currentOffset.z, _desiredOffset.z, 2.2, dt);
      camera.position.copy(controls.target).add(_currentOffset);
    }

    controls.update();

    // Update subtle telemetry readout (~10 Hz to avoid unnecessary React renders)
    telemetryAccum += dt;
    if (telemetryAccum >= 0.1) {
      telemetryAccum = 0;
      const kmh = currentSpeed * 3.6;
      const engineRpm = currentSpeed > 0.15 ? 1400 + currentSpeed * 380 : 1150;
      onTelemetry(kmh, engineRpm);
    }

    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  tick();

  return {
    setPlaying(playing: boolean) {
      isPlaying = playing;
    },
    setTargetSpeed(speedMs: number) {
      targetSpeed = THREE.MathUtils.clamp(speedMs, 1.5, 10.5);
    },
    setCameraPreset(preset: CameraPreset) {
      activePreset = preset;
      cameraTransitioning = true;
    },
    setTimeOfDay(mode: TimeOfDay) {
      timeOfDay = mode;
    },
    ringBell() {
      bellTimer = 1.0;
      audio.ringBell();
    },
    setSteerInput(dir: number) {
      steerInput = THREE.MathUtils.clamp(dir, -1, 1);
    },
    setZoomEnabled(enabled: boolean) {
      controls.enableZoom = enabled;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      textures.dispose();
      envMap.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
