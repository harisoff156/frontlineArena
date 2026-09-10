import type { MapDef, MapId, ObstacleDef, Canopy } from "./types";

// ---------- helpers ----------
const wall = (x: number, y: number, w: number, h: number): ObstacleDef => ({ x, y, w, h, kind: "wall" });
const crate = (x: number, y: number, s = 64): ObstacleDef => ({ x, y, w: s, h: s, kind: "crate" });
const car = (x: number, y: number, w: number, h: number): ObstacleDef => ({ x, y, w, h, kind: "car" });
const barrel = (x: number, y: number): ObstacleDef => ({ x: x - 17, y: y - 17, w: 34, h: 34, kind: "barrel" });
const half = (x: number, y: number, w: number, h: number): ObstacleDef => ({ x, y, w, h, kind: "half" });
const cont = (x: number, y: number, w: number, h: number): ObstacleDef => ({ x, y, w, h, kind: "container" });
const tree = (x: number, y: number): ObstacleDef => ({ x: x - 15, y: y - 15, w: 30, h: 30, kind: "tree" });

function borders(w: number, h: number): ObstacleDef[] {
  const t = 60;
  return [
    { x: -t, y: -t, w: w + 2 * t, h: t, kind: "wall" },
    { x: -t, y: h, w: w + 2 * t, h: t, kind: "wall" },
    { x: -t, y: 0, w: t, h, kind: "wall" },
    { x: w, y: 0, w: t, h, kind: "wall" },
  ];
}

// ---------- CITY ----------
function buildCity(): MapDef {
  const w = 2400, h = 1600;
  const o: ObstacleDef[] = [
    ...borders(w, h),
    // quadrant buildings
    wall(130, 130, 430, 300), wall(680, 130, 300, 220),
    wall(1420, 130, 300, 220), wall(1840, 130, 430, 300),
    wall(130, 1170, 430, 300), wall(680, 1250, 300, 220),
    wall(1420, 1250, 300, 220), wall(1840, 1170, 430, 300),
    // mid blocks creating lanes
    wall(560, 560, 240, 200), wall(1600, 560, 240, 200),
    wall(560, 880, 240, 200), wall(1600, 880, 240, 200),
    // central plaza props
    crate(1080, 700), crate(1256, 836), crate(1080, 836), crate(1256, 700),
    half(1150, 610, 100, 26), half(1150, 964, 100, 26),
    half(1010, 750, 26, 100), half(1364, 750, 26, 100),
    // cars on roads
    car(1030, 250, 120, 56), car(1290, 420, 56, 120), car(1058, 1330, 120, 56),
    car(1290, 1050, 56, 120), car(340, 745, 120, 56), car(1940, 795, 120, 56),
    // side props
    crate(300, 620), crate(380, 700), crate(2120, 620, 70),
    crate(2040, 900), crate(2140, 980), crate(330, 940, 70),
    cont(880, 1480, 220, 70), cont(1310, 60, 220, 70),
    half(850, 420, 130, 24), half(1420, 1160, 130, 24),
    half(240, 1080, 24, 130), half(2140, 380, 24, 130),
    // explosive barrels
    barrel(900, 1130), barrel(1520, 470), barrel(470, 500), barrel(1930, 1080),
    barrel(1210, 560), barrel(1225, 1035),
  ];
  return {
    id: "city", name: "НЕОН-СИТИ", tagline: "Ночной мегаполис",
    desc: "Уличные перестрелки среди неона, автомобилей и подворотен. Много средних дистанций.",
    w, h,
    palette: { voidColor: "#07080d", base: "#232633", accent: "#ffb340" },
    obstacles: o,
    highgrounds: [
      { x: 700, y: 660, w: 130, h: 130 },
      { x: 1570, y: 800, w: 130, h: 130 },
    ],
    points: [
      { id: "A", x: 700, y: 470 },
      { id: "B", x: 1200, y: 800 },
      { id: "C", x: 1700, y: 1130 },
    ],
    spawnsA: [{ x: 220, y: 800 }, { x: 300, y: 690 }, { x: 300, y: 910 }],
    spawnsB: [{ x: 2180, y: 800 }, { x: 2100, y: 690 }, { x: 2100, y: 910 }],
    canopies: [],
  };
}

