import React from 'react';
import { Play, RotateCcw, Home, Mic } from 'lucide-react';
import { HudSnapshot } from '../game/ScreamSmashEngine';
import { formatHudInt } from '../game/rules';

interface PauseModalProps {
  open: boolean;
  threshold: number;
  onChangeThreshold: (val: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onOpenMicSetup: () => void;
  onQuitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  open,
  threshold,
  onChangeThreshold,
  onResume,
  onRestart,
  onOpenMicSetup,
  onQuitToTitle,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-zinc-950/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
    >
      <div className="w-full max-w-md bg-amber-50 text-zinc-900 border-[4px] border-zinc-900 rounded-2xl shadow-[8px_8px_0_#18181b] p-6 flex flex-col gap-5">
        <h2
          id="pause-modal-title"
          className="font-display font-extrabold text-3xl text-center"
        >
          GAME PAUSED
        </h2>

        <label className="flex flex-col gap-1.5 bg-white border-2 border-zinc-900 rounded-xl p-3.5 text-sm font-bold">
          <div className="flex items-center justify-between">
            <span>Voice Kick Threshold</span>
            <span className="font-mono-num">{Math.round(threshold * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.08}
            max={0.65}
            step={0.02}
            value={threshold}
            onChange={(e) => onChangeThreshold(parseFloat(e.target.value))}
            className="accent-orange-500 h-2.5 cursor-pointer"
          />
        </label>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onResume();
            }}
            className="inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 font-display font-extrabold text-lg border-[3px] border-zinc-900 shadow-[4px_4px_0_#18181b] cursor-pointer"
          >
            <Play className="w-5 h-5 fill-zinc-950" />
            RESUME RUN
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenMicSetup();
            }}
            className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-300 hover:bg-amber-200 font-display font-extrabold text-base border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] cursor-pointer"
          >
            <Mic className="w-5 h-5" />
            MIC TEST &amp; CALIBRATION
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-slate-100 font-display font-extrabold text-sm border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              RESTART
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onQuitToTitle();
              }}
              className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-slate-100 font-display font-extrabold text-sm border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] cursor-pointer"
            >
              <Home className="w-4 h-4" />
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  open: boolean;
  hud: HudSnapshot;
  onTryAgain: () => void;
  onQuitToTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  open,
  hud,
  onTryAgain,
  onQuitToTitle,
}) => {
  if (!open) return null;

  const isNewBest = hud.score > 0 && hud.score >= hud.bestScore;

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-zinc-950/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-modal-title"
    >
      <div className="w-full max-w-md bg-amber-50 text-zinc-900 border-[4px] border-zinc-900 rounded-2xl shadow-[8px_8px_0_#18181b] p-6 flex flex-col gap-5">
        <div className="text-center">
          <h2
            id="gameover-modal-title"
            className="font-display font-extrabold text-4xl text-rose-600 arcade-stroke-sm"
          >
            WIPEOUT!
          </h2>
          {isNewBest && (
            <p className="mt-1 font-display font-extrabold text-sm text-emerald-700">
              NEW HIGH SCORE!
            </p>
          )}
        </div>

        {/* 2x2 Progress-Toward-Goal Stat Tiles */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border-[2.5px] border-zinc-900 rounded-xl p-3 text-center">
            <div className="text-[11px] font-extrabold uppercase text-zinc-500">
              Final Score
            </div>
            <div className="font-display font-extrabold text-2xl font-mono-num text-zinc-950">
              {formatHudInt(hud.score)}
            </div>
          </div>

          <div className="bg-white border-[2.5px] border-zinc-900 rounded-xl p-3 text-center">
            <div className="text-[11px] font-extrabold uppercase text-zinc-500">
              Best Score
            </div>
            <div className="font-display font-extrabold text-2xl font-mono-num text-amber-600">
              {formatHudInt(hud.bestScore)}
            </div>
          </div>

          <div className="bg-white border-[2.5px] border-zinc-900 rounded-xl p-3 text-center">
            <div className="text-[11px] font-extrabold uppercase text-zinc-500">
              Distance
            </div>
            <div className="font-display font-extrabold text-xl font-mono-num text-sky-700">
              {formatHudInt(hud.distance)}m
            </div>
          </div>

          <div className="bg-white border-[2.5px] border-zinc-900 rounded-xl p-3 text-center">
            <div className="text-[11px] font-extrabold uppercase text-zinc-500">
              Smashed
            </div>
            <div className="font-display font-extrabold text-xl font-mono-num text-emerald-700">
              {formatHudInt(hud.smashedCount)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onTryAgain();
            }}
            className="inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 font-display font-extrabold text-xl border-[3px] border-zinc-900 shadow-[4px_4px_0_#18181b] cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            TRY AGAIN
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onQuitToTitle();
            }}
            className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-slate-100 font-display font-extrabold text-base border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] cursor-pointer"
          >
            <Home className="w-4 h-4" />
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
