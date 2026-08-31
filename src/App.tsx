import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CENTER_X, CENTER_Y, MAX_CONGESTION, WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import { createInitialState, startGame, updateGame } from './game/logic';
import { useManualControls } from './hooks/useManualControls';
import { useMicrophoneControls } from './hooks/useMicrophoneControls';
import type { Axis, GameState, Pedestrian, Vehicle } from './game/types';

type ControlMode = 'voice' | 'manual';
type PipPose = 'idle' | 'wave' | 'jam' | 'stop' | 'cheer';

const axisLabel = (axis: Axis) => (axis === 'northSouth' ? 'North–South' : 'East–West');
const axisShortLabel = (axis: Axis) => (axis === 'northSouth' ? 'N · S' : 'E · W');

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

const getStoredBest = () => {
  try {
    return Number(window.localStorage.getItem('voice-traffic-cop:best-score')) || 0;
  } catch {
    return 0;
  }
};

const vehicleStyle = (vehicle: Vehicle) => {
  const centerX =
    vehicle.direction === 'northbound' || vehicle.direction === 'southbound'
      ? CENTER_X + vehicle.laneOffset
      : vehicle.position;
  const centerY =
    vehicle.direction === 'eastbound' || vehicle.direction === 'westbound'
      ? CENTER_Y + vehicle.laneOffset
      : vehicle.position;
  const rigSize = vehicle.length * 1.08;

  const rotation =
    vehicle.direction === 'northbound'
      ? '180deg'
      : vehicle.direction === 'southbound'
        ? '0deg'
        : vehicle.direction === 'eastbound'
          ? '-90deg'
          : '90deg';

  const screenY = vehicle.axis === 'northSouth' ? vehicle.position : CENTER_Y + vehicle.laneOffset;
  const perspectiveScale = Math.max(0.86, Math.min(1.12, 0.86 + (screenY / WORLD_HEIGHT) * 0.26));
  const accelerationTilt = Math.max(-3.5, Math.min(3.5, -vehicle.acceleration * 0.08));
  const speedLevel = Math.max(0, Math.min(1, vehicle.speed / 88));

  return {
    left: `${((centerX - rigSize / 2) / WORLD_WIDTH) * 100}%`,
    top: `${((centerY - rigSize / 2) / WORLD_HEIGHT) * 100}%`,
    width: `${((rigSize / WORLD_WIDTH) * 100).toFixed(3)}%`,
    aspectRatio: '1',
    zIndex: 12 + Math.round((screenY / WORLD_HEIGHT) * 8),
    '--vehicle-rotation': rotation,
    '--vehicle-scale': perspectiveScale.toFixed(3),
    '--accel-tilt': `${accelerationTilt.toFixed(2)}deg`,
    '--speed-level': speedLevel.toFixed(3),
    '--motion-duration': `${Math.max(0.42, 1.3 - speedLevel * 0.7).toFixed(2)}s`,
    '--wobble-delay': `${(-vehicle.wobbleSeed).toFixed(2)}s`,
  } as React.CSSProperties;
};

const pedestrianClass = (species: Pedestrian['species']) =>
  ({
    duck: 'duck',
    ferret: 'ferret',
    tortoise: 'tortoise',
    otter: 'otter',
    gazelle: 'gazelle',
    pigeon: 'pigeon',
  })[species];

interface TrafficSignalProps {
  position: 'far-left' | 'far-right' | 'near-left' | 'near-right';
  state: 'red' | 'amber' | 'green';
}

const TrafficSignal = ({ position, state }: TrafficSignalProps) => (
  <div className={`signal-cluster signal-cluster--${position}`} aria-hidden="true">
    <img className="signal-cluster__body" src="/images/signals/juniper-signal-v2.png" alt="" decoding="async" />
    <span className={`signal-cluster__light signal-cluster__light--red ${state === 'red' ? 'is-lit' : ''}`} />
    <span className={`signal-cluster__light signal-cluster__light--amber ${state === 'amber' ? 'is-lit' : ''}`} />
    <span className={`signal-cluster__light signal-cluster__light--green ${state === 'green' ? 'is-lit' : ''}`} />
    <span className="signal-cluster__reflection" />
  </div>
);

