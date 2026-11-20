import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createCoastalAudio, CoastalAudio } from '../scene/audio';
import { CameraPreset, CoastalSceneController, mountCoastalScene } from '../scene/CoastalScene';
import { TimeOfDay } from '../scene/environment';
import { ControlDock } from './ControlDock';

export const Coastal3DStage: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<CoastalSceneController | null>(null);
  const audioRef = useRef<CoastalAudio | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [targetSpeed, setTargetSpeed] = useState(4.6);
  const [speedKmh, setSpeedKmh] = useState(16.6);
  const [cadenceRpm, setCadenceRpm] = useState(3150);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('side');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [isMuted, setIsMuted] = useState(false);
  const [isBgmEnabled, setIsBgmEnabled] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const targetSpeedRef = useRef(targetSpeed);
  targetSpeedRef.current = targetSpeed;
  const isFullscreenRef = useRef(isFullscreen);
  isFullscreenRef.current = isFullscreen;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = createCoastalAudio();
    audioRef.current = audio;

    const controller = mountCoastalScene(
      container,
      audio,
      (kmh, rpm) => {
        setSpeedKmh(kmh);
        setCadenceRpm(rpm);
      },
      (lost) => setContextLost(lost)
    );
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      audio.dispose();
      controllerRef.current = null;
      audioRef.current = null;
    };
  }, []);

  // Enable wheel zoom & lock body scroll only when in fullscreen 3D theater mode
  useEffect(() => {
    controllerRef.current?.setZoomEnabled(isFullscreen);
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const unlockAudio = useCallback(() => {
    audioRef.current?.unlockFromGesture();
  }, []);

  const handleTogglePlay = useCallback(() => {
    unlockAudio();
    setIsPlaying((prev) => {
      const next = !prev;
      controllerRef.current?.setPlaying(next);
      return next;
    });
  }, [unlockAudio]);

  const handleSpeedChange = useCallback(
    (speedMs: number) => {
      unlockAudio();
      const clamped = Math.min(10.5, Math.max(1.8, speedMs));
      setTargetSpeed(clamped);
      controllerRef.current?.setTargetSpeed(clamped);
    },
    [unlockAudio]
  );

  const handleCameraPreset = useCallback(
    (preset: CameraPreset) => {
      unlockAudio();
      setCameraPreset(preset);
      controllerRef.current?.setCameraPreset(preset);
    },
    [unlockAudio]
  );

  const handleTimeOfDay = useCallback(
    (mode: TimeOfDay) => {
      unlockAudio();
      setTimeOfDay(mode);
      controllerRef.current?.setTimeOfDay(mode);
    },
    [unlockAudio]
  );

  const handleToggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.unlockFromGesture();
    const nextMuted = !audio.isMuted;
    audio.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, []);

  const handleToggleBgm = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.unlockFromGesture();
    const nextBgm = !audio.isBgmEnabled;
    audio.setBgmEnabled(nextBgm);
    setIsBgmEnabled(nextBgm);
    setIsMuted(audio.isMuted);
  }, []);

  const handleRingBell = useCallback(() => {
    unlockAudio();
    controllerRef.current?.ringBell();
    if (audioRef.current) {
      setIsMuted(audioRef.current.isMuted);
    }
  }, [unlockAudio]);

  const handleSteer = useCallback(
    (dir: number) => {
      unlockAudio();
      controllerRef.current?.setSteerInput(dir);
    },
    [unlockAudio]
  );

  // Keyboard shortcuts (Esc exits fullscreen; drive controls active when not typing in form fields)
  useEffect(() => {
    const activeKeys = new Set<string>();

    const updateSteerFromKeys = () => {
      const left = activeKeys.has('KeyA') || activeKeys.has('ArrowLeft');
      const right = activeKeys.has('KeyD') || activeKeys.has('ArrowRight');
      const dir = (left ? 1 : 0) + (right ? -1 : 0);
      controllerRef.current?.setSteerInput(dir);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Escape' && isFullscreenRef.current) {
        setIsFullscreen(false);
        return;
      }

      // Only capture Space / Up / Down when in fullscreen so normal webpage scrolling stays natural
      if (isFullscreenRef.current) {
        if (e.code === 'Space') {
          e.preventDefault();
          if (!e.repeat) handleRingBell();
          return;
        }
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          e.preventDefault();
          handleSpeedChange(targetSpeedRef.current + 0.45);
          return;
        }
        if (e.code === 'KeyS' || e.code === 'ArrowDown') {
          e.preventDefault();
          handleSpeedChange(targetSpeedRef.current - 0.45);
          return;
        }
      }

      if (e.code === 'KeyA' || e.code === 'KeyD') {
        activeKeys.add(e.code);
        updateSteerFromKeys();
      } else if (isFullscreenRef.current && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        activeKeys.add(e.code);
        updateSteerFromKeys();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (activeKeys.has(e.code)) {
        activeKeys.delete(e.code);
        updateSteerFromKeys();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleRingBell, handleSpeedChange]);

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-950'
          : 'relative w-full h-[500px] sm:h-[560px] lg:h-[620px] rounded-xl overflow-hidden bg-slate-950 border border-slate-200 shadow-sm'
      }
      onPointerDown={unlockAudio}
    >
      {/* Dedicated WebGL canvas mount container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="제주 해녀 호랑이 3D 해안도로 체험 장면"
      />

      {/* Minimal Top-Left Scene Guide Overlay */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-slate-950/75 border border-white/10 rounded-lg px-3.5 py-2">
          <div className="text-xs sm:text-sm font-semibold text-white tracking-tight">
            제주 해안도로 3D 인터랙티브 체험
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
            <span>드래그로 시점 회전</span>
            <span aria-hidden="true">·</span>
            <span>태왁·한라봉·남방큰돌고래</span>
            <span aria-hidden="true">·</span>
            <span>클릭 시 제주 민요 재생</span>
          </div>
        </div>
      </div>

      {/* Graceful WebGL Context Loss Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 p-6">
          <div className="max-w-sm rounded-xl bg-slate-900 border border-white/15 p-6 text-center">
            <h3 className="font-editorial text-lg font-semibold text-white">
              3D 그래픽 일시 중지됨
            </h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              브라우저에서 WebGL 렌더링이 잠시 중단되었습니다. 페이지를 새로고침하면 제주 해안 3D
              장면이 다시 시작됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Interactive 3D Control Dock */}
      <ControlDock
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((f) => !f)}
        collapsed={dockCollapsed}
        onToggleCollapsed={() => setDockCollapsed((c) => !c)}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        targetSpeed={targetSpeed}
        onSpeedChange={handleSpeedChange}
        speedKmh={speedKmh}
        cadenceRpm={cadenceRpm}
        cameraPreset={cameraPreset}
        onCameraPreset={handleCameraPreset}
        timeOfDay={timeOfDay}
        onTimeOfDay={handleTimeOfDay}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isBgmEnabled={isBgmEnabled}
        onToggleBgm={handleToggleBgm}
        onRingBell={handleRingBell}
        onSteer={handleSteer}
      />
    </div>
  );
};
