"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "@/game/engine";
import { sound } from "@/game/audio";
import type { MapId, MatchConfig, MatchResult, ModeId, WeaponClass } from "@/game/types";
import { weaponsByClass } from "@/game/weapons";
import {
  addHighScore, applyMatchResult, loadHighScores, loadProfile, loadSettings,
  saveProfile, saveSettings, type HighScoreEntry, type Profile, type Settings,
} from "@/game/profile";
import Hud from "./Hud";
import TouchControls from "./TouchControls";
import {
  MenuScreen, ModeSelect, MapSelect, LoadoutSelect, PauseOverlay,
  GameOverScreen, LeaderboardModal, SettingsModal, HowToModal, type Board,
} from "./Screens";

type Screen = "menu" | "mode" | "map" | "loadout" | "game" | "over";

export default function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const screenRef = useRef<Screen>("menu");
  const [paused, setPaused] = useState(false);
  const [modal, setModal] = useState<"none" | "lb" | "settings" | "help">("none");
  const [scoreOpen, setScoreOpen] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [touchSeen, setTouchSeen] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>({ sound: true, shake: true, quality: "auto", difficulty: "normal" });
  const [localScores, setLocalScores] = useState<HighScoreEntry[]>([]);

  const [cfg, setCfg] = useState<MatchConfig>({ modeId: "tdm", mapId: "city", weaponId: "ak47", playerName: "" });
  const [cls, setCls] = useState<WeaponClass>("ar");
  const [over, setOver] = useState<{ result: MatchResult; delta: number; newBest: boolean; board: Board } | null>(null);
  const submittedRef = useRef(false);

  const setScreenSafe = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  }, []);

  // ---------- init ----------
  useEffect(() => {
    const p = loadProfile();
    const st = loadSettings();
    setProfile(p);
    setSettings(st);
    setCfg((c) => ({ ...c, playerName: p.name }));
    setLocalScores(loadHighScores());
    setCoarse(window.matchMedia?.("(pointer: coarse)").matches ?? false);
    sound.setMuted(!st.sound);

    const game = new Game(canvasRef.current!);
    game.settings = { ...st };
    game.hooks.onPauseChange = (p2) => setPaused(p2);
    game.hooks.onGameOver = (result) => {
      const before = loadProfile();
      const { profile: after, delta } = applyMatchResult(before, {
        win: result.win, draw: result.draw, kills: result.kills, deaths: result.deaths,
        score: result.score, bestStreak: result.bestStreak,
        cls: game.player()?.weapon.cls ?? "ar",
      }, loadSettings().difficulty);
      const newBest = result.score > before.bestScore;
      setProfile(after);
      const entry: HighScoreEntry = {
        name: after.name, score: result.score, kills: result.kills,
        mode: result.modeId, map: result.mapId, date: Date.now(),
      };
      setLocalScores(addHighScore(entry));
      if (!submittedRef.current) {
        submittedRef.current = true;
        fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: after.name, mode: result.modeId, map: result.mapId,
            kills: result.kills, score: result.score, rating: after.rating,
          }),
        }).catch(() => undefined);
      }
      const sb = game.getScoreboard();
      setOver({
        result, delta, newBest,
        board: {
          a: sb.a.map((r) => ({ name: r.name, kills: r.kills, deaths: r.deaths, score: r.score, isPlayer: r.isPlayer })),
          b: sb.b.map((r) => ({ name: r.name, kills: r.kills, deaths: r.deaths, score: r.score, isPlayer: r.isPlayer })),
        },
      });
      setScreenSafe("over");
    };
    // attract
    const maps: MapId[] = ["city", "village", "terminal", "forest", "hangar"];
    const attModes: ModeId[] = ["tdm", "dom", "koth"];
    game.startMatch({ modeId: attModes[(Math.random() * attModes.length) | 0], mapId: maps[(Math.random() * maps.length) | 0], weaponId: "ak47", playerName: "ЗВЕЗДА" }, true);
    game.start();
    gameRef.current = game;
    return () => { game.destroy(); gameRef.current = null; };
  }, [setScreenSafe]);

  // ---------- settings sync ----------
  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
    sound.setMuted(!s.sound);
    if (gameRef.current) gameRef.current.settings = { ...s };
  }, []);

  const updateName = useCallback((n: string) => {
    setProfile((p) => {
      if (!p) return p;
      const np = { ...p, name: n || p.name };
      saveProfile(np);
      setCfg((c) => ({ ...c, playerName: np.name }));
      return np;
    });
  }, []);

  // ---------- flow ----------
  const startAttract = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const maps: MapId[] = ["city", "village", "terminal", "forest", "hangar"];
    const attModes: ModeId[] = ["tdm", "dom", "koth"];
    g.startMatch({ modeId: attModes[(Math.random() * attModes.length) | 0], mapId: maps[(Math.random() * maps.length) | 0], weaponId: "ak47", playerName: "ЗВЕЗДА" }, true);
  }, []);

  const launch = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    sound.ensure();
    sound.play("ui");
    submittedRef.current = false;
    setOver(null);
    g.startMatch({ ...cfg, playerName: profile?.name || "Игрок" }, false);
    setScreenSafe("game");
  }, [cfg, profile, setScreenSafe]);

  const toMenu = useCallback(() => {
    sound.play("uiBack");
    setPaused(false);
    setOver(null);
    startAttract();
    setScreenSafe("menu");
  }, [startAttract, setScreenSafe]);

  const rematch = useCallback(() => {
    sound.play("ui");
    setOver(null);
    launch();
  }, [launch]);

  // Tab scoreboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Tab" && screenRef.current === "game") { e.preventDefault(); setScoreOpen(true); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Tab") setScoreOpen(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const pickMode = (m: ModeId) => { sound.play("ui"); setCfg((c) => ({ ...c, modeId: m })); setScreenSafe("map"); };
  const pickMap = (m: MapId) => { sound.play("ui"); setCfg((c) => ({ ...c, mapId: m })); };
  const pickClass = (c: WeaponClass) => {
    sound.play("ui");
    setCls(c);
    const first = weaponsByClass(c)[0];
    setCfg((cfg2) => (weaponsByClass(c).some((w) => w.id === cfg2.weaponId) ? cfg2 : { ...cfg2, weaponId: first.id }));
  };
  const pickWeapon = (id: string) => { sound.play("ui"); setCfg((c) => ({ ...c, weaponId: id })); };

  const bindHud = useCallback((el: HTMLDivElement | null) => {
    if (el) gameRef.current?.bindHud(el);
  }, []);

  const inGame = screen === "game";

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#0a0d13] ${inGame && !coarse ? "playing-cursor" : ""}`}>
      <canvas ref={canvasRef} className="game-canvas absolute inset-0" />

      {/* top gradient for readability */}
      {!inGame && <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/45 via-transparent to-black/55" />}

      {inGame && (
        <Hud
          bindHud={bindHud}
          onPause={() => gameRef.current?.setPaused(true)}
          onScoreboard={() => setScoreOpen(true)}
          muted={!settings.sound}
          onToggleMute={() => updateSettings({ ...settings, sound: !settings.sound })}
          showKeys={!coarse && !touchSeen}
        />
      )}

      {inGame && (coarse || touchSeen) && <TouchControls onFirstTouch={() => setTouchSeen(true)} />}

      {inGame && paused && modal === "none" && (
        <PauseOverlay
          onResume={() => gameRef.current?.setPaused(false)}
          onSettings={() => setModal("settings")}
          onQuit={() => { gameRef.current?.setPaused(false); toMenu(); }}
        />
      )}

      {scoreOpen && inGame && (
        <ScoreboardOverlay
          getSnap={() => gameRef.current?.getScoreboard() ?? null}
          onClose={() => setScoreOpen(false)}
        />
      )}

      {screen === "menu" && profile && (
        <MenuScreen
          profile={profile}
          onPlay={() => { sound.ensure(); sound.play("ui"); setScreenSafe("mode"); }}
          onLeaderboard={() => { sound.ensure(); sound.play("ui"); setModal("lb"); }}
          onSettings={() => { sound.ensure(); sound.play("ui"); setModal("settings"); }}
          onHelp={() => { sound.ensure(); sound.play("ui"); setModal("help"); }}
        />
      )}

      {screen === "mode" && (
        <ModeSelect sel={cfg.modeId} onPick={pickMode} onBack={() => setScreenSafe("menu")} />
      )}

      {screen === "map" && (
        <MapSelect
          sel={cfg.mapId}
          onPick={pickMap}
          onBack={() => setScreenSafe("mode")}
          onNext={() => { sound.play("ui"); setScreenSafe("loadout"); }}
        />
      )}

      {screen === "loadout" && (
        <LoadoutSelect
          cls={cls}
          weaponId={cfg.weaponId}
          onClass={pickClass}
          onWeapon={pickWeapon}
          onStart={launch}
          onBack={() => setScreenSafe("map")}
        />
      )}

      {screen === "over" && over && profile && (
        <GameOverScreen
          result={over.result}
          delta={over.delta}
          newBest={over.newBest}
          board={over.board}
          profile={profile}
          onRematch={rematch}
          onMenu={toMenu}
        />
      )}

      {modal === "lb" && <LeaderboardModal local={localScores} onClose={() => setModal("none")} />}
      {modal === "settings" && profile && (
        <SettingsModal
          settings={settings}
          name={profile.name}
          onSettings={updateSettings}
          onName={updateName}
          onClose={() => setModal("none")}
        />
      )}
      {modal === "help" && <HowToModal onClose={() => setModal("none")} />}
    </div>
  );
}