// ---------- VILLAGE ----------
function buildVillage(): MapDef {
  const w = 2200, h = 1600;
  const canopies: Canopy[] = [];
  const o: ObstacleDef[] = [
    ...borders(w, h),
    // houses
    wall(180, 170, 250, 180), wall(770, 140, 250, 180),
    wall(1360, 150, 250, 180), wall(1830, 200, 240, 170),
    wall(200, 1220, 250, 180), wall(790, 1280, 240, 170),
    wall(1330, 1260, 250, 180), wall(1820, 1200, 250, 180),
    // fences (half cover yards)
    half(430, 200, 200, 22), half(430, 330, 200, 22),
    half(1600, 240, 160, 22), half(1600, 360, 160, 22),
    half(500, 1170, 22, 200), half(1180, 1290, 150, 22),
    half(1600, 1150, 160, 22), half(1620, 1280, 22, 140),
    half(700, 550, 24, 150), half(1470, 900, 24, 150),
    // hay bales
    crate(560, 620, 70), crate(600, 900, 70), crate(1560, 620, 70),
    crate(1540, 940, 70), crate(1070, 380, 66), crate(1100, 1160, 66),
    // central market square
    half(950, 700, 90, 26), half(1160, 700, 90, 26),
    half(950, 870, 90, 26), half(1160, 870, 90, 26),
    crate(1030, 750), crate(1110, 810),
    // well
    wall(1078, 770, 44, 44),
    // barn center-right
    wall(940, 240, 200, 130),
    // barrels
    barrel(660, 250), barrel(1490, 420), barrel(400, 1000), barrel(1740, 700),
    barrel(1120, 540), barrel(1120, 1060),
    // trees (trunk colliders) — outer ring
    tree(110, 700), tree(150, 900), tree(2060, 660), tree(2090, 950),
    tree(620, 80), tree(1220, 90), tree(90, 480), tree(2130, 470),
    tree(650, 1060), tree(1520, 1090), tree(320, 1430), tree(1930, 1460),
    tree(1250, 480), tree(950, 1120),
  ];
  for (const t of [
    [110, 700], [150, 900], [2060, 660], [2090, 950], [620, 80], [1220, 90],
    [90, 480], [2130, 470], [650, 1060], [1520, 1090], [320, 1430], [1930, 1460],
    [1250, 480], [950, 1120],
  ]) canopies.push({ x: t[0], y: t[1], r: 88 });
  return {
    id: "village", name: "ПОСЁЛОК", tagline: "Тихий пригород",
    desc: "Избы, заборы и стога сена. Заборы не останавливают пули — стреляйте через укрытия.",
    w, h,
    palette: { voidColor: "#0a0f08", base: "#33422a", accent: "#e3b04b" },
    obstacles: o,
    highgrounds: [
      { x: 940, y: 240, w: 200, h: 130 },
      { x: 430, y: 560, w: 120, h: 120 },
    ],
    points: [
      { id: "A", x: 560, y: 380 },
      { id: "B", x: 1100, y: 800 },
      { id: "C", x: 1660, y: 1240 },
    ],
    spawnsA: [{ x: 200, y: 800 }, { x: 280, y: 700 }, { x: 280, y: 900 }],
    spawnsB: [{ x: 2000, y: 800 }, { x: 1920, y: 700 }, { x: 1920, y: 900 }],
    canopies,
  };
}

// ---------- TERMINAL ----------
function buildTerminal(): MapDef {
  const w = 2500, h = 1400;
  const o: ObstacleDef[] = [
    ...borders(w, h),
    // terminal building along the top
    wall(60, 60, 2380, 150),
    // gates (half partitions below building)
    half(500, 270, 22, 120), half(1000, 270, 22, 120),
    half(1500, 270, 22, 120), half(2000, 270, 22, 120),
    half(260, 270, 200, 22), half(760, 270, 200, 22),
    half(1260, 270, 200, 22), half(1760, 270, 200, 22),
    // parked jet (fuselage + wings as containers) center
    cont(1175, 470, 150, 460),
    half(1010, 640, 180, 40), half(1310, 640, 180, 40),
    // luggage carts / crates
    crate(700, 560), crate(780, 640), crate(1670, 560), crate(1750, 640),
    crate(430, 900, 70), crate(2030, 880, 70),
    crate(980, 1060), crate(1460, 1060),
    // container rows bottom
    cont(180, 1180, 260, 80), cont(560, 1210, 220, 80),
    cont(1740, 1200, 240, 80), cont(2100, 1160, 240, 80),
    cont(1080, 1240, 340, 80),
    // fuel trucks (cars) + barrels near them (danger!)
    car(360, 700, 150, 60), car(1990, 720, 150, 60),
    barrel(540, 700), barrel(560, 750), barrel(1930, 770), barrel(1960, 720),
    barrel(1250, 1080), barrel(870, 420), barrel(1630, 420),
    // more cover halves on apron
    half(520, 520, 130, 24), half(1850, 540, 130, 24),
    half(820, 950, 24, 130), half(1656, 950, 24, 130),
  ];
  return {
    id: "terminal", name: "ТЕРМИНАЛ-7", tagline: "Посадочный терминал",
    desc: "Взлётное поле и перрон. Открытые дальние дистанции, припаркованный борт и топливные бочки.",
    w, h,
    palette: { voidColor: "#060a0e", base: "#2b3440", accent: "#5ee6d0" },
    obstacles: o,
    highgrounds: [
      { x: 1175, y: 470, w: 150, h: 460 },
    ],
    points: [
      { id: "A", x: 620, y: 800 },
      { id: "B", x: 1250, y: 700 },
      { id: "C", x: 1880, y: 800 },
    ],
    spawnsA: [{ x: 160, y: 450 }, { x: 220, y: 560 }, { x: 200, y: 340 }],
    spawnsB: [{ x: 2340, y: 450 }, { x: 2280, y: 560 }, { x: 2300, y: 340 }],
    canopies: [],
  };
}

