"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Play, Trophy, Settings as SettingsIcon, CircleHelp, Swords, Flag, Skull,
  ChevronLeft, Medal, RefreshCw, Home, Crosshair, Shield, UsersRound,
  Bomb, TreePine, Sparkles, Crown, X,
} from "lucide-react";
import type { MapId, MatchResult, ModeId, WeaponClass } from "@/game/types";
import { MODES } from "@/game/types";
import { MAPS, getMap, paintGround } from "@/game/maps";
import { CLASS_INFO, weaponsByClass, type WeaponDef } from "@/game/weapons";
import type { Profile, Settings } from "@/game/profile";
import { rankOf, nextRank } from "@/game/profile";

// ---------- shared bits ----------

export function RankBadge({ rating, big = false }: { rating: number; big?: boolean }) {
  const rank = rankOf(rating);
  return (
    <span
      className={`rank-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-black uppercase tracking-[0.14em] ${big ? "text-sm" : "text-[11px]"}`}
      style={{ color: rank.color, boxShadow: `0 0 24px ${rank.glow} inset` }}
    >
      <Crown size={big ? 15 : 12} />
      {rank.name} · {rating}
    </span>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</span>
      <div className="statbar flex-1"><div style={{ width: `${Math.max(6, v)}%` }} /></div>
    </div>
  );
}

const thumbCache = new Map<string, string>();
export function MapThumb({ mapId, className }: { mapId: MapId; className?: string }) {
  const [src, setSrc] = useState<string | undefined>(thumbCache.get(mapId));
  useEffect(() => {
    const cached = thumbCache.get(mapId);
    if (cached) { setSrc(cached); return; }
    let dead = false;
    const t = setTimeout(() => {
      try {
        const map = getMap(mapId);
        const off = document.createElement("canvas");
        paintGround(map, off);
        const c = document.createElement("canvas");
        c.width = 360; c.height = 216;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(off, 0, 0, c.width, c.height);
        const sx = c.width / map.w, sy = c.height / map.h;
        for (const o of map.obstacles) {
          ctx.fillStyle =
            o.kind === "wall" ? "rgba(8,10,16,.9)" :
            o.kind === "barrel" ? "#e06448" :
            o.kind === "car" ? "#7a5aa0" :
            "rgba(0,0,0,.5)";
          ctx.fillRect(o.x * sx, o.y * sy, Math.max(2, o.w * sx), Math.max(2, o.h * sy));
        }
        ctx.fillStyle = "rgba(255,209,102,.75)";
        for (const z of map.highgrounds) ctx.fillRect(z.x * sx, z.y * sy, z.w * sx, z.h * sy);
        ctx.font = "800 13px system-ui";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,.85)";
        for (const p of map.points) ctx.fillText(p.id, p.x * sx, p.y * sy);
        const sheen = ctx.createLinearGradient(0, 0, c.width, c.height);
        sheen.addColorStop(0, "rgba(255,255,255,.08)");
        sheen.addColorStop(0.4, "rgba(255,255,255,0)");
        ctx.fillStyle = sheen;
        ctx.fillRect(0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.82);
        thumbCache.set(mapId, url);
        if (!dead) setSrc(url);
      } catch { /* noop */ }
    }, 30);
    return () => { dead = true; clearTimeout(t); };
  }, [mapId]);
  if (!src) return <div className={className} style={{ background: "#141821" }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} className={className} alt="" draggable={false} />;
}

function ScreenShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-black/55 via-black/40 to-black/70 p-4 slim-scroll">
      <div className={`fade-up my-auto w-full ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</div>
    </div>
  );
}

function ScreenTitle({ kicker, title, onBack }: { kicker: string; title: string; onBack?: () => void }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-amber-400/80">{kicker}</div>
        <h2 className="text-4xl font-black uppercase tracking-wide text-white">{title}</h2>
      </div>
      {onBack && (
        <button onClick={onBack} className="btn btn-ghost mb-1 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs">
          <ChevronLeft size={15} /> Назад
        </button>
      )}
    </div>
  );
}

// ---------- MENU ----------

export function MenuScreen({
  profile, onPlay, onLeaderboard, onSettings, onHelp,
}: {
  profile: Profile;
  onPlay: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onHelp: () => void;
}) {
  const rank = rankOf(profile.rating);
  const next = nextRank(profile.rating);
  const prog = next ? (profile.rating - rank.min) / (next.min - rank.min) : 1;
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-b from-black/45 via-transparent to-black/75">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 font-black text-black shadow-lg shadow-amber-500/30">FA</div>
          <div>
            <div className="text-sm font-black uppercase tracking-[0.28em] text-white">Frontline Arena</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">tactical browser ops</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSettings} className="btn btn-ghost glass rounded-xl p-2.5" aria-label="Настройки"><SettingsIcon size={17} /></button>
          <button onClick={onHelp} className="btn btn-ghost glass rounded-xl p-2.5" aria-label="Как играть"><CircleHelp size={17} /></button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="fade-up text-[12px] font-bold uppercase tracking-[0.5em] text-amber-400/90">Онлайн-баталии · 5 карт · 20 стволов</div>
        <h1 className="fade-up mt-3 text-7xl font-black uppercase leading-[0.92] tracking-tight md:text-8xl" style={{ animationDelay: ".06s" }}>
          <span className="block text-white" style={{ textShadow: "0 0 60px rgba(120,200,255,.25)" }}>Frontline</span>
          <span className="title-outline block">Arena</span>
        </h1>
        <p className="fade-up mt-4 max-w-md text-sm font-semibold leading-relaxed text-white/55" style={{ animationDelay: ".12s" }}>
          Отрядные перестрелки с напарниками-ботами. Подсаживайтесь на высоты, взрывайте бочки, забирайте точки — и поднимайте рейтинг.
        </p>
        <div className="fade-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: ".18s" }}>
          <button onClick={onPlay} className="btn btn-primary pulse-ring flex items-center gap-2.5 rounded-2xl px-10 py-4 text-lg">
            <Play size={22} fill="currentColor" /> В бой
          </button>
          <button onClick={onLeaderboard} className="btn btn-ghost glass flex items-center gap-2 rounded-2xl px-6 py-4 text-sm">
            <Trophy size={17} className="text-amber-300" /> Лидерборд
          </button>
        </div>
      </div>

      <div className="mx-auto mb-5 w-full max-w-6xl px-6">
        <div className="glass fade-up mx-auto flex max-w-2xl items-center gap-5 rounded-2xl px-5 py-3.5" style={{ animationDelay: ".24s" }}>
          <RankBadge rating={profile.rating} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-white/50">
              <span className="truncate">{profile.name}</span>
              <span>{next ? `до «${next.name}»: ${next.min - profile.rating} очков` : "Максимальный ранг"}</span>
            </div>
            <div className="statbar mt-1.5"><div style={{ width: `${Math.max(4, prog * 100)}%` }} /></div>
          </div>
          <div className="hidden shrink-0 items-center gap-4 text-center sm:flex">
            <div><div className="text-lg font-black leading-none text-white">{profile.wins}</div><div className="text-[9px] uppercase tracking-widest text-white/40">побед</div></div>
            <div><div className="text-lg font-black leading-none text-white">{profile.kills}</div><div className="text-[9px] uppercase tracking-widest text-white/40">фрагов</div></div>
            <div><div className="text-lg font-black leading-none text-amber-300">{profile.bestScore}</div><div className="text-[9px] uppercase tracking-widest text-white/40">рекорд</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- MODE SELECT ----------

const MODE_ICONS: Record<ModeId, React.ReactNode> = {
  tdm: <Swords size={26} />, dom: <Flag size={26} />, elim: <Skull size={26} />, koth: <Crown size={26} />, horde: <Shield size={26} />,
};

export function ModeSelect({ sel, onPick, onBack }: { sel: ModeId; onPick: (m: ModeId) => void; onBack: () => void }) {
  return (
    <ScreenShell>
      <ScreenTitle kicker="Шаг 1 из 3" title="Режим игры" onBack={onBack} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(MODES) as ModeId[]).map((id, i) => {
          const m = MODES[id];
          const active = sel === id;
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              className={`glass card-hover ${active ? "card-active" : ""} fade-up rounded-2xl border border-white/10 p-5 text-left`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className={`mb-3 inline-flex rounded-xl p-2.5 ${active ? "bg-amber-400/20 text-amber-300" : "bg-white/8 text-white/60"}`}>
                {MODE_ICONS[id]}
              </div>
              <div className="text-lg font-black uppercase tracking-wide text-white">{m.name}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">{m.short}</div>
              <p className="mt-2 text-[12.5px] font-medium leading-snug text-white/55">{m.desc}</p>
            </button>
          );
        })}
      </div>
    </ScreenShell>
  );
}

// ---------- MAP SELECT ----------

export function MapSelect({ sel, onPick, onBack, onNext }: { sel: MapId; onPick: (m: MapId) => void; onBack: () => void; onNext: () => void }) {
  return (
    <ScreenShell wide>
      <ScreenTitle kicker="Шаг 2 из 3" title="Выбор карты" onBack={onBack} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MAPS.map((m, i) => {
          const active = sel === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              onDoubleClick={onNext}
              className={`glass card-hover ${active ? "card-active" : ""} fade-up overflow-hidden rounded-2xl border border-white/10 text-left`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <MapThumb mapId={m.id} className="aspect-[5/3] w-full object-cover" />
              <div className="p-4">
                <div className="flex items-baseline justify-between">
                  <div className="text-base font-black uppercase tracking-wider text-white">{m.name}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">{m.tagline}</div>
                </div>
                <p className="mt-1 text-[12px] font-medium leading-snug text-white/50">{m.desc}</p>
              </div>
            </button>
          );
        })}
        <button
          onClick={() => onPick(MAPS[(Math.random() * MAPS.length) | 0].id)}
          className="glass card-hover fade-up flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-white/60"
          style={{ animationDelay: `${MAPS.length * 0.06}s` }}
        >
          <Sparkles size={26} className="text-amber-300" />
          <span className="text-sm font-black uppercase tracking-widest">Случайная карта</span>
          <span className="text-[11px] text-white/40">Пусть решает судьба</span>
        </button>
      </div>
      <div className="mt-5 flex justify-end">
        <button onClick={onNext} className="btn btn-primary rounded-xl px-8 py-3 text-sm">Далее — экипировка</button>
      </div>
    </ScreenShell>
  );
}

// ---------- LOADOUT ----------

const CLASSES: WeaponClass[] = ["ar", "sg", "smg", "sr"];

export function LoadoutSelect({
  cls, weaponId, onClass, onWeapon, onStart, onBack,
}: {
  cls: WeaponClass;
  weaponId: string;
  onClass: (c: WeaponClass) => void;
  onWeapon: (id: string) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const list = useMemo(() => weaponsByClass(cls), [cls]);
  return (
    <ScreenShell wide>
      <ScreenTitle kicker="Шаг 3 из 3" title="Экипировка" onBack={onBack} />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {CLASSES.map((c) => (
          <button
            key={c}
            onClick={() => onClass(c)}
            className={`btn rounded-xl border px-3 py-2.5 text-left ${cls === c ? "border-amber-400/70 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/5 text-white/60"}`}
          >
            <div className="text-sm font-black uppercase tracking-wider">{CLASS_INFO[c].name}</div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">{CLASS_INFO[c].role}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {list.map((w: WeaponDef, i) => {
          const active = weaponId === w.id;
          return (
            <button
              key={w.id}
              onClick={() => onWeapon(w.id)}
              className={`glass card-hover ${active ? "card-active" : ""} fade-up flex flex-col rounded-2xl border border-white/10 p-4 text-left`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-black uppercase tracking-wider text-white">{w.name}</span>
                <Crosshair size={14} className={active ? "text-amber-300" : "text-white/30"} />
              </div>
              <p className="mb-3 min-h-[34px] text-[11px] font-medium leading-snug text-white/45">{w.desc}</p>
              <div className="space-y-1.5">
                <Stat label="Урон" v={w.statBars.dmg} />
                <Stat label="Темп" v={w.statBars.rof} />
                <Stat label="Дальн." v={w.statBars.range} />
                <Stat label="Контроль" v={Math.max(0, w.statBars.ctrl)} />
              </div>
              <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                <span>Маг {w.mag}</span>
                <span>{w.auto ? "Авто" : "Одиноч."}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="hidden text-[11px] font-semibold tracking-wide text-white/35 md:block">
          Подсказка: винтовка снайпера + подсадка на высоту = контроль всей карты
        </div>
        <button onClick={onStart} className="btn btn-primary flex items-center gap-2 rounded-2xl px-10 py-4 text-base">
          <Play size={18} fill="currentColor" /> За деплоем!
        </button>
      </div>
    </ScreenShell>
  );
}

// ---------- PAUSE ----------

export function PauseOverlay({ onResume, onSettings, onQuit }: { onResume: () => void; onSettings: () => void; onQuit: () => void }) {
  return (
    <ScreenShell>
      <div className="glass mx-auto max-w-sm rounded-3xl p-7 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-amber-400/80">Тактическая пауза</div>
        <h2 className="mb-6 mt-1 text-4xl font-black uppercase text-white">Пауза</h2>
        <div className="flex flex-col gap-2.5">
          <button onClick={onResume} className="btn btn-primary rounded-xl px-6 py-3.5 text-sm">Продолжить</button>
          <button onClick={onSettings} className="btn btn-ghost rounded-xl px-6 py-3 text-sm">Настройки</button>
          <button onClick={onQuit} className="btn btn-ghost rounded-xl px-6 py-3 text-sm text-red-300/90">Покинуть бой</button>
        </div>
      </div>
    </ScreenShell>
  );
}

// ---------- GAME OVER ----------

export interface BoardRow { name: string; kills: number; deaths: number; score: number; isPlayer: boolean }
export interface Board { a: BoardRow[]; b: BoardRow[] }

function useCountUp(target: number, dur = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

export function GameOverScreen({
  result, delta, newBest, board, profile, onRematch, onMenu,
}: {
  result: MatchResult;
  delta: number;
  newBest: boolean;
  board: Board;
  profile: Profile;
  onRematch: () => void;
  onMenu: () => void;
}) {
  const score = useCountUp(result.score);
  const kd = result.deaths > 0 ? (result.kills / result.deaths).toFixed(2) : result.kills.toFixed(2);
  const map = getMap(result.mapId);
  const mode = MODES[result.modeId];
  const mvp = [...board.a, ...board.b].sort((x, y) => y.kills - x.kills || y.score - x.score)[0];
  const dur = `${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, "0")}`;
  return (
    <ScreenShell>
      <div className="glass relative mx-auto max-w-2xl overflow-hidden rounded-3xl p-7 text-center">
        <div className="scanline pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/6 to-transparent" />
        <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/45">
          {mode.name} · {map.name} · {result.scoreA} : {result.scoreB} · {dur}
        </div>
        {mvp && (
          <div className="mx-auto mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white/70">
            <Medal size={12} className="text-amber-300" /> MVP боя — {mvp.name} · {mvp.kills} фрагов
          </div>
        )}
        <h2
          className={`mt-1 text-6xl font-black uppercase tracking-wide ${result.draw ? "text-white" : result.win ? "text-amber-300" : "text-red-400"}`}
          style={{ textShadow: result.win ? "0 0 50px rgba(255,180,60,.5)" : "none" }}
        >
          {result.draw ? "Ничья" : result.win ? "Победа" : "Поражение"}
        </h2>
        {newBest && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-200">
            <Sparkles size={13} /> Новый личный рекорд!
          </div>
        )}

        <div className="mt-6 grid grid-cols-4 gap-2.5">
          {[
            { l: "Очки", v: score, accent: true },
            { l: "Фраги", v: result.kills },
            { l: "Смерти", v: result.deaths },
            { l: "K/D", v: kd },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-white/8 bg-black/30 px-2 py-3">
              <div className={`text-2xl font-black tabular-nums ${s.accent ? "text-amber-300" : "text-white"}`}>{s.v}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <RankBadge rating={profile.rating} big />
          <span className={`text-xl font-black tabular-nums ${delta > 0 ? "text-emerald-300" : delta < 0 ? "text-red-400" : "text-white/60"}`}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-widest text-white/40">
          Серия: {result.bestStreak} · Всего побед: {profile.wins} · Кооп: отряд ИИ
        </div>

        {/* scoreboard */}
        <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
          {([["АЛЬФА", board.a, "#35d0ff"], ["БРАВО", board.b, "#ff5d5d"]] as const).map(([name, rows, col]) => (
            <div key={name} className="rounded-xl border border-white/8 bg-black/30 p-3">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.24em]" style={{ color: col }}>{name}</div>
              {rows.map((r, i) => (
                <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1 text-[12.5px] font-semibold ${r.isPlayer ? "bg-white/10 text-white" : "text-white/65"}`}>
                  <span className="flex items-center gap-1.5 truncate">
                    {i === 0 && <Medal size={12} className="shrink-0 text-amber-300" />}
                    {r.name}
                  </span>
                  <span className="tabular-nums text-white/80">{r.kills}<span className="text-white/35"> / {r.deaths}</span></span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button onClick={onRematch} className="btn btn-primary flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm">
            <RefreshCw size={16} /> Реванш
          </button>
          <button onClick={onMenu} className="btn btn-ghost flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm">
            <Home size={16} /> В меню
          </button>
        </div>
      </div>
    </ScreenShell>
  );
}

