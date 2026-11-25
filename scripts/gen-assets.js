/**
 * 生成项目所需的矢量视觉素材（海报 / 背景图 / 轮播图 / 图标）
 * 运行：node scripts/gen-assets.js
 * 说明：全部为原创 SVG 绘制，无版权风险、无外链依赖，离线可用
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'public', 'assets');
['posters', 'backdrops', 'banners'].forEach((d) => fs.mkdirSync(path.join(OUT, d), { recursive: true }));

/* ------------------------------ 影片配置 ------------------------------ */
const MOVIES = [
  {
    id: 1, title: ['星际迷航', '回声'], en: 'ECHOES OF THE VOID', date: '2026.11.14',
    tag: '科幻 / 冒险', palette: ['#03060f', '#0a1f38', '#12456b'], accent: '#7fe3ff', warm: '#ff9a4d', motif: 'space',
  },
  {
    id: 2, title: ['长安', '诗行'], en: 'POEMS OF CHANGAN', date: '2026.11.08',
    tag: '动画 / 历史', palette: ['#14100b', '#38281a', '#6b4a2c'], accent: '#ffcf8a', warm: '#e8b06a', motif: 'ink',
  },
  {
    id: 3, title: ['暗夜', '追凶'], en: 'NIGHT CHASE', date: '2026.11.18',
    tag: '犯罪 / 悬疑', palette: ['#060709', '#140d12', '#2a1420'], accent: '#ff3b5c', warm: '#ff6b3d', motif: 'noir',
  },
  {
    id: 4, title: ['夏日', '信箱'], en: 'SUMMER MAILBOX', date: '2026.11.01',
    tag: '爱情 / 剧情', palette: ['#0d1b2a', '#2c5f7c', '#e8a87c'], accent: '#ffd9a8', warm: '#ff9e7a', motif: 'summer',
  },
  {
    id: 5, title: ['深蓝', '行动'], en: 'OPERATION DEEP BLUE', date: '2026.11.20',
    tag: '动作 / 战争', palette: ['#04090c', '#0b2430', '#134a56'], accent: '#6ff0d8', warm: '#ffb454', motif: 'sonar',
  },
  {
    id: 6, title: ['猫猫', '特工队'], en: 'PAW AGENTS', date: '2026.11.15',
    tag: '动画 / 喜剧', palette: ['#071b22', '#0f4a55', '#1d7d84'], accent: '#ffe066', warm: '#ff9f68', motif: 'paw',
  },
  {
    id: 7, title: ['时间', '褶皱'], en: 'THE FOLD', date: '2026.12.05',
    tag: '科幻 / 悬疑', palette: ['#0a0614', '#241242', '#4a2a78'], accent: '#c7a4ff', warm: '#67e8f9', motif: 'fold',
  },
  {
    id: 8, title: ['雪国列车', '重启'], en: 'SNOWPIERCER: REBOOT', date: '2026.12.12',
    tag: '剧情 / 灾难', palette: ['#050a10', '#132a3a', '#2a4d63'], accent: '#d9f2ff', warm: '#ffb347', motif: 'snow',
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------ 纹理与光效 ------------------------------ */
function grain(id) {
  return `
  <filter id="grain${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
  </filter>`;
}

function stars(w, h, count, color) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = ((i * 97.13) % w).toFixed(0);
    const y = ((i * 53.77) % h).toFixed(0);
    const r = (0.6 + ((i * 7) % 10) / 10).toFixed(2);
    const o = (0.18 + ((i * 13) % 10) / 22).toFixed(2);
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${o}"/>`;
  }
  return s;
}