interface HelpDialogProps {
  onClose: () => void;
}

const HelpDialog = ({ onClose }: HelpDialogProps) => (
  <div className="overlay overlay--help" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <div className="help-card">
      <button className="close-button" type="button" onClick={onClose} aria-label="Close help">×</button>
      <p className="card__eyebrow">Dispatch handbook</p>
      <h2 id="help-title">Four cues. One happy city.</h2>
      <div className="help-grid">
        <div><span className="cue-icon">↓</span><strong>Low hum</strong><p>Give North–South traffic the green light.</p></div>
        <div><span className="cue-icon">↑</span><strong>High hum</strong><p>Open East–West and release that queue.</p></div>
        <div><span className="cue-icon">■</span><strong>Loud burst</strong><p>Stop every lane for a quick recovery.</p></div>
        <div><span className="cue-icon">✦</span><strong>Steady tone</strong><p>Hold your pitch to earn a flow boost.</p></div>
      </div>
      <div className="help-note">
        <strong>No microphone? No problem.</strong>
        Arrow or WASD keys choose a lane, Space stops traffic, Shift boosts, and P pauses.
      </div>
      <button className="primary-button" type="button" onClick={onClose}>Got it</button>
    </div>
  </div>
);

interface TitleScreenProps {
  highScore: number;
  showHelp: boolean;
  onVoiceStart: () => void;
  onManualStart: () => void;
  onOpenHelp: () => void;
  onCloseHelp: () => void;
}

const TitleScreen = ({ highScore, showHelp, onVoiceStart, onManualStart, onOpenHelp, onCloseHelp }: TitleScreenProps) => (
  <main className="title-page">
    <div className="title-page__glow title-page__glow--one" />
    <div className="title-page__glow title-page__glow--two" />
    <div className="title-layout">
      <section className="intro-copy">
        <div className="intro-brand">
          <span className="intro-brand__mark" aria-hidden="true">〽</span>
          Juniper Junction Dispatch
        </div>
        <div className="intro-heading">
          <p className="card__eyebrow">A tiny city that listens</p>
          <h1><span>Voice</span><span>Traffic Cop</span></h1>
          <p className="intro-lead">Conduct rush hour with a hum. Guide Pip, clear the queues, and keep the coziest crossing in town moving.</p>
        </div>

        <div className="feature-pills" aria-label="Game features">
          <span>Voice controlled</span>
          <span>Audio stays local</span>
          <span>Keyboard friendly</span>
        </div>

        <div className="start-actions">
          <button className="primary-button primary-button--voice" type="button" onClick={onVoiceStart}>
            <span className="button-icon" aria-hidden="true">●</span>
            <span><small>Recommended</small>Play with voice</span>
          </button>
          <button className="secondary-button" type="button" onClick={onManualStart}>Play with keys</button>
        </div>

        <div className="intro-footer">
          <button type="button" className="text-button" onClick={onOpenHelp}>How to play <kbd>H</kbd></button>
          <span>Personal best <strong>{highScore.toLocaleString()}</strong></span>
        </div>
      </section>

      <section className="intro-art" aria-label="Pip directing traffic in Juniper Junction">
        <img src="/images/voice-traffic-cop-hero.png" alt="Pip the hedgehog directing colorful cars with glowing sound waves" decoding="async" fetchPriority="high" />
        <div className="art-vignette" />
        <div className="art-caption">
          <span className="live-dot" />
          <span><small>First assignment</small><strong>Rookie Patrol</strong></span>
        </div>
        <div className="art-callout art-callout--low"><b>Low hum</b><span>North–South</span></div>
        <div className="art-callout art-callout--high"><b>High hum</b><span>East–West</span></div>
      </section>
    </div>
    {showHelp && <HelpDialog onClose={onCloseHelp} />}
  </main>
);

