// ============================================================
// FRONTLINE ARENA — core game engine (canvas 2D, fixed timestep)
// ============================================================

import type { MapDef, MatchConfig, MatchResult, ModeDef, ObstacleDef, ObstacleKind, TeamId, WeaponClass } from "./types";
import { MODES } from "./types";
import { getMap, paintGround } from "./maps";
import { weaponById, WEAPONS, type WeaponDef } from "./weapons";
import { Particles } from "./particles";
import { sound } from "./audio";
import { BotBrain, BOT_NAMES, type BotWorld, type BotFighter } from "./ai";

// ---------------- runtime types ----------------

export interface Fighter extends BotFighter {
  name: string;
  bot: boolean;
  vx: number; vy: number;
  z: number; zv: number;
  angle: number;
  radius: number;
  shield: number;
  weapon: WeaponDef;
  fireCd: number;
  spreadHeat: number;
  protectT: number;
  hitFlashT: number;
  revealT: number;
  respawnT: number;
  kills: number; deaths: number;
  streak: number; bestStreak: number;
  score: number;
  multi: number; multiT: number;
  boostCd: number;
  boostAnim: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number } | null;
  brain: BotBrain | null;
  hurtPulse: number;
  nades: number;
  nadeT: number;
}

interface Grenade {
  x: number; y: number;
  vx: number; vy: number;
  z: number; vz: number;
  fuse: number;
  ownerId: number;
  ticked: boolean;
}

interface DirHit { angle: number; life: number }

interface Bullet {
  alive: boolean;
  x: number; y: number;
  vx: number; vy: number;
  dmg: number;
  team: TeamId;
  ownerId: number;
  pierce: number;
  dist: number;
  color: string;
  fromHigh: boolean;
}

interface Pickup {
  x: number; y: number;
  kind: "medkit" | "armor";
  alive: boolean;
  bobT: number;
}

interface Obs {
  x: number; y: number; w: number; h: number;
  kind: ObstacleKind;
  hp: number; maxHp: number;
  alive: boolean;
  flash: number;
}

interface PointState {
  id: "A" | "B" | "C";
  x: number; y: number;
  owner: number; // -1 neutral, 0/1 team
  progress: number; // capture progress 0..1 toward capTeam
  capTeam: number;
  contested: boolean;
}

interface PendingExplosion { x: number; y: number; t: number; srcId: number; big: boolean }

export interface MatchHooks {
  onGameOver?(r: MatchResult): void;
  onPauseChange?(paused: boolean): void;
}

export interface EngineSettings { sound: boolean; shake: boolean; quality: "auto" | "high" | "low"; difficulty: "easy" | "normal" | "hard" }

// touch input — React writes, engine reads
export interface TouchInput {
  active: boolean;
  moveX: number; moveY: number;
  aimDX: number; aimDY: number;
  aiming: boolean;
  fireHeld: boolean;
  fireTapped: boolean;
  jumpQ: boolean; reloadQ: boolean; boostQ: boolean; nadeQ: boolean;
}
export const touchInput: TouchInput = {
  active: false, moveX: 0, moveY: 0, aimDX: 1, aimDY: 0,
  aiming: false, fireHeld: false, fireTapped: false,
  jumpQ: false, reloadQ: false, boostQ: false, nadeQ: false,
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));

export const TEAM_COLORS = ["#35d0ff", "#ff5d5d"];
export const TEAM_NAMES = ["АЛЬФА", "БРАВО"];
const LOW_KINDS: ReadonlySet<ObstacleKind> = new Set(["crate", "half", "barrel"]);
const DESTRUCTIBLE: Record<string, number> = { crate: 70, barrel: 26, car: 130, container: 0 };
const SHOT_KINDS: ReadonlySet<ObstacleKind> = new Set(["wall", "crate", "barrel", "car", "container", "tree"]);