/* ------------------------------ 视觉母题 ------------------------------ */
function motifSpace(w, h, m) {
  const cx = w * 0.68;
  const cy = h * 0.34;
  const r = Math.min(w, h) * 0.26;
  return `
  <g>
    ${stars(w, h * 0.9, Math.round(w / 6), '#cfe9ff')}
    <circle cx="${cx}" cy="${cy}" r="${r * 2.5}" fill="url(#glowA)" opacity="0.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#planetA)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.5}" ry="${r * 0.32}" fill="none" stroke="${m.accent}" stroke-width="1.2" opacity="0.55" transform="rotate(-18 ${cx} ${cy})"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.85}" ry="${r * 0.42}" fill="none" stroke="${m.accent}" stroke-width="0.8" opacity="0.28" transform="rotate(-18 ${cx} ${cy})"/>
    <path d="M0 ${h * 0.72} L${w * 0.18} ${h * 0.62} L${w * 0.3} ${h * 0.7} L${w * 0.46} ${h * 0.58} L${w * 0.62} ${h * 0.66} L${w} ${h * 0.5} L${w} ${h} L0 ${h} Z" fill="#02040a" opacity="0.86"/>
    <path d="M0 ${h * 0.78} L${w * 0.2} ${h * 0.7} L${w * 0.38} ${h * 0.78} L${w * 0.55} ${h * 0.68} L${w * 0.72} ${h * 0.76} L${w} ${h * 0.64} L${w} ${h} L0 ${h} Z" fill="#01030a" opacity="0.92"/>
    <circle cx="${w * 0.2}" cy="${h * 0.22}" r="1.8" fill="${m.warm}"/>
    <path d="M${w * 0.2} ${h * 0.22} L${w * 0.26} ${h * 0.3}" stroke="${m.warm}" stroke-width="0.8" opacity="0.6"/>
  </g>`;
}

function motifInk(w, h, m) {
  return `
  <g>
    <circle cx="${w * 0.72}" cy="${h * 0.2}" r="${w * 0.17}" fill="url(#moonA)" opacity="0.92"/>
    <circle cx="${w * 0.72}" cy="${h * 0.2}" r="${w * 0.24}" fill="none" stroke="${m.accent}" stroke-width="0.7" opacity="0.28"/>
    <path d="M0 ${h * 0.58} C${w * 0.2} ${h * 0.4}, ${w * 0.3} ${h * 0.62}, ${w * 0.52} ${h * 0.5} C${w * 0.7} ${h * 0.4}, ${w * 0.86} ${h * 0.56}, ${w} ${h * 0.46} L${w} ${h} L0 ${h} Z" fill="#0c0906" opacity="0.5"/>
    <path d="M0 ${h * 0.7} C${w * 0.18} ${h * 0.58}, ${w * 0.34} ${h * 0.76}, ${w * 0.55} ${h * 0.64} C${w * 0.74} ${h * 0.54}, ${w * 0.9} ${h * 0.7}, ${w} ${h * 0.62} L${w} ${h} L0 ${h} Z" fill="#080604" opacity="0.78"/>
    <path d="M0 ${h * 0.84} C${w * 0.24} ${h * 0.74}, ${w * 0.44} ${h * 0.88}, ${w * 0.66} ${h * 0.78} C${w * 0.84} ${h * 0.7}, ${w * 0.94} ${h * 0.8}, ${w} ${h * 0.78} L${w} ${h} L0 ${h} Z" fill="#050403"/>
    <g opacity="0.5" stroke="${m.accent}" stroke-width="1" fill="none">
      <path d="M${w * 0.16} ${h * 0.16} q${w * 0.05} ${h * 0.04} ${w * 0.02} ${h * 0.09}"/>
      <path d="M${w * 0.22} ${h * 0.12} q${w * 0.05} ${h * 0.05} ${w * 0.03} ${h * 0.11}"/>
    </g>
    <g opacity="0.22" fill="none" stroke="${m.accent}" stroke-width="0.6">
      <circle cx="${w * 0.5}" cy="${h * 0.46}" r="${w * 0.3}"/>
      <circle cx="${w * 0.5}" cy="${h * 0.46}" r="${w * 0.38}"/>
    </g>
  </g>`;
}

