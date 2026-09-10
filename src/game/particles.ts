// Pooled particle system — zero per-frame allocations, capped counts, 60fps friendly.

export type PKind =
  | "spark" | "smoke" | "fire" | "chip" | "dust"
  | "ring" | "muzzle" | "casing" | "text";

interface P {
  alive: boolean;
  kind: PKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number; size2: number;
  color: string;
  grav: number; drag: number;
  rot: number; vr: number;
  text: string;
  additive: boolean;
}

const MAX = 900;

export class Particles {
  private pool: P[] = [];
  private cursor = 0;
  spawnScale = 1; // quality scaler

  private obtain(): P {
    // round-robin steal
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[(this.cursor + i) % this.pool.length];
      if (!p.alive) { this.cursor = (this.cursor + i + 1) % this.pool.length; return p; }
    }
    if (this.pool.length < MAX) {
      const p: P = {
        alive: false, kind: "spark", x: 0, y: 0, vx: 0, vy: 0,
        life: 0, max: 1, size: 3, size2: 0, color: "#fff",
        grav: 0, drag: 0, rot: 0, vr: 0, text: "", additive: true,
      };
      this.pool.push(p);
      return p;
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return p;
  }

  spawn(kind: PKind, x: number, y: number, o: Partial<P> = {}) {
    const p = this.obtain();
    p.alive = true; p.kind = kind;
    p.x = x; p.y = y;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0;
    p.max = o.max ?? 0.5; p.life = p.max;
    p.size = o.size ?? 3; p.size2 = o.size2 ?? 0;
    p.color = o.color ?? "#ffd28a";
    p.grav = o.grav ?? 0; p.drag = o.drag ?? 0;
    p.rot = o.rot ?? Math.random() * Math.PI * 2;
    p.vr = o.vr ?? 0;
    p.text = o.text ?? "";
    p.additive = o.additive ?? (kind === "spark" || kind === "fire" || kind === "muzzle" || kind === "ring");
  }

  burst(x: number, y: number, color: string, count: number, speed: number, life = 0.5, size = 3, kind: PKind = "spark") {
    const n = Math.max(1, Math.round(count * this.spawnScale));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.spawn(kind, x, y, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        max: life * (0.6 + Math.random() * 0.7),
        size: size * (0.6 + Math.random() * 0.8),
        color, drag: 3 + Math.random() * 3,
      });
    }
  }

  muzzle(x: number, y: number, angle: number, color: string) {
    this.spawn("muzzle", x, y, { rot: angle, max: 0.06, size: 16 + Math.random() * 8, color });
    for (let i = 0; i < 2 * this.spawnScale; i++) {
      const a = angle + (Math.random() - 0.5) * 0.5;
      const s = 300 + Math.random() * 260;
      this.spawn("spark", x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: 0.14, size: 2.4, color, drag: 6 });
    }
  }

  casing(x: number, y: number, angle: number) {
    if (Math.random() > 0.6 * this.spawnScale) return;
    const a = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    this.spawn("casing", x, y, {
      vx: Math.cos(a) * 140, vy: Math.sin(a) * 140 - 60,
      max: 0.7, size: 3, color: "#e8c26a", grav: 700, drag: 1, vr: 12,
      additive: false,
    });
  }

  hitSpark(x: number, y: number, color = "#ffb454") {
    this.burst(x, y, color, 7, 240, 0.35, 2.6);
    this.spawn("muzzle", x, y, { max: 0.09, size: 12, color });
  }

  fleshHit(x: number, y: number) {
    this.burst(x, y, "#ff5d5d", 6, 200, 0.4, 3);
    this.burst(x, y, "#c5322e", 4, 120, 0.5, 3.4);
  }

  explosion(x: number, y: number, scale = 1) {
    this.spawn("ring", x, y, { max: 0.4, size: 12, size2: 150 * scale, color: "#ffd28a" });
    this.spawn("ring", x, y, { max: 0.55, size: 8, size2: 220 * scale, color: "#ff8a4a" });
    this.burst(x, y, "#ffcf7a", 18, 420 * scale, 0.5, 5, "fire");
    this.burst(x, y, "#ff7a3c", 14, 320 * scale, 0.6, 6, "fire");
    this.burst(x, y, "#8a8f98", 12, 200 * scale, 1.1, 8, "smoke");
    this.burst(x, y, "#ffd28a", 16, 520 * scale, 0.35, 2.6, "spark");
    this.burst(x, y, "#3c3f47", 10, 300 * scale, 0.8, 4, "chip");
  }

  woodBurst(x: number, y: number) {
    this.burst(x, y, "#a97b43", 10, 260, 0.55, 4, "chip");
    this.burst(x, y, "#d8b077", 8, 180, 0.4, 3, "spark");
    this.burst(x, y, "#6b5936", 5, 90, 0.8, 6, "dust");
  }

  metalBurst(x: number, y: number) {
    this.burst(x, y, "#c9d2dd", 10, 300, 0.4, 3, "spark");
    this.burst(x, y, "#5b6470", 6, 160, 0.7, 5, "chip");
  }

  dust(x: number, y: number, n = 4) {
    this.burst(x, y, "#9a917e", n, 90, 0.6, 6, "dust");
  }

  jumpRing(x: number, y: number, color = "#cfe6ff") {
    this.spawn("ring", x, y, { max: 0.3, size: 4, size2: 52, color });
  }

  floatText(x: number, y: number, text: string, color: string, big = false) {
    this.spawn("text", x, y, {
      vy: -70, max: 0.85, size: big ? 30 : 19, color, text,
      additive: false, drag: 2,
    });
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      const d = 1 - Math.min(1, p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, additive: boolean) {
    for (const p of this.pool) {
      if (!p.alive || p.additive !== additive) continue;
      const t = p.life / p.max;
      const size = p.size + (p.size2 - p.size) * (1 - t);
      ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.4));
      switch (p.kind) {
        case "ring": {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, 5 * t);
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "muzzle": {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "casing": {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-size, -size * 0.4, size * 2, size * 0.8);
          ctx.restore();
          break;
        }
        case "text": {
          ctx.font = `800 ${Math.round(size)}px 'Segoe UI', system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(0,0,0,.55)";
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
          break;
        }
        case "smoke":
        case "dust": {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * (1.4 - t * 0.4), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default: {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillStyle = p.color;
          ctx.fillRect(-size, -size * 0.35, size * 2.2, size * 0.7);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this.pool) p.alive = false;
  }
}