// ---------- FOREST ----------
function buildForest(): MapDef {
  const w = 2300, h = 1700;
  const o: ObstacleDef[] = [...borders(w, h)];
  const canopies: Canopy[] = [];
  // hand-placed trees with clearings for lanes & points
  const trees: [number, number][] = [
    [220, 220], [420, 180], [640, 260], [900, 160], [1240, 200], [1560, 160],
    [1860, 220], [2100, 300], [300, 480], [540, 460], [820, 420], [1420, 420],
    [1700, 460], [2020, 520], [180, 760], [430, 720], [700, 640], [1600, 700],
    [1900, 760], [2140, 820], [260, 1050], [560, 980], [1680, 1020], [2050, 1080],
    [200, 1350], [480, 1300], [760, 1240], [1500, 1270], [1800, 1330], [2080, 1400],
    [980, 520], [1320, 560], [1060, 1180], [1300, 1220], [880, 880], [1480, 880],
    [640, 1470], [1150, 1450], [1560, 500], [760, 320],
  ];
  for (const [tx, ty] of trees) {
    o.push(tree(tx, ty));
    canopies.push({ x: tx, y: ty, r: 92 });
  }
  // rocks
  o.push(wall(1000, 700, 90, 70), wall(1330, 940, 80, 60));
  o.push(wall(500, 1150, 70, 60), wall(1750, 550, 80, 60));
  // fallen logs (half cover)
  o.push(half(850, 620, 150, 26), half(1300, 700, 26, 150));
  o.push(half(700, 1050, 160, 26), half(1550, 1150, 160, 26));
  o.push(half(1090, 400, 120, 24), half(1150, 1330, 120, 24));
  // camp center (abandoned): crates + barrels
  o.push(crate(1080, 790), crate(1160, 850), crate(1075, 862, 58));
  o.push(barrel(1215, 800), barrel(1090, 928));
  o.push(barrel(430, 420), barrel(1900, 1280));
  return {
    id: "forest", name: "ЧАЩА", tagline: "Ночной лес",
    desc: "Густые кроны скрывают бойцов от врагов. Залегите под деревом — и вас не увидят.",
    w, h,
    palette: { voidColor: "#040a05", base: "#1d2b1a", accent: "#9dff57" },
    obstacles: o,
    highgrounds: [{ x: 1080, y: 240, w: 150, h: 120 }],
    points: [
      { id: "A", x: 420, y: 850 },
      { id: "B", x: 1150, y: 850 },
      { id: "C", x: 1880, y: 850 },
    ],
    spawnsA: [{ x: 170, y: 850 }, { x: 240, y: 940 }, { x: 240, y: 760 }],
    spawnsB: [{ x: 2130, y: 850 }, { x: 2060, y: 940 }, { x: 2060, y: 760 }],
    canopies,
  };
}

