import { useCallback, useEffect, useRef, useState } from 'react';
import { MicStatus, SoundEngine } from './audio/soundEngine';
import { GameHud } from './components/GameHud';
import { GameOverModal, PauseModal } from './components/GameModals';
import { MicSetupModal } from './components/MicSetupModal';
import { TitleScreen } from './components/TitleScreen';
import { TutorialModal } from './components/TutorialModal';
import { GameState, INITIAL_LIVES, KickPowerTier } from './game/rules';
import { HudSnapshot, ScreamSmashEngine } from './game/ScreamSmashEngine';

const INITIAL_HUD: HudSnapshot = {
  gameState: 'title',
  score: 0,
  bestScore: 0,
  distance: 0,
  lives: INITIAL_LIVES,
  maxLives: INITIAL_LIVES,
  combo: 0,
  smashedCount: 0,
  superScreamTimer: 0,
  doubleKickTimer: 0,
  lastKickTier: 'none',
  lastEventText: '',
  lastEventId: 0,
  hurtFlash: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const engineRef = useRef<ScreamSmashEngine | null>(null);

  const hudMeterBarRef = useRef<HTMLDivElement | null>(null);
  const modalMeterBarRef = useRef<HTMLDivElement | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [gameState, setGameState] = useState<GameState>('title');
  const [liveTier, setLiveTier] = useState<KickPowerTier>('none');
  const liveTierRef = useRef<KickPowerTier>('none');

  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [micError, setMicError] = useState('');
  const [threshold, setThreshold] = useState(0.24);
  const [micGain, setMicGain] = useState(1.9);
  const [muted, setMuted] = useState(false);

  const [micSetupOpen, setMicSetupOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Refs for latest state inside window keyboard listeners
  const stateRef = useRef<{
    gameState: GameState;
    micSetupOpen: boolean;
    tutorialOpen: boolean;
  }>({
    gameState: 'title',
    micSetupOpen: false,
    tutorialOpen: false,
  });

  stateRef.current = { gameState, micSetupOpen, tutorialOpen };

  const handleRequestMic = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    setMicStatus('requesting');
    const res = await sound.startMicrophone();
    setMicStatus(res.status);
    setMicError(res.error);
  }, []);

  const handleStart = useCallback(() => {
    setMicSetupOpen(false);
    setTutorialOpen(false);
    if (soundRef.current && soundRef.current.getMicStatus().status === 'idle') {
      void handleRequestMic();
    }
    engineRef.current?.startRun();
  }, [handleRequestMic]);

  const handleChangeThreshold = useCallback((val: number) => {
    setThreshold(val);
    engineRef.current?.setThreshold(val);
  }, []);

  const handleChangeMicGain = useCallback((val: number) => {
    setMicGain(val);
    engineRef.current?.setMicGain(val);
  }, []);

  const handleToggleMute = useCallback(() => {
    const sound = soundRef.current;
    if (!sound) return;
    const next = !sound.isMuted();
    sound.setMuted(next);
    setMuted(next);
  }, []);

  // Mount Three.js engine & SoundEngine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const sound = new SoundEngine();
    soundRef.current = sound;

    const engine = new ScreamSmashEngine(mount, sound, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onStateChange: (nextState) => {
        setGameState(nextState);
      },
      onVolumeFrame: (volume, tier) => {
        const clamped = Math.max(0, Math.min(1, volume));
        const transform = `scaleX(${clamped.toFixed(3)})`;
        if (hudMeterBarRef.current) {
          hudMeterBarRef.current.style.transform = transform;
        }
        if (modalMeterBarRef.current) {
          modalMeterBarRef.current.style.transform = transform;
        }
        if (liveTierRef.current !== tier) {
          liveTierRef.current = tier;
          setLiveTier(tier);
        }
      },
    });
    engineRef.current = engine;
    document.body.dataset.state = 'title';

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startRun();
    }

    return () => {
      engine.dispose();
      sound.dispose();
      engineRef.current = null;
      soundRef.current = null;
    };
  }, []);

  // Global keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { gameState: gs, micSetupOpen: micOpen, tutorialOpen: tutOpen } =
        stateRef.current;

      if (micOpen || tutOpen) {
        if (e.code === 'Escape') {
          setMicSetupOpen(false);
          setTutorialOpen(false);
        }
        return;
      }

      if (gs === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      if (gs === 'playing') {
        if (e.code === 'Space') {
          e.preventDefault();
          if (!e.repeat) {
            engineRef.current?.triggerManualKick(
              e.shiftKey ? 'super' : 'normal',
            );
          }
        } else if (e.code === 'KeyF') {
          e.preventDefault();
          if (!e.repeat) {
            engineRef.current?.triggerManualKick('super');
          }
        } else if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          engineRef.current?.pauseRun();
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          handleToggleMute();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          engineRef.current?.startRun();
        }
        return;
      }

      if (gs === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          engineRef.current?.resumeRun();
        }
        return;
      }

      if (gs === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          engineRef.current?.startRun();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStart, handleToggleMute]);

  return (
    <main className="relative w-full h-full overflow-hidden bg-sky-200">
      {/* Dedicated isolated WebGL canvas container */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-container"
        className="absolute inset-0 w-full h-full"
      />

      {gameState === 'title' && (
        <TitleScreen
          bestScore={hud.bestScore}
          micStatus={micStatus}
          onStart={handleStart}
          onOpenMicSetup={() => {
            soundRef.current?.unlock();
            setMicSetupOpen(true);
          }}
          onOpenTutorial={() => setTutorialOpen(true)}
        />
      )}

      {gameState === 'playing' && (
        <GameHud
          hud={hud}
          micStatus={micStatus}
          muted={muted}
          threshold={threshold}
          hudMeterBarRef={hudMeterBarRef}
          liveTier={liveTier}
          onManualKick={(tier) => engineRef.current?.triggerManualKick(tier)}
          onToggleMute={handleToggleMute}
          onPause={() => engineRef.current?.pauseRun()}
          onRestart={() => engineRef.current?.startRun()}
          onOpenMicSetup={() => {
            engineRef.current?.pauseRun();
            setMicSetupOpen(true);
          }}
        />
      )}

      <PauseModal
        open={gameState === 'paused' && !micSetupOpen}
        threshold={threshold}
        onChangeThreshold={handleChangeThreshold}
        onResume={() => engineRef.current?.resumeRun()}
        onRestart={() => engineRef.current?.startRun()}
        onOpenMicSetup={() => setMicSetupOpen(true)}
        onQuitToTitle={() => engineRef.current?.returnToTitle()}
      />

      <GameOverModal
        open={gameState === 'gameover'}
        hud={hud}
        onTryAgain={() => engineRef.current?.startRun()}
        onQuitToTitle={() => engineRef.current?.returnToTitle()}
      />

      <MicSetupModal
        open={micSetupOpen}
        micStatus={micStatus}
        micError={micError}
        threshold={threshold}
        micGain={micGain}
        meterBarRef={modalMeterBarRef}
        detectedTier={liveTier}
        onRequestMic={() => void handleRequestMic()}
        onChangeThreshold={handleChangeThreshold}
        onChangeMicGain={handleChangeMicGain}
        onTestSound={() => {
          soundRef.current?.unlock();
          soundRef.current?.playKick('super');
        }}
        onClose={() => setMicSetupOpen(false)}
      />

      <TutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />
    </main>
  );
}
