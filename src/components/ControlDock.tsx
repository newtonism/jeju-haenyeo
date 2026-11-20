import React from 'react';
import {
  Bell,
  Camera,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Sun,
  Sunset,
  Moon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CameraPreset } from '../scene/CoastalScene';
import { TimeOfDay } from '../scene/environment';

interface ControlDockProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  targetSpeed: number;
  onSpeedChange: (speedMs: number) => void;
  speedKmh: number;
  cadenceRpm: number;
  cameraPreset: CameraPreset;
  onCameraPreset: (preset: CameraPreset) => void;
  timeOfDay: TimeOfDay;
  onTimeOfDay: (mode: TimeOfDay) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isBgmEnabled: boolean;
  onToggleBgm: () => void;
  onRingBell: () => void;
  onSteer: (dir: number) => void;
}

const CAMERA_OPTIONS: { id: CameraPreset; label: string }[] = [
  { id: 'side', label: '측면' },
  { id: 'chase', label: '추적' },
  { id: 'front', label: '정면' },
  { id: 'scenic', label: '전경' },
];

const TIME_OPTIONS: { id: TimeOfDay; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'morning', label: '아침', Icon: Sun },
  { id: 'golden', label: '노을', Icon: Sunset },
  { id: 'twilight', label: '밤바다', Icon: Moon },
];