// segment vs AABB (slab method)
function segHitsRect(ax: number, ay: number, bx: number, by: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const dx = bx - ax, dy = by - ay;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) { if (ax < rx || ax > rx + rw) return false; }
  else {
    let t1 = (rx - ax) / dx, t2 = (rx + rw - ax) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) { if (ay < ry || ay > ry + rh) return false; }
  else {
    let t1 = (ry - ay) / dy, t2 = (ry + rh - ay) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  settings: EngineSettings = { sound: true, shake: true, quality: "auto", difficulty: "normal" };
  hooks: MatchHooks = {};

  // world state
  mode: ModeDef = MODES.tdm;
  map: MapDef = getMap("city");
  private ground: HTMLCanvasElement | null = null;
  private obstacles: Obs[] = [];
  private points: PointState[] = [];
  private fighters: Fighter[] = [];
  private bullets: Bullet[] = [];
  private bulletCursor = 0;
  private pickups: Pickup[] = [];
  private particles = new Particles();
  private pendingBooms: PendingExplosion[] = [];
  private grenades: Grenade[] = [];
  private dirHits: DirHit[] = [];
  private ambientAcc = 0;
  atlas = false;

  // match state
  state: "idle" | "playing" | "over" = "idle";
  paused = false;
  attract = false;
  private matchT = 0;
  private timeLeft = 0;
  private scoreA = 0;
  private scoreB = 0;
  private roundsA = 0;
  private roundsB = 0;
  private roundNum = 1;
  private intermissionT = 0;
  private pickupT = 6;
  private lastTimerTick = -1;
  private endDelay = 0;
  private cfg: MatchConfig | null = null;

  // horde mode state
  private waveNum = 0;
  private waveBreakT = 0;
  private pendingSpawns = 0;
  private spawnTick = 0;
  private hordeWon = false;
  private hordeLost = false;
  private nextFighterId = 100;

  // camera & fx
  private cam = { x: 0, y: 0, zoom: 1 };
  private trauma = 0;
  private hitstopT = 0;
  private camT = 0;
  private attractTarget = 0;
  private fpsAvg = 60;
  private qualityScale = 1;

  // input
  private keys = new Set<string>();
  private mouse = { sx: 0, sy: 0, down: false, clicked: false };
  private reloadQ = false;
  private jumpQ = false;
  private boostQ = false;
  private nadeQ = false;

  // HUD DOM
  private hud: Map<string, HTMLElement> = new Map();

  // bot world facade
  private botWorld: BotWorld = {
    time: 0, mode: "tdm", fighters: [], points: [], pickups: [], playerId: -1,
    hasLOS: (ax, ay, bx, by) => this.hasLOS(ax, ay, bx, by),
  };

  private styleCache = new Map<string, CanvasGradient>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("visibilitychange", this.onVis);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  bindHud(root: HTMLElement) {
    this.hud.clear();
    root.querySelectorAll<HTMLElement>("[data-hud]").forEach((el) => {
      const k = el.getAttribute("data-hud");
      if (k) this.hud.set(k, el);
    });
  }

  private hset(key: string, text: string) {
    const el = this.hud.get(key);
    if (el && el.textContent !== text) el.textContent = text;
  }
  private hshow(key: string, show: boolean) {
    const el = this.hud.get(key);
    if (el) el.style.display = show ? "" : "none";
  }

  // ---------------- listeners ----------------
  private onVis = () => {
    if (document.hidden && this.state === "playing" && !this.attract && !this.paused) {
      this.setPaused(true);
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.code;
    this.keys.add(k);
    if (k === "KeyR") this.reloadQ = true;
    if (k === "Space") { this.jumpQ = true; e.preventDefault(); }
    if (k === "KeyE") this.boostQ = true;
    if (k === "KeyG") this.nadeQ = true;
    if ((k === "Escape" || k === "KeyP") && this.state === "playing" && !this.attract) {
      this.setPaused(!this.paused);
    }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onMouseMove = (e: MouseEvent) => { this.mouse.sx = e.clientX; this.mouse.sy = e.clientY; };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
  };
  private onMouseUp = (e: MouseEvent) => { if (e.button === 0) this.mouse.down = false; };

  setPaused(p: boolean) {
    if (this.state !== "playing") return;
    this.paused = p;
    this.hooks.onPauseChange?.(p);
  }

  // ---------------- match lifecycle ----------------

  startMatch(cfg: MatchConfig, attract = false) {
    this.cfg = cfg;
    this.mode = MODES[cfg.modeId];
    this.map = getMap(cfg.mapId);
    this.attract = attract;
    this.state = "playing";
    this.paused = false;
    this.matchT = 0;
    this.timeLeft = this.mode.timeLimit;
    this.scoreA = 0; this.scoreB = 0;
    this.roundsA = 0; this.roundsB = 0;
    this.roundNum = 1;
    this.intermissionT = 0;
    this.endDelay = 0;
    this.pickupT = 5;
    this.waveNum = 0;
    this.waveBreakT = cfg.modeId === "horde" ? 4 : 0;
    this.pendingSpawns = 0;
    this.hordeWon = false;
    this.hordeLost = false;
    this.nextFighterId = 100;
    this.pendingBooms = [];
    this.particles.clear();
    this.bullets = [];
    this.pickups = [];
    this.grenades = [];
    this.dirHits = [];
    this.trauma = 0;

    // offscreen ground
    if (!this.ground) this.ground = document.createElement("canvas");
    paintGround(this.map, this.ground);

    // obstacles
    this.obstacles = this.map.obstacles.map((o: ObstacleDef) => {
      const hp = DESTRUCTIBLE[o.kind] ?? 0;
      return { x: o.x, y: o.y, w: o.w, h: o.h, kind: o.kind, hp, maxHp: hp, alive: true, flash: 0 };
    });

    // points (KOTH uses only the central hill)
    const pointSrc = cfg.modeId === "koth"
      ? [this.map.points[1] ?? this.map.points[0]]
      : this.map.points;
    this.points = pointSrc.map((p) => ({
      id: p.id, x: p.x, y: p.y, owner: -1, progress: 0, capTeam: -1, contested: false,
    }));

    // fighters
    this.fighters = [];
    const size = this.mode.teamSize;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const botWeapon = (): WeaponDef => {
      const r = Math.random();
      const cls = r < 0.38 ? "ar" : r < 0.62 ? "smg" : r < 0.8 ? "sg" : "sr";
      const list = WEAPONS.filter((w) => w.cls === cls);
      return list[(Math.random() * list.length) | 0];
    };

    let player: Fighter;
    const diff = this.settings.difficulty;
    const enemySkill = () =>
      diff === "easy" ? 0.22 + Math.random() * 0.3
        : diff === "hard" ? 0.72 + Math.random() * 0.28
          : 0.45 + Math.random() * 0.45;
    const mk = (id: number, team: TeamId, name: string, bot: boolean, weapon: WeaponDef): Fighter => {
      const sp = (team === 0 ? this.map.spawnsA : this.map.spawnsB)[id % size % 3];
      const objPush = cfg.modeId === "dom" || cfg.modeId === "koth";
      const role: "hunter" | "obj" | "buddy" = team === 0 && id % size === 1 ? "buddy" : (objPush ? "obj" : "hunter");
      const skill = team === 1 ? (attract ? 0.45 + Math.random() * 0.45 : enemySkill()) : 0.5 + Math.random() * 0.38;
      return {
        id, team, name, bot, isPlayer: !bot,
        x: sp.x, y: sp.y, vx: 0, vy: 0, z: 0, zv: 0,
        angle: team === 0 ? 0 : Math.PI, radius: 18,
        hp: 100, maxHp: 100, shield: 0,
        weapon, ammoInMag: weapon.mag, reloading: 0, fireCd: 0, spreadHeat: 0,
        alive: true, elevated: false, hidden: false,
        weaponRange: weapon.range, weaponCls: weapon.cls,
        mvx: 0, mvy: 0, aimAngle: team === 0 ? 0 : Math.PI,
        wantFire: false, wantReload: false, wantJump: false, wantNade: false,
        protectT: 1.6, hitFlashT: 0, revealT: 0, respawnT: 0,
        kills: 0, deaths: 0, streak: 0, bestStreak: 0, score: 0,
        multi: 0, multiT: 0, boostCd: 0, boostAnim: null, hurtPulse: 0,
        nades: bot ? 1 : 2, nadeT: 0,
        brain: bot ? new BotBrain(skill, role, sp.x, sp.y) : null,
      };
    };

    player = mk(0, 0, cfg.playerName, attract, weaponById(cfg.weaponId));
    if (attract) {
      player.isPlayer = false;
      player.bot = true;
      player.name = names[7] ?? "ЗВЕЗДА";
      player.weapon = botWeapon();
      player.weaponRange = player.weapon.range;
      player.weaponCls = player.weapon.cls;
      player.brain = new BotBrain(0.6, "hunter", player.x, player.y);
    }
    this.fighters.push(player);
    for (let i = 1; i < size; i++) this.fighters.push(mk(i, 0, names[i], true, botWeapon()));
    // horde has no standing enemy team — they arrive in waves
    if (cfg.modeId !== "horde") {
      for (let i = 0; i < size; i++) this.fighters.push(mk(size + i, 1, names[size + i], true, botWeapon()));
    }

    this.botWorld.mode = cfg.modeId;
    this.botWorld.fighters = this.fighters;
    this.botWorld.points = this.points.map((p) => ({ ...p, owner: -1, progress: 0, capTeam: -1 }));
    this.botWorld.pickups = this.pickups;
    this.botWorld.playerId = 0;

    this.cam.x = player.x; this.cam.y = player.y;

    if (!attract) {
      sound.play("deploy");
      this.announce(`РЕЖИМ: ${this.mode.name.toUpperCase()}`, this.map.name);
    }
  }

  stopToIdle() {
    this.state = "idle";
    this.paused = false;
  }

  player(): Fighter | undefined { return this.fighters[0]; }

  getScoreboard() {
    const rows = (t: TeamId) =>
      this.fighters
        .filter((f) => f.team === t)
        .map((f) => ({ name: f.name, kills: f.kills, deaths: f.deaths, score: f.score, isPlayer: f.isPlayer, alive: f.alive }))
        .sort((a, b) => b.kills - a.kills || b.score - a.score);
    return {
      a: rows(0), b: rows(1),
      scoreA: this.scoreA, scoreB: this.scoreB,
      roundsA: this.roundsA, roundsB: this.roundsB,
      mode: this.mode.id, mapName: this.map.name, timeLeft: this.timeLeft,
    };
  }

  // ---------------- loop ----------------
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      let frame = (now - this.last) / 1000;
      this.last = now;
      if (frame > 0.1) frame = 0.1;
      this.fpsAvg = lerp(this.fpsAvg, 1 / Math.max(frame, 1e-4), 0.05);
      if (this.settings.quality === "auto") {
        this.qualityScale = this.fpsAvg > 52 ? 1 : this.fpsAvg > 38 ? 0.6 : 0.35;
      } else this.qualityScale = this.settings.quality === "high" ? 1 : 0.5;
      this.particles.spawnScale = this.qualityScale;

      if (this.hitstopT > 0) {
        this.hitstopT -= frame;
      } else if (this.state === "playing" && !this.paused) {
        this.acc += frame;
        const DT = 1 / 60;
        let n = 0;
        while (this.acc >= DT && n < 3) {
          this.step(DT);
          this.acc -= DT;
          n++;
        }
        if (n === 3) this.acc = 0;
      } else if (this.state !== "idle") {
        this.particles.update(frame);
      }
      this.render(frame);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // ---------------- queries ----------------
  hasLOS(ax: number, ay: number, bx: number, by: number): boolean {
    for (const o of this.obstacles) {
      if (!o.alive || !SHOT_KINDS.has(o.kind)) continue;
      if (segHitsRect(ax, ay, bx, by, o.x, o.y, o.w, o.h)) return false;
    }
    return true;
  }

  private playAt(name: Parameters<typeof sound.play>[0], x: number, y: number, base = 1) {
    if (this.attract) return;
    const p = this.player();
    const px = p ? p.x : this.cam.x, py = p ? p.y : this.cam.y;
    const d = Math.hypot(x - px, y - py);
    const vol = base * clamp(1 - d / 1100, 0.05, 1);
    sound.play(name, vol);
  }

  private addTrauma(v: number) {
    if (!this.settings.shake) v *= 0.25;
    this.trauma = clamp(this.trauma + v, 0, 1);
  }

  // ---------------- step ----------------
  private step(dt: number) {
    this.matchT += dt;
    this.botWorld.time = this.matchT;

    if (this.intermissionT > 0) {
      this.intermissionT -= dt;
      this.particles.update(dt);
      if (this.intermissionT <= 0) this.resetRound();
      this.updateHudDom();
      return;
    }

    // pending explosions (chain reactions)
    for (let i = this.pendingBooms.length - 1; i >= 0; i--) {
      const b = this.pendingBooms[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.pendingBooms.splice(i, 1);
        this.explode(b.x, b.y, b.srcId, b.big);
      }
    }

    // fighters
    for (const f of this.fighters) {
      if (!f.alive) {
        if (this.mode.respawn && this.intermissionT <= 0) {
          f.respawnT -= dt;
          if (f.respawnT <= 0) this.respawn(f);
        }
        continue;
      }
      f.protectT = Math.max(0, f.protectT - dt);
      f.hitFlashT = Math.max(0, f.hitFlashT - dt);
      f.revealT = Math.max(0, f.revealT - dt);
      f.hurtPulse = Math.max(0, f.hurtPulse - dt * 2);
      f.multiT = Math.max(0, f.multiT - dt);
      if (f.multiT <= 0) f.multi = 0;
      f.boostCd = Math.max(0, f.boostCd - dt);
      f.spreadHeat = Math.max(0, f.spreadHeat - dt * 3);
      if (f.nades < 2) {
        f.nadeT -= dt;
        if (f.nadeT <= 0) {
          f.nades++;
          if (f.nades < 2) f.nadeT = 7;
        }
      }

      if (f.boostAnim) {
        this.updateBoostAnim(f, dt);
      } else {
        if (f.isPlayer && !this.attract) this.updatePlayerInput(f, dt);
        else if (f.brain) {
          f.brain.think(f, this.botWorld, dt);
          if (f.wantReload && f.reloading <= 0 && f.ammoInMag < f.weapon.mag) this.startReload(f);
          if (f.wantFire) this.tryFire(f);
          if (f.wantJump) this.jump(f);
          if (f.wantNade) this.throwNade(f);
          this.moveFighter(f, f.mvx, f.mvy, dt, f.weapon.moveMult * 0.94);
          f.angle = f.aimAngle;
        }
      }

      // jump physics
      if (f.z > 0 || f.zv > 0) {
        f.zv -= 520 * dt;
        f.z += f.zv * dt;
        if (f.z <= 0) {
          f.z = 0; f.zv = 0;
          this.particles.dust(f.x, f.y + 8, 5);
          if (f.isPlayer) this.playAt("land", f.x, f.y, 0.7);
        }
      }

      // reload
      if (f.reloading > 0) {
        f.reloading -= dt;
        if (f.reloading <= 0) {
          f.ammoInMag = f.weapon.mag;
        }
      }
      f.fireCd = Math.max(0, f.fireCd - dt);

      // elevated state check
      if (f.elevated && !this.inAnyZone(f.x, f.y, 4)) {
        f.elevated = false;
        f.z = 18; f.zv = 0;
        this.particles.dust(f.x, f.y + 8, 4);
      }

      // canopy hide
      f.hidden = false;
      for (const c of this.map.canopies) {
        const d2 = (f.x - c.x) * (f.x - c.x) + (f.y - c.y) * (f.y - c.y);
        if (d2 < (c.r * 0.72) * (c.r * 0.72)) { f.hidden = f.revealT <= 0; break; }
      }
    }

    // fighter separation
    this.separateFighters();

    // sync bot world point states
    for (let i = 0; i < this.points.length; i++) {
      this.botWorld.points[i].owner = this.points[i].owner;
      this.botWorld.points[i].progress = this.points[i].progress;
      this.botWorld.points[i].capTeam = this.points[i].capTeam;
    }

    // bullets & grenades
    this.updateBullets(dt);
    this.updateGrenades(dt);

    // damage direction indicators fade
    for (let i = this.dirHits.length - 1; i >= 0; i--) {
      this.dirHits[i].life -= dt * 1.3;
      if (this.dirHits[i].life <= 0) this.dirHits.splice(i, 1);
    }

    // pickups
    this.pickupT -= dt;
    if (this.pickupT <= 0) {
      this.pickupT = 8 + Math.random() * 4;
      this.spawnRandomPickup();
    }
    this.updatePickups(dt);

    // mode logic
    if (this.endDelay > 0) {
      this.endDelay -= dt;
      if (this.endDelay <= 0) this.finishMatch();
      this.particles.update(dt);
      this.updateHudDom();
      return;
    }
    this.updateMode(dt);

    this.particles.update(dt);
    this.updateHudDom();
  }

  private updatePlayerInput(f: Fighter, dt: number) {
    // move
    let mx = 0, my = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    if (touchInput.active) {
      mx += touchInput.moveX; my += touchInput.moveY;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }

    // aim
    if (touchInput.active && touchInput.aiming) {
      f.angle = Math.atan2(touchInput.aimDY, touchInput.aimDX);
    } else {
      const w = this.screenToWorld(this.mouse.sx, this.mouse.sy);
      f.angle = Math.atan2(w.y - f.y, w.x - f.x);
    }

    this.moveFighter(f, mx, my, dt, f.weapon.moveMult);

    // firing
    const wantFire = this.mouse.down || touchInput.fireHeld;
    const tapped = this.mouse.clicked || touchInput.fireTapped;
    if (f.weapon.auto ? wantFire : tapped) this.tryFire(f);
    this.mouse.clicked = false;
    touchInput.fireTapped = false;

    // actions
    if (this.reloadQ || touchInput.reloadQ) {
      this.startReload(f);
      this.reloadQ = false; touchInput.reloadQ = false;
    }
    if (this.jumpQ || touchInput.jumpQ) {
      this.jump(f);
      this.jumpQ = false; touchInput.jumpQ = false;
    }
    if (this.boostQ || touchInput.boostQ) {
      this.tryBoost(f);
      this.boostQ = false; touchInput.boostQ = false;
    }
    if (this.nadeQ || touchInput.nadeQ) {
      this.throwNade(f);
      this.nadeQ = false; touchInput.nadeQ = false;
    }
  }

  private moveFighter(f: Fighter, mx: number, my: number, dt: number, mult = 1) {
    const speed = 246 * mult;
    f.vx = mx * speed;
    f.vy = my * speed;
    const airborne = f.z > 16;
    const nx = f.x + f.vx * dt;
    // x-axis
    f.x = nx;
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      if (f.elevated && o.kind !== "wall") { /* free on platform */ }
      else if (airborne && LOW_KINDS.has(o.kind)) { /* hop over */ }
      else this.resolveAxis(f, o, true);
    }
    // y-axis
    f.y += f.vy * dt;
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      if (f.elevated && o.kind !== "wall") { /* free */ }
      else if (airborne && LOW_KINDS.has(o.kind)) { /* hop */ }
      else this.resolveAxis(f, o, false);
    }
    f.x = clamp(f.x, f.radius, this.map.w - f.radius);
    f.y = clamp(f.y, f.radius, this.map.h - f.radius);
  }

  private resolveAxis(f: Fighter, o: Obs, isX: boolean) {
    const r = f.radius;
    if (f.x + r < o.x || f.x - r > o.x + o.w || f.y + r < o.y || f.y - r > o.y + o.h) return;
    if (isX) {
      const cx = clamp(f.x, o.x, o.x + o.w);
      if (Math.abs(f.y - clamp(f.y, o.y, o.y + o.h)) < r) {
        f.x = f.x < cx ? o.x - r : o.x + o.w + r;
      }
    } else {
      const cy = clamp(f.y, o.y, o.y + o.h);
      if (Math.abs(f.x - clamp(f.x, o.x, o.x + o.w)) < r) {
        f.y = f.y < cy ? o.y - r : o.y + o.h + r;
      }
    }
  }

  private separateFighters() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j];
        if (!b.alive) continue;
        if (a.z > 16 || b.z > 16) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius - 4;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
  }

  private inAnyZone(x: number, y: number, pad: number): boolean {
    for (const z of this.map.highgrounds) {
      if (x > z.x - pad && x < z.x + z.w + pad && y > z.y - pad && y < z.y + z.h + pad) return true;
    }
    return false;
  }

  // ---------------- combat ----------------
  private jump(f: Fighter) {
    if (f.z > 0 || f.boostAnim) return;
    f.zv = 175;
    f.z = 1;
    this.particles.jumpRing(f.x, f.y);
    if (f.isPlayer) this.playAt("jump", f.x, f.y, 0.6);
  }

  private tryBoost(f: Fighter) {
    if (f.boostCd > 0 || f.z > 0 || f.boostAnim || f.elevated) return;
    // needs an ally nearby and a platform nearby
    let ally: Fighter | null = null;
    for (const o of this.fighters) {
      if (o.alive && o.team === f.team && o.id !== f.id) {
        if (Math.hypot(o.x - f.x, o.y - f.y) < 95) { ally = o; break; }
      }
    }
    if (!ally) { if (f.isPlayer) this.hintFlash(); return; }
    let zone: { x: number; y: number; w: number; h: number } | null = null;
    let bd = 170;
    for (const z of this.map.highgrounds) {
      const cx = clamp(f.x, z.x, z.x + z.w), cy = clamp(f.y, z.y, z.y + z.h);
      const d = Math.hypot(cx - f.x, cy - f.y);
      if (d < bd) { bd = d; zone = z; }
    }
    if (!zone) { if (f.isPlayer) this.hintFlash(); return; }
    const tx = clamp(f.x, zone.x + 30, zone.x + zone.w - 30);
    const ty = clamp(f.y, zone.y + 30, zone.y + zone.h - 30);
    if (Math.abs(tx - f.x) + Math.abs(ty - f.y) < 2 && this.inAnyZone(f.x, f.y, 0)) return;
    f.boostAnim = { x0: f.x, y0: f.y, x1: tx, y1: ty, t: 0, dur: 0.44 };
    f.boostCd = 4;
    this.particles.jumpRing(ally.x, ally.y, "#ffd166");
    this.particles.dust(ally.x, ally.y + 8, 6);
    if (f.isPlayer) { this.playAt("boost", f.x, f.y); this.addTrauma(0.15); }
  }

  private updateBoostAnim(f: Fighter, dt: number) {
    const a = f.boostAnim;
    if (!a) return;
    a.t += dt;
    const t = clamp(a.t / a.dur, 0, 1);
    const e = 1 - (1 - t) * (1 - t);
    f.x = lerp(a.x0, a.x1, e);
    f.y = lerp(a.y0, a.y1, e);
    f.z = Math.sin(t * Math.PI) * 46;
    if (t >= 1) {
      f.boostAnim = null;
      f.z = 0;
      f.elevated = true;
      this.particles.jumpRing(f.x, f.y, "#ffd166");
      this.particles.floatText(f.x, f.y - 44, "ВЫСОТА +22%", "#ffd166");
      this.playAt("land", f.x, f.y, 0.8);
    }
  }

  private hintFlash() {
    const el = this.hud.get("boostHint");
    if (el) {
      el.style.color = "#ff7d7d";
      setTimeout(() => { el.style.color = ""; }, 300);
    }
  }

  private startReload(f: Fighter) {
    if (f.reloading > 0 || f.ammoInMag >= f.weapon.mag) return;
    f.reloading = f.weapon.reload;
    if (f.isPlayer) this.playAt("reload", f.x, f.y, 0.8);
  }

  private tryFire(f: Fighter) {
    if (!f.alive || f.fireCd > 0 || f.reloading > 0 || f.boostAnim) return;
    if (f.ammoInMag <= 0) {
      this.startReload(f);
      if (f.isPlayer) this.playAt("dryfire", f.x, f.y, 0.7);
      return;
    }
    const w = f.weapon;
    f.ammoInMag--;
    f.fireCd = 60 / w.rpm;
    f.revealT = 1.2;
    const movePen = (Math.abs(f.vx) + Math.abs(f.vy)) > 30 ? 1.4 : 1;
    const spread = (w.spread + f.spreadHeat * w.spread * 1.6) * movePen;
    f.spreadHeat = Math.min(1, f.spreadHeat + 0.22);
    const mx = f.x + Math.cos(f.angle) * 26;
    const my = f.y + Math.sin(f.angle) * 26;
    const dmgMult = (f.elevated ? 1.22 : 1);
    for (let i = 0; i < w.pellets; i++) {
      const a = f.angle + (Math.random() - 0.5) * 2 * spread + (w.pellets > 1 ? (i / w.pellets - 0.5) * spread : 0);
      const sp = w.bulletSpeed * (0.92 + Math.random() * 0.16);
      const b: Bullet = {
        alive: true, x: mx, y: my,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        dmg: w.damage * dmgMult,
        team: f.team, ownerId: f.id,
        pierce: w.pierce ?? 0, dist: w.range, color: w.tracer,
        fromHigh: f.elevated,
      };
      this.pushBullet(b);
    }
    this.particles.muzzle(mx, my, f.angle, w.tracer);
    this.particles.casing(mx, my, f.angle);
    const sfx = ("shoot_" + w.cls) as "shoot_ar";
    this.playAt(sfx, f.x, f.y, f.isPlayer ? 1 : 0.7);
    // recoil
    f.x -= Math.cos(f.angle) * w.kick * 4;
    f.y -= Math.sin(f.angle) * w.kick * 4;
    if (f.isPlayer) this.addTrauma(w.kick * 0.35);
  }

  private pushBullet(b: Bullet) {
    for (let i = 0; i < this.bullets.length; i++) {
      const idx = (this.bulletCursor + i) % this.bullets.length;
      if (!this.bullets[idx].alive) {
        this.bulletCursor = (idx + 1) % this.bullets.length;
        Object.assign(this.bullets[idx], b);
        return;
      }
    }
    if (this.bullets.length < 220) this.bullets.push(b);
  }

  private updateBullets(dt: number) {
    const sub = 2;
    const sdt = dt / sub;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (let s = 0; s < sub && b.alive; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        b.dist -= Math.hypot(b.vx, b.vy) * sdt;
        if (b.dist <= 0) { b.alive = false; break; }
        if (b.x < 0 || b.y < 0 || b.x > this.map.w || b.y > this.map.h) { b.alive = false; break; }
        // obstacles
        for (const o of this.obstacles) {
          if (!o.alive || !SHOT_KINDS.has(o.kind)) continue;
          if (b.fromHigh && LOW_KINDS.has(o.kind)) continue;
          if (b.x > o.x - 2 && b.x < o.x + o.w + 2 && b.y > o.y - 2 && b.y < o.y + o.h + 2) {
            this.hitObstacle(o, b.dmg, b.x, b.y);
            b.alive = false;
            break;
          }
        }
        if (!b.alive) break;
        // fighters
        for (const f of this.fighters) {
          if (!f.alive || f.team === b.team || f.protectT > 0) continue;
          const dx = f.x - b.x, dy = f.y - b.y;
          if (dx * dx + dy * dy < (f.radius + 3) * (f.radius + 3)) {
            const src = this.fighters.find((x) => x.id === b.ownerId);
            this.damageFighter(f, b.dmg, src ?? null, false);
            if (b.pierce > 0) { b.pierce--; continue; }
            b.alive = false;
            break;
          }
        }
      }
    }
  }

  // ---------------- grenades ----------------
  private throwNade(f: Fighter) {
    if (!f.alive || f.nades <= 0 || f.boostAnim) return;
    f.nades--;
    if (f.nadeT <= 0) f.nadeT = 7;
    const a = f.isPlayer ? f.angle : f.aimAngle;
    const sp = 430;
    this.grenades.push({
      x: f.x + Math.cos(a) * 22, y: f.y + Math.sin(a) * 22,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      z: 26, vz: 150, fuse: 1.4, ownerId: f.id, ticked: false,
    });
    this.particles.dust(f.x + Math.cos(a) * 26, f.y + Math.sin(a) * 26, 3);
    this.playAt("throw", f.x, f.y, f.isPlayer ? 0.9 : 0.6);
    if (f.isPlayer) this.addTrauma(0.08);
  }

  private updateGrenades(dt: number) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      if (g.z > 0) {
        g.vz -= 520 * dt;
        g.z += g.vz * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        // hard structures stop grenades mid-flight
        for (const o of this.obstacles) {
          if (!o.alive) continue;
          if (o.kind !== "wall" && o.kind !== "container") continue;
          if (g.x > o.x - 4 && g.x < o.x + o.w + 4 && g.y > o.y - 4 && g.y < o.y + o.h + 4 && g.z < 44) {
            g.x -= g.vx * dt; g.y -= g.vy * dt;
            g.vx = 0; g.vy = 0;
            break;
          }
        }
        if (Math.random() < 0.35) this.particles.spawn("smoke", g.x, g.y - g.z * 0.5, { max: 0.3, size: 4, color: "#9aa48e" });
        if (g.z <= 0) {
          g.z = 0; g.vx = 0; g.vy = 0;
          this.particles.dust(g.x, g.y, 4);
          this.playAt("land", g.x, g.y, 0.5);
        }
      }
      g.fuse -= dt;
      if (g.fuse < 0.5 && !g.ticked) {
        g.ticked = true;
        this.playAt("nadeTick", g.x, g.y, 0.8);
      }
      if (g.fuse <= 0) {
        this.grenades.splice(i, 1);
        this.explode(g.x, g.y, g.ownerId, false);
      }
    }
  }

  private drawGrenades(ctx: CanvasRenderingContext2D) {
    for (const g of this.grenades) {
      const gy = g.y - g.z * 0.9;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(g.x + 3, g.y + 4, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const grad = ctx.createRadialGradient(g.x - 2, gy - 2, 1, g.x, gy, 7);
      grad.addColorStop(0, "#56704e");
      grad.addColorStop(1, "#1d2b1c");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(g.x, gy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0e1610";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // blinking fuse LED
      const blinkSpeed = g.fuse < 0.5 ? 26 : 10;
      if (Math.sin(this.matchT * blinkSpeed) > -0.2) {
        ctx.fillStyle = "#ff4d4d";
        ctx.beginPath(); ctx.arc(g.x + 2.5, gy - 3, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  private hitObstacle(o: Obs, dmg: number, hx: number, hy: number) {
    if (o.maxHp <= 0) {
      this.particles.hitSpark(hx, hy, "#ffcf8a");
      return;
    }
    o.hp -= dmg;
    o.flash = 0.1;
    if (o.kind === "crate") this.particles.woodBurst(hx, hy);
    else if (o.kind === "barrel") this.particles.hitSpark(hx, hy, "#ffa14a");
    else this.particles.metalBurst(hx, hy);
    if (o.hp <= 0 && o.alive) {
      o.alive = false;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      if (o.kind === "barrel") this.pendingBooms.push({ x: cx, y: cy, t: 0.05, srcId: -2, big: false });
      else if (o.kind === "car") this.pendingBooms.push({ x: cx, y: cy, t: 0.05, srcId: -2, big: true });
      else if (o.kind === "crate") {
        this.particles.woodBurst(cx, cy);
        this.particles.dust(cx, cy, 6);
        if (Math.random() < 0.4) {
          this.pickups.push({ x: cx, y: cy, kind: Math.random() < 0.55 ? "medkit" : "armor", alive: true, bobT: Math.random() * 6 });
        }
      }
      this.playAt("hit", hx, hy, 0.5);
    }
  }

  explode(x: number, y: number, srcId: number, big = false) {
    const radius = big ? 200 : 150;
    const maxDmg = big ? 110 : 88;
    this.particles.explosion(x, y, big ? 1.3 : 1);
    const src = this.fighters.find((f) => f.id === srcId) ?? null;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < radius) {
        const dmg = Math.max(18, maxDmg * (1 - d / radius));
        this.damageFighter(f, dmg, src, true);
        if (f.isPlayer) {
          this.dirHits.push({ angle: Math.atan2(y - f.y, x - f.x), life: 1 });
          if (this.dirHits.length > 4) this.dirHits.shift();
        }
        const push = (1 - d / radius) * 260;
        if (d > 0.01) { f.x += ((f.x - x) / d) * push * 0.05; f.y += ((f.y - y) / d) * push * 0.05; }
      }
    }
    // chain obstacles
    for (const o of this.obstacles) {
      if (!o.alive || o.maxHp <= 0) continue;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      if (Math.hypot(cx - x, cy - y) < radius + Math.max(o.w, o.h) / 2) {
        o.hp -= 150;
        o.flash = 0.15;
        if (o.hp <= 0) {
          o.alive = false;
          if (o.kind === "barrel") this.pendingBooms.push({ x: cx, y: cy, t: 0.12 + Math.random() * 0.2, srcId, big: false });
          else if (o.kind === "car") this.pendingBooms.push({ x: cx, y: cy, t: 0.15, srcId, big: true });
          else this.particles.woodBurst(cx, cy);
        }
      }
    }
    this.playAt("explosion", x, y, 1);
    const p = this.player();
    if (p) {
      const d = Math.hypot(p.x - x, p.y - y);
      this.addTrauma(clamp(0.9 - d / 900, 0.1, 0.9));
    }
  }

  private damageFighter(f: Fighter, dmg: number, src: Fighter | null, isExplosion: boolean) {
    if (!f.alive || f.protectT > 0) return;
    if (f.elevated) dmg *= 0.85;
    let left = dmg;
    if (f.shield > 0) {
      const absorbed = Math.min(f.shield, left * 0.65);
      f.shield -= absorbed;
      left -= absorbed;
    }
    f.hp -= left;
    f.hitFlashT = 0.13;
    f.hidden = false;
    f.revealT = Math.max(f.revealT, 0.5);
    this.particles.fleshHit(f.x, f.y);
    if (src && src.isPlayer) {
      this.pulseHitmarker(false);
      this.playAt("hit", f.x, f.y, 0.8);
      this.particles.floatText(f.x + (Math.random() - 0.5) * 20, f.y - 30, String(Math.round(dmg)), "#ffd28a");
    }
    if (f.isPlayer) {
      f.hurtPulse = Math.min(1, f.hurtPulse + 0.55);
      this.addTrauma(0.22);
      this.playAt("hurt", f.x, f.y, 0.9);
      if (src) {
        this.dirHits.push({ angle: Math.atan2(src.y - f.y, src.x - f.x), life: 1 });
        if (this.dirHits.length > 4) this.dirHits.shift();
      }
    }
    if (f.hp <= 0) this.kill(f, src);
    if (isExplosion) f.hidden = false;
  }

  private kill(victim: Fighter, src: Fighter | null) {
    victim.alive = false;
    victim.deaths++;
    victim.streak = 0;
    victim.hp = 0;
    this.particles.burst(victim.x, victim.y, TEAM_COLORS[victim.team], 16, 300, 0.6, 4);
    this.particles.burst(victim.x, victim.y, "#ff5d5d", 10, 200, 0.5, 4);
    this.particles.spawn("ring", victim.x, victim.y, { max: 0.5, size: 10, size2: 70, color: TEAM_COLORS[victim.team] });

    if (src && src !== victim && src.team !== victim.team) {
      src.kills++;
      src.streak++;
      if (this.mode.id === "tdm") {
        if (src.team === 0) this.scoreA++; else this.scoreB++;
      }
      if (this.mode.id === "horde" && src.team === 0) this.scoreA++;
      const bonus = src.elevated ? 25 : 0;
      src.score += 100 + bonus;
      if (src.isPlayer) {
        this.playAt("kill", victim.x, victim.y, 1);
        this.pulseHitmarker(true);
        this.hitstopT = 0.055;
        this.addTrauma(0.18);
        this.particles.floatText(victim.x, victim.y - 46, `+${100 + bonus}`, "#7dff9b", true);
        src.multi++;
        src.multiT = 4.5;
        if (src.multi === 2) this.announce("ДВОЙНОЕ УБИЙСТВО", "");
        else if (src.multi === 3) { this.announce("ТРОЙНОЕ УБИЙСТВО", ""); this.playAt("streak", 0, 0); }
        else if (src.multi >= 4) { this.announce("БЕШЕНСТВО ×" + src.multi, ""); this.playAt("streak", 0, 0); }
        else if (src.streak === 5) this.announce("СЕРИЯ ИЗ 5", "");
        else if (src.streak === 8) this.announce("НЕУДЕРЖИМЫЙ", "");
      }
      if (src.streak > src.bestStreak) src.bestStreak = src.streak;
      this.killfeedPush(src, victim);
      // drop loot
      if (Math.random() < 0.16) {
        this.pickups.push({ x: victim.x, y: victim.y, kind: Math.random() < 0.6 ? "medkit" : "armor", alive: true, bobT: 0 });
      }
    }
    if (this.mode.respawn) victim.respawnT = this.mode.respawnDelay;
    this.checkElimRound(victim);
    // horde: squad wipe = defeat
    if (this.mode.id === "horde" && victim.team === 0 && !this.hordeLost && !this.hordeWon && this.endDelay <= 0) {
      const squadLeft = this.fighters.some((x) => x.alive && x.team === 0);
      if (!squadLeft && this.waveNum > 0) {
        this.hordeLost = true;
        this.triggerEndDelay();
      }
    }
  }

  private respawn(f: Fighter) {
    const spawns = f.team === 0 ? this.map.spawnsA : this.map.spawnsB;
    // pick spawn farthest from nearest enemy
    let best = spawns[0], bd = -1;
    for (const s of spawns) {
      let minD = Infinity;
      for (const e of this.fighters) {
        if (e.alive && e.team !== f.team) minD = Math.min(minD, Math.hypot(e.x - s.x, e.y - s.y));
      }
      if (minD > bd) { bd = minD; best = s; }
    }
    f.x = best.x + (Math.random() - 0.5) * 30;
    f.y = best.y + (Math.random() - 0.5) * 30;
    f.hp = f.maxHp;
    f.shield = 0;
    f.alive = true;
    f.ammoInMag = f.weapon.mag;
    f.reloading = 0;
    f.protectT = 1.6;
    f.elevated = false;
    f.z = 0; f.zv = 0;
    f.vx = f.vy = 0;
    f.brain?.reset(f.x, f.y);
    this.particles.jumpRing(f.x, f.y, TEAM_COLORS[f.team]);
    if (f.isPlayer) this.playAt("deploy", f.x, f.y, 0.9);
  }

  private spawnRandomPickup() {
    const spots: [number, number][] = [];
    for (const p of this.map.points) spots.push([p.x + 180, p.y], [p.x - 180, p.y]);
    spots.push([this.map.w / 2, this.map.h / 2 + 200], [this.map.w / 2, this.map.h / 2 - 200]);
    const [x, y] = spots[(Math.random() * spots.length) | 0];
    const busy = this.pickups.some((p) => p.alive && Math.hypot(p.x - x, p.y - y) < 60);
    if (busy) return;
    if (this.pickups.filter((p) => p.alive).length >= 6) return;
    this.pickups.push({ x, y, kind: Math.random() < 0.6 ? "medkit" : "armor", alive: true, bobT: Math.random() * 6 });
  }

  private updatePickups(dt: number) {
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.bobT += dt;
      for (const f of this.fighters) {
        if (!f.alive) continue;
        if (Math.hypot(f.x - p.x, f.y - p.y) < 30) {
          if (p.kind === "medkit") {
            if (f.hp >= f.maxHp) continue;
            f.hp = Math.min(f.maxHp, f.hp + 45);
            this.particles.floatText(f.x, f.y - 34, "+45", "#7dff9b");
          } else {
            if (f.shield >= 70) continue;
            f.shield = Math.min(70, f.shield + 50);
            this.particles.floatText(f.x, f.y - 34, "+БРОНЯ", "#9bd7ff");
          }
          p.alive = false;
          this.particles.burst(p.x, p.y, p.kind === "medkit" ? "#7dff9b" : "#9bd7ff", 10, 160, 0.5, 3);
          if (f.isPlayer) this.playAt("pickup", p.x, p.y);
          break;
        }
      }
    }
  }

  // ---------------- horde (co-op PvE waves) ----------------
  private waveTotal(wave: number): number { return Math.min(12, 3 + wave); }

  private spawnHordeEnemy(wave: number) {
    const total = this.waveTotal(wave);
    const isBoss = wave % 4 === 0 && this.pendingSpawns === 0;
    const diff = this.settings.difficulty;
    const diffBonus = diff === "easy" ? -0.12 : diff === "hard" ? 0.12 : 0;
    const skill = clamp(0.3 + wave * 0.055 + diffBonus + Math.random() * 0.15, 0.2, 0.95);
    const pool: WeaponClass[] = wave < 3 ? ["sg", "smg"] : wave < 6 ? ["smg", "ar", "sg"] : ["ar", "sr", "smg", "ar"];
    const cls = pool[(Math.random() * pool.length) | 0];
    const list = WEAPONS.filter((w) => w.cls === cls);
    const weapon = isBoss ? (WEAPONS.find((w) => w.id === "famas") ?? list[0]) : list[(Math.random() * list.length) | 0];
    // spawn at rotating map edges — flanking pressure grows over waves
    const M = this.map;
    const edges = [
      { x: M.w - 70, y: M.h / 2 }, { x: 70, y: M.h / 2 },
      { x: M.w / 2, y: 70 }, { x: M.w / 2, y: M.h - 70 },
    ];
    const e = edges[(wave + ((Math.random() * edges.length) | 0)) % edges.length];
    const x = clamp(e.x + (Math.random() - 0.5) * 140, 40, M.w - 40);
    const y = clamp(e.y + (Math.random() - 0.5) * 140, 40, M.h - 40);
    void total;
    const f: Fighter = {
      id: this.nextFighterId++,
      team: 1,
      name: isBoss ? "ЖУГГЕРНАУТ" : BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0],
      bot: true, isPlayer: false,
      x, y, vx: 0, vy: 0, z: 0, zv: 0,
      angle: Math.atan2(M.h / 2 - y, M.w / 2 - x),
      radius: isBoss ? 25 : 18,
      hp: isBoss ? 340 : 100, maxHp: isBoss ? 340 : 100,
      shield: !isBoss && wave >= 6 ? 30 : 0,
      weapon, ammoInMag: weapon.mag, reloading: 0, fireCd: 0, spreadHeat: 0,
      alive: true, elevated: false, hidden: false,
      weaponRange: weapon.range, weaponCls: weapon.cls,
      mvx: 0, mvy: 0, aimAngle: Math.atan2(M.h / 2 - y, M.w / 2 - x),
      wantFire: false, wantReload: false, wantJump: false, wantNade: false,
      protectT: 1.2, hitFlashT: 0, revealT: 0, respawnT: 0,
      kills: 0, deaths: 0, streak: 0, bestStreak: 0, score: 0,
      multi: 0, multiT: 0, boostCd: 0, boostAnim: null, hurtPulse: 0,
      nades: wave >= 5 ? 1 : 0, nadeT: 0,
      brain: new BotBrain(skill, "hunter", x, y),
    };
    this.fighters.push(f);
    this.particles.jumpRing(x, y, TEAM_COLORS[1]);
  }

  private updateHorde(dt: number) {
    const enemiesAlive = this.fighters.reduce((n, f) => n + (f.alive && f.team === 1 ? 1 : 0), 0);
    this.scoreB = enemiesAlive + this.pendingSpawns;

    if (this.waveBreakT > 0) {
      this.waveBreakT -= dt;
      if (this.waveBreakT <= 0) {
        this.waveNum++;
        this.pendingSpawns = this.waveTotal(this.waveNum);
        this.spawnTick = 0.3;
        const bossWave = this.waveNum % 4 === 0;
        this.announce(`ВОЛНА ${this.waveNum}`, bossWave ? "ВНИМАНИЕ: ДЖАГГЕРНАУТ" : `противников: ${this.pendingSpawns}`);
        this.playAt("deploy", this.cam.x, this.cam.y, 0.9);
      }
      return;
    }

    if (this.pendingSpawns > 0) {
      this.spawnTick -= dt;
      if (this.spawnTick <= 0 && enemiesAlive < 7) {
        this.spawnTick = 0.85 + Math.random() * 0.7;
        this.pendingSpawns--;
        this.spawnHordeEnemy(this.waveNum);
      }
      return;
    }

    if (enemiesAlive === 0 && this.waveNum > 0) {
      if (this.waveNum >= 10) {
        this.hordeWon = true;
        this.triggerEndDelay();
        return;
      }
      // wave cleared — reward: heal, refill, revive fallen allies, supplies
      this.waveBreakT = 6;
      this.announce("ВОЛНА ЗАЧИЩЕНА", "Перегруппировка — 6 секунд");
      this.playAt("roundWin", 0, 0, 0.8);
      for (const f of this.fighters) {
        if (f.team !== 0) continue;
        if (f.alive) {
          f.hp = Math.min(f.maxHp, f.hp + 40);
          f.ammoInMag = f.weapon.mag;
        } else {
          this.respawn(f);
        }
      }
      const pl = this.player();
      if (pl && pl.alive) {
        pl.score += 150;
        this.particles.floatText(pl.x, pl.y - 50, "+150 ВОЛНА", "#7dff9b", true);
      }
      for (let i = 0; i < 3; i++) {
        this.pickups.push({
          x: this.map.w / 2 + (Math.random() - 0.5) * 560,
          y: this.map.h / 2 + (Math.random() - 0.5) * 420,
          kind: Math.random() < 0.55 ? "medkit" : "armor",
          alive: true, bobT: Math.random() * 6,
        });
      }
    }
  }

  // ---------------- modes ----------------
  private updateMode(dt: number) {
    this.timeLeft -= dt;

    if (this.mode.id === "horde") {
      this.updateHorde(dt);
      return;
    }

    // countdown ticks
    const tl = Math.ceil(this.timeLeft);
    if (tl !== this.lastTimerTick) {
      this.lastTimerTick = tl;
      if (tl <= 3 && tl >= 1 && this.mode.id === "elim") this.playAt("countdown", this.cam.x, this.cam.y, 0.6);
    }

    if (this.mode.id === "dom") {
      for (const p of this.points) {
        let a = 0, b = 0;
        for (const f of this.fighters) {
          if (!f.alive) continue;
          if (Math.hypot(f.x - p.x, f.y - p.y) < 115) { if (f.team === 0) a++; else b++; }
        }
        p.contested = a > 0 && b > 0;
        if (p.contested) continue;
        const t = a > 0 ? 0 : b > 0 ? 1 : -1;
        if (t === -1) {
          if (p.progress > 0 && p.owner === -1) { p.progress = Math.max(0, p.progress - dt * 0.1); if (p.progress === 0) p.capTeam = -1; }
          continue;
        }
        const n = Math.max(a, b);
        if (p.owner === t) continue;
        if (p.capTeam !== t) {
          p.capTeam = t;
          p.progress = 0.05;
          // enemy touch neutralizes an owned point — classic two-phase capture
          if (p.owner !== -1 && p.owner !== t) p.owner = -1;
        }
        p.progress = Math.min(1, p.progress + (dt / 3.4) * Math.min(2, n * 0.7 + 0.3));
        if (Math.random() < dt * 2 && n > 0) this.playAt("capture", p.x, p.y, 0.5);
        if (p.progress >= 1) {
          p.owner = t;
          this.playAt("pointTaken", p.x, p.y);
          this.announce(`ТОЧКА ${p.id} — ${TEAM_NAMES[t]}`, t === 0 ? "Точка наша" : "Точка потеряна", true);
          const pl = this.player();
          if (pl && pl.team === t && Math.hypot(pl.x - p.x, pl.y - p.y) < 150) {
            pl.score += 50;
            this.particles.floatText(p.x, p.y - 50, "+50 ЗАХВАТ", "#7dff9b");
          }
        }
      }
      const ownedA = this.points.filter((p) => p.owner === 0).length;
      const ownedB = this.points.filter((p) => p.owner === 1).length;
      this.scoreA += (ownedA * dt) / 1.7;
      this.scoreB += (ownedB * dt) / 1.7;
      if (this.scoreA >= this.mode.scoreTarget! || this.scoreB >= this.mode.scoreTarget!) return this.triggerEndDelay();
    }

    if (this.mode.id === "koth") {
      const p = this.points[0];
      if (p) {
        let a = 0, b = 0;
        for (const f of this.fighters) {
          if (!f.alive) continue;
          if (Math.hypot(f.x - p.x, f.y - p.y) < 115) { if (f.team === 0) a++; else b++; }
        }
        p.contested = a > 0 && b > 0;
        const t = a > 0 ? 0 : b > 0 ? 1 : -1;
        if (t !== -1 && !p.contested) {
          if (t === 0) this.scoreA += dt; else this.scoreB += dt;
          if (p.owner !== t) {
            p.owner = t; p.capTeam = t; p.progress = 1;
            if (t === 0) {
              const pl = this.player();
              if (pl && Math.hypot(pl.x - p.x, pl.y - p.y) < 140) {
                pl.score += 50;
                this.particles.floatText(p.x, p.y - 50, "+50 ХОЛМ", "#7dff9b");
              }
            }
            this.announce(`ХОЛМ — ${TEAM_NAMES[t]}`, t === 0 ? "Удерживайте позицию!" : "Отбейте точку!", true);
            this.playAt("pointTaken", p.x, p.y);
          }
        }
        if (this.scoreA >= this.mode.scoreTarget! || this.scoreB >= this.mode.scoreTarget!) return this.triggerEndDelay();
      }
    }

    if (this.mode.id === "tdm") {
      if (this.scoreA >= this.mode.killTarget! || this.scoreB >= this.mode.killTarget!) return this.triggerEndDelay();
    }

    if (this.mode.id === "elim") {
      if (this.timeLeft <= 0) {
        const a = this.fighters.filter((f) => f.alive && f.team === 0).length;
        const b = this.fighters.filter((f) => f.alive && f.team === 1).length;
        if (a > b) this.roundsA++;
        else if (b > a) this.roundsB++;
        this.endRound(a > b ? 0 : b > a ? 1 : -1);
      }
      return;
    }

    if (this.timeLeft <= 0) this.triggerEndDelay();
  }

  private checkElimRound(_victim: Fighter) {
    if (this.mode.id !== "elim" || this.intermissionT > 0 || this.endDelay > 0) return;
    const a = this.fighters.filter((f) => f.alive && f.team === 0).length;
    const b = this.fighters.filter((f) => f.alive && f.team === 1).length;
    if (a === 0 || b === 0) {
      if (a > 0) this.roundsA++;
      else if (b > 0) this.roundsB++;
      this.endRound(a > 0 ? 0 : 1);
    }
  }

  private endRound(winner: number) {
    if (this.endDelay > 0) return;
    if (this.roundsA >= this.mode.roundWins! || this.roundsB >= this.mode.roundWins!) {
      this.triggerEndDelay();
      return;
    }
    if (winner === 0) { this.announce("РАУНД ЗА НАМИ", `${this.roundsA} : ${this.roundsB}`); this.playAt("roundWin", 0, 0); }
    else if (winner === 1) this.announce("РАУНД ПРОИГРАН", `${this.roundsA} : ${this.roundsB}`);
    else this.announce("НИЧЬЯ", `${this.roundsA} : ${this.roundsB}`);
    this.intermissionT = 3.2;
  }

  private resetRound() {
    this.roundNum++;
    this.timeLeft = this.mode.timeLimit;
    this.bullets = [];
    this.pendingBooms = [];
    this.pickups = [];
    this.grenades = [];
    this.dirHits = [];
    this.botWorld.pickups = this.pickups;
    for (const o of this.obstacles) { o.alive = true; o.hp = o.maxHp; o.flash = 0; }
    for (const f of this.fighters) this.respawn(f);
    for (const p of this.points) { p.owner = -1; p.progress = 0; p.capTeam = -1; }
    this.announce(`РАУНД ${this.roundNum}`, `${this.roundsA} : ${this.roundsB}`);
    this.playAt("deploy", this.cam.x, this.cam.y, 0.8);
  }

  private triggerEndDelay() {
    if (this.attract) { this.restartAttract(); return; }
    if (this.endDelay > 0) return;
    const win = this.mode.id === "horde" ? this.hordeWon : this.scoreA > this.scoreB;
    this.announce(win ? "ПОБЕДА" : this.scoreA === this.scoreB ? "НИЧЬЯ" : "ПОРАЖЕНИЕ",
      this.mode.id === "elim" ? `Раунды ${this.roundsA} : ${this.roundsB}` : `Счёт ${Math.floor(this.scoreA)} : ${Math.floor(this.scoreB)}`);
    this.playAt(win ? "roundWin" : "countdown", 0, 0, 1);
    this.endDelay = 1.4;
  }

  private finishMatch() {
    if (this.attract) { this.restartAttract(); return; }
    this.state = "over";
    const p = this.player()!;
    const win = this.mode.id === "horde" ? this.hordeWon
      : this.mode.id === "elim" ? this.roundsA > this.roundsB
        : this.scoreA > this.scoreB;
    const draw = this.mode.id === "horde" ? false
      : this.mode.id === "elim" ? this.roundsA === this.roundsB
        : this.scoreA === this.scoreB;
    const result: MatchResult = {
      win: win && !draw, draw,
      modeId: this.mode.id, mapId: this.map.id,
      kills: p.kills, deaths: p.deaths,
      bestStreak: p.bestStreak,
      score: p.score + (win && !draw ? 500 : 0),
      scoreA: Math.floor(this.mode.id === "elim" ? this.roundsA : this.scoreA),
      scoreB: Math.floor(this.mode.id === "elim" ? this.roundsB : this.scoreB),
      duration: this.matchT,
    };
    this.hooks.onGameOver?.(result);
  }

  private restartAttract() {
    if (this.cfg) this.startMatch(this.cfg, true);
  }

  // ---------------- announce / feed ----------------
  private announce(main: string, sub: string, quiet = false) {
    if (this.attract) return;
    const el = this.hud.get("announce");
    const sub2 = this.hud.get("announceSub");
    if (el) {
      el.textContent = main;
      el.classList.remove("hud-pop");
      void el.offsetWidth;
      el.classList.add("hud-pop");
    }
    if (sub2) {
      sub2.textContent = sub;
      sub2.classList.remove("hud-pop-sub");
      void sub2.offsetWidth;
      if (sub) sub2.classList.add("hud-pop-sub");
    }
    if (!quiet && main) sound.play("streak", 0.4);
  }

  private killfeedPush(src: Fighter, victim: Fighter) {
    const feed = this.hud.get("killfeed");
    if (!feed || this.attract) return;
    const div = document.createElement("div");
    div.className = "kf-row";
    div.innerHTML =
      `<span style="color:${TEAM_COLORS[src.team]}">${esc(src.name)}</span>` +
      `<span class="kf-wep">${esc(src.weapon.name)}</span>` +
      `<span style="color:${TEAM_COLORS[victim.team]}">${esc(victim.name)}</span>`;
    feed.prepend(div);
    while (feed.children.length > 5) feed.lastChild?.remove();
    setTimeout(() => { div.classList.add("kf-out"); }, 3600);
    setTimeout(() => { div.remove(); }, 4200);
  }

  private pulseHitmarker(killshot: boolean) {
    const el = this.hud.get("hitm");
    if (!el) return;
    el.classList.remove("hitm-show", "hitm-kill");
    void el.offsetWidth;
    el.classList.add("hitm-show");
    if (killshot) el.classList.add("hitm-kill");
  }

  // ---------------- HUD dom ----------------
  private updateHudDom() {
    if (this.attract || this.hud.size === 0) return;
    const p = this.player();
    if (!p) return;
    const hpFrac = clamp(p.hp / p.maxHp, 0, 1);
    const hpbar = this.hud.get("hpbar");
    if (hpbar) hpbar.style.transform = `scaleX(${hpFrac})`;
    const shbar = this.hud.get("shbar");
    if (shbar) shbar.style.transform = `scaleX(${clamp(p.shield / 70, 0, 1)})`;
    this.hset("hpnum", String(Math.max(0, Math.ceil(p.hp))));
    this.hset("ammo", p.reloading > 0 ? "..." : `${p.ammoInMag} / ${p.weapon.mag}`);
    this.hset("wepname", p.weapon.name);
    this.hset("nades", (p.nades >= 1 ? "●" : "○") + " " + (p.nades >= 2 ? "●" : "○"));
    const amEl = this.hud.get("ammo");
    if (amEl) amEl.style.color = p.ammoInMag <= Math.ceil(p.weapon.mag * 0.25) ? "#ff8d7d" : "";
    const rbar = this.hud.get("reloadbar");
    if (rbar) {
      const show = p.reloading > 0;
      rbar.style.display = show ? "" : "none";
      if (show) rbar.style.transform = `scaleX(${1 - p.reloading / p.weapon.reload})`;
    }

    // scores
    const sA = this.mode.id === "elim" ? this.roundsA : Math.floor(this.scoreA);
    const sB = this.mode.id === "elim" ? this.roundsB : Math.floor(this.scoreB);
    this.hset("scoreA", String(sA));
    this.hset("scoreB", String(sB));
    const targetTxt = this.mode.killTarget ? `до ${this.mode.killTarget}`
      : this.mode.scoreTarget ? `до ${this.mode.scoreTarget}`
        : this.mode.roundWins ? `до ${this.mode.roundWins} раундов`
          : "выстоять 10 волн";
    this.hset("objline", `${this.mode.name} · ${targetTxt}`);
    if (this.mode.id === "horde") {
      this.hset("objline", this.waveBreakT > 0
        ? `РУБЕЖ · волна через ${Math.ceil(this.waveBreakT)}`
        : `РУБЕЖ · волна ${Math.max(1, this.waveNum)}/10`);
    }

    const t = Math.max(0, this.timeLeft);
    const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    this.hset("timer", `${mm}:${ss.toString().padStart(2, "0")}`);

    // respawn overlay
    const dead = !p.alive;
    this.hshow("respawn", dead && this.mode.respawn);
    if (dead && this.mode.respawn) this.hset("respawnT", Math.ceil(p.respawnT).toString());

    // vignette
    const vg = this.hud.get("dmgvin");
    if (vg) {
      const low = p.alive && p.hp < 32 ? 0.35 + Math.sin(this.matchT * 6) * 0.12 : 0;
      vg.style.opacity = String(clamp(p.hurtPulse + low, 0, 0.85));
    }

    // boost hint
    let canBoost = false;
    if (p.alive && !p.elevated && p.boostCd <= 0) {
      for (const o of this.fighters) {
        if (o.alive && o.team === p.team && o.id !== p.id && Math.hypot(o.x - p.x, o.y - p.y) < 95) {
          for (const z of this.map.highgrounds) {
            const cx = clamp(p.x, z.x, z.x + z.w), cy = clamp(p.y, z.y, z.y + z.h);
            if (Math.hypot(cx - p.x, cy - p.y) < 170) { canBoost = true; break; }
          }
        }
        if (canBoost) break;
      }
    }
    this.hshow("boostHint", canBoost);
    if (p.elevated) this.hset("boostHint", "");
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const lx = sx - rect.left, ly = sy - rect.top;
    return {
      x: this.cam.x + (lx - cx) / this.cam.zoom,
      y: this.cam.y + (ly - cy) / this.cam.zoom,
    };
  }

  // ---------------- render ----------------
  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
  };

  private render(frame: number) {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = this.canvas.width / dpr, vh = this.canvas.height / dpr;

    // camera follow
    let tx = this.cam.x, ty = this.cam.y;
    if (this.attract) {
      this.camT -= frame;
      const list = this.fighters.filter((f) => f.alive);
      if (this.camT <= 0 || !list.some((f) => f.id === this.attractTarget)) {
        this.camT = 4.5;
        this.attractTarget = list.length ? list[(Math.random() * list.length) | 0].id : 0;
      }
      const tgt = list.find((f) => f.id === this.attractTarget);
      if (tgt) { tx = tgt.x; ty = tgt.y; }
    } else {
      const p = this.player();
      if (p) {
        if (p.alive) {
          tx = p.x; ty = p.y;
          if (!touchInput.active) {
            const w = this.screenToWorld(this.mouse.sx, this.mouse.sy);
            const dx = w.x - p.x, dy = w.y - p.y;
            const d = Math.hypot(dx, dy);
            const lead = Math.min(d * 0.22, 90);
            if (d > 1) { tx += (dx / d) * lead; ty += (dy / d) * lead; }
          }
        } else {
          const ally = this.fighters.find((f) => f.alive && f.team === 0 && !f.isPlayer);
          if (ally) { tx = ally.x; ty = ally.y; }
        }
      }
    }
    const k = 1 - Math.pow(0.0015, frame);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);

    const baseZoom = clamp(Math.min(vw / 1150, vh / 720), 0.55, 1.3);
    this.cam.zoom = baseZoom * (this.attract ? 0.9 : 1);

    // shake
    this.trauma = Math.max(0, this.trauma - frame * 1.6);
    const sh = this.trauma * this.trauma * 26;
    const shx = (Math.random() - 0.5) * 2 * sh;
    const shy = (Math.random() - 0.5) * 2 * sh;

    const camX = clamp(this.cam.x, vw / (2 * this.cam.zoom) - 80, this.map.w - vw / (2 * this.cam.zoom) + 80);
    const camY = clamp(this.cam.y, vh / (2 * this.cam.zoom) - 80, this.map.h - vh / (2 * this.cam.zoom) + 80);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.map.palette.voidColor;
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(vw / 2 + shx, vh / 2 + shy);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-camX, -camY);

    // ground
    if (this.ground) ctx.drawImage(this.ground, 0, 0);

    this.drawHighgrounds(ctx);
    if (this.mode.id === "dom" || this.mode.id === "koth") this.drawPoints(ctx);
    this.drawPickups(ctx);
    this.drawObstaclesShadows(ctx);
    this.drawObstacles(ctx);
    this.drawFighters(ctx);
    this.drawGrenades(ctx);
    this.drawCanopies(ctx);

    // ambient weather (rain / leaves / fireflies / dust)
    this.updateAmbientWorld(frame, camX, camY, vw, vh);

    // bullets (additive)
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const b of this.bullets) {
      if (!b.alive) continue;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3;
      const l = 16;
      const m = Math.hypot(b.vx, b.vy) || 1;
      ctx.beginPath();
      ctx.moveTo(b.x - (b.vx / m) * l, b.y - (b.vy / m) * l);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 7;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.particles.draw(ctx, true);
    ctx.globalCompositeOperation = "source-over";
    this.particles.draw(ctx, false);

    ctx.restore();

    this.drawMinimap(ctx, vw, vh, dpr);
    if (!this.attract && this.state === "playing") {
      this.drawDirHits(ctx, vw, vh);
      this.drawCrosshair(ctx, vw, vh);
    }
  }

  // ---------------- ambient weather ----------------
  private updateAmbientWorld(frame: number, camX: number, camY: number, vw: number, vh: number) {
    const zoom = this.cam.zoom;
    const viewW = vw / zoom, viewH = vh / zoom;
    const left = camX - viewW / 2, top = camY - viewH / 2;
    const rate = 34 * this.qualityScale;
    this.ambientAcc += frame * rate;
    const P = this.particles;
    while (this.ambientAcc >= 1) {
      this.ambientAcc -= 1;
      switch (this.map.id) {
        case "city": {
          // slanted rain streaks
          P.spawn("spark", left - 80 + Math.random() * (viewW + 160), top - 60, {
            vx: 70, vy: 660, max: (viewH + 200) / 660, size: 8,
            color: "#6f96c9", additive: false, drag: 0,
          });
          break;
        }
        case "village": {
          const cols = ["#8fae5a", "#b5a04a", "#7d9a4e"];
          P.spawn("chip", left + Math.random() * viewW, top - 30, {
            vx: (Math.random() - 0.5) * 70, vy: 55 + Math.random() * 60,
            max: 4 + Math.random() * 2, size: 4 + Math.random() * 3,
            color: cols[(Math.random() * cols.length) | 0], drag: 0.35, vr: (Math.random() - 0.5) * 6,
            additive: false,
          });
          break;
        }
        case "forest": {
          if (Math.random() < 0.55) {
            // fireflies
            P.spawn("spark", left + Math.random() * viewW, top + Math.random() * viewH, {
              vx: (Math.random() - 0.5) * 26, vy: (Math.random() - 0.5) * 22,
              max: 3.5 + Math.random() * 3, size: 2.6 + Math.random() * 2.4,
              color: "#ffe07a", drag: 0,
            });
          } else {
            P.spawn("chip", left + Math.random() * viewW, top - 30, {
              vx: (Math.random() - 0.5) * 50, vy: 45 + Math.random() * 50,
              max: 5, size: 4 + Math.random() * 2.5,
              color: Math.random() < 0.5 ? "#5d8440" : "#4a6c33", drag: 0.3, vr: 3,
              additive: false,
            });
          }
          break;
        }
        case "terminal": {
          P.spawn("dust", left + Math.random() * viewW, top + Math.random() * viewH, {
            vx: -40 - Math.random() * 60, vy: 8 + Math.random() * 14,
            max: 5 + Math.random() * 3, size: 2 + Math.random() * 2,
            color: "#93a6b8", drag: 0, additive: false,
          });
          break;
        }
        default: {
          P.spawn("dust", left + Math.random() * viewW, top + Math.random() * viewH, {
            vx: (Math.random() - 0.5) * 24, vy: 14 + Math.random() * 18,
            max: 5 + Math.random() * 3, size: 2 + Math.random() * 2,
            color: "#b0a98a", drag: 0, additive: false,
          });
        }
      }
    }
  }

  // ---------------- damage direction ----------------
  private drawDirHits(ctx: CanvasRenderingContext2D, vw: number, vh: number) {
    if (this.dirHits.length === 0) return;
    const cx = vw / 2, cy = vh / 2;
    const R = Math.min(vw, vh) * 0.19 + 60;
    for (const d of this.dirHits) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(d.angle);
      ctx.globalAlpha = clamp(d.life, 0, 1) * 0.85;
      const g = ctx.createLinearGradient(R - 24, 0, R + 14, 0);
      g.addColorStop(0, "rgba(255,60,60,0)");
      g.addColorStop(1, "rgba(255,60,60,.95)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, R, -0.4, 0.4);
      ctx.stroke();
      ctx.restore();
    }
  }

  private cachedGrad(key: string, make: () => CanvasGradient): CanvasGradient {
    let g = this.styleCache.get(key);
    if (!g) { g = make(); this.styleCache.set(key, g); }
    return g;
  }

  private drawHighgrounds(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const z of this.map.highgrounds) {
      ctx.fillStyle = "rgba(255,209,102,.07)";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "rgba(255,209,102,.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6);
      ctx.setLineDash([]);
      // scaffold cross braces
      ctx.strokeStyle = "rgba(255,209,102,.18)";
      ctx.beginPath();
      ctx.moveTo(z.x + 6, z.y + 6); ctx.lineTo(z.x + z.w - 6, z.y + z.h - 6);
      ctx.moveTo(z.x + z.w - 6, z.y + 6); ctx.lineTo(z.x + 6, z.y + z.h - 6);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,209,102,.75)";
      ctx.font = "800 15px 'Segoe UI', system-ui";
      ctx.textAlign = "center";
      ctx.fillText("▲ ВЫСОТА", z.x + z.w / 2, z.y - 8);
    }
    ctx.restore();
  }

  private drawPoints(ctx: CanvasRenderingContext2D) {
    for (const p of this.points) {
      const col = p.owner === -1 ? "#cfd8e3" : TEAM_COLORS[p.owner];
      const r = 115;
      ctx.save();
      ctx.globalAlpha = p.contested ? 0.2 + Math.sin(this.matchT * 8) * 0.08 : 0.14;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // capture progress arc
      if (p.capTeam !== -1 && p.progress > 0 && p.owner !== p.capTeam) {
        ctx.strokeStyle = TEAM_COLORS[p.capTeam];
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.progress);
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.font = "900 44px 'Segoe UI', system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.9;
      ctx.fillText(p.id, p.x, p.y);
      ctx.restore();
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D) {
    for (const p of this.pickups) {
      if (!p.alive) continue;
      const bob = Math.sin(p.bobT * 4) * 4;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      // glow
      ctx.globalAlpha = 0.3 + Math.sin(p.bobT * 5) * 0.1;
      ctx.fillStyle = p.kind === "medkit" ? "#7dff9b" : "#9bd7ff";
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#141821";
      ctx.strokeStyle = p.kind === "medkit" ? "#7dff9b" : "#9bd7ff";
      ctx.lineWidth = 2;
      const s = 11;
      ctx.beginPath();
      ctx.roundRect(-s, -s, s * 2, s * 2, 4);
      ctx.fill(); ctx.stroke();
      if (p.kind === "medkit") {
        ctx.fillStyle = "#7dff9b";
        ctx.fillRect(-2.5, -7, 5, 14);
        ctx.fillRect(-7, -2.5, 14, 5);
      } else {
        ctx.fillStyle = "#9bd7ff";
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(6, -4); ctx.lineTo(6, 2); ctx.lineTo(0, 8); ctx.lineTo(-6, 2); ctx.lineTo(-6, -4);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawObstaclesShadows(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(0,0,0,.3)";
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      if (o.kind === "tree" || o.kind === "barrel") {
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2 + 5, o.y + o.h - 2, o.w / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.roundRect(o.x + 6, o.y + 8, o.w, o.h, 8);
        ctx.fill();
      }
    }
  }

  private drawObstacles(ctx: CanvasRenderingContext2D) {
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      o.flash = Math.max(0, o.flash - 1 / 60);
      const hurtFrac = o.maxHp > 0 ? o.hp / o.maxHp : 1;
      ctx.save();
      switch (o.kind) {
        case "wall": {
          ctx.fillStyle = "#14171f";
          ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.fillStyle = "#232834";
          ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
          ctx.strokeStyle = "rgba(255,255,255,.07)";
          ctx.lineWidth = 2;
          ctx.strokeRect(o.x + 5, o.y + 5, o.w - 10, o.h - 10);
          break;
        }
        case "crate": {
          ctx.fillStyle = hurtFrac < 0.5 ? "#6d4c2a" : "#8a6236";
          ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.strokeStyle = "#553a1e";
          ctx.lineWidth = 3;
          ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
          ctx.beginPath();
          ctx.moveTo(o.x + 3, o.y + 3); ctx.lineTo(o.x + o.w - 3, o.y + o.h - 3);
          ctx.moveTo(o.x + o.w - 3, o.y + 3); ctx.lineTo(o.x + 3, o.y + o.h - 3);
          ctx.stroke();
          if (hurtFrac < 0.5) {
            ctx.strokeStyle = "rgba(0,0,0,.5)";
            ctx.beginPath();
            ctx.moveTo(o.x + o.w * 0.3, o.y + 4); ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.6);
            ctx.stroke();
          }
          break;
        }
        case "barrel": {
          const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
          const danger = hurtFrac < 0.6;
          const g = ctx.createRadialGradient(cx - 5, cy - 6, 3, cx, cy, 20);
          g.addColorStop(0, danger ? "#ff8d5d" : "#e06448");
          g.addColorStop(1, "#8c2f1d");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#5c1f12";
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = "rgba(255,220,120,.85)";
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "half": {
          ctx.fillStyle = "#6e6a50";
          ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 9); ctx.fill();
          ctx.strokeStyle = "#4d4a38";
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4, 7); ctx.stroke();
          break;
        }
        case "car": {
          const hash = ((o.x * 7 + o.y * 13) | 0) % 3;
          const cols = ["#704b8f", "#3f6ea5", "#a5533f"];
          ctx.fillStyle = cols[Math.abs(hash)];
          ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 14); ctx.fill();
          ctx.fillStyle = "rgba(20,26,38,.85)";
          const horiz = o.w > o.h;
          if (horiz) {
            ctx.beginPath(); ctx.roundRect(o.x + o.w * 0.22, o.y + 6, o.w * 0.3, o.h - 12, 6); ctx.fill();
          } else {
            ctx.beginPath(); ctx.roundRect(o.x + 6, o.y + o.h * 0.22, o.w - 12, o.h * 0.3, 6); ctx.fill();
          }
          if (hurtFrac < 0.5) {
            ctx.strokeStyle = "rgba(0,0,0,.55)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(o.x + 8, o.y + 8); ctx.lineTo(o.x + o.w - 10, o.y + o.h - 10);
            ctx.stroke();
          }
          break;
        }
        case "container": {
          const hash = ((o.x * 3 + o.y * 11) | 0) % 2;
          ctx.fillStyle = hash ? "#a35d2c" : "#2e6f6a";
          ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.strokeStyle = "rgba(0,0,0,.4)";
          ctx.lineWidth = 2;
          ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
          ctx.strokeStyle = "rgba(0,0,0,.25)";
          const step = 16;
          if (o.w >= o.h) {
            for (let x = o.x + 8; x < o.x + o.w - 4; x += step) {
              ctx.beginPath(); ctx.moveTo(x, o.y + 3); ctx.lineTo(x, o.y + o.h - 3); ctx.stroke();
            }
          } else {
            for (let y = o.y + 8; y < o.y + o.h - 4; y += step) {
              ctx.beginPath(); ctx.moveTo(o.x + 3, y); ctx.lineTo(o.x + o.w - 3, y); ctx.stroke();
            }
          }
          break;
        }
        case "tree": {
          const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
          ctx.fillStyle = "#43301f";
          ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#5a4128";
          ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 6, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
      if (o.flash > 0) {
        ctx.globalAlpha = o.flash * 6;
        ctx.fillStyle = "#fff";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  private drawFighters(ctx: CanvasRenderingContext2D) {
    const playerTeam = 0;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      // hidden enemies under canopy: invisible to player
      if (f.hidden && f.team !== playerTeam && !this.attract) continue;

      const zOff = f.z * 0.9 + (f.elevated ? 14 : 0);
      const col = TEAM_COLORS[f.team];
      const drawX = f.x, drawY = f.y - zOff;

      // shadow
      ctx.save();
      ctx.globalAlpha = clamp(0.34 - f.z * 0.004, 0.08, 0.4);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(f.x + 4, f.y + 7, 15 - f.z * 0.02, 9 - f.z * 0.012, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // elevated golden ring
      if (f.elevated) {
        ctx.save();
        ctx.strokeStyle = "#ffd166";
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(drawX, drawY, 25, this.matchT * 1.5, this.matchT * 1.5 + Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // spawn protection
      if (f.protectT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(this.matchT * 10) * 0.2;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(drawX, drawY, 26, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // gun barrel
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(f.angle);
      ctx.fillStyle = "#10131a";
      ctx.fillRect(8, -3.2, 24, 6.4);
      ctx.fillStyle = col;
      ctx.fillRect(26, -1.6, 6, 3.2);
      ctx.restore();

      // body
      const suitA = f.team === 0 ? "#20313d" : "#3d2323";
      const g = this.ctx.createRadialGradient(drawX - 5, drawY - 6, 2, drawX, drawY, 19);
      g.addColorStop(0, f.isPlayer ? "#3a4c5c" : suitA);
      g.addColorStop(1, "#11151c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(drawX, drawY, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = f.isPlayer ? 3.4 : 2.6;
      ctx.strokeStyle = col;
      ctx.stroke();

      // visor
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(f.angle);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(2, -6, 12, 12, 4);
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.restore();

      // hurt flash
      if (f.hitFlashT > 0) {
        ctx.globalAlpha = f.hitFlashT * 5;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(drawX, drawY, 17, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // hp + name
      ctx.save();
      ctx.translate(drawX, drawY - 34);
      ctx.fillStyle = "rgba(8,10,14,.72)";
      ctx.beginPath(); ctx.roundRect(-20, -4, 40, 6, 3); ctx.fill();
      const frac = clamp(f.hp / f.maxHp, 0, 1);
      ctx.fillStyle = frac > 0.55 ? "#7dff9b" : frac > 0.28 ? "#ffd166" : "#ff5d5d";
      ctx.beginPath(); ctx.roundRect(-19, -3, 38 * frac, 4, 2); ctx.fill();
      if (f.shield > 0) {
        ctx.fillStyle = "rgba(155,215,255,.9)";
        ctx.beginPath(); ctx.roundRect(-19, -8, 38 * clamp(f.shield / 70, 0, 1), 2.6, 1.3); ctx.fill();
      }
      ctx.font = "700 11px 'Segoe UI', system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = f.isPlayer ? "#ffffff" : col;
      ctx.globalAlpha = 0.9;
      ctx.fillText(f.name, 0, -12);
      ctx.restore();
    }
  }

  private drawCanopies(ctx: CanvasRenderingContext2D) {
    if (this.map.canopies.length === 0) return;
    for (const c of this.map.canopies) {
      ctx.save();
      const g = ctx.createRadialGradient(c.x - c.r * 0.25, c.y - c.r * 0.3, c.r * 0.1, c.x, c.y, c.r);
      g.addColorStop(0, "rgba(46,74,34,.94)");
      g.addColorStop(0.75, "rgba(30,52,24,.92)");
      g.addColorStop(1, "rgba(22,38,18,.72)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      // leaf blobs
      ctx.fillStyle = "rgba(58,92,42,.5)";
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + c.x * 0.01;
        ctx.beginPath();
        ctx.arc(c.x + Math.cos(a) * c.r * 0.5, c.y + Math.sin(a) * c.r * 0.5, c.r * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, vw: number, _vh: number, _dpr: number) {
    if (this.state === "idle") return;
    const MW = 176, MH = 118;
    const mx = vw - MW - 14, my = 14;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "rgba(8,10,15,.82)";
    ctx.beginPath(); ctx.roundRect(mx - 4, my - 4, MW + 8, MH + 8, 10); ctx.fill();
    ctx.globalAlpha = 1;
    const sx = MW / this.map.w, sy = MH / this.map.h;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(mx, my, MW, MH, 7); ctx.clip();
    ctx.fillStyle = this.map.palette.base;
    ctx.fillRect(mx, my, MW, MH);
    // obstacles
    ctx.fillStyle = "rgba(0,0,0,.5)";
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      ctx.fillRect(mx + o.x * sx, my + o.y * sy, Math.max(1.5, o.w * sx), Math.max(1.5, o.h * sy));
    }
    ctx.fillStyle = "rgba(255,209,102,.5)";
    for (const z of this.map.highgrounds) ctx.fillRect(mx + z.x * sx, my + z.y * sy, z.w * sx, z.h * sy);
    // points
    if (this.mode.id === "dom" || this.mode.id === "koth") {
      for (const p of this.points) {
        ctx.fillStyle = p.owner === -1 ? "#cfd8e3" : TEAM_COLORS[p.owner];
        ctx.font = "800 12px system-ui";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(p.id, mx + p.x * sx, my + p.y * sy);
      }
    }
    // fighters
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (f.hidden && !f.isPlayer && f.team !== 0 && !this.attract) continue;
      ctx.fillStyle = TEAM_COLORS[f.team];
      ctx.beginPath();
      ctx.arc(mx + f.x * sx, my + f.y * sy, f.isPlayer ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (f.isPlayer) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(mx, my, MW, MH, 7); ctx.stroke();
    ctx.restore();
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D, vw: number, vh: number) {
    const p = this.player();
    if (!p || !p.alive) return;
    let sx: number, sy: number;
    if (touchInput.active) {
      const rect = { width: vw, height: vh };
      sx = rect.width / 2 + Math.cos(p.angle) * 120 * this.cam.zoom;
      sy = rect.height / 2 + Math.sin(p.angle) * 120 * this.cam.zoom;
    } else {
      const rect = this.canvas.getBoundingClientRect();
      sx = this.mouse.sx - rect.left;
      sy = this.mouse.sy - rect.top;
    }
    const spreadPx = (p.weapon.spread + p.spreadHeat * p.weapon.spread * 1.6) * 900 + 10;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0,0,0,.8)";
    ctx.shadowBlur = 3;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      ctx.beginPath();
      ctx.moveTo(sx + dx * spreadPx, sy + dy * spreadPx);
      ctx.lineTo(sx + dx * (spreadPx + 9), sy + dy * (spreadPx + 9));
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
