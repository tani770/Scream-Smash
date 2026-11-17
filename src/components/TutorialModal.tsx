import React from 'react';
import { X, Volume2, Zap, ShieldAlert } from 'lucide-react';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-zinc-950/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="w-full max-w-xl bg-amber-50 text-zinc-900 border-[4px] border-zinc-900 rounded-2xl shadow-[8px_8px_0_#18181b] p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <h2 id="tutorial-title" className="font-display font-extrabold text-2xl">
            How to Play Scream &amp; Smash
          </h2>
          <button
            type="button"
            aria-label="Close tutorial"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white hover:bg-rose-100 border-[2.5px] border-zinc-900 shadow-[2px_2px_0_#18181b] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voice Power Tiers */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 font-display font-extrabold text-base">
            <Volume2 className="w-5 h-5 text-orange-600" />
            <span>Louder Scream = Stronger Kick</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-sm">
            <div className="bg-emerald-100 border-2 border-zinc-900 rounded-xl p-3">
              <div className="font-display font-extrabold text-emerald-950">Low Scream</div>
              <div className="text-xs font-semibold text-zinc-700 mt-1">
                Weak Kick — Breaks Hurdles &amp; Wood Barriers
              </div>
            </div>
            <div className="bg-orange-100 border-2 border-zinc-900 rounded-xl p-3">
              <div className="font-display font-extrabold text-orange-950">Medium Scream</div>
              <div className="text-xs font-semibold text-zinc-700 mt-1">
                Normal Kick — Shatters Boulders &amp; Sliding Gates
              </div>
            </div>
            <div className="bg-yellow-200 border-2 border-zinc-900 rounded-xl p-3">
              <div className="font-display font-extrabold text-zinc-950">LOUD SCREAM!</div>
              <div className="text-xs font-semibold text-zinc-800 mt-1">
                SUPER SMASH — Obliterates Brick Walls + Bonus Score!
              </div>
            </div>
          </div>
        </div>

        {/* Power-Ups */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 font-display font-extrabold text-base">
            <Zap className="w-5 h-5 text-sky-600" />
            <span>Arcade Power-Ups</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
            <div className="bg-white border-2 border-zinc-900 rounded-xl p-3">
              <div className="font-display font-extrabold text-amber-600">Super Scream Horn</div>
              <div className="text-xs font-semibold text-zinc-700 mt-1">
                Every sound above threshold unleashes a full Super Smash for 8.5s!
              </div>
            </div>
            <div className="bg-white border-2 border-zinc-900 rounded-xl p-3">
              <div className="font-display font-extrabold text-cyan-600">Double Kick Boots</div>
              <div className="text-xs font-semibold text-zinc-700 mt-1">
                Fires twin shockwaves with 2x kick damage, longer reach &amp; 2x points!
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard & Touch Fallback */}
        <div className="flex items-start gap-2.5 bg-sky-100 border-2 border-zinc-900 rounded-xl p-3.5 text-sm">
          <ShieldAlert className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
          <div className="font-semibold text-zinc-800">
            <strong>Keyboard &amp; Touch Fallback:</strong> Playing in a quiet space? Press{' '}
            <kbd className="px-1.5 py-0.5 bg-white border border-zinc-900 rounded text-xs font-mono-num">
              Space
            </kbd>{' '}
            for Normal Kick,{' '}
            <kbd className="px-1.5 py-0.5 bg-white border border-zinc-900 rounded text-xs font-mono-num">
              Shift+Space
            </kbd>{' '}
            (or{' '}
            <kbd className="px-1.5 py-0.5 bg-white border border-zinc-900 rounded text-xs font-mono-num">
              F
            </kbd>
            ) for Super Smash, or tap the on-screen Kick buttons!
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-end px-6 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 font-display font-extrabold text-base border-[2.5px] border-zinc-900 shadow-[3px_3px_0_#18181b] cursor-pointer"
        >
          Got It!
        </button>
      </div>
    </div>
  );
};