export const ControlDock: React.FC<ControlDockProps> = ({
  isFullscreen,
  onToggleFullscreen,
  collapsed,
  onToggleCollapsed,
  isPlaying,
  onTogglePlay,
  targetSpeed,
  onSpeedChange,
  speedKmh,
  cadenceRpm,
  cameraPreset,
  onCameraPreset,
  timeOfDay,
  onTimeOfDay,
  isMuted,
  onToggleMute,
  isBgmEnabled,
  onToggleBgm,
  onRingBell,
  onSteer,
}) => {
  return (
    <div
      className={`${
        isFullscreen ? 'fixed bottom-3 sm:bottom-4' : 'absolute bottom-2.5 sm:bottom-3'
      } left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none w-[calc(100%-1rem)] sm:w-max max-w-[980px]`}
    >
      {/* Collapse / Expand Toggle */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-t-md rounded-b-sm bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
        title="조작 패널 접기/펼치기"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            <span>조작 패널 열기</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            <span>조작 패널 숨기기</span>
          </>
        )}
      </button>

      {/* Collapsible Unified Control Dock (Responsive Mobile + Desktop Icon Layout) */}
      <div
        className={`pointer-events-auto w-full rounded-xl bg-slate-950/92 border border-white/15 shadow-2xl px-2 py-2 sm:px-3.5 sm:py-2.5 transition-all duration-200 ease-out origin-bottom ${
          collapsed
            ? 'opacity-0 translate-y-4 pointer-events-none max-h-0 py-0 overflow-hidden border-0'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-1.5 sm:gap-x-3.5 sm:gap-y-2">
          {/* Group 1: Primary Drive Actions + Mobile Quick Utility Icons */}
          <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-1.5 shrink-0 min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onTogglePlay}
                className="inline-flex items-center justify-center gap-1.5 w-[30px] h-7 sm:w-auto sm:h-8 sm:px-3 rounded-md sm:rounded-lg bg-[#D9531E] hover:bg-[#c24616] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                title="주행 / 일시정지 (P)"
                aria-label={isPlaying ? '일시정지' : '주행'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isPlaying ? '일시정지' : '주행'}</span>
              </button>

              <button
                type="button"
                onClick={onRingBell}
                className="inline-flex items-center justify-center gap-1.5 w-7 h-7 sm:w-auto sm:h-8 sm:px-2.5 rounded-md sm:rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-amber-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
                title="경적 울리기"
                aria-label="경적 울리기"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">경적</span>
              </button>

              {/* Steer Buttons inline on mobile for thumb access */}
              <div className="flex sm:hidden items-center bg-slate-900 rounded-md p-0.5 border border-white/10 h-7 shrink-0">
                <button
                  type="button"
                  onPointerDown={() => onSteer(1)}
                  onPointerUp={() => onSteer(0)}
                  onPointerLeave={() => onSteer(0)}
                  className="w-6 h-full inline-flex items-center justify-center text-[11px] font-semibold text-slate-200 hover:text-white active:bg-slate-700 rounded transition-colors cursor-pointer"
                  title="좌측 이동"
                  aria-label="좌측 이동"
                >
                  ←
                </button>
                <button
                  type="button"
                  onPointerDown={() => onSteer(-1)}
                  onPointerUp={() => onSteer(0)}
                  onPointerLeave={() => onSteer(0)}
                  className="w-6 h-full inline-flex items-center justify-center text-[11px] font-semibold text-slate-200 hover:text-white active:bg-slate-700 rounded transition-colors cursor-pointer"
                  title="우측 이동"
                  aria-label="우측 이동"
                >
                  →
                </button>
              </div>
            </div>

            {/* Mobile-only compact audio & fullscreen icon cluster on Row 1 right */}
            <div className="flex sm:hidden items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleBgm}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors shrink-0 cursor-pointer ${
                  isBgmEnabled && !isMuted
                    ? 'bg-amber-500/20 border-amber-400/35 text-amber-300'
                    : 'bg-slate-900 border-white/10 text-slate-400'
                }`}
                title="제주 민요 켜기/끄기"
                aria-label="제주 민요 켜기/끄기"
              >
                <Music className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors shrink-0 cursor-pointer ${
                  isMuted
                    ? 'bg-slate-900 border-white/10 text-slate-400'
                    : 'bg-teal-500/20 border-teal-400/35 text-teal-300'
                }`}
                title={isMuted ? '소리 켜기' : '음소거'}
                aria-label={isMuted ? '소리 켜기' : '음소거'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={onToggleFullscreen}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-100 transition-colors shrink-0 cursor-pointer"
                title={isFullscreen ? '축소' : '전체화면'}
                aria-label={isFullscreen ? '축소' : '전체화면'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="h-5 w-px bg-white/10 hidden sm:block shrink-0" aria-hidden="true" />

          {/* Group 2: Speed Slider & Desktop Steer */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto min-w-0">
            <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-2 sm:gap-1 w-full sm:w-auto min-w-0">
              <span className="sm:hidden text-[11px] font-medium text-slate-300 whitespace-nowrap shrink-0">
                속도
              </span>
              <div className="hidden sm:flex items-center justify-between gap-2 text-[11px] text-slate-300">
                <span>속도</span>
                <span className="font-mono-tabular text-amber-300 font-medium">
                  {speedKmh.toFixed(1)} km/h · {Math.round(cadenceRpm)} rpm
                </span>
              </div>
              <input
                type="range"
                min={1.8}
                max={10.5}
                step={0.1}
                value={targetSpeed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                className="dock-slider flex-1 min-w-0 sm:flex-none sm:w-32"
                aria-label="주행 속도 조절"
              />
              <span className="sm:hidden font-mono-tabular text-[11px] text-amber-300 font-medium whitespace-nowrap shrink-0 w-14 text-right">
                {speedKmh.toFixed(1)} km/h
              </span>
            </div>

            <div className="hidden sm:flex items-center bg-slate-900 rounded-lg p-0.5 border border-white/10">
              <button
                type="button"
                onPointerDown={() => onSteer(1)}
                onPointerUp={() => onSteer(0)}
                onPointerLeave={() => onSteer(0)}
                className="px-2 py-1.5 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                title="좌측 이동"
              >
                ←
              </button>
              <span className="px-1 text-[11px] text-slate-400 whitespace-nowrap">조향</span>
              <button
                type="button"
                onPointerDown={() => onSteer(-1)}
                onPointerUp={() => onSteer(0)}
                onPointerLeave={() => onSteer(0)}
                className="px-2 py-1.5 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                title="우측 이동"
              >
                →
              </button>
            </div>
          </div>

          <div className="h-5 w-px bg-white/10 hidden md:block shrink-0" aria-hidden="true" />

          {/* Group 3: Camera Views + Time-of-Day Icons (clean single compact row on mobile!) */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-3 shrink-0 w-full sm:w-auto min-w-0">
            {/* Camera Views */}
            <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
              <Camera className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" aria-hidden="true" />
              <div className="grid grid-cols-4 sm:flex items-center bg-slate-900 p-0.5 rounded-md sm:rounded-lg border border-white/10 w-full sm:w-auto">
                {CAMERA_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onCameraPreset(opt.id)}
                    className={`px-1 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded sm:rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer text-center ${
                      cameraPreset === opt.id
                        ? 'bg-slate-100 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-5 w-px bg-white/10 hidden lg:block shrink-0" aria-hidden="true" />

            {/* Time-of-Day Selector (icon-only compact on mobile, icon+label on sm+) */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-md sm:rounded-lg border border-white/10 shrink-0">
              {TIME_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTimeOfDay(id)}
                  className={`inline-flex items-center justify-center gap-1 w-7 h-6 sm:w-auto sm:h-auto sm:px-2 sm:py-1.5 text-xs font-medium rounded sm:rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    timeOfDay === id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'text-slate-300 hover:text-white border border-transparent'
                  }`}
                  title={label}
                  aria-label={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Group 4: Desktop Audio & Fullscreen Actions */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleBgm}
              className={`inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isBgmEnabled && !isMuted
                  ? 'bg-amber-500/20 border-amber-400/35 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="제주 민요(오돌또기·너영나영) 켜기/끄기"
            >
              <Music className="w-3.5 h-3.5" />
              <span>제주 민요</span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                isMuted
                  ? 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                  : 'bg-teal-500/20 border-teal-400/35 text-teal-300 hover:bg-teal-500/30'
              }`}
              title={isMuted ? '소리 켜기' : '음소거'}
              aria-label={isMuted ? '소리 켜기' : '음소거'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={isFullscreen ? '웹사이트로 돌아가기 (Esc)' : '3D 전체화면 보기'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>축소</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>전체화면</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
