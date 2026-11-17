import React from 'react';
import { Mic, MicOff, Volume2, X, ShieldCheck } from 'lucide-react';
import { MicStatus } from '../audio/soundEngine';
import { KickPowerTier } from '../game/rules';

interface MicSetupModalProps {
  open: boolean;
  micStatus: MicStatus;
  micError: string;
  threshold: number;
  micGain: number;
  meterBarRef: React.RefObject<HTMLDivElement | null>;
  detectedTier: KickPowerTier;
  onRequestMic: () => void;
  onChangeThreshold: (val: number) => void;
  onChangeMicGain: (val: number) => void;
  onTestSound: () => void;
  onClose: () => void;
}

export const MicSetupModal: React.FC<MicSetupModalProps> = ({
  open,
  micStatus,
  micError,
  threshold,
  micGain,
  meterBarRef,
  detectedTier,
  onRequestMic,
  onChangeThreshold,
  onChangeMicGain,
  onTestSound,
  onClose,
}) => {
  if (!open) return null;

  const thresholdPct = Math.round(threshold * 100);
  const tierBadge =
    detectedTier === 'super'
      ? { label: 'SUPER SMASH DETECTED!', cls: 'bg-yellow-300 text-zinc-950' }
      : detectedTier === 'normal'
        ? { label: 'NORMAL KICK DETECTED!', cls: 'bg-orange-400 text-zinc-950' }
        : detectedTier === 'weak'
          ? { label: 'WEAK KICK DETECTED!', cls: 'bg-emerald-300 text-zinc-950' }
          : { label: 'Say "HA!" or scream to test...', cls: 'bg-slate-800 text-slate-200' };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-zinc-950/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mic-setup-title"
    >
      <div className="w-full max-w-lg bg-amber-50 text-zinc-900 border-[4px] border-zinc-900 rounded-2xl shadow-[8px_8px_0_#18181b] p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <h2 id="mic-setup-title" className="font-display font-extrabold text-2xl">
            Microphone Setup &amp; Test
          </h2>
          <button
            type="button"
            aria-label="Close microphone setup"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white hover:bg-rose-100 border-[2.5px] border-zinc-900 shadow-[2px_2px_0_#18181b] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-emerald-950 bg-emerald-100 border-2 border-zinc-900 rounded-xl p-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <span>
            Privacy safe: Audio is processed locally in your browser in real time and is never recorded, stored, or uploaded.
          </span>
        </div>

        {/* Mic Activation Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-[2.5px] border-zinc-900 rounded-xl p-3.5">
          <div className="flex items-center gap-2.5">
            {micStatus === 'active' ? (
              <Mic className="w-5 h-5 text-emerald-600" />
            ) : (
              <MicOff className="w-5 h-5 text-rose-600" />
            )}
            <span className="font-bold text-sm">
              {micStatus === 'active'
                ? 'Microphone Active & Listening'
                : micStatus === 'requesting'
                  ? 'Requesting Permission...'
                  : micStatus === 'denied'
                    ? 'Mic Permission Denied / Unavailable'
                    : micStatus === 'unsupported'
                      ? 'Browser Mic API Unavailable'
                      : 'Microphone Not Enabled Yet'}
            </span>
          </div>

          <button
            type="button"
            onClick={onRequestMic}
            className="px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 text-zinc-950 font-display font-extrabold text-sm border-2 border-zinc-900 shadow-[2px_2px_0_#18181b] cursor-pointer whitespace-nowrap"
          >
            {micStatus === 'active' ? 'Reconnect Mic' : 'Enable Microphone'}
          </button>
        </div>

        {micError && (
          <p className="text-xs font-bold text-rose-700 bg-rose-100 border-2 border-rose-400 rounded-lg px-3 py-2">
            {micError} — You can still play anytime using Spacebar (Kick) and Shift+Space (Super Smash).
          </p>
        )}

        {/* Live Voice Amplitude Meter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wide text-zinc-700">
            <span>Live Voice Volume Meter</span>
            <span className="font-mono-num">Threshold: {thresholdPct}%</span>
          </div>

          <div className="relative h-9 w-full bg-zinc-900 rounded-xl border-[3px] border-zinc-900 overflow-hidden">
            {/* Live bar scaled via ref at 60Hz */}
            <div
              ref={meterBarRef}
              style={{ transform: 'scaleX(0)' }}
              className="absolute inset-0 origin-left bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 will-change-transform"
            />
            {/* Calibrated threshold marker */}
            <div
              style={{ left: `${thresholdPct}%` }}
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_0_2px_#18181b] z-10"
            />
          </div>

          <div
            className={`text-center font-display font-extrabold text-sm py-2 rounded-lg border-2 border-zinc-900 transition-colors ${tierBadge.cls}`}
          >
            {tierBadge.label}
          </div>
        </div>

        {/* Calibration Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            <span>Kick Threshold ({thresholdPct}%)</span>
            <input
              type="range"
              min={0.08}
              max={0.65}
              step={0.02}
              value={threshold}
              onChange={(e) => onChangeThreshold(parseFloat(e.target.value))}
              className="accent-orange-500 h-2.5 cursor-pointer"
            />
            <span className="text-xs font-medium text-zinc-600">
              Lower = triggers easier · Higher = ignores room noise
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-bold">
            <span>Mic Sensitivity Boost ({micGain.toFixed(1)}x)</span>
            <input
              type="range"
              min={0.8}
              max={3.5}
              step={0.1}
              value={micGain}
              onChange={(e) => onChangeMicGain(parseFloat(e.target.value))}
              className="accent-emerald-500 h-2.5 cursor-pointer"
            />
            <span className="text-xs font-medium text-zinc-600">
              Boost quiet laptop or phone microphones
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onTestSound}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 font-bold text-sm border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            Test Kick SFX
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 font-display font-extrabold text-base border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
