"use client";

import { useCallback, useEffect, useRef } from "react";
import { Bomb, ChevronsUp, RotateCw, UsersRound } from "lucide-react";
import { touchInput } from "@/game/engine";

function Stick({
  side,
  onFirst,
}: {
  side: "left" | "right";
  onFirst: () => void;
}) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const st = useRef({ id: -1, ox: 0, oy: 0 });
  const R = 58;

  const reset = useCallback(() => {
    st.current.id = -1;
    if (side === "left") { touchInput.moveX = 0; touchInput.moveY = 0; }
    else { touchInput.aiming = false; touchInput.fireHeld = false; }
    if (baseRef.current) baseRef.current.style.opacity = "0";
    if (knobRef.current) knobRef.current.style.transform = "translate(-50%,-50%)";
  }, [side]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;

    const down = (e: PointerEvent) => {
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      st.current.id = e.pointerId;
      st.current.ox = e.clientX;
      st.current.oy = e.clientY;
      touchInput.active = true;
      onFirst();
      if (baseRef.current) {
        baseRef.current.style.opacity = "1";
        baseRef.current.style.left = e.clientX + "px";
        baseRef.current.style.top = e.clientY + "px";
      }
      if (side === "right") touchInput.aiming = true;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== st.current.id) return;
      let dx = e.clientX - st.current.ox;
      let dy = e.clientY - st.current.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      if (side === "left") {
        touchInput.moveX = dx / R;
        touchInput.moveY = dy / R;
      } else {
        const m = Math.hypot(dx, dy);
        if (m > 6) {
          touchInput.aimDX = dx / m;
          touchInput.aimDY = dy / m;
          touchInput.aiming = true;
          const firing = m / R > 0.4;
          if (firing && !touchInput.fireHeld) touchInput.fireTapped = true;
          touchInput.fireHeld = firing;
        }
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== st.current.id) return;
      reset();
    };
    zone.addEventListener("pointerdown", down);
    zone.addEventListener("pointermove", move);
    zone.addEventListener("pointerup", up);
    zone.addEventListener("pointercancel", up);
    return () => {
      zone.removeEventListener("pointerdown", down);
      zone.removeEventListener("pointermove", move);
      zone.removeEventListener("pointerup", up);
      zone.removeEventListener("pointercancel", up);
    };
  }, [side, reset, onFirst]);

  return (
    <>
      <div
        ref={zoneRef}
        className={`pointer-events-auto touch-btn absolute bottom-0 ${side === "left" ? "left-0" : "right-0"} h-[55%] w-[46%] z-30`}
      />
      {/* floating base + knob (position set on touch) */}
      <div
        ref={baseRef}
        className="pointer-events-none fixed z-30 h-[116px] w-[116px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20 bg-white/5 opacity-0 backdrop-blur-[2px]"
        style={{ transition: "opacity .15s" }}
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 h-[52px] w-[52px] rounded-full border border-white/30 bg-gradient-to-br from-white/25 to-white/5 shadow-lg"
          style={{ transform: "translate(-50%,-50%)" }}
        />
      </div>
    </>
  );
}

function ActionBtn({
  icon,
  label,
  onTap,
  className = "",
  size = 64,
}: {
  icon: React.ReactNode;
  label: string;
  onTap: () => void;
  className?: string;
  size?: number;
}) {
  return (
    <button
      className={`touch-btn flex flex-col items-center justify-center gap-0.5 rounded-full border border-white/25 bg-black/40 text-white/90 backdrop-blur-sm active:scale-90 active:bg-amber-500/30 ${className}`}
      style={{ width: size, height: size }}
      onPointerDown={(e) => { e.preventDefault(); onTap(); }}
    >
      {icon}
      <span className="text-[9px] font-bold tracking-widest">{label}</span>
    </button>
  );
}

export default function TouchControls({ onFirstTouch }: { onFirstTouch: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <Stick side="left" onFirst={onFirstTouch} />
      <Stick side="right" onFirst={onFirstTouch} />
      <div className="absolute bottom-[110px] right-4 z-40 flex flex-col items-end gap-3">
        <div className="pointer-events-auto flex items-end gap-3">
          <ActionBtn
            icon={<Bomb size={22} />}
            label="ГРАНАТА"
            size={58}
            onTap={() => { touchInput.nadeQ = true; }}
            className="border-emerald-400/50"
          />
          <ActionBtn
            icon={<UsersRound size={22} />}
            label="ПОДСАД"
            size={58}
            onTap={() => { touchInput.boostQ = true; }}
          />
          <ActionBtn
            icon={<RotateCw size={22} />}
            label="ПЕРЕЗАР"
            size={58}
            onTap={() => { touchInput.reloadQ = true; }}
          />
          <ActionBtn
            icon={<ChevronsUp size={26} />}
            label="ПРЫЖОК"
            size={70}
            onTap={() => { touchInput.jumpQ = true; }}
            className="border-amber-400/50"
          />
        </div>
      </div>
    </div>
  );
}
