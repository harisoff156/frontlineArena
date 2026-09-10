// Bot AI: perception, target selection, strafing combat, objective play.
// Structural typing only — the engine's Fighter satisfies BotFighter.

import type { ModeId } from "./types";

export interface BotFighter {
  id: number;
  team: 0 | 1;
  x: number; y: number;
  hp: number; maxHp: number;
  alive: boolean;
  elevated: boolean;
  hidden: boolean;
  weaponRange: number;
  weaponCls: string;
  ammoInMag: number;
  reloading: number;
  isPlayer: boolean;
  // outputs (engine reads)
  mvx: number; mvy: number;
  aimAngle: number;
  wantFire: boolean;
  wantReload: boolean;
  wantJump: boolean;
  wantNade: boolean;
}

export interface BotPoint {
  x: number; y: number; owner: number; progress: number; capTeam: number;
}

export interface BotPickup {
  x: number; y: number; kind: "medkit" | "armor"; alive: boolean;
}

export interface BotWorld {
  time: number;
  mode: ModeId;
  fighters: BotFighter[];
  points: BotPoint[];
  pickups: BotPickup[];
  playerId: number;
  hasLOS(ax: number, ay: number, bx: number, by: number): boolean;
}

export const BOT_NAMES = [
  "ВОЛК", "СОКОЛ", "ТАЙФУН", "ГРОМ", "ПУМА", "ОРЁЛ", "БАРС", "ШТУРМ",
  "СЕВЕР", "ЯСТРЕБ", "ТУМАН", "КОБРА", "МОЛНИЯ", "ГРАД", "РЫСЬ", "ЗУБР",
];

type Role = "hunter" | "obj" | "buddy";

const PREF_RANGE: Record<string, number> = { sg: 230, smg: 340, ar: 460, sr: 680 };

export class BotBrain {
  role: Role;
  skill: number; // 0..1
  private decideT = 0;
  private strafeDir = Math.random() > 0.5 ? 1 : -1;
  private strafeT = 1 + Math.random();
  private burstT = 0;
  private burstOn = false;
  private aimErr = 0;
  private targetId = -1;
  private destX = 0; private destY = 0;
  private hasDest = false;
  private lastX = 0; private lastY = 0;
  private stuckT = 0;
  private retreatT = 0;
  private aimHoldT = 0;
  private hopT = Math.random() * 2;
  private reactT = 0;

  constructor(skill: number, role: Role, x: number, y: number) {
    this.skill = skill;
    this.role = role;
    this.destX = x; this.destY = y;
    this.lastX = x; this.lastY = y;
    this.aimErr = 0.14 - skill * 0.1;
  }

  reset(x: number, y: number) {
    this.targetId = -1;
    this.hasDest = false;
    this.destX = x; this.destY = y;
    this.lastX = x; this.lastY = y;
    this.stuckT = 0;
    this.retreatT = 0;
    this.wantResetOutputs();
  }

  private wantResetOutputs() { /* placeholder for symmetry */ }

  private nadeCdT = 3 + Math.random() * 5;