function motifNoir(w, h, m) {
  const lines = Array.from({ length: 44 }, (_, i) => {
    const x = (i * 41) % w;
    const y0 = h * 0.35 + ((i * 37) % (h * 0.35));
    return `<line x1="${x}" y1="${y0}" x2="${x - 16}" y2="${y0 + h * 0.18}" stroke="${m.accent}" stroke-width="0.7" opacity="${(0.05 + (i % 5) * 0.03).toFixed(2)}"/>`;
  }).join('');
  return `
  <g>
    <rect x="0" y="${h * 0.56}" width="${w}" height="${h * 0.44}" fill="#05060a" opacity="0.82"/>
    <g>${[0.12, 0.28, 0.44, 0.62, 0.78, 0.9].map((x, i) =>
      `<rect x="${w * x}" y="${h * (0.42 - i * 0.04)}" width="${w * 0.1}" height="${h * 0.34}" fill="#0a0b10" opacity="0.9"/>
       <rect x="${w * (x + 0.012)}" y="${h * (0.46 - i * 0.04)}" width="${w * 0.012}" height="${h * 0.012}" fill="${m.accent}" opacity="0.55"/>`).join('')}
    </g>
    ${lines}
    <circle cx="${w * 0.5}" cy="${h * 0.36}" r="${w * 0.38}" fill="url(#redGlow)" opacity="0.5"/>
    <g fill="#07080c">
      <path d="M${w * 0.42} ${h * 0.72} q${w * 0.02} -${h * 0.18} ${w * 0.05} 0 l${w * 0.02} 0 l0 ${h * 0.12} l-${w * 0.09} 0 Z"/>
      <circle cx="${w * 0.445}" cy="${h * 0.51}" r="${w * 0.022}"/>
    </g>
    <path d="M0 ${h * 0.9} L${w} ${h * 0.86} L${w} ${h} L0 ${h} Z" fill="#05060a"/>
    <rect x="0" y="${h * 0.56}" width="${w}" height="1" fill="${m.accent}" opacity="0.35"/>
  </g>`;
}

