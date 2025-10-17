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
  { id: 0, key: 'about', title: 'Bullseye Hit', body: `
  <div class="bio bio-pre">
<pre>Hi, here's Bojun,
a person who still carries a few ideals,
not so curious about the world but has clear dream.

I play a little music, enjoy bands and creating.
I host a little known podcast, meaningful sounds energize me.

Software engineering is what I excel at and rely on for a living. Along this path, I've worked for one of the best electronics and software companies on this planet.

I run and act, dream and love.

Welcome.

</pre>
    </div>
  `, links: [] },
  { id: 1, key: 'growing', title: 'Growth', body: `
  <div class="bio bio-pre">
<pre>I'm from China.

I don't speak any dialect other than Mandarin.
I haven't traveled extensively, but I'm a global citizen.

My last educational experience was studying Communications Engineering at JUST, which ended in 2016.

However, true growth is always ongoing.

</pre>
    </div>
  `, links: [] },
  { id: 2, key: 'career', title: 'Career', body: `
  <div class="bio bio-pre">
<pre>

My journey began with an mediocre company.
Thankfully, that was just the first step.

I was fortunate to join Samsung, developing the Galaxy Watch, and later worked on Android system development at OPPO.

Now, I work at Microsoft, delivering Bing (https://play.google.com/store/apps/details?id=com.microsoft.bing) and Copilot (https://play.google.com/store/search?q=Copilot&c=apps).

I'm not a geek or a researcher, but I believe in the value that technology brings to peoples.

</pre>
    </div>
  `, links: [] },
  { id: 3, key: 'music', title: 'Music', body: `
  <div class="bio bio-pre">
<pre>

I used to suffer from severe anxiety disorder.
In that dark moments, music took me out of the haze.

During that period, I started to create some sporadic music and released a not so good EP (https://music.163.com/#/artist?id=34957915).

I know a little guitar and drums, always playing in bands and active in Return True (https://space.bilibili.com/1526622975) music club.

I don't always need music.
But if life gives me a poison, music is my antidote.

</pre>
    </div>
  `, links: [] },
  { id: 4, key: 'podcast', title: 'Sounds', body: `
  <div class="bio bio-pre">
<pre>

During the period of COVID-19,
I began to listen to podcasts.

I gradually realized that I like sound over images,
and felt excited for interesting long content.

After becoming a deep listener of podcasts for a while,
I began to think whether I should have my own podcast and eventually took action.

Welcome to listen Offbeat Life (https://www.ximalaya.com/album/85667561).

</pre>
    </div>
  `, links: [] },
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