function App() {
  const [game, setGame] = useState<GameState>(createInitialState);
  const [stageScale, setStageScale] = useState(1);
  const [controlMode, setControlMode] = useState<ControlMode>('voice');
  const [highScore, setHighScore] = useState(getStoredBest);
  const [showHelp, setShowHelp] = useState(false);
  const [pipIdlePose, setPipIdlePose] = useState<PipPose>('idle');
  const {
    snapshot,
    laneControl: microphoneControl,
    requestPermission,
    stopMonitoring,
    errorMessage,
  } = useMicrophoneControls();
  const manual = useManualControls();
  const lastFrameRef = useRef<number | null>(null);
  const baselineBestRef = useRef(highScore);

  const laneControl = controlMode === 'voice' ? microphoneControl : manual.laneControl;

  useEffect(() => {
    const updateScale = () => {
      const horizontalPadding = 20;
      const verticalPadding = 20;
      const availableWidth = window.innerWidth - horizontalPadding;
      const availableHeight = window.innerHeight - verticalPadding;
      const nextScale = Math.min(availableWidth / WORLD_WIDTH, availableHeight / WORLD_HEIGHT);
      setStageScale(Math.max(0.24, nextScale));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    const tick = (now: number) => {
      const last = lastFrameRef.current ?? now;
      const delta = Math.min(0.033, (now - last) / 1000);
      lastFrameRef.current = now;
      setGame((current) => updateGame(current, laneControl, delta));
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [laneControl]);

  useEffect(() => {
    if (game.score <= highScore) return;
    setHighScore(game.score);
    try {
      window.localStorage.setItem('voice-traffic-cop:best-score', String(game.score));
    } catch {
      // The game still works when storage is unavailable.
    }
  }, [game.score, highScore]);

  const togglePause = useCallback(() => {
    setGame((current) => {
      if (current.phase === 'running') {
        return { ...current, phase: 'paused', announcement: 'Shift paused' };
      }
      if (current.phase === 'paused') {
        lastFrameRef.current = performance.now();
        return { ...current, phase: 'running', announcement: 'Back on duty' };
      }
      return current;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (game.phase === 'running' || game.phase === 'paused') {
          event.preventDefault();
          togglePause();
        }
      }
      if (event.code === 'KeyH' && !event.repeat) setShowHelp((current) => !current);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        setGame((current) =>
          current.phase === 'running'
            ? { ...current, phase: 'paused', announcement: 'Shift paused while you were away' }
            : current,
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [game.phase, togglePause]);

  useEffect(() => () => stopMonitoring(), [stopMonitoring]);

  useEffect(() => {
    if (game.phase !== 'running') {
      setPipIdlePose('idle');
      return undefined;
    }

    let timeoutId = 0;
    const scheduleReaction = () => {
      timeoutId = window.setTimeout(() => {
        setPipIdlePose(Math.random() > 0.64 ? 'wave' : 'idle');
        scheduleReaction();
      }, 2800 + Math.random() * 3200);
    };

    scheduleReaction();
    return () => window.clearTimeout(timeoutId);
  }, [game.phase]);

  const startRun = async (mode: ControlMode) => {
    let selectedMode = mode;
    if (mode === 'voice') {
      const permissionGranted = await requestPermission();
      if (!permissionGranted) selectedMode = 'manual';
    }
    setControlMode(selectedMode);
    baselineBestRef.current = highScore;
    lastFrameRef.current = performance.now();
    setGame(startGame());
  };

  const switchControlMode = async (mode: ControlMode) => {
    if (mode === 'voice' && snapshot.permission !== 'granted') {
      const permissionGranted = await requestPermission();
      if (!permissionGranted) return;
    }
    setControlMode(mode);
  };

  const restart = () => {
    baselineBestRef.current = highScore;
    lastFrameRef.current = performance.now();
    setGame(startGame());
  };

  const returnToTitle = () => setGame(createInitialState());

  if (game.phase === 'title') {
    return (
      <TitleScreen
        highScore={highScore}
        showHelp={showHelp}
        onVoiceStart={() => void startRun('voice')}
        onManualStart={() => void startRun('manual')}
        onOpenHelp={() => setShowHelp(true)}
        onCloseHelp={() => setShowHelp(false)}
      />
    );
  }

  const activeNS = game.activeAxis === 'northSouth' && game.signalPhase === 'green' && !game.emergencyStop;
  const activeEW = game.activeAxis === 'eastWest' && game.signalPhase === 'green' && !game.emergencyStop;
  const signalStateForAxis = (axis: Axis): TrafficSignalProps['state'] => {
    if (game.emergencyStop || game.signalPhase === 'allRed' || game.activeAxis !== axis) return 'red';
    return game.signalPhase === 'yellow' ? 'amber' : 'green';
  };
  const trafficMood =
    game.congestion < 28 ? 'Gliding' : game.congestion < 58 ? 'Building' : game.congestion < 82 ? 'Tense' : 'Critical';
  const levelName =
    game.difficultyLevel === 1 ? 'Rookie Patrol' : game.difficultyLevel === 2 ? 'Cadet Crossing' : 'Captain Rush';
  const progressToNext = game.difficultyLevel >= 3 ? 100 : Math.min(100, (game.score / game.levelGoal) * 100);
  const congestionLevel = Math.min(MAX_CONGESTION, Math.max(0, game.congestion));
  const queueNS = game.vehicles.filter((vehicle) => vehicle.axis === 'northSouth').length;
  const queueEW = game.vehicles.filter((vehicle) => vehicle.axis === 'eastWest').length;
  const currentQueue = game.activeAxis === 'northSouth' ? queueNS : queueEW;
  const currentInput =
    controlMode === 'voice'
      ? snapshot.command === 'none'
        ? 'Listening'
        : snapshot.transcript
      : manual.laneControl.inputLabel;
  const isPlaying = game.phase === 'running' || game.phase === 'paused';
  const pipPose: PipPose = game.emergencyStop
    ? 'stop'
    : game.signalPhase !== 'green'
      ? 'stop'
      : game.congestion >= 70
        ? 'jam'
        : game.delightFlash > 0.18
          ? 'cheer'
          : game.boostTimer > 0.5
            ? 'wave'
            : pipIdlePose;
  const pipMessage = game.emergencyStop
    ? 'All paws — stop!'
    : game.signalPhase === 'yellow'
      ? 'Easy now — lights changing.'
      : game.signalPhase === 'allRed'
        ? 'Clearing the junction…'
        : game.congestion >= 70
          ? 'Queue building — hold steady!'
          : game.delightFlash > 0.18
            ? 'Clear roads — lovely work!'
            : currentInput;

  const controlButtonProps = (axis: Axis) => ({
    className: `lane-button ${game.activeAxis === axis && game.signalPhase === 'green' && !game.emergencyStop ? 'lane-button--active' : ''}`,
    onClick: () => manual.chooseAxis(axis),
    'aria-pressed': game.activeAxis === axis && game.signalPhase === 'green' && !game.emergencyStop,
  });

  return (
    <main className="app-shell">
      <div className="scene">
        <div className="scene-frame">
          <div
            className={`scene-stage ${game.phase === 'running' ? 'scene--live' : ''} ${game.phase === 'paused' ? 'scene--paused' : ''} ${game.dangerFlash > 0.1 ? 'scene--danger' : ''}`}
            style={
              {
                width: `${WORLD_WIDTH}px`,
                height: `${WORLD_HEIGHT}px`,
                transform: `translate(-50%, -50%) scale(${stageScale})`,
                '--danger-flash': game.dangerFlash,
                '--delight-flash': game.delightFlash,
                '--boost-flash': Math.min(1, game.boostTimer / 4),
              } as React.CSSProperties
            }
          >
            <div className="sun-glow" />
            <div className="cloud cloud--one" />
            <div className="cloud cloud--two" />
            <div className="skyline skyline--far" />
            <div className="skyline skyline--mid" />

            <header className="hud">
              <div className="brand-chip">
                <span className="brand-mark" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <span className="brand-chip__eyebrow">Juniper Junction</span>
                  <strong>Voice Traffic Cop</strong>
                </span>
              </div>

              <div className="status-panel" aria-label="Shift stats">
                <div className="metric metric--score">
                  <span className="metric__label">Score</span>
                  <strong>{game.score.toLocaleString()}</strong>
                </div>
                <div className="metric">
                  <span className="metric__label">Streak</span>
                  <strong>×{game.streak}</strong>
                </div>
                <div className="metric">
                  <span className="metric__label">Level</span>
                  <strong>{game.difficultyLevel}</strong>
                </div>
                <div className="metric">
                  <span className="metric__label">Best</span>
                  <strong>{highScore.toLocaleString()}</strong>
                </div>
                {isPlaying && (
                  <button className="icon-button" type="button" onClick={togglePause} aria-label={game.phase === 'paused' ? 'Resume game' : 'Pause game'}>
                    {game.phase === 'paused' ? '▶' : 'Ⅱ'}
                  </button>
                )}
              </div>
            </header>

            <div className="objective-strip">
              <span className="objective-strip__label">
                {game.signalPhase === 'green' && !game.emergencyStop ? 'Open lane' : game.signalPhase === 'yellow' ? 'Changing lights' : 'Safety clearance'}
              </span>
              <strong>{game.signalPhase === 'green' && !game.emergencyStop ? axisLabel(game.activeAxis) : 'All lanes holding'}</strong>
              <span className="objective-strip__queue">{currentQueue} vehicles in route</span>
            </div>

            <div className="street-stage">
              <img className="game-world-art" src="/images/juniper-junction-world.png" alt="" aria-hidden="true" decoding="async" />
              <div className="world-lighting" aria-hidden="true" />
              <div className="ambient-particles" aria-hidden="true">
                {new Array(14).fill(null).map((_, index) => <i key={index} />)}
              </div>
              <div className="city-block city-block--top-left">
                <div className="building cluster-a">
                  <span className="awning" />
                  <span className="window window--round" />
                  <span className="window window--tall" />
                </div>
                <div className="tiny-lane tiny-lane--left" />
              </div>
              <div className="city-block city-block--top-right">
                <div className="building cluster-b">
                  <span className="sign sign--tram">Tram</span>
                  <span className="window window--wide" />
                </div>
              </div>
              <div className="city-block city-block--bottom-left">
                <div className="building cluster-c">
                  <span className="sign sign--tea">Berry Tea</span>
                  <span className="planter" />
                </div>
              </div>
              <div className="city-block city-block--bottom-right">
                <div className="building cluster-d">
                  <span className="sign sign--mail">Snail Mail</span>
                  <span className="bench" />
                </div>
              </div>

              <div className={`road road--vertical ${activeNS ? 'road--active' : ''}`} />
              <div className={`road road--horizontal ${activeEW ? 'road--active' : ''}`} />
              <div className={`crosswalk crosswalk--top ${activeEW ? 'crosswalk--go' : ''}`} />
              <div className={`crosswalk crosswalk--bottom ${activeEW ? 'crosswalk--go' : ''}`} />
              <div className={`crosswalk crosswalk--left ${activeNS ? 'crosswalk--go' : ''}`} />
              <div className={`crosswalk crosswalk--right ${activeNS ? 'crosswalk--go' : ''}`} />

              <div className="intersection-center">
                <div className="roundabout-bloom" />
                <div className={`voice-wave voice-wave--${game.activeAxis} ${game.emergencyStop || game.signalPhase === 'allRed' ? 'voice-wave--stop' : ''} ${game.boostTimer > 0.5 ? 'voice-wave--boost' : ''}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="pip">
                  <div className={`speech-ribbon ${laneControl.inputLabel ? 'speech-ribbon--live' : ''}`}>{pipMessage}</div>
                  <div className={`pip-avatar pip-avatar--${game.activeAxis} ${game.congestion > 70 ? 'pip-avatar--urgent' : ''} ${game.emergencyStop || game.signalPhase !== 'green' ? 'pip-avatar--stop' : ''}`}>
                    <span className="pip-avatar__glow" />
                    <img
                      key={pipPose}
                      className={`pip-avatar__pose pip-avatar__pose--${pipPose}`}
                      src={`/images/pip/pip-${pipPose}-v2.png`}
                      alt="Pip Bristle directing the intersection"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>

              <TrafficSignal position="far-left" state={signalStateForAxis('northSouth')} />
              <TrafficSignal position="far-right" state={signalStateForAxis('eastWest')} />
              <TrafficSignal position="near-left" state={signalStateForAxis('eastWest')} />
              <TrafficSignal position="near-right" state={signalStateForAxis('northSouth')} />

              {game.vehicles.map((vehicle) => {
                const waiting = vehicle.speed < 7 && vehicle.waitingTime > 0.6;
                const braking = vehicle.acceleration < -18;
                const boosted = vehicle.axis === game.activeAxis && game.signalPhase === 'green' && game.boostTimer > 0.5 && vehicle.speed > 25;
                const mood = game.congestion > 70 ? '!' : vehicle.id % 2 === 0 ? '…' : '♪';

                return (
                  <div
                    className={`vehicle vehicle--${vehicle.kind} ${vehicle.axis === game.activeAxis ? 'vehicle--favored' : ''} ${vehicle.speed > 7 ? 'vehicle--moving' : ''} ${waiting ? 'vehicle--waiting' : ''} ${braking ? 'vehicle--braking' : ''} ${boosted ? 'vehicle--boosted' : ''}`}
                    style={vehicleStyle(vehicle)}
                    key={vehicle.id}
                    aria-hidden="true"
                  >
                    <div className="vehicle__rig">
                      <span className="vehicle__ground-shadow" />
                      <span className="vehicle__speed-trail"><i /><i /></span>
                      <span className="vehicle__exhaust"><i /><i /><i /></span>
                      <img
                        className="vehicle__sprite"
                        src={`/images/vehicles/${vehicle.kind}-top.webp`}
                        alt=""
                        draggable={false}
                        decoding="async"
                      />
                      <span className="vehicle__headlight vehicle__headlight--one" />
                      <span className="vehicle__headlight vehicle__headlight--two" />
                      <span className="vehicle__brake-light vehicle__brake-light--one" />
                      <span className="vehicle__brake-light vehicle__brake-light--two" />
                    </div>
                    {waiting && <span className="vehicle__mood">{mood}</span>}
                  </div>
                );
              })}

              {game.pedestrians.map((pedestrian) => (
                <div
                  key={pedestrian.id}
                  className={`pedestrian pedestrian--${pedestrian.side}`}
                  style={{
                    left: `${(pedestrian.x / WORLD_WIDTH) * 100}%`,
                    transform: `translateY(${Math.sin(pedestrian.bob) * 4}px)`,
                  }}
                >
                  <span className="pedestrian__shadow" />
                  <span className={`pedestrian__body pedestrian__body--${pedestrianClass(pedestrian.species)}`} />
                </div>
              ))}
            </div>

            <aside className="control-dock" aria-label="Traffic controls">
              <div className="control-dock__header">
                <div>
                  <span className="panel-kicker">Controller</span>
                  <strong>{controlMode === 'voice' ? 'Voice pilot' : 'Hands-on patrol'}</strong>
                </div>
                <div className="mode-switch">
                  <button type="button" className={controlMode === 'voice' ? 'is-active' : ''} onClick={() => void switchControlMode('voice')} aria-pressed={controlMode === 'voice'}>
                    Voice
                  </button>
                  <button type="button" className={controlMode === 'manual' ? 'is-active' : ''} onClick={() => void switchControlMode('manual')} aria-pressed={controlMode === 'manual'}>
                    Keys
                  </button>
                </div>
              </div>

              {controlMode === 'voice' ? (
                <>
                  <div className="listening-row">
                    <span className={`permission-dot permission-dot--${snapshot.permission}`} />
                    <span>{snapshot.permission === 'granted' ? 'Live input' : 'Microphone idle'}</span>
                    <strong>{snapshot.smoothedPitch ? `${Math.round(snapshot.smoothedPitch)} Hz` : '—'}</strong>
                  </div>
                  <div className="audio-visualizer" aria-label={`Microphone level ${Math.round(snapshot.volume * 100)} percent`}>
                    {new Array(12).fill(null).map((_, index) => (
                      <i
                        key={index}
                        style={{ '--bar-level': Math.max(0.12, Math.min(1, snapshot.volume * 2.8 - index * 0.045)) } as React.CSSProperties}
                      />
                    ))}
                  </div>
                  {snapshot.permission !== 'granted' && (
                    <button className="dock-action" type="button" onClick={() => void switchControlMode('voice')}>
                      Enable microphone
                    </button>
                  )}
                  {errorMessage && <p className="control-error">{errorMessage}</p>}
                  <p className="control-hint">Low hum = N–S · High hum = E–W · Loud = Stop</p>
                </>
              ) : (
                <>
                  <div className="lane-controls">
                    <button type="button" {...controlButtonProps('northSouth')}>
                      <span>↑↓</span>
                      <strong>N–S</strong>
                      <small>W / S / 1</small>
                    </button>
                    <button type="button" {...controlButtonProps('eastWest')}>
                      <span>↔</span>
                      <strong>E–W</strong>
                      <small>A / D / 2</small>
                    </button>
                    <button type="button" className={`lane-button lane-button--stop ${game.emergencyStop ? 'lane-button--active' : ''}`} onClick={manual.triggerStop}>
                      <span>■</span>
                      <strong>Stop</strong>
                      <small>Space</small>
                    </button>
                    <button
                      type="button"
                      className={`lane-button lane-button--boost ${manual.boosting ? 'lane-button--active' : ''}`}
                      onPointerDown={() => manual.setBoost(true)}
                      onPointerUp={() => manual.setBoost(false)}
                      onPointerLeave={() => manual.setBoost(false)}
                      onPointerCancel={() => manual.setBoost(false)}
                    >
                      <span>✦</span>
                      <strong>Boost</strong>
                      <small>Hold Shift</small>
                    </button>
                  </div>
                </>
              )}
            </aside>

            <aside className="shift-panel" aria-label="Traffic health">
              <div className="shift-panel__top">
                <div>
                  <span className="panel-kicker">Traffic mood</span>
                  <strong>{trafficMood}</strong>
                </div>
                <span className={`mood-orb mood-orb--${trafficMood.toLowerCase()}`} />
              </div>
              <div
                className="congestion-meter"
                role="progressbar"
                aria-label="Congestion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(congestionLevel)}
              >
                <span style={{ width: `${congestionLevel}%` }} />
              </div>
              <div className="shift-stats">
                <span><b>{game.carsCleared}</b> cleared</span>
                <span><b>{formatTime(game.elapsed)}</b> shift</span>
                <span><b>{axisShortLabel(game.activeAxis)}</b> open</span>
              </div>
              <div className="level-progress">
                <span style={{ width: `${Math.max(4, progressToNext)}%` }} />
              </div>
              <small>{game.difficultyLevel >= 3 ? 'Maximum traffic level' : `${game.levelGoal - game.score} points to next patrol`}</small>
            </aside>

            <div className="announcement-bar" role="status" aria-live="polite">
              <span aria-hidden="true">✦</span>
              {game.announcement}
            </div>

            {game.phase === 'paused' && (
              <div className="overlay overlay--pause">
                <div className="pause-card">
                  <span className="pause-card__icon" aria-hidden="true">Ⅱ</span>
                  <p className="card__eyebrow">Pip is holding the crossing</p>
                  <h2>Shift paused</h2>
                  <p>Your score and traffic are safe. Take a breath.</p>
                  <button className="primary-button" type="button" onClick={togglePause}>Resume patrol</button>
                  <button className="text-button" type="button" onClick={returnToTitle}>Return to title</button>
                </div>
              </div>
            )}

            {game.phase === 'gameOver' && (
              <div className="overlay overlay--gameover">
                <div className="results-card">
                  <div className="results-card__header">
                    <span className="results-badge">Shift report</span>
                    <p>{game.score > baselineBestRef.current ? 'New personal best' : 'Juniper Junction tangled up'}</p>
                    <h2>{game.score.toLocaleString()}</h2>
                    <span>final score</span>
                  </div>
                  <div className="gameover-stats">
                    <div><span>Cars cleared</span><strong>{game.carsCleared}</strong></div>
                    <div><span>Best streak</span><strong>×{game.bestStreak}</strong></div>
                    <div><span>Patrol reached</span><strong>{game.difficultyLevel}</strong></div>
                    <div><span>Time on duty</span><strong>{formatTime(game.elapsed)}</strong></div>
                  </div>
                  <div className="results-actions">
                    <button className="primary-button" type="button" onClick={restart}>Try another shift</button>
                    <button className="secondary-button" type="button" onClick={returnToTitle}>Back to title</button>
                  </div>
                </div>
              </div>
            )}

            {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
          </div>
        </div>
      </div>
      <div className="orientation-hint" role="status">
        <strong>Turn your screen sideways</strong>
        <span>Juniper Junction plays best in landscape.</span>
      </div>
    </main>
  );
}

export default App;
