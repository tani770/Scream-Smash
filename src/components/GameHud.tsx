import React from 'react';
import { Mic, MicOff, Pause, RotateCcw, Volume2, VolumeX, Zap } from 'lucide-react';
import { MicStatus } from '../audio/soundEngine';
import { HudSnapshot } from '../game/ScreamSmashEngine';
import { formatHudInt, KickPowerTier } from '../game/rules';

interface GameHudProps {
  hud: HudSnapshot;
  micStatus: MicStatus;
  muted: boolean;
  threshold: number;
  hudMeterBarRef: React.RefObject<HTMLDivElement | null>;
  liveTier: KickPowerTier;
  onManualKick: (tier: KickPowerTier) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onOpenMicSetup: () => void;
}

const HeartPip: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_0_#18181b]"
    aria-hidden="true"
  >
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={filled ? '#ef4444' : '#334155'}
      stroke="#18181b"
      strokeWidth="2.2"
    />
    {filled && (
      <path
        d="M6.8 6.4c.7-.6 1.5-.8 2.2-.7"
        stroke="#fecaca"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    )}
  </svg>
);

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  micStatus,
  muted,
  threshold,
  hudMeterBarRef,
  liveTier,
  onManualKick,
  onToggleMute,
  onPause,
  onRestart,
  onOpenMicSetup,
}) => {
  const thresholdPct = Math.round(threshold * 100);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Peripheral Damage Vignette */}
      {hud.hurtFlash > 0.02 && (
        <div
          style={{
            opacity: Math.min(0.65, hud.hurtFlash * 0.65),
            boxShadow: 'inset 0 0 90px 28px rgba(239, 68, 68, 0.95)',
          }}
          className="fixed inset-0 pointer-events-none"
        />
      )}

      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Score, Distance & Lives */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-3 sm:gap-4 bg-zinc-950/75 border-[2.5px] border-zinc-900 rounded-xl px-3.5 py-2 shadow-[3px_3px_0_#18181b]">
            <div>
              <div className="text-[10px] font-extrabold tracking-wider uppercase text-amber-300">
                Score
              </div>
              <div
                data-testid="hud-score"
                className="font-display font-extrabold text-2xl sm:text-3xl leading-none text-white font-mono-num arcade-stroke-sm"
              >
                {formatHudInt(hud.score)}
              </div>
            </div>

            <div className="h-7 w-px bg-white/15" />

            <div>
              <div className="text-[10px] font-extrabold tracking-wider uppercase text-sky-300">
                Dist
              </div>
              <div
                data-testid="hud-distance"
                className="font-display font-extrabold text-lg sm:text-xl leading-none text-white font-mono-num"
              >
                {formatHudInt(hud.distance)}m
              </div>
            </div>

            {hud.combo >= 2 && (
              <>
                <div className="h-7 w-px bg-white/15" />
                <div className="font-display font-extrabold text-lg text-yellow-300 font-mono-num">
                  {hud.combo}x
                </div>
              </>
            )}
          </div>

          {/* Vitality Heart Pips */}
          <div
            className="flex items-center gap-1.5 pl-1"
            aria-label={`Lives remaining: ${hud.lives} of ${hud.maxLives}`}
            data-testid="hud-lives"
          >
            {Array.from({ length: hud.maxLives }).map((_, idx) => (
              <HeartPip key={idx} filled={idx < hud.lives} />
            ))}
          </div>
        </div>

        {/* Center-Top Dynamic Callout */}
        {hud.lastEventText && (
          <div
            key={hud.lastEventId}
            className="hidden sm:block mt-1 px-4 py-1.5 rounded-xl bg-yellow-300 text-zinc-950 font-display font-extrabold text-base border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] whitespace-nowrap"
          >
            {hud.lastEventText}
          </div>
        )}

        {/* Top-Right Compact Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Microphone settings"
            title="Microphone settings"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenMicSetup();
            }}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] flex items-center justify-center cursor-pointer transition-colors ${
              micStatus === 'active'
                ? 'bg-emerald-400 hover:bg-emerald-300 text-zinc-950'
                : 'bg-amber-200 hover:bg-amber-100 text-zinc-950'
            }`}
          >
            {micStatus === 'active' ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
            title={muted ? 'Unmute (M)' : 'Mute (M)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white hover:bg-slate-100 text-zinc-950 border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] flex items-center justify-center cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-5 h-5 text-rose-600" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Restart run (R)"
            title="Restart (R)"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white hover:bg-slate-100 text-zinc-950 border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] flex items-center justify-center cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause game (P or Esc)"
            title="Pause (P / Esc)"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-300 hover:bg-amber-200 text-zinc-950 border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] flex items-center justify-center cursor-pointer"
          >
            <Pause className="w-5 h-5 fill-zinc-950" />
          </button>
        </div>
      </div>

      {/* Bottom Perimeter: Active Power-ups + Voice Meter + Tactile Kick Buttons */}
      <div className="flex flex-col items-center gap-2 w-full max-w-xl mx-auto">
        {/* Power-Up Active Timers */}
        {(hud.superScreamTimer > 0 || hud.doubleKickTimer > 0) && (
          <div className="flex items-center gap-2.5">
            {hud.superScreamTimer > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-300 text-zinc-950 font-display font-extrabold text-xs sm:text-sm border-2 border-zinc-900 shadow-[2px_2px_0_#18181b] font-mono-num">
                <Zap className="w-4 h-4 fill-orange-500 text-orange-600" />
                SUPER SCREAM {hud.superScreamTimer.toFixed(1)}s
              </div>
            )}
            {hud.doubleKickTimer > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-300 text-zinc-950 font-display font-extrabold text-xs sm:text-sm border-2 border-zinc-900 shadow-[2px_2px_0_#18181b] font-mono-num">
                <Zap className="w-4 h-4 fill-sky-600 text-sky-700" />
                DOUBLE KICK {hud.doubleKickTimer.toFixed(1)}s
              </div>
            )}
          </div>
        )}

        {/* Voice Meter + Fallback Kick Controls */}
        <div className="pointer-events-auto w-full bg-zinc-950/85 border-[3px] border-zinc-900 rounded-2xl px-3.5 py-2.5 shadow-[4px_4px_0_#18181b] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          {/* Mic Volume Meter */}
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-slate-200">
              <span>
                {micStatus === 'active'
                  ? liveTier === 'super'
                    ? 'POWER: SUPER SMASH!'
                    : liveTier === 'normal'
                      ? 'POWER: NORMAL KICK!'
                      : liveTier === 'weak'
                        ? 'POWER: WEAK KICK'
                        : 'SCREAM TO KICK!'
                  : 'MIC OFF · USE SPACE OR BUTTONS'}
              </span>
              <span className="font-mono-num text-amber-300">
                THR {thresholdPct}%
              </span>
            </div>

            <div className="relative h-5 w-full bg-zinc-800 rounded-lg border-2 border-zinc-950 overflow-hidden">
              <div
                ref={hudMeterBarRef}
                style={{ transform: 'scaleX(0)' }}
                className="absolute inset-0 origin-left bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 will-change-transform"
              />
              <div
                style={{ left: `${thresholdPct}%` }}
                className="absolute top-0 bottom-0 w-1 bg-white z-10 shadow-[0_0_0_1px_#000]"
              />
            </div>
          </div>

          {/* Tactile Keyboard / Mobile Fallback Buttons */}
          <div className="flex items-center gap-2 shrink-0 justify-end">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onManualKick('normal');
              }}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-orange-400 hover:bg-orange-300 active:translate-y-0.5 text-zinc-950 font-display font-extrabold text-xs sm:text-sm border-[2.5px] border-zinc-900 shadow-[2px_2px_0_#18181b] cursor-pointer whitespace-nowrap"
            >
              KICK [SPACE]
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onManualKick('super');
              }}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-yellow-300 hover:bg-yellow-200 active:translate-y-0.5 text-zinc-950 font-display font-extrabold text-xs sm:text-sm border-[2.5px] border-zinc-900 shadow-[2px_2px_0_#18181b] cursor-pointer whitespace-nowrap"
            >
              SMASH!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