  think(f: BotFighter, w: BotWorld, dt: number) {
    // defaults
    f.wantFire = false;
    f.wantReload = false;
    f.wantJump = false;
    f.wantNade = false;

    this.decideT -= dt;
    this.reactT -= dt;
    this.hopT -= dt;
    this.nadeCdT -= dt;

    // ---- perception: pick target ----
    if (this.decideT <= 0) {
      this.decideT = 0.14 + (1 - this.skill) * 0.12;
      this.pickTarget(f, w);
      this.updateObjective(f, w);
    }

    const target = w.fighters.find((t) => t.id === this.targetId && t.alive);

    // ---- low hp: reload / retreat logic ----
    const hurt = f.hp < f.maxHp * 0.35;
    if (f.ammoInMag <= 0 && f.reloading <= 0) {
      f.wantReload = true;
      if (target) this.retreatT = 0.7;
    }
    if (hurt && target && this.retreatT <= 0 && Math.random() < 0.4 * dt * 10) {
      this.retreatT = 0.9;
      // seek medkit
      let best: BotPickup | null = null;
      let bd = 520;
      for (const p of w.pickups) {
        if (!p.alive || p.kind !== "medkit") continue;
        const d = Math.hypot(p.x - f.x, p.y - f.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { this.destX = best.x; this.destY = best.y; this.hasDest = true; }
    }

    let moveX = 0, moveY = 0;

    if (target) {
      const dx = target.x - f.x;
      const dy = target.y - f.y;
      const dist = Math.hypot(dx, dy) || 1;
      const baseAngle = Math.atan2(dy, dx);

      // reaction delay before shooting a newly seen target
      if (this.reactT <= -1.5) this.reactT = 0.1 + (1 - this.skill) * 0.35;

      // aim with error that tightens as reaction completes
      const errScale = this.reactT > 0 ? 2.2 : 1;
      const movingPenalty = (Math.abs(f.mvx) + Math.abs(f.mvy)) > 0.1 ? 1.35 : 1;
      const err = this.aimErr * errScale * movingPenalty * (target.elevated ? 1.35 : 1);
      this.aimHoldT += dt;
      const wander = Math.sin(w.time * 6.7 + f.id * 3.1) * err;
      f.aimAngle = baseAngle + wander + (Math.random() - 0.5) * err * 0.5;

      const pref = PREF_RANGE[f.weaponCls] ?? 400;
      const los = w.hasLOS(f.x, f.y, target.x, target.y);

      // flush out campers / elevated targets with a frag
      if (this.nadeCdT <= 0 && dist > 240 && dist < 700 && (!los || target.elevated) && Math.random() < 0.55) {
        f.wantNade = true;
        this.nadeCdT = 9 + Math.random() * 5;
      }

      // burst pattern
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstOn = !this.burstOn;
        this.burstT = this.burstOn
          ? (f.weaponCls === "sr" ? 0.12 : 0.3 + Math.random() * 0.45)
          : (f.weaponCls === "sr" ? 0.7 + (1 - this.skill) * 1.1 : 0.18 + Math.random() * 0.4);
      }

      const inRange = dist < f.weaponRange * 0.92;
      if (los && inRange && this.burstOn && this.reactT <= 0) {
        let angDiff = Math.abs(((f.aimAngle - baseAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        f.wantFire = angDiff < 0.45;
      }

      // positioning
      if (this.retreatT > 0) {
        this.retreatT -= dt;
        moveX = -dx / dist; moveY = -dy / dist;
      } else if (!los || dist > pref * 1.15) {
        moveX = dx / dist; moveY = dy / dist;
      } else if (dist < pref * 0.55 && !target.elevated) {
        moveX = -dx / dist; moveY = -dy / dist;
        if (f.weaponCls !== "sg" && f.weaponCls !== "smg") { moveX *= 0.7; moveY *= 0.7; }
      } else {
        // strafe orbit
        this.strafeT -= dt;
        if (this.strafeT <= 0) {
          this.strafeT = 0.7 + Math.random() * 1.1;
          this.strafeDir *= -1;
        }
        moveX = (-dy / dist) * this.strafeDir * 0.9 + (dx / dist) * 0.15;
        moveY = (dx / dist) * this.strafeDir * 0.9 + (dy / dist) * 0.15;
        if (this.hopT <= 0) {
          this.hopT = 1.6 + Math.random() * 3;
          if (Math.random() < 0.4) f.wantJump = true;
        }
      }
      // objective bias while fighting in domination / koth
      if ((w.mode === "dom" || w.mode === "koth") && this.role !== "hunter" && this.hasDest) {
        moveX += (this.destX - f.x) / 900;
        moveY += (this.destY - f.y) / 900;
      }
    } else {
      // no target: move to destination
      this.reactT = 0;
      if (!this.hasDest) this.updateObjective(f, w);
      const dx = this.destX - f.x;
      const dy = this.destY - f.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 36) {
        moveX = dx / dist; moveY = dy / dist;
      } else {
        // idle scan
        f.aimAngle += Math.sin(w.time * 0.9 + f.id) * dt * 0.8;
        if (dist < 20 && Math.random() < dt * 0.4) this.hasDest = false;
      }
      // slow aim sweep in movement direction
      if (moveX !== 0 || moveY !== 0) {
        const ma = Math.atan2(moveY, moveX);
        let d = ((ma - f.aimAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        f.aimAngle += d * Math.min(1, dt * 4);
      }
      // objective capture wander inside point
      if ((w.mode === "dom" || w.mode === "koth") && dist < 60) {
        moveX += Math.sin(w.time * 1.7 + f.id * 2) * 0.4;
        moveY += Math.cos(w.time * 1.3 + f.id * 1.7) * 0.4;
      }
    }

    // stuck detection → unstick sideways
    const moved = Math.hypot(f.x - this.lastX, f.y - this.lastY);
    const wantsMove = Math.abs(moveX) + Math.abs(moveY) > 0.15;
    if (wantsMove && moved < 4 * dt * 60 * 0.016) {
      this.stuckT += dt;
      if (this.stuckT > 0.45) {
        this.stuckT = 0;
        this.strafeDir *= -1;
        if (Math.random() < 0.5) f.wantJump = true;
        const px = -moveY, py = moveX;
        moveX = px * this.strafeDir + moveX * 0.3;
        moveY = py * this.strafeDir + moveY * 0.3;
        this.hasDest = this.hasDest && Math.random() > 0.3;
      }
    } else {
      this.stuckT = Math.max(0, this.stuckT - dt);
    }
    this.lastX = f.x; this.lastY = f.y;

    const len = Math.hypot(moveX, moveY);
    if (len > 1) { moveX /= len; moveY /= len; }
    f.mvx = moveX; f.mvy = moveY;
  }

  private pickTarget(f: BotFighter, w: BotWorld) {
    let bestId = -1;
    let bestScore = Infinity;
    for (const e of w.fighters) {
      if (!e.alive || e.team === f.team || e.id === f.id) continue;
      const d = Math.hypot(e.x - f.x, e.y - f.y);
      if (d > 1250) continue;
      if (e.hidden && d > 300) continue;
      if (!w.hasLOS(f.x, f.y, e.x, e.y)) continue;
      let score = d;
      if (e.isPlayer) score *= 0.85;
      if (e.hp < 40) score *= 0.7;
      if (score < bestScore) { bestScore = score; bestId = e.id; }
    }
    if (bestId !== this.targetId) {
      this.targetId = bestId;
      if (bestId >= 0) this.reactT = Math.max(this.reactT, 0.12 + (1 - this.skill) * 0.4);
    }
  }

  private updateObjective(f: BotFighter, w: BotWorld) {
    if (this.role === "buddy") {
      const pl = w.fighters.find((p) => p.id === w.playerId);
      if (pl && pl.alive) {
        const a = (f.id * 2.4) % (Math.PI * 2);
        this.destX = pl.x + Math.cos(a) * 110;
        this.destY = pl.y + Math.sin(a) * 110;
        this.hasDest = true;
        return;
      }
    }
    if ((w.mode === "dom" || w.mode === "koth") && w.points.length > 0) {
      let best: BotPoint | null = null;
      let bd = Infinity;
      for (const p of w.points) {
        if (p.owner === f.team && p.progress >= 1) continue;
        const d = Math.hypot(p.x - f.x, p.y - f.y) + (p.owner === -1 ? -220 : 0);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        this.destX = best.x + (Math.random() - 0.5) * 80;
        this.destY = best.y + (Math.random() - 0.5) * 80;
        this.hasDest = true;
        return;
      }
    }
    // roam toward map center-ish with jitter
    if (!this.hasDest || Math.random() < 0.25) {
      this.destX = f.x + (Math.random() - 0.5) * 900;
      this.destY = f.y + (Math.random() - 0.5) * 900;
      this.hasDest = true;
    }
  }
}