// ---------- LEADERBOARD ----------

interface LbRow { id: number; name: string; mode: string; map: string; kills: number; score: number; rating: number; createdAt: string }

export function LeaderboardModal({
  local, onClose,
}: {
  local: { name: string; score: number; kills: number; mode: string; map: string; date: number }[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"global" | "local">("global");
  const [rows, setRows] = useState<LbRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "err">("loading");

  useEffect(() => {
    if (tab !== "global") return;
    setStatus("loading");
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d: { ok: boolean; rows: LbRow[] }) => {
        setRows(d.rows ?? []);
        setStatus((d.rows ?? []).length ? "ok" : "empty");
      })
      .catch(() => setStatus("err"));
  }, [tab]);

  return (
    <ScreenShell>
      <div className="glass mx-auto max-w-xl rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-black uppercase text-white"><Trophy size={22} className="text-amber-300" /> Лидерборд</h2>
          <button onClick={onClose} className="btn btn-ghost rounded-lg p-2" aria-label="Закрыть"><X size={16} /></button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {([["global", "Мировой"], ["local", "Локальный"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-widest ${tab === t ? "border-amber-400/70 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/5 text-white/50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="slim-scroll max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
          {tab === "global" ? (
            status === "loading" ? <div className="py-10 text-center text-sm font-bold uppercase tracking-widest text-white/35">Загрузка…</div> :
            status === "empty" || status === "err" ? (
              <div className="py-10 text-center text-sm font-bold uppercase tracking-widest text-white/35">
                {status === "err" ? "Сервер недоступен — сыграй офлайн" : "Пока пусто. Займи первое место!"}
              </div>
            ) : (
              rows.map((r, i) => <LbRowView key={r.id} i={i} name={r.name} score={r.score} kills={r.kills} mode={r.mode} map={r.map} />)
            )
          ) : local.length === 0 ? (
            <div className="py-10 text-center text-sm font-bold uppercase tracking-widest text-white/35">Сыграй матч — и появится запись</div>
          ) : (
            local.map((r, i) => <LbRowView key={i} i={i} name={r.name} score={r.score} kills={r.kills} mode={r.mode} map={r.map} />)
          )}
        </div>
      </div>
    </ScreenShell>
  );
}

function LbRowView({ i, name, score, kills, mode, map }: { i: number; name: string; score: number; kills: number; mode: string; map: string }) {
  const medal = i === 0 ? "text-amber-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-white/30";
  const mapName = (MAPS.find((m) => m.id === map)?.name ?? map).toUpperCase();
  const modeName = (MODES[mode as ModeId]?.short ?? mode).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/6 bg-black/30 px-3 py-2.5">
      <span className={`w-7 shrink-0 text-center text-lg font-black tabular-nums ${medal}`}>{i + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black text-white">{name}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{modeName} · {mapName} · {kills} фрагов</div>
      </div>
      <span className="text-xl font-black tabular-nums text-amber-300">{score}</span>
    </div>
  );
}

// ---------- SETTINGS ----------

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3">
      <span className="text-sm font-bold uppercase tracking-wider text-white/75">{label}</span>
      <span className={`relative h-6 w-11 rounded-full bg-white/12 transition ${on ? "toggle-on" : ""}`}>
        <span className="toggle-dot absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: on ? "translateX(20px)" : "translateX(0)" }} />
      </span>
    </button>
  );
}

export function SettingsModal({
  settings, name, onSettings, onName, onClose,
}: {
  settings: Settings;
  name: string;
  onSettings: (s: Settings) => void;
  onName: (n: string) => void;
  onClose: () => void;
}) {
  return (
    <ScreenShell>
      <div className="glass mx-auto max-w-md rounded-3xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black uppercase text-white">Настройки</h2>
          <button onClick={onClose} className="btn btn-ghost rounded-lg p-2" aria-label="Закрыть"><X size={16} /></button>
        </div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">Позывной</label>
        <input
          value={name}
          onChange={(e) => onName(e.target.value.slice(0, 16))}
          className="mb-4 w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-base font-bold text-white outline-none focus:border-amber-400/70"
          placeholder="Игрок-0000"
        />
        <div className="space-y-2.5">
          <Toggle label="Звук" on={settings.sound} onChange={(v) => onSettings({ ...settings, sound: v })} />
          <Toggle label="Тряска экрана" on={settings.shake} onChange={(v) => onSettings({ ...settings, shake: v })} />
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="mb-2 text-sm font-bold uppercase tracking-wider text-white/75">
              Сложность ботов <span className="text-white/35">(влияет на рейтинг)</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {([["easy", "Лёгкая"], ["normal", "Норма"], ["hard", "Ветеран"]] as const).map(([d, label]) => (
                <button
                  key={d}
                  onClick={() => onSettings({ ...settings, difficulty: d })}
                  className={`btn rounded-lg border px-2 py-1.5 text-[11px] font-black uppercase tracking-widest ${settings.difficulty === d ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-200" : "border-white/10 bg-white/5 text-white/50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="mb-2 text-sm font-bold uppercase tracking-wider text-white/75">Качество</div>
            <div className="grid grid-cols-3 gap-1.5">
              {([["auto", "Авто"], ["high", "Выс."], ["low", "Низк."]] as const).map(([q, label]) => (
                <button
                  key={q}
                  onClick={() => onSettings({ ...settings, quality: q })}
                  className={`btn rounded-lg border px-2 py-1.5 text-[11px] font-black uppercase tracking-widest ${settings.quality === q ? "border-amber-400/70 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/5 text-white/50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="btn btn-primary mt-5 w-full rounded-xl py-3 text-sm">Готово</button>
      </div>
    </ScreenShell>
  );
}

// ---------- HOW TO ----------

export function HowToModal({ onClose }: { onClose: () => void }) {
  const rows: [React.ReactNode, string, string][] = [
    [<Swords key="i" size={18} />, "WASD / левый стик", "Движение. Курсор / правый стик — прицел, ЛКМ — огонь."],
    [<RefreshCw key="i" size={18} />, "R — перезарядка", "Следи за магазином. Пустой щелчок = смерть в замесе."],
    [<ChevronUpIcon key="i" />, "ПРОБЕЛ — прыжок", "Перепрыгивай мешки, ящики и бочки. На лету ты — трудная мишень."],
    [<UsersRound key="i" size={18} />, "E — подсадка", "Встань рядом с напарником у жёлтой площадки «ВЫСОТА» — он подкинет тебя наверх: +22% к урону, тебя сложнее снять."],
    [<Bomb key="i" size={18} />, "G — граната", "Две фугаса в запасе, восстанавливаются сами. Выкуривай снайперов с высот, поджигай бочки и машины цепочкой."],
    [<Bomb key="i" size={18} />, "Бочки и машины", "Красные бочки и авто взрываются цепочкой. Ящики разбиваются и ронят аптечки и броню."],
    [<TreePine key="i" size={18} />, "Кроны деревьев", "В лесу залезь под крону — враги тебя не видят. Выстрел демаскирует на секунду."],
    [<Flag key="i" size={18} />, "Захват точек", "В режиме «Захват» стой в круге A/B/C — очки капают за каждую удержанную точку."],
  ];
  return (
    <ScreenShell>
      <div className="glass mx-auto max-w-xl rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-black uppercase text-white"><Crosshair size={20} className="text-amber-300" /> Как играть</h2>
          <button onClick={onClose} className="btn btn-ghost rounded-lg p-2" aria-label="Закрыть"><X size={16} /></button>
        </div>
        <div className="slim-scroll max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {rows.map(([icon, title, text], i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-white/8 bg-black/25 p-3">
              <div className="mt-0.5 shrink-0 text-amber-300">{icon}</div>
              <div>
                <div className="text-sm font-black uppercase tracking-wider text-white">{title}</div>
                <div className="text-[12.5px] font-medium leading-snug text-white/55">{text}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="btn btn-primary mt-5 w-full rounded-xl py-3 text-sm">Понял, в бой</button>
      </div>
    </ScreenShell>
  );
}

function ChevronUpIcon() {
  return <Shield size={18} />;
}
