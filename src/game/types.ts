// Shared game types

export type TeamId = 0 | 1;
export type WeaponClass = "ar" | "sg" | "smg" | "sr";
export type ModeId = "tdm" | "dom" | "elim" | "koth" | "horde";
export type MapId = "city" | "village" | "terminal" | "forest" | "hangar";

export interface Vec {
  x: number;
  y: number;
}

export type ObstacleKind =
  | "wall"
  | "crate"
  | "barrel"
  | "half"
  | "tree"
  | "car"
  | "container";

export interface ObstacleDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ObstacleKind;
}

export interface HighGroundZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CapturePointDef {
  id: "A" | "B" | "C";
  x: number;
  y: number;
}

export interface Canopy {
  x: number;
  y: number;
  r: number;
}

export interface MapPalette {
  voidColor: string;
  base: string;
  accent: string;
}

export interface MapDef {
  id: MapId;
  name: string;
  tagline: string;
  desc: string;
  w: number;
  h: number;
  palette: MapPalette;
  obstacles: ObstacleDef[];
  highgrounds: HighGroundZone[];
  points: CapturePointDef[];
  spawnsA: Vec[];
  spawnsB: Vec[];
  canopies: Canopy[];
}

export interface ModeDef {
  id: ModeId;
  name: string;
  short: string;
  desc: string;
  teamSize: number; // players per team including human
  respawn: boolean;
  respawnDelay: number;
  timeLimit: number; // seconds (elim: per round)
  killTarget?: number;
  scoreTarget?: number;
  roundWins?: number;
}

export const MODES: Record<ModeId, ModeDef> = {
  tdm: {
    id: "tdm",
    name: "Командный бой",
    short: "TDM 4×4",
    desc: "Два отряда по 4 бойца. Первая команда, набравшая 25 фрагов, побеждает. Респаун включён.",
    teamSize: 4,
    respawn: true,
    respawnDelay: 3,
    timeLimit: 300,
    killTarget: 25,
  },
  dom: {
    id: "dom",
    name: "Захват точек",
    short: "Domination",
    desc: "Удерживайте точки A, B и C. За каждую удерживаемую точку команда получает очки. Цель — 150.",
    teamSize: 4,
    respawn: true,
    respawnDelay: 3,
    timeLimit: 360,
    scoreTarget: 150,
  },
  elim: {
    id: "elim",
    name: "Ликвидация",
    short: "Раунды 4×4",
    desc: "Раунды без респауна. Уничтожьте вражеский отряд. Побеждает команда, выигравшая 4 раунда.",
    teamSize: 4,
    respawn: false,
    respawnDelay: 0,
    timeLimit: 75,
    roundWins: 4,
  },
  koth: {
    id: "koth",
    name: "Король холма",
    short: "KOTH",
    desc: "Одна точка в центре карты. Пока на ней только ваш отряд — копятся секунды власти. Первые 100 секунд — победа.",
    teamSize: 4,
    respawn: true,
    respawnDelay: 3,
    timeLimit: 300,
    scoreTarget: 100,
  },
  horde: {
    id: "horde",
    name: "Рубеж",
    short: "Co-op PvE",
    desc: "Кооперативная оборона: отряд против 10 волн врагов. Каждая 4-я волна — джаггернаут. Выстоять всем отрядом!",
    teamSize: 4,
    respawn: false,
    respawnDelay: 0,
    timeLimit: 3600,
  },
};

export interface MatchConfig {
  modeId: ModeId;
  mapId: MapId;
  weaponId: string;
  playerName: string;
}

export interface MatchResult {
  win: boolean;
  draw: boolean;
  modeId: ModeId;
  mapId: MapId;
  kills: number;
  deaths: number;
  bestStreak: number;
  score: number;
  scoreA: number;
  scoreB: number;
  duration: number;
}
