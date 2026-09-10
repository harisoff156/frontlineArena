import type { WeaponClass } from "./types";

export interface WeaponDef {
  id: string;
  name: string;
  cls: WeaponClass;
  desc: string;
  damage: number; // per bullet / per pellet
  rpm: number;
  mag: number;
  reload: number; // seconds
  spread: number; // radians base spread
  pellets: number;
  bulletSpeed: number; // px/s
  range: number; // px before despawn
  auto: boolean;
  kick: number; // screen shake per shot
  tracer: string; // tracer tint
  moveMult: number; // movement multiplier while held
  pierce?: number; // extra targets pierced
  statBars: { dmg: number; rof: number; range: number; ctrl: number };
}

const W = (w: Omit<WeaponDef, "statBars" | "pellets" | "pierce"> & Partial<Pick<WeaponDef, "pellets" | "pierce">>): WeaponDef => {
  const pellets = w.pellets ?? 1;
  const dps = (w.damage * pellets * w.rpm) / 60;
  return {
    ...w,
    pellets,
    pierce: w.pierce ?? 0,
    statBars: {
      dmg: Math.min(100, Math.round(dps / 4.2)),
      rof: Math.min(100, Math.round(w.rpm / 11)),
      range: Math.min(100, Math.round(w.range / 16)),
      ctrl: Math.min(100, Math.round(100 - w.spread * 2100 - w.kick * 110)),
    },
  };
};

export const CLASS_INFO: Record<WeaponClass, { name: string; role: string }> = {
  ar: { name: "Штурмовик", role: "Штурмовые винтовки" },
  sg: { name: "Боец", role: "Дробовики" },
  smg: { name: "Разведчик", role: "Пистолеты-пулемёты" },
  sr: { name: "Снайпер", role: "Снайперские винтовки" },
};

