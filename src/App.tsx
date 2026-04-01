import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { CENTER_X, CENTER_Y, WORLD_HEIGHT, WORLD_WIDTH } from './game/constants';
import { createInitialState, startGame, updateGame } from './game/logic';
import { useMicrophoneControls } from './hooks/useMicrophoneControls';
import type { Axis, GameState, Pedestrian, Vehicle } from './game/types';

const axisLabel = (axis: Axis) => (axis === 'northSouth' ? 'North-South' : 'East-West');

const vehicleStyle = (vehicle: Vehicle) => {
  const isVertical = vehicle.axis === 'northSouth';
  const x =
    vehicle.direction === 'northbound' || vehicle.direction === 'southbound'
      ? CENTER_X + vehicle.laneOffset - vehicle.width / 2
      : vehicle.position - vehicle.length / 2;
  const y =
    vehicle.direction === 'eastbound' || vehicle.direction === 'westbound'
      ? CENTER_Y + vehicle.laneOffset - vehicle.width / 2
      : vehicle.position - vehicle.length / 2;

  const rotate =
    vehicle.direction === 'northbound'
      ? 'rotate(-90deg)'
      : vehicle.direction === 'southbound'
        ? 'rotate(90deg)'
        : vehicle.direction === 'westbound'
          ? 'scaleX(-1)'
          : 'none';

  return {
    left: `${(x / WORLD_WIDTH) * 100}%`,
    top: `${(y / WORLD_HEIGHT) * 100}%`,
    width: `${(((isVertical ? vehicle.width : vehicle.length) / WORLD_WIDTH) * 100).toFixed(3)}%`,
    height: `${(((isVertical ? vehicle.length : vehicle.width) / WORLD_HEIGHT) * 100).toFixed(3)}%`,
    transform: rotate,
    '--body': vehicle.color.body,
    '--roof': vehicle.color.roof,
    '--accent': vehicle.color.accent,
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

function App() {
  const [game, setGame] = useState<GameState>(createInitialState);
  const [stageScale, setStageScale] = useState(1);
  const { snapshot, laneControl, requestPermission, stopMonitoring } = useMicrophoneControls();
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const updateScale = () => {
      const horizontalPadding = 24;
      const verticalPadding = 24;
      const availableWidth = window.innerWidth - horizontalPadding;
      const availableHeight = window.innerHeight - verticalPadding;
      const nextScale = Math.min(availableWidth / WORLD_WIDTH, availableHeight / WORLD_HEIGHT);
      setStageScale(Math.max(0.42, nextScale));
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

  useEffect(() => () => stopMonitoring(), [stopMonitoring]);

  const startRun = async () => {
    if (snapshot.permission !== 'granted') await requestPermission();
    setGame(startGame());
  };

  const restart = () => setGame(startGame());

  const activeNS = game.activeAxis === 'northSouth' && !game.emergencyStop;
  const activeEW = game.activeAxis === 'eastWest' && !game.emergencyStop;
  const trafficMood =
    game.congestion < 28 ? 'Calm' : game.congestion < 58 ? 'Busy' : game.congestion < 82 ? 'Tense' : 'Tangled';
  const levelName =
    game.difficultyLevel === 1 ? 'Rookie Patrol' : game.difficultyLevel === 2 ? 'Cadet Crossing' : 'Captain Rush';
  const progressToNext = game.difficultyLevel >= 3 ? 100 : Math.min(100, (game.score / game.levelGoal) * 100);

  return (
    <div className="app-shell">
      <div className="scene">
        <div className="scene-frame">
          <div
            className={`scene-stage ${game.phase === 'running' ? 'scene--live' : ''} ${game.dangerFlash > 0.1 ? 'scene--danger' : ''}`}
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
            <div className="skyline skyline--far" />
            <div className="skyline skyline--mid" />

            <header className="hud">
              <div className="brand-chip">
                <span className="brand-chip__eyebrow">Juniper Junction</span>
                <strong>Voice Traffic Cop</strong>
              </div>
              <div className="status-panel">
                <div className="metric">
                  <span className="metric__label">Score</span>
                  <strong>{game.score}</strong>
                </div>
                <div className="metric">
                  <span className="metric__label">Streak</span>
                  <strong>{game.streak}</strong>
                </div>
                <div className="metric">
                  <span className="metric__label">Level</span>
                  <strong>{game.difficultyLevel}</strong>
                </div>
                <div className="metric">
                  <span className="metric__label">Mood</span>
                  <strong>{trafficMood}</strong>
                </div>
              </div>
            </header>

            <div className="street-stage">
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
            <div className="pip">
              <div className={`speech-ribbon ${snapshot.command !== 'none' ? 'speech-ribbon--live' : ''}`}>
                {snapshot.transcript}
              </div>
              <div className={`pip-tail ${game.congestion > 70 ? 'pip-tail--poof' : ''}`} />
              <div className="pip-body">
                <div className="pip-cap" />
                <div className="pip-face">
                  <span className="eye" />
                  <span className="eye" />
                </div>
                <div className={`pip-baton ${activeNS ? 'pip-baton--ns' : 'pip-baton--ew'}`} />
              </div>
            </div>
          </div>

          <div className="signal-cluster signal-cluster--top">
            <span className={`signal-lamp ${activeNS ? 'signal-lamp--green' : 'signal-lamp--red'}`} />
          </div>
          <div className="signal-cluster signal-cluster--right">
            <span className={`signal-lamp ${activeEW ? 'signal-lamp--green' : 'signal-lamp--red'}`} />
          </div>
          <div className="signal-cluster signal-cluster--bottom">
            <span className={`signal-lamp ${activeNS ? 'signal-lamp--green' : 'signal-lamp--red'}`} />
          </div>
          <div className="signal-cluster signal-cluster--left">
            <span className={`signal-lamp ${activeEW ? 'signal-lamp--green' : 'signal-lamp--red'}`} />
          </div>

          {game.vehicles.map((vehicle) => (
            <div
              className={`vehicle vehicle--${vehicle.kind} ${vehicle.axis === game.activeAxis ? 'vehicle--favored' : ''}`}
              style={vehicleStyle(vehicle)}
              key={vehicle.id}
            >
              <span className="vehicle__body" />
              <span className="vehicle__roof" />
              <span className="vehicle__window" />
              <span className="vehicle__wheel vehicle__wheel--front" />
              <span className="vehicle__wheel vehicle__wheel--rear" />
            </div>
          ))}

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

            <aside className="mic-panel">
              <div className="mic-panel__top">
                <span className={`permission-dot permission-dot--${snapshot.permission}`} />
                <strong>Mic</strong>
                <span className="mic-panel__command">{snapshot.transcript}</span>
              </div>
              <div className="meter">
                <div className="meter__fill" style={{ width: `${Math.max(8, snapshot.volume * 100)}%` }} />
              </div>
              <div className="mic-stats">
                <div className="mic-stat">
                  <span className="mic-stat__label">Pitch</span>
                  <strong>{snapshot.smoothedPitch ? `${Math.round(snapshot.smoothedPitch)} Hz` : 'Listening'}</strong>
                </div>
                <div className="mic-stat">
                  <span className="mic-stat__label">Light</span>
                  <strong>{game.emergencyStop ? 'All stop' : axisLabel(game.activeAxis)}</strong>
                </div>
                <div className="mic-stat">
                  <span className="mic-stat__label">Level</span>
                  <strong>{levelName}</strong>
                </div>
                <div className="mic-stat">
                  <span className="mic-stat__label">Next</span>
                  <strong>{game.difficultyLevel >= 3 ? 'Maxed' : game.levelGoal}</strong>
                </div>
              </div>
              <div className="meter meter--level">
                <div className="meter__fill meter__fill--level" style={{ width: `${Math.max(8, progressToNext)}%` }} />
              </div>
              <div className="hint-pill">Voice: Low = North-South, High = East-West, Loud = Stop, Hold = Boost</div>
            </aside>

            <div className="announcement-bar">{game.announcement}</div>

            {game.phase === 'title' && (
              <div className="overlay">
                <div className="card card--hero">
                  <div className="card__body">
                    <p className="card__eyebrow">Juniper Junction Duty</p>
                    <h1>Voice Traffic Cop</h1>
                    <p>A calm little voice-controlled traffic game. Help Pip Bristle keep the intersection flowing.</p>
                    <div className="quickstart-list">
                      <div>
                        <strong>Low hum</strong>
                        <span>Switch to North-South green.</span>
                      </div>
                      <div>
                        <strong>High hum</strong>
                        <span>Switch to East-West green.</span>
                      </div>
                      <div>
                        <strong>Loud burst</strong>
                        <span>Emergency stop. Hold a steady tone for a small boost.</span>
                      </div>
                    </div>
                    <p className="start-tip">You only need a short hum to switch. The game starts easy and speeds up later.</p>
                  </div>
                  <div className="card__footer">
                    <button className="primary-button" onClick={startRun}>
                      {snapshot.permission === 'granted' ? 'Start Patrol' : 'Enable Mic & Start'}
                    </button>
                    <p className="card__microcopy">Watch the mic panel on the left if you want to see what Pip is hearing.</p>
                  </div>
                </div>
              </div>
            )}

            {game.phase === 'gameOver' && (
              <div className="overlay overlay--gameover">
                <div className="card card--gameover">
                  <p className="card__eyebrow">Intersection Report</p>
                  <h2>Juniper Junction Jammed Up</h2>
                  <p>Pip did their best, but the crossing got too tangled. You reached level {game.difficultyLevel} before the jam.</p>
                  <div className="gameover-stats">
                    <div>
                      <span>Final Score</span>
                      <strong>{game.score}</strong>
                    </div>
                    <div>
                      <span>Top Level</span>
                      <strong>{levelName}</strong>
                    </div>
                    <div>
                      <span>Best Streak</span>
                      <strong>{game.bestStreak}</strong>
                    </div>
                  </div>
                  <button className="primary-button" onClick={restart}>
                    Restart Shift
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