// ---------- HANGAR ----------
function buildHangar(): MapDef {
  const w = 2000, h = 1400;
  const o: ObstacleDef[] = [
    ...borders(w, h),
    // central heli pad clearance — crate rows flanking
    crate(420, 420), crate(500, 420), crate(580, 420),
    crate(420, 940), crate(500, 940), crate(580, 940),
    crate(1340, 420), crate(1420, 420), crate(1500, 420),
    crate(1340, 940), crate(1420, 940), crate(1500, 940),
    // containers along walls
    cont(100, 180, 260, 80), cont(1640, 180, 260, 80),
    cont(100, 1140, 260, 80), cont(1640, 1140, 260, 80),
    cont(880, 90, 240, 70), cont(880, 1240, 240, 70),
    // machine blocks
    wall(180, 620, 120, 160), wall(1700, 620, 120, 160),
    wall(880, 620, 240, 60), wall(880, 720, 240, 60),
    // halves (tool benches)
    half(640, 220, 140, 26), half(1220, 220, 140, 26),
    half(640, 1150, 140, 26), half(1220, 1150, 140, 26),
    half(760, 560, 26, 120), half(1214, 740, 26, 120),
    // barrels — rows near machines
    barrel(340, 700), barrel(360, 760), barrel(1640, 700), barrel(1620, 760),
    barrel(1000, 480), barrel(1028, 928),
  ];
  return {
    id: "hangar", name: "АНГАР-12", tagline: "Военная база",
    desc: "Тесные коридоры между стеллажами, вертолётная площадка в центре. Ближний бой правит.",
    w, h,
    palette: { voidColor: "#050505", base: "#26262b", accent: "#ffb340" },
    obstacles: o,
    highgrounds: [
      { x: 100, y: 520, w: 120, h: 360 },
      { x: 1780, y: 520, w: 120, h: 360 },
    ],
    points: [
      { id: "A", x: 470, y: 700 },
      { id: "B", x: 1000, y: 700 },
      { id: "C", x: 1530, y: 700 },
    ],
    spawnsA: [{ x: 150, y: 340 }, { x: 220, y: 300 }, { x: 160, y: 1050 }],
    spawnsB: [{ x: 1850, y: 340 }, { x: 1780, y: 300 }, { x: 1840, y: 1050 }],
    canopies: [],
  };
}

export const MAPS: MapDef[] = [buildCity(), buildVillage(), buildTerminal(), buildForest(), buildHangar()];

export const getMap = (id: MapId): MapDef => MAPS.find((m) => m.id === id) ?? MAPS[0];

// ================= GROUND PAINTERS =================

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx: CanvasRenderingContext2D, rnd: () => number, w: number, h: number, n: number, colors: string[], rMin = 1, rMax = 3, alpha = 0.16) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.5 + rnd() * 0.8);
    ctx.fillStyle = colors[(rnd() * colors.length) | 0];
    const r = rMin + rnd() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function plaza(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, fill);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Paints the full static ground of a map onto an offscreen canvas (called once per match). */
