// Player profile, rating, local high-scores and settings (localStorage-backed).

export interface RankInfo {
  name: string;
  min: number;
  color: string;
  glow: string;
}

export const RANKS: RankInfo[] = [
  { name: "Рекрут", min: 0, color: "#9aa4b2", glow: "rgba(154,164,178,.4)" },
  { name: "Бронза", min: 900, color: "#d08b4e", glow: "rgba(208,139,78,.45)" },
  { name: "Серебро", min: 1050, color: "#cfd8e3", glow: "rgba(207,216,227,.45)" },
  { name: "Золото", min: 1250, color: "#ffd166", glow: "rgba(255,209,102,.5)" },
  { name: "Платина", min: 1450, color: "#6ee7d8", glow: "rgba(110,231,216,.5)" },
  { name: "Алмаз", min: 1700, color: "#7cc4ff", glow: "rgba(124,196,255,.55)" },
  { name: "Легенда", min: 2000, color: "#ff7ad9", glow: "rgba(255,122,217,.6)" },
];

export function rankOf(rating: number): RankInfo {
  let r = RANKS[0];
  for (const k of RANKS) if (rating >= k.min) r = k;
  return r;
}

export function nextRank(rating: number): RankInfo | null {
  for (const k of RANKS) if (rating < k.min) return k;
  return null;
}

export interface Profile {
  name: string;
  rating: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  bestScore: number;
  bestStreak: number;
  games: number;
  favoriteClass: string;
}

export interface HighScoreEntry {
  name: string;
  score: number;
  kills: number;
  mode: string;
  map: string;
  date: number;
}

export type Difficulty = "easy" | "normal" | "hard";

export interface Settings {
  sound: boolean;
  shake: boolean;
  quality: "auto" | "high" | "low";
  difficulty: Difficulty;
}

const P_KEY = "arenabot_profile_v1";
const S_KEY = "arenabot_scores_v1";
const SET_KEY = "arenabot_settings_v1";

const defaultProfile = (): Profile => ({
  name: "Игрок-" + Math.floor(1000 + Math.random() * 9000),
  rating: 1000,
  wins: 0,
  losses: 0,
  kills: 0,
  deaths: 0,
  bestScore: 0,
  bestStreak: 0,
  games: 0,
  favoriteClass: "ar",
});

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(P_KEY);
    if (raw) return { ...defaultProfile(), ...(JSON.parse(raw) as Profile) };
  } catch { /* noop */ }
  return defaultProfile();
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(P_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

export function applyMatchResult(
  p: Profile,
  r: { win: boolean; draw: boolean; kills: number; deaths: number; score: number; bestStreak: number; cls: string },
  diff: Difficulty = "normal"
): { profile: Profile; delta: number } {
  const next = { ...p };
  next.games += 1;
  next.kills += r.kills;
  next.deaths += r.deaths;
  next.favoriteClass = r.cls;
  if (r.score > next.bestScore) next.bestScore = r.score;
  if (r.bestStreak > next.bestStreak) next.bestStreak = r.bestStreak;
  let delta = 0;
  if (r.draw) delta = 0;
  else if (r.win) {
    next.wins += 1;
    delta = 22 + Math.min(10, Math.floor(r.kills / 2)) + (r.bestStreak >= 5 ? 4 : 0);
    if (diff === "hard") delta += 9;
    if (diff === "easy") delta = Math.max(6, delta - 10);
  } else {
    next.losses += 1;
    delta = -(12 + Math.max(0, 6 - Math.floor(r.kills / 2)));
  }
  next.rating = Math.max(100, next.rating + delta);
  saveProfile(next);
  return { profile: next, delta };
}

export function loadHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(S_KEY);
    if (raw) return JSON.parse(raw) as HighScoreEntry[];
  } catch { /* noop */ }
  return [];
}

export function addHighScore(e: HighScoreEntry): HighScoreEntry[] {
  const list = loadHighScores();
  list.push(e);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try { localStorage.setItem(S_KEY, JSON.stringify(top)); } catch { /* noop */ }
  return top;
}

export function loadSettings(): Settings {
  const fallback: Settings = { sound: true, shake: true, quality: "auto", difficulty: "normal" };
  try {
    const raw = localStorage.getItem(SET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...fallback, ...parsed };
    }
  } catch { /* noop */ }
  return fallback;
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch { /* noop */ }
}