function motifSummer(w, h, m) {
  return `
  <g>
    <circle cx="${w * 0.5}" cy="${h * 0.3}" r="${w * 0.2}" fill="url(#sunA)" opacity="0.95"/>
    <rect x="0" y="${h * 0.5}" width="${w}" height="${h * 0.5}" fill="url(#seaA)" opacity="0.85"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="0" y="${h * (0.53 + i * 0.045)}" width="${w}" height="1.2" fill="${m.accent}" opacity="${(0.3 - i * 0.02).toFixed(2)}"/>`).join('')}
    <path d="M${w * 0.14} ${h * 0.5} q${w * 0.36} ${h * 0.06} ${w * 0.72} 0" stroke="${m.accent}" stroke-width="1.4" fill="none" opacity="0.7"/>
    <g opacity="0.9">
      <rect x="${w * 0.62}" y="${h * 0.62}" width="${w * 0.2}" height="${h * 0.13}" fill="#e6d3b8"/>
      <rect x="${w * 0.62}" y="${h * 0.62}" width="${w * 0.2}" height="${h * 0.02}" fill="#b08a63"/>
      <rect x="${w * 0.655}" y="${h * 0.665}" width="${w * 0.11}" height="${h * 0.008}" fill="#8a6b4a" opacity="0.7"/>
      <rect x="${w * 0.62}" y="${h * 0.75}" width="${w * 0.02}" height="${h * 0.06}" fill="#7a5b3c"/>
    </g>
    <g opacity="0.55" fill="${m.accent}">
      <circle cx="${w * 0.2}" cy="${h * 0.24}" r="2"/><circle cx="${w * 0.26}" cy="${h * 0.18}" r="1.4"/>
      <circle cx="${w * 0.32}" cy="${h * 0.26}" r="1.1"/>
    </g>
    <path d="M0 ${h * 0.86} q${w * 0.3} -${h * 0.05} ${w * 0.6} 0 q${w * 0.24} ${h * 0.04} ${w * 0.4} -${h * 0.02} L${w} ${h} L0 ${h} Z" fill="#08131d" opacity="0.9"/>
  </g>`;
}

function motifSonar(w, h, m) {
  const rings = [0.16, 0.26, 0.36, 0.46, 0.56].map((r, i) =>
    `<circle cx="${w * 0.5}" cy="${h * 0.4}" r="${Math.min(w, h) * r}" fill="none" stroke="${m.accent}" stroke-width="${1.6 - i * 0.22}" opacity="${(0.5 - i * 0.08).toFixed(2)}"/>`).join('');
  return `
  <g>
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#deepSea)"/>
    ${rings}
    <path d="M${w * 0.5} ${h * 0.4} L${w} 0 L${w} ${h * 0.16} Z" fill="${m.accent}" opacity="0.07"/>
    <g transform="translate(${w * 0.5} ${h * 0.55})" fill="#04121a">
      <ellipse cx="0" cy="0" rx="${w * 0.17}" ry="${h * 0.045}"/>
      <rect x="-${w * 0.05}" y="-${h * 0.075}" width="${w * 0.075}" height="${h * 0.05}" rx="4"/>
      <rect x="${w * 0.045}" y="-${h * 0.05}" width="${w * 0.045}" height="${h * 0.02}" rx="3"/>
      <path d="M0 -${h * 0.045} l${w * 0.02} -${h * 0.05} l${w * 0.02} ${h * 0.05} Z"/>
    </g>
    ${Array.from({ length: 18 }, (_, i) => `<circle cx="${((i * 71) % w)}" cy="${h * 0.3 + ((i * 47) % (h * 0.5))}" r="${1 + (i % 3) * 0.7}" fill="${m.accent}" opacity="0.18"/>`).join('')}
    <path d="M0 ${h * 0.8} q${w * 0.25} -${h * 0.03} ${w * 0.5} 0 q${w * 0.3} ${h * 0.04} ${w * 0.5} 0 L${w} ${h} L0 ${h} Z" fill="#020a0e" opacity="0.9"/>
  </g>`;
}

function motifPaw(w, h, m) {
  const paw = (x, y, s, color, op) => `
    <g transform="translate(${x} ${y}) scale(${s})" fill="${color}" opacity="${op}">
      <ellipse cx="0" cy="26" rx="30" ry="24"/>
      <ellipse cx="-34" cy="-6" rx="12" ry="16" transform="rotate(-20 -34 -6)"/>
      <ellipse cx="-12" cy="-24" rx="12" ry="17" transform="rotate(-6 -12 -24)"/>
      <ellipse cx="12" cy="-24" rx="12" ry="17" transform="rotate(6 12 -24)"/>
      <ellipse cx="34" cy="-6" rx="12" ry="16" transform="rotate(20 34 -6)"/>
    </g>`;
  return `
  <g>
    <circle cx="${w * 0.28}" cy="${h * 0.24}" r="${w * 0.3}" fill="url(#tealGlow)" opacity="0.55"/>
    ${paw(w * 0.68, h * 0.28, 1.5, m.accent, 0.9)}
    ${paw(w * 0.2, h * 0.62, 0.85, m.warm, 0.5)}
    ${paw(w * 0.8, h * 0.7, 0.65, '#ffffff', 0.18)}
    <g opacity="0.7">
      <circle cx="${w * 0.5}" cy="${h * 0.48}" r="${w * 0.16}" fill="none" stroke="${m.accent}" stroke-width="1" stroke-dasharray="6 10"/>
      <circle cx="${w * 0.5}" cy="${h * 0.48}" r="${w * 0.22}" fill="none" stroke="${m.accent}" stroke-width="0.8" stroke-dasharray="3 12" opacity="0.6"/>
    </g>
    ${Array.from({ length: 12 }, (_, i) => `<circle cx="${((i * 89) % w)}" cy="${h * 0.08 + ((i * 61) % (h * 0.3))}" r="${2 + (i % 3)}" fill="${m.warm}" opacity="0.25"/>`).join('')}
    <path d="M0 ${h * 0.86} q${w * 0.3} -${h * 0.04} ${w * 0.62} 0 q${w * 0.22} ${h * 0.03} ${w * 0.38} -${h * 0.01} L${w} ${h} L0 ${h} Z" fill="#03141a" opacity="0.9"/>
  </g>`;
}

function motifFold(w, h, m) {
  const rings = Array.from({ length: 7 }, (_, i) => {
    const rx = w * (0.06 + i * 0.062);
    const ry = h * (0.03 + i * 0.046);
    return `<ellipse cx="${w * 0.5}" cy="${h * 0.42}" rx="${rx}" ry="${ry}" fill="none" stroke="${m.accent}" stroke-width="${1.3 - i * 0.1}" opacity="${(0.62 - i * 0.07).toFixed(2)}" transform="rotate(${-24 + i * 7} ${w * 0.5} ${h * 0.42})"/>`;
  }).join('');
  return `
  <g>
    ${rings}
    <circle cx="${w * 0.5}" cy="${h * 0.42}" r="${w * 0.03}" fill="${m.accent}" opacity="0.9"/>
    <g opacity="0.14" stroke="${m.accent}" stroke-width="0.5">
      ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${(h * i) / 12}" x2="${w}" y2="${(h * i) / 12}"/>`).join('')}
      ${Array.from({ length: 8 }, (_, i) => `<line x1="${(w * i) / 8}" y1="0" x2="${(w * i) / 8}" y2="${h}"/>`).join('')}
    </g>
    <g opacity="0.22" fill="${m.warm}">
      ${Array.from({ length: 5 }, (_, i) => `<rect x="${w * (0.12 + i * 0.17)}" y="${h * (0.12 + (i % 3) * 0.04)}" width="${w * 0.1}" height="2" transform="skewX(-24)"/>`).join('')}
    </g>
    <path d="M0 ${h * 0.9} L${w} ${h * 0.78} L${w} ${h} L0 ${h} Z" fill="#05030a" opacity="0.92"/>
  </g>`;
}

function motifSnow(w, h, m) {
  return `
  <g>
    <path d="M0 ${h * 0.62} L${w * 0.22} ${h * 0.3} L${w * 0.4} ${h * 0.55} L${w * 0.6} ${h * 0.24} L${w * 0.82} ${h * 0.52} L${w} ${h * 0.36} L${w} ${h} L0 ${h} Z" fill="#0c1d2a" opacity="0.75"/>
    <path d="M0 ${h * 0.78} L${w * 0.26} ${h * 0.52} L${w * 0.46} ${h * 0.72} L${w * 0.66} ${h * 0.48} L${w * 0.88} ${h * 0.7} L${w} ${h * 0.6} L${w} ${h} L0 ${h} Z" fill="#060f16" opacity="0.9"/>
    ${Array.from({ length: 90 }, (_, i) => `<circle cx="${(i * 67.3) % w}" cy="${(i * 41.7) % (h * 0.8)}" r="${(0.8 + (i % 4) * 0.6).toFixed(1)}" fill="#e8f6ff" opacity="${(0.12 + (i % 7) * 0.05).toFixed(2)}"/>`).join('')}
    <g>
      <path d="M${w * 0.5} ${h * 0.72} L${w * 0.5} ${h * 0.84}" stroke="#020608" stroke-width="${w * 0.006}"/>
      <path d="M${w * 0.5} ${h * 0.8} q${w * 0.2} ${h * 0.025} ${w * 0.42} 0" stroke="${m.warm}" stroke-width="2" fill="none" opacity="0.65"/>
      <circle cx="${w * 0.5}" cy="${h * 0.78}" r="${w * 0.012}" fill="${m.warm}" opacity="0.85"/>
      <circle cx="${w * 0.5}" cy="${h * 0.78}" r="${w * 0.05}" fill="${m.warm}" opacity="0.18"/>
    </g>
  </g>`;
}

const MOTIFS = {
  space: motifSpace, ink: motifInk, noir: motifNoir, summer: motifSummer,
  sonar: motifSonar, paw: motifPaw, fold: motifFold, snow: motifSnow,
};

/* ------------------------------ 海报 ------------------------------ */
function poster(m) {
  const W = 600;
  const H = 900;
  const [c0, c1, c2] = m.palette;
  const id = m.id;
  const [line1, line2] = m.title;
  const motif = MOTIFS[m.motif](W, H, m);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg${id}" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c0}"/><stop offset="1" stop-color="#030407"/>
    </linearGradient>
    <linearGradient id="planetA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${m.accent}" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="#04070d"/>
    </linearGradient>
    <radialGradient id="glowA"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.5"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="moonA"><stop offset="0" stop-color="#fff4d6"/><stop offset="0.7" stop-color="${m.accent}" stop-opacity="0.9"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="redGlow"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="seaA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${m.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${c0}"/>
    </linearGradient>
    <linearGradient id="sunA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3d0"/><stop offset="1" stop-color="${m.warm}" stop-opacity="0.45"/>
    </linearGradient>
    <linearGradient id="deepSea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c2}"/><stop offset="0.6" stop-color="${c0}"/><stop offset="1" stop-color="#02080b"/>
    </linearGradient>
    <radialGradient id="tealGlow"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.4"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="0.28" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.62" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0.94"/>
    </linearGradient>
    ${grain(id)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg${id})"/>
  ${motif}
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <rect width="${W}" height="${H}" filter="url(#grain${id})" opacity="0.6"/>

  <g font-family="'Microsoft YaHei','PingFang SC',sans-serif">
    <text x="46" y="62" font-size="15" letter-spacing="7" fill="${m.accent}" opacity="0.9">CINEMAX ORIGINAL</text>
    <line x1="46" y1="80" x2="150" y2="80" stroke="${m.accent}" stroke-width="1" opacity="0.5"/>

    <g fill="#ffffff">
      <text x="42" y="${H - 258}" font-size="92" font-weight="800" letter-spacing="6" style="paint-order:stroke;stroke:#00000055;stroke-width:2">${esc(line1)}</text>
      <text x="42" y="${H - 168}" font-size="92" font-weight="800" letter-spacing="6" style="paint-order:stroke;stroke:#00000055;stroke-width:2">${esc(line2)}</text>
    </g>
    <text x="46" y="${H - 126}" font-size="14" letter-spacing="5" fill="${m.accent}" opacity="0.95">${esc(m.en)}</text>
    <line x1="46" y1="${H - 100}" x2="${W - 46}" y2="${H - 100}" stroke="#ffffff" stroke-width="0.7" opacity="0.25"/>
    <text x="46" y="${H - 72}" font-size="15" fill="#ffffff" opacity="0.78" letter-spacing="2">${esc(m.tag)}</text>
    <text x="${W - 46}" y="${H - 72}" text-anchor="end" font-size="15" fill="${m.accent}" letter-spacing="2">${esc(m.date)} 全国上映</text>
    <text x="46" y="${H - 38}" font-size="12" fill="#ffffff" opacity="0.4" letter-spacing="2">DOLBY ATMOS · IMAX · CINITY</text>
  </g>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="#ffffff" stroke-width="0.6" opacity="0.16"/>
</svg>`;
}