export function paintGround(map: MapDef, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = map.w;
  canvas.height = map.h;
  const rnd = mulberry32(map.id.length * 7919 + map.w);
  const { w, h } = map;

  ctx.fillStyle = map.palette.base;
  ctx.fillRect(0, 0, w, h);

  switch (map.id) {
    case "city": {
      // two-tone asphalt patches
      speckle(ctx, rnd, w, h, 2600, ["#1c1f29", "#2a2e3d", "#31364a", "#252938"], 1.5, 4, 0.2);
      // roads: vertical & horizontal at center cross + ring
      ctx.fillStyle = "#191c26";
      ctx.fillRect(1000, 0, 400, h);
      ctx.fillRect(0, 620, w, 360);
      // lane dashes
      ctx.fillStyle = "rgba(255,214,120,.5)";
      for (let y = 20; y < h; y += 90) ctx.fillRect(1194, y, 12, 44);
      for (let x = 20; x < w; x += 90) ctx.fillRect(x, 794, 44, 12);
      // crosswalks
      ctx.fillStyle = "rgba(230,235,245,.16)";
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(1010 + i * 46, 560, 24, 50);
        ctx.fillRect(1010 + i * 46, 990, 24, 50);
      }
      // sidewalk tint in quadrants
      ctx.fillStyle = "rgba(255,255,255,.035)";
      ctx.fillRect(0, 0, 1000, 620); ctx.fillRect(1400, 980, 1000, 620);
      ctx.fillRect(1400, 0, 1000, 620); ctx.fillRect(0, 980, 1000, 620);
      // neon puddles
      plaza(ctx, 700, 470, 190, "rgba(120,80,255,.10)");
      plaza(ctx, 1700, 1130, 190, "rgba(255,179,64,.10)");
      plaza(ctx, 1200, 800, 260, "rgba(255,120,160,.07)");
      speckle(ctx, rnd, w, h, 200, ["#ffb340", "#7c5cff", "#ff5d8f"], 2, 5, 0.25);
      break;
    }
    case "village": {
      speckle(ctx, rnd, w, h, 3200, ["#2c3a24", "#3c4d30", "#445836", "#2a3622"], 2, 5, 0.22);
      // field rows right-bottom
      ctx.strokeStyle = "rgba(120,95,50,.35)";
      ctx.lineWidth = 7;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath(); ctx.moveTo(1300 + i * 4, 1050 + i * 42); ctx.lineTo(2200, 990 + i * 42); ctx.stroke();
      }
      // dirt paths: main street
      ctx.strokeStyle = "rgba(146,110,64,.5)";
      ctx.lineWidth = 64; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 800); ctx.quadraticCurveTo(1100, 760, w, 830); ctx.stroke();
      ctx.lineWidth = 44;
      ctx.beginPath(); ctx.moveTo(1100, 200); ctx.quadraticCurveTo(1120, 800, 1090, 1600); ctx.stroke();
      speckle(ctx, rnd, w, h, 260, ["#c9a35f"], 2, 6, 0.2);
      // flower dots
      speckle(ctx, rnd, w, h, 120, ["#f2e6a2", "#e8f6ff", "#ffc2d1"], 1.5, 3, 0.5);
      break;
    }
    case "terminal": {
      speckle(ctx, rnd, w, h, 2200, ["#242c36", "#333d4a", "#3a4552"], 2, 4, 0.2);
      // concrete slab grid
      ctx.strokeStyle = "rgba(0,0,0,.22)";
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 125) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 220; y < h; y += 125) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // runway centerline bottom
      ctx.fillStyle = "rgba(255,255,255,.5)";
      for (let x = 40; x < w; x += 120) ctx.fillRect(x, 1330, 60, 14);
      // taxiway lines
      ctx.strokeStyle = "rgba(255,213,79,.55)";
      ctx.lineWidth = 8;
      ctx.setLineDash([50, 34]);
      ctx.beginPath(); ctx.moveTo(0, 1050); ctx.lineTo(w, 1050); ctx.stroke();
      ctx.setLineDash([]);
      // gate letters
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.font = "700 90px monospace";
      ctx.fillText("G1", 250, 330); ctx.fillText("G2", 750, 330); ctx.fillText("G3", 1250, 330); ctx.fillText("G4", 1750, 330);
      // safety circles at points
      for (const p of map.points) {
        ctx.strokeStyle = "rgba(255,80,60,.4)";
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, 120, 0, Math.PI * 2); ctx.stroke();
      }
      plaza(ctx, 1250, 700, 340, "rgba(94,230,208,.05)");
      break;
    }
    case "forest": {
      speckle(ctx, rnd, w, h, 4200, ["#16220f", "#24351b", "#2b3d20", "#101a0c"], 2, 6, 0.26);
      // moss blobs
      for (let i = 0; i < 60; i++) {
        const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 90;
        plaza(ctx, x, y, r, i % 2 ? "rgba(60,90,40,.14)" : "rgba(20,30,14,.2)");
      }
      // dirt clearing ring at center & points
      for (const p of map.points) plaza(ctx, p.x, p.y, 170, "rgba(120,95,55,.25)");
      speckle(ctx, rnd, w, h, 300, ["#6d8f4f", "#87ad5e"], 1.5, 3.5, 0.35);
      // scattered stones
      speckle(ctx, rnd, w, h, 120, ["#5d644f", "#4a5240"], 2, 5, 0.5);
      break;
    }
    case "hangar": {
      speckle(ctx, rnd, w, h, 2000, ["#1f1f24", "#2d2d33", "#232328"], 2, 4, 0.2);
      // concrete tiles
      ctx.strokeStyle = "rgba(0,0,0,.3)";
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // heli pad
      ctx.strokeStyle = "rgba(255,179,64,.55)";
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(1000, 700, 190, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "700 120px monospace";
      ctx.fillStyle = "rgba(255,179,64,.4)";
      ctx.fillText("H", 960, 738);
      // hazard stripes near machines
      for (const [sx, sy, sw] of [[180, 600, 120], [1700, 600, 120], [880, 600, 240]] as [number, number, number][]) {
        for (let i = 0; i < sw; i += 24) {
          ctx.fillStyle = i % 48 === 0 ? "rgba(255,190,60,.35)" : "rgba(20,20,20,.35)";
          ctx.fillRect(sx + i, sy, 24, 10);
        }
      }
      // oil stains
      for (let i = 0; i < 26; i++) plaza(ctx, rnd() * w, rnd() * h, 20 + rnd() * 50, "rgba(0,0,0,.28)");
      // light pools
      plaza(ctx, 470, 700, 300, "rgba(255,220,150,.06)");
      plaza(ctx, 1530, 700, 300, "rgba(255,220,150,.06)");
      plaza(ctx, 1000, 700, 360, "rgba(255,230,170,.08)");
      break;
    }
  }

  // capture point ground markers
  for (const p of map.points) {
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 14]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 130, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.42)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}
