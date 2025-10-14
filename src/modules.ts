export interface ModuleContent {
  id: number;
  key: string;
  title: string;
  short?: string;
  body: string;
  links?: { label: string; url: string }[];
  accent?: string;
  hidden?: boolean;
  // Whether clicking this ring is allowed to open the info disc (bullseye always true in logic)
  openDisc?: boolean; // default false for rings > 0; can be toggled via runtime config
}

export const MODULES: ModuleContent[] = [
  { id: 0, key: 'about', title: 'Bullseye Hit!', body: `
  <div class="bio bio-pre">
<pre>Hi, I'm Bojun Chai.

A person who still carries a few ideals,
who is not so curious about the world but has clear dream.

I play a little music, enjoy bands and creation. I host a little‑known podcast, meaningful sounds energize me.

Software engineering is what I excel at and what I rely on for a living. Along this path, I have worked for the world's largest consumer electronics and computer software companies.

Welcome.

</pre>
    </div>
  `, links: [] },
  { id: 1, key: 'career', title: '职业经历 · Career', body: '时间线：公司 / 角色 / 影响力（占位）。', links: [] },
  { id: 2, key: 'projects', title: '项目作品 · Projects', body: '展示代表性项目与仓库链接。', links: [{label:'GitHub', url:'https://github.com/'}] },
  { id: 3, key: 'tech', title: '技术栈 · Tech Stack', body: '精通 / 熟悉 / 了解：以图标或标签形式（占位）。' },
  { id: 4, key: 'blog', title: '博客 · Blog', body: '最近文章列表或外部博客入口。', links:[{label:'Blog', url:'#'}] },
  { id: 5, key: 'photo', title: '摄影 · Photography', body: '精选照片或社交平台链接。', links:[{label:'Instagram', url:'#'}] },
  { id: 6, key: 'interests', title: '兴趣 · Interests', body: '阅读 / 跑步 / 音乐 / 旅行 等（占位）。' },
  { id: 7, key: 'talks', title: '演讲与活动 · Talks', body: '演讲、Slides、视频链接（占位）。' },
  { id: 8, key: 'resume', title: '简历 · Resume', body: '下载 PDF 或在线简历链接。', links:[{label:'Download PDF', url:'#'}] },
  { id: 9, key: 'contact', title: '联系 · Contact', body: 'Email / 微信 / Twitter / LinkedIn（占位）。' },
  { id: 10, key: 'easter', title: '彩蛋 · Easter Egg', body: '隐藏趣味互动：小游戏 / 随机语录 / 彩蛋指令。', hidden:true }
];

// Initialize per-ring disc-open config (excluding bullseye which is always allowed in code):
// You can toggle at runtime via: window.setRingOpen(3,true) and it will persist in localStorage.
const RING_OPEN_KEY = 'ring-open-config-v1';
type RingOpenMap = { [ring:number]: boolean };
function loadRingOpen(): RingOpenMap {
  try {
    const raw = localStorage.getItem(RING_OPEN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}
function saveRingOpen(map:RingOpenMap) {
  try { localStorage.setItem(RING_OPEN_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}
const ringOpenMap = loadRingOpen();
// Apply stored flags into MODULES (skip id 0)
MODULES.forEach(m => { if (m.id>0 && ringOpenMap[m.id]) m.openDisc = true; });

// Expose helpers for console usage
declare global { interface Window { setRingOpen?: (ring:number, open:boolean)=>void; listRingOpen?: ()=>void; } }
if (typeof window !== 'undefined') {
  window.setRingOpen = (ring:number, open:boolean) => {
    if (ring<=0) { console.warn('Bullseye is always open by default; no need to set.'); }
    ringOpenMap[ring] = open;
    if (!open) delete ringOpenMap[ring];
    saveRingOpen(ringOpenMap);
    const mod = MODULES.find(m=>m.id===ring);
    if (mod) mod.openDisc = open;
    console.log('[RingOpen] ring', ring, '=>', open);
  };
  window.listRingOpen = () => {
    console.table(MODULES.filter(m=>m.id>0).map(m=> ({ ring:m.id, open: !!m.openDisc, key:m.key, title:m.title })));
  };
}