/* ------------------------------ 背景图（详情页 Hero） ------------------------------ */
function backdrop(m) {
  const W = 1600;
  const H = 760;
  const [c0, c1, c2] = m.palette;
  const id = `bd${m.id}`;
  const motif = MOTIFS[m.motif](W, H, m);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="b${m.id}" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="0.5" stop-color="${c0}"/><stop offset="1" stop-color="#020306"/>
    </linearGradient>
    <linearGradient id="fade${m.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#05070c" stop-opacity="0.55"/><stop offset="0.45" stop-color="#05070c" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#05070c" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="left${m.id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#05070c" stop-opacity="0.92"/><stop offset="0.55" stop-color="#05070c" stop-opacity="0.25"/><stop offset="1" stop-color="#05070c" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="planetA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.accent}"/><stop offset="0.6" stop-color="${c2}"/><stop offset="1" stop-color="#04070d"/></linearGradient>
    <radialGradient id="glowA"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.45"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="moonA"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="redGlow"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.5"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="seaA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.5"/><stop offset="1" stop-color="${c0}"/></linearGradient>
    <linearGradient id="sunA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d0"/><stop offset="1" stop-color="${m.warm}" stop-opacity="0.4"/></linearGradient>
    <linearGradient id="deepSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="#02080b"/></linearGradient>
    <radialGradient id="tealGlow"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.4"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    ${grain(id)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#b${m.id})"/>
  ${motif}
  <rect width="${W}" height="${H}" fill="url(#fade${m.id})"/>
  <rect width="${W * 0.7}" height="${H}" fill="url(#left${m.id})"/>
  <rect width="${W}" height="${H}" filter="url(#grain${id})" opacity="0.5"/>
</svg>`;
}

/* ------------------------------ 轮播图 ------------------------------ */
function banner(m, idx) {
  const W = 1600;
  const H = 640;
  const [c0, c1, c2] = m.palette;
  const id = `bn${idx}`;
  const motif = MOTIFS[m.motif](W, H, m);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="gb${idx}" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="0.5" stop-color="${c0}"/><stop offset="1" stop-color="#020307"/>
    </linearGradient>
    <linearGradient id="bl${idx}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#05070b" stop-opacity="0.96"/><stop offset="0.42" stop-color="#05070b" stop-opacity="0.72"/>
      <stop offset="0.72" stop-color="#05070b" stop-opacity="0.12"/><stop offset="1" stop-color="#05070b" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="planetA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.accent}"/><stop offset="0.6" stop-color="${c2}"/><stop offset="1" stop-color="#04070d"/></linearGradient>
    <radialGradient id="glowA"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.5"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="moonA"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="redGlow"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="seaA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${c0}"/></linearGradient>
    <linearGradient id="sunA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d0"/><stop offset="1" stop-color="${m.warm}" stop-opacity="0.45"/></linearGradient>
    <linearGradient id="deepSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="#02080b"/></linearGradient>
    <radialGradient id="tealGlow"><stop offset="0" stop-color="${m.accent}" stop-opacity="0.4"/><stop offset="1" stop-color="${m.accent}" stop-opacity="0"/></radialGradient>
    ${grain(id)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#gb${idx})"/>
  <g transform="translate(${W * 0.18} 0)">${motif}</g>
  <rect width="${W}" height="${H}" fill="url(#bl${idx})"/>
  <rect width="${W}" height="${H}" filter="url(#grain${id})" opacity="0.5"/>
  <rect x="0" y="${H - 4}" width="${W}" height="4" fill="${m.accent}" opacity="0.35"/>
</svg>`;
}

/* ------------------------------ 输出 ------------------------------ */
MOVIES.forEach((m) => {
  fs.writeFileSync(path.join(OUT, 'posters', `p${m.id}.svg`), poster(m));
  fs.writeFileSync(path.join(OUT, 'backdrops', `bd${m.id}.svg`), backdrop(m));
});
[1, 5, 2].forEach((id, i) => {
  const m = MOVIES.find((x) => x.id === id);
  fs.writeFileSync(path.join(OUT, 'banners', `bn${i + 1}.svg`), banner(m, i + 1));
});

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d6d"/><stop offset="1" stop-color="#ffb347"/></linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="#0b0d12"/>
  <path d="M16 20h32a4 4 0 0 1 4 4v6a6 6 0 0 0 0 12v6a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4v-6a6 6 0 0 0 0-12v-6a4 4 0 0 1 4-4z" fill="url(#g)"/>
  <path d="M27 25v14l11-7z" fill="#0b0d12"/>
</svg>`;
fs.writeFileSync(path.join(OUT, 'favicon.svg'), favicon);

console.log('✔ 素材生成完成：8 张海报、8 张背景、3 张轮播、1 个图标 →', OUT);
