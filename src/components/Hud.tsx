"use client";

import { Pause, SquareChartGantt, Volume2, VolumeX } from "lucide-react";

export default function Hud({
  bindHud,
  onPause,
  onScoreboard,
  muted,
  onToggleMute,
  showKeys,
}: {
  bindHud: (el: HTMLDivElement | null) => void;
  onPause: () => void;
  onScoreboard: () => void;
  muted: boolean;
  onToggleMute: () => void;
  showKeys: boolean;
}) {
  return (
    <div ref={bindHud} className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* damage vignette */}
      <div
        data-hud="dmgvin"
        className="absolute inset-0"
        style={{
          opacity: 0,
          background: "radial-gradient(ellipse at center, transparent 42%, rgba(200,20,20,.5) 100%)",
          transition: "opacity .1s",
        }}
      />

      {/* top-left buttons */}
      <div className="pointer-events-auto absolute left-3 top-3 z-30 flex gap-2">
        <button
          onClick={onPause}
          className="btn btn-ghost glass rounded-xl p-2.5 text-white/80"
          aria-label="Пауза"
        >
          <Pause size={18} />
        </button>
        <button
          onClick={onScoreboard}
          className="btn btn-ghost glass rounded-xl p-2.5 text-white/80"
          aria-label="Табло"
        >
          <SquareChartGantt size={18} />
        </button>
        <button
          onClick={onToggleMute}
          className="btn btn-ghost glass rounded-xl p-2.5 text-white/80"
          aria-label="Звук"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* top-center score widget */}
      <div className="absolute top-3" style={{ left: "50%", transform: "translateX(-50%)" }}>
        <div className="glass rounded-2xl px-5 py-1.5 text-center">
          <div data-hud="objline" className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45" />
          <div className="flex items-center justify-center gap-4">
            <span data-hud="scoreA" className="text-2xl font-black tabular-nums" style={{ color: "#35d0ff" }} />
            <span data-hud="timer" className="min-w-[62px] rounded-lg bg-black/50 px-2 py-0.5 text-lg font-bold tabular-nums text-white/90" />
            <span data-hud="scoreB" className="text-2xl font-black tabular-nums" style={{ color: "#ff5d5d" }} />
          </div>
        </div>
      </div>

      {/* killfeed */}
      <div data-hud="killfeed" className="absolute right-4 top-[150px] z-20 flex w-[290px] flex-col items-end" />

      {/* announcements */}
      <h1
        data-hud="announce"
        className="absolute left-1/2 top-[22%] z-30 whitespace-nowrap text-center text-5xl font-black uppercase tracking-[0.12em] text-amber-300"
        style={{ textShadow: "0 0 34px rgba(255,170,60,.65), 0 3px 0 rgba(0,0,0,.55)", transform: "translate(-50%,0)", opacity: 0 }}
      />
      <h2
        data-hud="announceSub"
        className="absolute left-1/2 top-[30%] z-30 whitespace-nowrap text-center text-lg font-bold uppercase tracking-[0.3em] text-white/85"
        style={{ textShadow: "0 2px 10px rgba(0,0,0,.7)", transform: "translate(-50%,0)", opacity: 0 }}
      />

      {/* hitmarker */}
      <div data-hud="hitm" className="absolute left-1/2 top-1/2 z-20 h-11 w-11 opacity-0" style={{ transform: "translate(-50%,-50%)" }}>
        {[0, 90, 180, 270].map((deg) => (
          <div
            key={deg}
            className="hitm-line absolute left-1/2 top-1/2 h-[3px] w-[13px] rounded bg-white"
            style={{
              transformOrigin: "left center",
              transform: `rotate(${deg}deg) translateX(9px)`,
            }}
          />
        ))}
      </div>

      {/* bottom-left health */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="glass rounded-2xl px-4 py-3">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">ОЗ</span>
            <span data-hud="hpnum" className="text-3xl font-black tabular-nums leading-none" />
          </div>
          <div className="mb-1.5 h-[5px] w-[200px] overflow-hidden rounded-full bg-white/10">
            <div data-hud="shbar" className="h-full origin-left rounded-full bg-sky-300" style={{ transform: "scaleX(0)" }} />
          </div>
          <div className="h-[10px] w-[200px] overflow-hidden rounded-full bg-white/10">
            <div
              data-hud="hpbar"
              className="h-full origin-left rounded-full"
              style={{ transform: "scaleX(1)", background: "linear-gradient(90deg,#7dff9b,#35d0ff)" }}
            />
          </div>
        </div>
      </div>

      {/* bottom-right weapon */}
      <div className="absolute bottom-4 right-4 z-20 text-right">
        <div className="glass rounded-2xl px-5 py-3">
          <div data-hud="wepname" className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-300/90" />
          <div data-hud="ammo" className="text-3xl font-black tabular-nums leading-tight" />
          <div className="mt-1 flex items-center justify-end gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Гранаты</span>
            <span data-hud="nades" className="text-base tracking-[0.35em] text-emerald-300" />
          </div>
          <div className="mt-1 h-[4px] w-[170px] overflow-hidden rounded-full bg-white/10">
            <div data-hud="reloadbar" className="h-full origin-left rounded-full bg-amber-300" style={{ display: "none" }} />
          </div>
        </div>
      </div>

      {/* boost hint */}
      <div className="absolute bottom-[110px] left-1/2 z-20" style={{ transform: "translateX(-50%)" }}>
        <div data-hud="boostHint" className="glass rounded-xl px-4 py-2 text-sm font-bold tracking-wider text-amber-200" style={{ display: "none" }}>
          <span className="mr-2 inline-block rounded-md border border-amber-300/60 bg-black/50 px-2 py-0.5 text-xs">E</span>
          ПОДСАДКА НА ВЫСОТУ
        </div>
      </div>

      {/* respawn overlay */}
      <div data-hud="respawn" className="absolute inset-0 z-20 flex items-center justify-center" style={{ display: "none" }}>
        <div className="glass rounded-2xl px-8 py-5 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">Возрождение через</div>
          <div data-hud="respawnT" className="text-6xl font-black tabular-nums text-amber-300" />
          <div className="mt-1 text-xs text-white/45">Наблюдение за напарником</div>
        </div>
      </div>

      {/* desktop key hints */}
      {showKeys && (
        <div className="absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 text-[11px] font-semibold tracking-wider text-white/35 md:flex">
          {["WASD — движение", "ЛКМ — огонь", "G — граната", "R — перезарядка", "ПРОБЕЛ — прыжок", "E — подсадка", "TAB — табло"].map((s) => (
            <span key={s} className="rounded-md bg-black/35 px-2 py-1">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