export const WEAPONS: WeaponDef[] = [
  // ============ ASSAULT RIFLES ============
  W({
    id: "ak47", name: "АК-47", cls: "ar",
    desc: "Легендарный автомат. Тяжёлый урон, заметная отдача.",
    damage: 27, rpm: 600, mag: 30, reload: 2.2, spread: 0.03,
    bulletSpeed: 1050, range: 1000, auto: true, kick: 0.17,
    tracer: "#ffc36b", moveMult: 0.96,
  }),
  W({
    id: "m4a4", name: "М4А4", cls: "ar",
    desc: "Сбалансированный карабин спецназа. Точный и быстрый.",
    damage: 24, rpm: 666, mag: 30, reload: 2.0, spread: 0.023,
    bulletSpeed: 1080, range: 1020, auto: true, kick: 0.13,
    tracer: "#9be7ff", moveMult: 0.97,
  }),
  W({
    id: "aug", name: "AUG A3", cls: "ar",
    desc: "Bullpup с коллиматором — минимальный разброс на дистанции.",
    damage: 23, rpm: 620, mag: 30, reload: 2.1, spread: 0.014,
    bulletSpeed: 1100, range: 1060, auto: true, kick: 0.12,
    tracer: "#b6ff9b", moveMult: 0.94,
  }),
  W({
    id: "famas", name: "FAMAS", cls: "ar",
    desc: "Французский «кулер». Сумасшедший темп стрельбы.",
    damage: 19, rpm: 820, mag: 25, reload: 1.9, spread: 0.032,
    bulletSpeed: 1040, range: 960, auto: true, kick: 0.14,
    tracer: "#ffd79b", moveMult: 0.97,
  }),
  W({
    id: "galil", name: "Galil AR", cls: "ar",
    desc: "Рабочая лошадка с магазином на 35 патронов.",
    damage: 22, rpm: 560, mag: 35, reload: 2.3, spread: 0.021,
    bulletSpeed: 1020, range: 990, auto: true, kick: 0.12,
    tracer: "#9bc8ff", moveMult: 0.95,
  }),

  // ============ SHOTGUNS ============
  W({
    id: "spas12", name: "SPAS-12", cls: "sg",
    desc: "Помповый зверь. Девять дробин крушат всё вблизи.",
    damage: 9, rpm: 75, mag: 8, reload: 2.6, spread: 0.09, pellets: 9,
    bulletSpeed: 820, range: 500, auto: false, kick: 0.5,
    tracer: "#ffb27a", moveMult: 0.95,
  }),
  W({
    id: "aa12", name: "AA-12", cls: "sg",
    desc: "Автоматический дробовик. Стена свинца без остановки.",
    damage: 8, rpm: 220, mag: 12, reload: 2.8, spread: 0.11, pellets: 7,
    bulletSpeed: 800, range: 470, auto: true, kick: 0.3,
    tracer: "#ff9d7a", moveMult: 0.93,
  }),
  W({
    id: "r870", name: "Remington 870", cls: "sg",
    desc: "Классика полиции. Предельный урон одним выстрелом.",
    damage: 11, rpm: 65, mag: 7, reload: 2.7, spread: 0.075, pellets: 8,
    bulletSpeed: 840, range: 520, auto: false, kick: 0.55,
    tracer: "#ffc98f", moveMult: 0.95,
  }),
  W({
    id: "nova", name: "Benelli Nova", cls: "sg",
    desc: "Лёгкая помпа — быстрый темп и живчая подача.",
    damage: 8, rpm: 88, mag: 8, reload: 2.4, spread: 0.085, pellets: 8,
    bulletSpeed: 830, range: 500, auto: false, kick: 0.42,
    tracer: "#ffbf92", moveMult: 0.98,
  }),
  W({
    id: "saiga12", name: "Сайга-12", cls: "sg",
    desc: "Магазинный дробовик на базе АК. Полуавтоматический прессинг.",
    damage: 9, rpm: 165, mag: 10, reload: 2.5, spread: 0.098, pellets: 7,
    bulletSpeed: 810, range: 490, auto: false, kick: 0.38,
    tracer: "#ffa877", moveMult: 0.94,
  }),

  // ============ SMGs ============
  W({
    id: "mp5", name: "MP5", cls: "smg",
    desc: "Эталон ПП спецподразделений. Ровная и точная очередь.",
    damage: 17, rpm: 760, mag: 30, reload: 1.8, spread: 0.026,
    bulletSpeed: 900, range: 760, auto: true, kick: 0.1,
    tracer: "#a8e6ff", moveMult: 1.04,
  }),
  W({
    id: "p90", name: "FN P90", cls: "smg",
    desc: "50 патронов в рожке. Поливай, не перезаряжаясь.",
    damage: 15, rpm: 850, mag: 50, reload: 2.2, spread: 0.03,
    bulletSpeed: 920, range: 740, auto: true, kick: 0.1,
    tracer: "#c3f0ff", moveMult: 1.05,
  }),
  W({
    id: "mp7", name: "MP7A1", cls: "smg",
    desc: "Компактный швейцарский нож — ближний бой в чистом виде.",
    damage: 16, rpm: 900, mag: 30, reload: 1.7, spread: 0.028,
    bulletSpeed: 940, range: 720, auto: true, kick: 0.11,
    tracer: "#d7ffe0", moveMult: 1.07,
  }),
  W({
    id: "uzi", name: "Uzi PRO", cls: "smg",
    desc: "Дешёво и сердито. Дикий веер на пределе.",
    damage: 15, rpm: 800, mag: 32, reload: 1.8, spread: 0.04,
    bulletSpeed: 880, range: 700, auto: true, kick: 0.13,
    tracer: "#ffe4a8", moveMult: 1.08,
  }),
  W({
    id: "vector", name: "KRISS Vector", cls: "smg",
    desc: "Лазерный луч: 1050 выстр/мин с магической стабилизацией.",
    damage: 13, rpm: 1050, mag: 33, reload: 1.9, spread: 0.022,
    bulletSpeed: 950, range: 730, auto: true, kick: 0.09,
    tracer: "#e2d1ff", moveMult: 1.06,
  }),

  // ============ SNIPER RIFLES ============
  W({
    id: "awp", name: "AWP", cls: "sr",
    desc: "Один выстрел — один труп. Гром каждого раунда.",
    damage: 108, rpm: 41, mag: 5, reload: 3.2, spread: 0.004,
    bulletSpeed: 1450, range: 1650, auto: false, kick: 0.7,
    tracer: "#f9f871", moveMult: 0.82,
  }),
  W({
    id: "svd", name: "СВД Драгунова", cls: "sr",
    desc: "Полуавтоматическая винтовка. Темп вместо мощи.",
    damage: 56, rpm: 150, mag: 10, reload: 2.6, spread: 0.01,
    bulletSpeed: 1380, range: 1500, auto: false, kick: 0.38,
    tracer: "#ffe066", moveMult: 0.9,
  }),
  W({
    id: "m24", name: "M24 SWS", cls: "sr",
    desc: "Армейский болт тихой смерти. Точность хирурга.",
    damage: 86, rpm: 50, mag: 6, reload: 3.0, spread: 0.005,
    bulletSpeed: 1420, range: 1580, auto: false, kick: 0.6,
    tracer: "#ffd166", moveMult: 0.86,
  }),
  W({
    id: "scout", name: "Steyr Scout", cls: "sr",
    desc: "Лёгкий болт для снайпера-бегуна. Максимальная мобильность.",
    damage: 66, rpm: 64, mag: 10, reload: 2.4, spread: 0.007,
    bulletSpeed: 1350, range: 1420, auto: false, kick: 0.45,
    tracer: "#fff3a1", moveMult: 0.98,
  }),
  W({
    id: "barrett", name: "Barrett M82", cls: "sr",
    desc: "Крупнокалиберный монстр. Пули пробивают цели навылет.",
    damage: 120, rpm: 34, mag: 5, reload: 3.6, spread: 0.006, pierce: 2,
    bulletSpeed: 1500, range: 1700, auto: false, kick: 0.9,
    tracer: "#ffb703", moveMult: 0.78,
  }),
];

export const weaponById = (id: string): WeaponDef =>
  WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];

export const weaponsByClass = (cls: WeaponClass): WeaponDef[] =>
  WEAPONS.filter((w) => w.cls === cls);