type ScoreSnap = ReturnType<Game["getScoreboard"]>;

function ScoreboardOverlay({ getSnap, onClose }: { getSnap: () => ScoreSnap | null; onClose: () => void }) {
  const [snap, setSnap] = useState<ScoreSnap | null>(null);
  useEffect(() => {
    const tick = () => setSnap(getSnap());
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [getSnap]);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div className="glass w-full max-w-xl rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-white/50">
          Табло · удерживай TAB
        </div>
        {snap && (
          <div className="grid gap-3 sm:grid-cols-2">
            {([["АЛЬФА", snap.a, "#35d0ff", snap.mode === "elim" ? snap.roundsA : snap.scoreA], ["БРАВО", snap.b, "#ff5d5d", snap.mode === "elim" ? snap.roundsB : snap.scoreB]] as const).map(([name, rows, col, score]) => (
              <div key={name} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: col }}>{name}</span>
                  <span className="text-2xl font-black tabular-nums text-white">{Math.floor(score as number)}</span>
                </div>
                {rows.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1 text-[12.5px] font-semibold ${r.isPlayer ? "bg-white/10 text-white" : "text-white/65"} ${!r.alive ? "opacity-50" : ""}`}>
                    <span className="truncate">{r.name}</span>
                    <span className="tabular-nums">{r.kills}<span className="text-white/35">/{r.deaths}</span></span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
