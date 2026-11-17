import React from 'react';
import { Mic, Play, BookOpen } from 'lucide-react';
import { MicStatus } from '../audio/soundEngine';

interface TitleScreenProps {
  bestScore: number;
  micStatus: MicStatus;
  onStart: () => void;
  onOpenMicSetup: () => void;
  onOpenTutorial: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  bestScore,
  micStatus,
  onStart,
  onOpenMicSetup,
  onOpenTutorial,
}) => {
  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-5 sm:p-8 lg:p-12">
      {/* Left/Upper Negative Space Title Lockup & Menu */}
      <div className="max-w-lg pointer-events-auto flex flex-col items-start gap-5 mt-2 sm:mt-4">
        {/* Custom Inline SVG Arcade Emblem Lockup */}
        <div className="w-full max-w-[440px]">
          <svg
            viewBox="0 0 460 158"
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="Scream and Smash Arcade Logo"
          >
            {/* Dynamic comic burst backdrop */}
            <polygon
              points="18,32 70,12 130,24 195,4 260,22 330,8 402,28 446,18 432,74 452,126 392,138 326,154 248,136 170,152 96,136 22,146 6,88"
              fill="#facc15"
              stroke="#18181b"
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <polygon
              points="28,38 78,22 136,32 198,16 258,32 324,20 392,36 430,28 418,74 434,116 382,128 320,140 248,126 172,140 102,126 36,134 20,86"
              fill="#f97316"
              stroke="#18181b"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <text
              x="230"
              y="72"
              textAnchor="middle"
              fill="#ffffff"
              stroke="#18181b"
              strokeWidth="9"
              paintOrder="stroke fill"
              fontFamily="Bricolage Grotesque, sans-serif"
              fontWeight="800"
              fontSize="54"
              letterSpacing="1.5"
            >
              SCREAM
            </text>
            <text
              x="230"
              y="124"
              textAnchor="middle"
              fill="#fef08a"
              stroke="#18181b"
              strokeWidth="9"
              paintOrder="stroke fill"
              fontFamily="Bricolage Grotesque, sans-serif"
              fontWeight="800"
              fontSize="48"
              letterSpacing="2"
            >
              &amp; SMASH!
            </text>
          </svg>
        </div>

        <p className="text-slate-900 font-bold text-base sm:text-lg leading-snug bg-amber-100/95 border-[3px] border-zinc-900 rounded-xl px-4 py-2.5 shadow-[4px_4px_0_#18181b] max-w-md">
          Shout into your mic to unleash flying kicks and shatter hurdles, barriers, boulders, and brick walls!
        </p>

        {bestScore > 0 && (
          <div className="text-sm font-extrabold text-zinc-900 bg-white/95 border-[2.5px] border-zinc-900 rounded-lg px-3.5 py-1.5 shadow-[3px_3px_0_#18181b] font-mono-num">
            BEST SCORE: {bestScore.toLocaleString('en-US')}
          </div>
        )}

        {/* Primary Menu Actions (<= 3 actions) */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 text-zinc-950 font-display font-extrabold text-xl border-[3px] border-zinc-900 shadow-[4px_4px_0_#18181b] transition-transform cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
          >
            <Play className="w-6 h-6 fill-zinc-950" />
            PLAY NOW
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenMicSetup();
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-amber-300 hover:bg-amber-200 active:translate-y-0.5 text-zinc-950 font-display font-extrabold text-base border-[3px] border-zinc-900 shadow-[4px_4px_0_#18181b] transition-transform cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
          >
            <Mic className="w-5 h-5" />
            {micStatus === 'active' ? 'MIC READY · TEST' : 'MIC SETUP & TEST'}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenTutorial();
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-sky-50 active:translate-y-0.5 text-zinc-950 font-display font-extrabold text-base border-[3px] border-zinc-900 shadow-[4px_4px_0_#18181b] transition-transform cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
          >
            <BookOpen className="w-5 h-5" />
            HOW TO PLAY
          </button>
        </div>
      </div>

      {/* Single flat borderless inline control hint at bottom */}
      <div className="text-center sm:text-left">
        <p className="inline-block text-xs sm:text-sm font-bold text-zinc-900 bg-white/85 px-3 py-1 rounded-md border-2 border-zinc-900/20">
          Scream into Mic or Press Space to Kick · Shift+Space Super Smash · Esc Pause
        </p>
      </div>
    </div>
  );
};
