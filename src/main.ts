import './styles.css';
import { Dartboard, getModuleByRing } from './dartboard';
import { MODULES } from './modules';

const app = document.getElementById('app')!;
const bgCanvas = document.getElementById('bg') as HTMLCanvasElement;

// Wrapper
const wrapper = document.createElement('div');
wrapper.className = 'dartboard-wrapper';
app.appendChild(wrapper);

// Intro typing + reveal logic
function typeIntro() {
  const el = document.getElementById('intro-text');
  const subtitle = el?.querySelector('#intro-sub') as HTMLElement | null;
  if (!el) return;
  // Stabilize fade-in: ensure initial computed style applied, wait for fonts to avoid layout jump
  el.style.willChange = 'opacity, filter';
  el.style.opacity = '0';
  const activate = () => {
    requestAnimationFrame(()=> {
      el.classList.add('active');
      if (subtitle) subtitle.classList.add('active');
      // re-enable transform animation after first paint
      setTimeout(()=> el.classList.add('enable-transform'), 60);
      // cleanup inline hints after animation starts
      setTimeout(()=> { el.style.willChange=''; el.style.opacity=''; }, 400);
    });
  };
  // Use Font Loading API if available to wait until fonts are ready to prevent flash
  if ((document as any).fonts && 'ready' in (document as any).fonts) {
    (document as any).fonts.ready.then(()=> activate()).catch(()=> activate());
    // Fallback in case fonts promise hangs
    setTimeout(()=> { if(!el.classList.contains('active')) activate(); }, 1200);
  } else {
    // Legacy fallback
    setTimeout(activate, 30);
  }
  const HOLD_DURATION = 2500; // stay visible before lift (updated from 1500ms per request)
  const autoReveal = () => {
    if (document.body.classList.contains('revealed')) return;
    document.body.classList.remove('intro-phase');
    document.body.classList.add('revealed');
    requestAnimationFrame(()=> setTimeout(()=> anchorIntroAboveBoard(), 250));
    setTimeout(()=> wrapper.classList.add('board-visible'), 520);
  };
  setTimeout(autoReveal, HOLD_DURATION);
}

function anchorIntroAboveBoard() {
  const el = document.getElementById('intro-text');
  if (!el) return;
  const boardRect = wrapper.getBoundingClientRect();
  const centerY = window.innerHeight / 2;
  const boardTop = boardRect.top;
  // We want the text to end ABOVE the board with a larger gap (previously +40). Increase gap to 120.
  const GAP = 160; // increased gap to push title higher above board
  // Target Y position for text baseline relative to viewport
  const minTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--intro-min-top')) || 60;
  const targetY = Math.max(minTop, boardTop - GAP);
  // rise offset = distance we need to move from original center to targetY
  const rise = Math.min(centerY - targetY, 400); // allow a bit more max lift for larger screens
  document.documentElement.style.setProperty('--rise-offset', rise + 'px');
  el.classList.add('lifted');
}

window.addEventListener('resize', () => { if (document.body.classList.contains('revealed')) anchorIntroAboveBoard(); }, { passive:true });

// Initialize dartboard
// Defer board creation until after a microdelay so initial layout is stable
const board = new Dartboard({ radius: 500, rings: 6, container: wrapper });
// Interaction gate: block ring activation until initial board animation fully completes
let boardInteractive = false;
function enableBoardInteraction() { boardInteractive = true; }
// Use transitionend (opacity) or fallback timeout (a bit longer than CSS durations)
wrapper.addEventListener('transitionend', (e) => {
  if (!boardInteractive && wrapper.classList.contains('board-visible') && e.propertyName === 'opacity') {
    enableBoardInteraction();
  }
});


// Center overlay disc element
const infoDisc = document.createElement('div');
infoDisc.className = 'info-disc';
infoDisc.setAttribute('role','dialog');
infoDisc.setAttribute('aria-modal','true');
infoDisc.innerHTML = '<div class="disc"><h2></h2><div class="body"></div></div>';
document.body.appendChild(infoDisc);

function showCard(moduleId:number, anchorRing:number, at?: { x:number; y:number }) {
  const mod = MODULES.find(m=>m.id===moduleId);
  if (!mod) return;
  const h2 = infoDisc.querySelector('h2')!;
  const body = infoDisc.querySelector('.body')!;
  if (anchorRing === 0 || anchorRing === 1 || anchorRing === 2) {
    // 展示内容（靶心与第一环）
    h2.textContent = mod.title;
    h2.setAttribute('data-title', mod.title);
    if (mod.title === 'Bullseye Hit!') {
      h2.innerHTML = '<span class="t-bull">Bullseye</span> <span class="t-hit">Hit!</span>';
    } else if (mod.title === 'Growing Up') {
      // Unified gradient across the entire title for harmony
      h2.innerHTML = '<span class="t-grow">Growing Up</span>';
    } else if (mod.title === 'Career') {
      // Dual-color gradient title with halo and separator
      h2.innerHTML = '<span class="t-career">Career</span>';
    }
    body.innerHTML = `${mod.body}${mod.links?'<ul class="links">'+mod.links.map(l=>`<li><a href="${l.url}" target="_blank" rel="noopener">${l.label}</a></li>`).join('')+'</ul>':''}`;
    // Transform preformatted bio into paragraphs and stagger reveal
    try { setupBullseyeParagraphFade(body); } catch {}
    infoDisc.classList.remove('empty');
  } else {
    // 其它环全部清空文字
    h2.textContent = '';
    h2.removeAttribute('data-title');
    body.innerHTML = '';
    infoDisc.classList.add('empty');
  }
  // Add body class for styling and mark visible
  adjustDiscShift();
  document.body.classList.add('disc-open');
  infoDisc.dataset.visible = 'true';
  // 动态强调色：仅基于 ring 序号映射行星主题 (不改变环本身颜色)
  const ringPlanetAccent: Record<number,string> = {
    0: '#58b2ff', // Earth (center disc)
    1: '#e3c15d', // Venus
    2: '#d49b61', // Jupiter
    3: '#c3ccd4', // Mercury
    4: '#e36846', // Mars
    5: '#e1d4b2', // Saturn
    6: '#f0f3f5'  // Moon
  };
  const accent = ringPlanetAccent[anchorRing] || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const discElForAccent = infoDisc.querySelector('.disc') as HTMLElement | null;
  if (discElForAccent) discElForAccent.style.setProperty('--disc-accent', accent);
  // Planet class mapping for full background theme
  const ringPlanetClass: Record<number,string> = {
    0:'earth',1:'venus',2:'jupiter',3:'mercury',4:'mars',5:'saturn',6:'moon'
  };
  if (discElForAccent) {
    // remove previous planet-* classes
    discElForAccent.className = discElForAccent.className.replace(/\bplanet-[a-z]+\b/g,'').trim();
    const planet = ringPlanetClass[anchorRing];
    if (planet) discElForAccent.classList.add(`planet-${planet}`);
  }
  const discEl = infoDisc.querySelector('.disc') as HTMLElement | null;
  if (discEl) {
    discEl.classList.add('animating');
    discEl.setAttribute('data-pop','in');
    // 动画结束后清理标记，避免再次打开时重复抖动
    discEl.addEventListener('animationend', () => {
      discEl.removeAttribute('data-pop');
      discEl.classList.remove('animating');
    }, { once:true });
    // 启用动态光照：监听 pointermove 更新 CSS 变量 --lx/--ly
    enableDiscLighting(discEl);
  }
  // Hide custom dart cursor while disc is open
  document.body.classList.remove('custom-cursor-active');
  // Prevent accidental immediate close by swallowing the originating click
  suppressClickOnce();
  setTimeout(trapFocus, 30);
  injectMiniGameIfNeeded(moduleId);
}

// Transform bullseye preformatted bio into <p> paragraphs and reveal them sequentially
function setupBullseyeParagraphFade(bodyEl: Element) {
  try {
    const bioPre = bodyEl.querySelector('.bio-pre pre') as HTMLElement | null;
    if (!bioPre) return; // already transformed or no bio
    const bio = bioPre.closest('.bio') as HTMLElement | null;
    if (!bio) return;
    const raw = (bioPre.textContent || '').trim();
    if (!raw) { bioPre.parentElement?.remove(); return; }
    // Split by blank lines (>=1 empty line) into paragraphs
    const parts = raw.replace(/\r\n/g, '\n').split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    // Rebuild bio as paragraphs
    bio.innerHTML = '';
    bio.classList.add('fade-paras');
    const paras: HTMLParagraphElement[] = [];
    for (let txt of parts) {
      // Inline-linkify JUST (uppercase word) to official site
      txt = txt.replace(/\bJUST\b/g, '<a class="inline-link" href="https://en.just.edu.cn/" target="_blank" rel="noopener">JUST</a>');
        // Inline-linkify "Label (https://...)" patterns → Only link the capitalized label just before parentheses
        // Examples: Galaxy Watch (url), OPPO (url), Bing (url), Copilot (url)
        txt = txt.replace(/([A-Z][A-Za-z0-9+'’`-]*(?:\s+[A-Z][A-Za-z0-9+'’`-]*)*)\s*\((https?:\/\/[^)]+)\)/g,
          (_m, label, url) => `<a class="inline-link" href="${url}" target="_blank" rel="noopener">${String(label).trim()}</a>`
        );
      const p = document.createElement('p');
      p.innerHTML = txt;
      bio.appendChild(p);
      paras.push(p);
    }
    // Staggered fade-in
  const baseDelay = 300; // ms spacing between paragraphs (slower)
  const startDelay = 420; // ms after disc pop-in begins (slower)
    paras.forEach((p, i) => {
      // ensure start state matches CSS (opacity 0, translated)
      p.classList.remove('is-in');
      setTimeout(() => {
        // small per-paragraph breathing phase offset
        p.style.setProperty('--breath-delay', (i * 0.25).toFixed(2) + 's');
        p.classList.add('is-in');
      }, startDelay + i * baseDelay);
    });
  } catch { /* noop */ }
}

function hideCard() {
  if(!infoDisc.dataset.visible) return;
  const discEl = infoDisc.querySelector('.disc') as HTMLElement | null;
  if (discEl && !discEl.classList.contains('closing')) {
    discEl.classList.remove('animating');
    discEl.classList.add('closing');
    // 在关闭动画结束后再真正隐藏
    const onEnd = (e:AnimationEvent|TransitionEvent) => {
      if (e.type === 'transitionend' && e.target === discEl) {
        discEl.classList.remove('closing');
        delete infoDisc.dataset.visible;
        document.body.classList.remove('disc-open');
        const discEl2 = infoDisc.querySelector('.disc') as HTMLElement | null;
        if (discEl2) discEl2.style.removeProperty('--disc-accent');
  if (discEl2) discEl2.className = discEl2.className.replace(/\bplanet-[a-z]+\b/g,'').trim();
        discEl.removeEventListener('transitionend', onEnd as any);
        disableDiscLighting(discEl);
      }
    };
    discEl.addEventListener('transitionend', onEnd as any);
    // 触发重绘确保 transition 能执行
    discEl.getBoundingClientRect();
    discEl.classList.add('closing');
  } else {
    delete infoDisc.dataset.visible;
    document.body.classList.remove('disc-open');
    const discEl2 = infoDisc.querySelector('.disc') as HTMLElement | null;
    if (discEl2) discEl2.style.removeProperty('--disc-accent');
    if (discEl2) discEl2.className = discEl2.className.replace(/\bplanet-[a-z]+\b/g,'').trim();
    if (discEl2) disableDiscLighting(discEl2);
  }
}

// -------- Dynamic Disc Lighting (pointer-based highlight) --------
let discLightHandler: ((e:PointerEvent)=>void) | null = null;
function enableDiscLighting(disc: HTMLElement) {
  disableDiscLighting(disc); // safety
  const rect = () => disc.getBoundingClientRect();
  discLightHandler = (e:PointerEvent) => {
    const r = rect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    const y = (e.clientY - r.top) / r.height;
    // Clamp & ease toward edge to avoid harsh shift when出界
    const clampedX = Math.min(1, Math.max(0, x));
    const clampedY = Math.min(1, Math.max(0, y));
    // Ease to slightly inward to keep highlight never exactly on rim
    const inward = 0.06;
    const lx = inward + (1 - inward*2) * clampedX;
    const ly = inward + (1 - inward*2) * clampedY;
    disc.style.setProperty('--lx', (lx*100).toFixed(2)+'%');
    disc.style.setProperty('--ly', (ly*100).toFixed(2)+'%');
  };
  window.addEventListener('pointermove', discLightHandler, { passive:true });
  // 初始随机放置在左上或右上，避免正中显得平
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const baseX = side === 'left' ? 0.30 : 0.70; // 更外侧 30% 或 70%
  const baseY = 0.26 + Math.random()*0.04;    // 更高 26%~30%（中心上方，目标 ~28%）
  disc.style.setProperty('--lx', (baseX*100).toFixed(2)+'%');
  disc.style.setProperty('--ly', (baseY*100).toFixed(2)+'%');
  // 同步惯性起点（若 parallax 系统存在）
  if (typeof (discInertial) !== 'undefined') {
    discInertial.x = discInertial.tx = 0.5; // 本体仍以中心为基准移动
  }
  if (typeof (specularState) !== 'undefined') {
    specularState.x = specularState.tx = baseX;
    specularState.y = specularState.ty = baseY;
    specularState.lastMove = performance.now();
    specularState.idle = false;
  }
}
function disableDiscLighting(disc: HTMLElement) {
  if (discLightHandler) {
    window.removeEventListener('pointermove', discLightHandler as any);
    discLightHandler = null;
  }
  disc.style.removeProperty('--lx');
  disc.style.removeProperty('--ly');
}

// ----- Parallax + Active Specular Highlight (Inertial & Idle Drift) -----
let parallaxRAF: number | null = null;
let parallaxDisc: HTMLElement | null = null;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Position state for disc body
const discInertial = { x:0.5, y:0.5, vx:0, vy:0, tx:0.5, ty:0.5 };
// Specular (镜面高光) state
const specularState = { x:0.5, y:0.5, vx:0, vy:0, tx:0.5, ty:0.5, lastMove: performance.now(), idle:false, phase: Math.random()*Math.PI*2 };
function startDiscParallax(disc: HTMLElement) {
  if (prefersReduced) return;
  parallaxDisc = disc;
  const BODY_STRENGTH = 6; // px
  const loop = () => {
    // Disc inertial easing
    discInertial.vx += (discInertial.tx - discInertial.x) * 0.12;
    discInertial.vy += (discInertial.ty - discInertial.y) * 0.12;
    discInertial.vx *= 0.78; discInertial.vy *= 0.78;
    discInertial.x += discInertial.vx; discInertial.y += discInertial.vy;
    // Specular idle drift
    const now = performance.now();
    const IDLE_AFTER = 800;
    const wasIdle = specularState.idle;
    specularState.idle = (now - specularState.lastMove) > IDLE_AFTER;
    if (specularState.idle) {
      specularState.phase += 0.005; // very slow
      const amp = 0.045;
      specularState.tx = 0.5 + Math.cos(specularState.phase)*amp;
      specularState.ty = 0.5 + Math.sin(specularState.phase*1.18)*amp*0.75;
    }
    // Specular inertial chase (slightly snappier)
    specularState.vx += (specularState.tx - specularState.x) * 0.18;
    specularState.vy += (specularState.ty - specularState.y) * 0.18;
    specularState.vx *= 0.80; specularState.vy *= 0.80;
    specularState.x += specularState.vx; specularState.y += specularState.vy;
    if (parallaxDisc) {
      const dx = (discInertial.x - 0.5) * -BODY_STRENGTH;
      const dy = (discInertial.y - 0.5) * -BODY_STRENGTH;
      parallaxDisc.style.setProperty('--parallax-x', dx.toFixed(3)+'px');
      parallaxDisc.style.setProperty('--parallax-y', dy.toFixed(3)+'px');
      parallaxDisc.style.transform = `translateY(var(--disc-shift,0)) translate(${dx.toFixed(3)}px, ${dy.toFixed(3)}px) scale(.74)`;
      const spec = parallaxDisc.querySelector('.specular') as HTMLElement | null;
      if (spec) {
        // Edge fade
        const edgeDist = Math.max(Math.abs(discInertial.x-0.5), Math.abs(discInertial.y-0.5));
        const fade = 1 - edgeDist*1.4;
        spec.classList.toggle('dim', fade < 0.55);
        spec.style.opacity = Math.max(0.4, Math.min(0.9, fade)).toFixed(3);
        spec.style.setProperty('--slx', (specularState.x*100).toFixed(2)+'%');
        spec.style.setProperty('--sly', (specularState.y*100).toFixed(2)+'%');
        if (specularState.idle) {
          const pulse = 1 + Math.sin(specularState.phase*2)*0.05;
          spec.style.setProperty('--specular-gain', pulse.toFixed(3));
        } else if (wasIdle) {
          spec.style.setProperty('--specular-gain', '1');
        }
      }
    }
    parallaxRAF = requestAnimationFrame(loop);
  };
  if (!parallaxRAF) parallaxRAF = requestAnimationFrame(loop);
  window.addEventListener('pointermove', updateParallaxTarget, { passive:true });
}
function stopDiscParallax() {
  if (parallaxRAF) { cancelAnimationFrame(parallaxRAF); parallaxRAF = null; }
  window.removeEventListener('pointermove', updateParallaxTarget as any);
  if (parallaxDisc) {
    parallaxDisc.style.removeProperty('--parallax-x');
    parallaxDisc.style.removeProperty('--parallax-y');
    parallaxDisc.style.transform = 'translateY(var(--disc-shift,0)) scale(.74)';
  }
  parallaxDisc = null;
  discInertial.x = discInertial.y = 0.5; discInertial.tx = discInertial.ty = 0.5; discInertial.vx = discInertial.vy = 0;
  specularState.x = specularState.y = 0.5; specularState.tx = specularState.ty = 0.5; specularState.vx = specularState.vy = 0; specularState.idle=false;
}
function updateParallaxTarget(e:PointerEvent) {
  if (!parallaxDisc) return;
  const r = parallaxDisc.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
  const inward = 0.03;
  discInertial.tx = inward + (1 - inward*2) * Math.min(1, Math.max(0, x));
  discInertial.ty = inward + (1 - inward*2) * Math.min(1, Math.max(0, y));
  const specInward = 0.02;
  specularState.tx = specInward + (1 - specInward*2) * Math.min(1, Math.max(0, x));
  specularState.ty = specInward + (1 - specInward*2) * Math.min(1, Math.max(0, y));
  specularState.lastMove = performance.now();
}

// Click outside disc closes
infoDisc.addEventListener('pointerdown', (e) => {
  if (!(e.target instanceof HTMLElement)) return;
  if (e.target.closest('.disc')) return; // inside
  hideCard();
});

// Utility: suppress one immediate click bubbling (to avoid open->close race)
function suppressClickOnce() {
  // 仅阻止“同一次触发打开”的那一下导致的立即关闭；
  // 不阻止第一次真正点击圆盘内部链接（例如社交 icon）。
  const openerTime = performance.now();
  const handler = (e:MouseEvent) => {
    // 如果点击发生在圆盘内部可交互区域（.disc 内部且是 a / button / .s-icon），允许它正常执行。
    const target = e.target as HTMLElement | null;
    if (target && target.closest('.info-disc .disc')) {
      // 若是可点击元素而且时间已经超过 40ms（避免同一冒泡链），放行并移除拦截。
      if (target.closest('a,button,.s-icon')) {
        if (performance.now() - openerTime > 40) {
          window.removeEventListener('click', handler, true);
          return; // 允许默认行为与跳转
        }
      } else {
        // 非交互元素内部点击：依旧阻止，以免立即关闭
        e.stopPropagation(); e.preventDefault();
        window.removeEventListener('click', handler, true);
        return;
      }
    } else {
      // 圆盘外点击：阻止（避免打开后马上被外层点击关闭）
      e.stopPropagation(); e.preventDefault();
      window.removeEventListener('click', handler, true);
      return;
    }
  };
  window.addEventListener('click', handler, true);
}

// (positionCard / positionCardAt no longer needed for centered disc)

// (Hit marker & calibration removed per latest request)

// Simple WebAudio impact sound (lazy initialized)
let audioCtx: AudioContext | null = null;
let soundEnabled = false; // sound disabled per request
function playImpact() {
  if(!soundEnabled) return;
  try {
  // audio removed
  } catch(e) { /* ignore audio errors */ }
}

// Auto-charge sequence control
let autoChargeInProgress = false;
let pendingCard: { ring:number; x:number; y:number } | null = null;

board.onRing((ring:number, x:number, y:number) => {
  if(!boardInteractive) return;
  if (autoChargeInProgress) return; // ignore if an animation already running
  // 需求：点击任意环都直接打开信息圆盘（包括外围所有 ring）
  const modCfg = MODULES.find(m=>m.id===ring);
  const allowDisc = true; // 全部允许
  autoChargeInProgress = true;
  pendingCard = { ring, x, y };
  playAutoCharge(()=> {
    if (pendingCard) {
      spawnHitMarker(pendingCard.x, pendingCard.y);
      spawnImpactRipple(pendingCard.x, pendingCard.y, 0.9);
      if (allowDisc) {
        const mod = getModuleByRing(pendingCard.ring);
        if (mod) showCard(mod.id, pendingCard.ring, { x: pendingCard.x, y: pendingCard.y });
      }
      playImpact();
    }
    pendingCard = null;
    autoChargeInProgress = false;
  });
});

document.addEventListener('keydown', (e) => {
  if(!boardInteractive) return; // block keyboard activation before animation end
  if (e.key === 'Escape') { hideCard(); return; }
  if (['ArrowRight','ArrowDown'].includes(e.key)) { board.focusNext(1); e.preventDefault(); }
  if (['ArrowLeft','ArrowUp'].includes(e.key)) { board.focusNext(-1); e.preventDefault(); }
  if (e.key === 'Enter' || e.key === ' ') { board.activateFocused(); e.preventDefault(); }
});

window.addEventListener('resize', () => { /* center disc auto-centers via flex */ });
window.addEventListener('resize', () => adjustDiscShift());

function adjustDiscShift() {
  // 目标：让圆盘整体向下覆盖飞镖盘，让上半部分仍保持平衡。我们计算飞镖盘 wrapper 在视口中的中心与视口中心差。
  const boardRect = wrapper.getBoundingClientRect();
  const viewportCenterY = window.innerHeight / 2;
  const boardCenterY = boardRect.top + boardRect.height / 2;
  // shift = (boardCenter - viewportCenter) + 自定义额外下移偏移量（例如再加 4% 高度）
  const baseDelta = boardCenterY - viewportCenterY;
  const extra = boardRect.height * 0.001; // 2% 额外下移（由用户要求）
  const shift = Math.round(baseDelta + extra);
  document.documentElement.style.setProperty('--disc-shift', shift + 'px');
}

// Settings toggle placeholder
// Settings panel removed (sound & contrast toggle)

typeIntro();
setTimeout(()=> document.body.classList.remove('loading'), 1200);
// Fallback: ensure interaction enabled even if transitionend missed (e.g., user reduced motion) after max 3s
setTimeout(()=> { if(!boardInteractive && wrapper.classList.contains('board-visible')) enableBoardInteraction(); }, 3000);

// Global pointerdown capture debug (to diagnose missing inner ring clicks)
if (location.search.includes('debug=1') || localStorage.getItem('dartboard-debug')==='1') {
  window.addEventListener('pointerdown', (e) => {
    try {
      const path = (e.composedPath && e.composedPath()) || [];
      const summary = path.slice(0,8).map(el => {
        if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return String(el);
        const tag = el.tagName.toLowerCase();
        const id = (el as HTMLElement).id ? '#'+(el as HTMLElement).id : '';
        const cls = (el as HTMLElement).className ? '.'+((el as HTMLElement).className+'').trim().replace(/\s+/g,'.') : '';
        return tag+id+cls;
      });
      console.log('[GLOBAL POINTERDOWN]', { target: (e.target as any)?.tagName, summary });
    } catch(err) {
      console.warn('[GLOBAL POINTERDOWN] error', err);
    }
  }, { capture:true });
}

// Background particles (energy dots + radial drift)
interface Particle { x:number; y:number; vx:number; vy:number; r:number; life:number; hue:number; }
// Softened particle visual parameters (reduced intensity)
const PARTICLE_COUNT = 120; // reduced density for subtle presence
const PARTICLE_BASE_R_MIN = 0.55; // slightly smaller
const PARTICLE_BASE_R_RANGE = 1.4; // narrower size variance
const PARTICLE_ALPHA_MULT = 0.38; // lower overall alpha
const ctx = bgCanvas.getContext('2d');
let particles: Particle[] = [];
function initParticles() {
  if (!ctx) return;
  bgCanvas.classList.add('particles');
  resizeCanvas();
  particles = new Array(PARTICLE_COUNT).fill(0).map(()=> spawnParticle());
  requestAnimationFrame(loopParticles);
}
function spawnParticle(): Particle {
  // Uniform full-screen distribution with mild center gravity handled in loop
  const x = Math.random()*innerWidth;
  const y = Math.random()*innerHeight;
  const speed = 0.04 + Math.random()*0.22;
  return {
    x,
    y,
    vx: (Math.random() - .5)*speed,
    vy: (Math.random() - .5)*speed,
    r: PARTICLE_BASE_R_MIN + Math.random()*PARTICLE_BASE_R_RANGE,
    life: 700 + Math.random()*700,
    hue: 200 + Math.random()*80
  };
}
function loopParticles() {
  if (!ctx) return;
  ctx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  ctx.globalCompositeOperation = 'lighter';
  const cx = innerWidth/2, cy = innerHeight/2;
  const maxR = Math.min(innerWidth, innerHeight) * 0.5; // reference radius
  const FADE_START = maxR * 0.40; // start fading earlier
  const FADE_END = maxR * 0.85;   // fully dim sooner
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.life -= 1;
    if (p.life < 0) { Object.assign(p, spawnParticle()); }
    // Mild gravitational pull to center to avoid edge stagnation
    p.vx += (cx - p.x)*0.000015;
    p.vy += (cy - p.y)*0.000015;
    ctx.beginPath();
    const alphaLife = Math.max(0, Math.min(1, p.life/800));
    const dist = Math.hypot(p.x - cx, p.y - cy);
    let radial = 1;
    if (dist > FADE_START) {
      const k = Math.min(1, (dist - FADE_START)/(FADE_END - FADE_START));
      const smooth = k*k*(3 - 2*k); // smoothstep
      radial = 1 - smooth;
      radial = 0.25 + radial * 0.75; // baseline floor 0.25
    }
    // Center emphasis: boost inner 30% radius gradually (ease curve), then normal
  const centerR = maxR * 0.36; // expand center emphasis radius
    let centerBoost = 1;
    if (dist < centerR) {
      const c = 1 - dist / centerR; // 1 at center -> 0 at edge of center zone
      const ease = c*c*(3 - 2*c); // smoothstep
  // Max boost ~2.4 at absolute center tapering to 1 at boundary
  centerBoost = 1 + ease * 1.4;
    }
    const finalAlpha = alphaLife * PARTICLE_ALPHA_MULT * radial * centerBoost * 0.75; // apply center boost
    ctx.fillStyle = `hsla(${p.hue} 65% 58% / ${finalAlpha.toFixed(3)})`;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
  });
  requestAnimationFrame(loopParticles);
}
function resizeCanvas() {
  bgCanvas.width = innerWidth * devicePixelRatio;
  bgCanvas.height = innerHeight * devicePixelRatio;
  bgCanvas.style.width = innerWidth+'px';
  bgCanvas.style.height = innerHeight+'px';
  if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
}
window.addEventListener('resize', resizeCanvas);
initParticles();

// --- Starfield (static + twinkle) layer ---
interface Star { x:number; y:number; r:number; phase:number; speed:number; base:number; tint:number; }
let starCanvas: HTMLCanvasElement | null = null;
let starCtx: CanvasRenderingContext2D | null = null;
let stars: Star[] = [];
const STAR_COUNT = 160; // fewer stars for subtler field
function initStarfield() {
  starCanvas = document.createElement('canvas');
  starCanvas.className = 'starfield-layer';
  document.body.insertBefore(starCanvas, document.body.firstChild); // furthest back
  starCtx = starCanvas.getContext('2d');
  resizeStarCanvas();
  stars = new Array(STAR_COUNT).fill(0).map(()=> spawnStar());
  requestAnimationFrame(loopStars);
}
function resizeStarCanvas() {
  if(!starCanvas) return;
  starCanvas.width = innerWidth * devicePixelRatio;
  starCanvas.height = innerHeight * devicePixelRatio;
  starCanvas.style.width = innerWidth+'px';
  starCanvas.style.height = innerHeight+'px';
  const sc = starCanvas.getContext('2d');
  if (sc) sc.scale(devicePixelRatio, devicePixelRatio);
}
function spawnStar(): Star {
  return {
    x: Math.random()*innerWidth,
    y: Math.random()*innerHeight,
  r: Math.random() < 0.85 ? (0.45 + Math.random()*0.9) : (1.1 + Math.random()*0.8),
    phase: Math.random()*Math.PI*2,
    speed: 0.5 + Math.random()*1.2, // twinkle speed factor
  base: 0.18 + Math.random()*0.40, // lower base brightness
    tint: 190 + Math.random()*80 // bluish to subtle teal range
  };
}
function loopStars() {
  if(!starCtx || !starCanvas) return;
  starCtx.clearRect(0,0,starCanvas.width,starCanvas.height);
  const t = performance.now()/1000;
  for (const s of stars) {
    const twinkle = Math.sin(t * s.speed + s.phase);
  const alpha = s.base + 0.22 * twinkle; // further reduced amplitude
    const a = Math.max(0, Math.min(1, alpha));
  starCtx.fillStyle = `hsla(${s.tint} 70% 68% / ${(a*0.55).toFixed(3)})`;
    starCtx.beginPath();
    starCtx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    starCtx.fill();
    if (s.r > 1.5 && a > 0.80) {
      starCtx.fillStyle = `hsla(${s.tint} 80% 78% / ${(a*0.12).toFixed(3)})`;
      starCtx.beginPath();
      starCtx.arc(s.x, s.y, s.r*2.4, 0, Math.PI*2);
      starCtx.fill();
    }
  }
  requestAnimationFrame(loopStars);
}
window.addEventListener('resize', resizeStarCanvas);
initStarfield();

// --- Custom Interactive Cursor ---
const customCursor = document.createElement('div');
customCursor.className = 'custom-cursor';
// 初始移出视口，防止 (0,0) 闪现；第一次 pointermove 会覆盖 transform
customCursor.style.transform = 'translate(-200px,-200px)';
// Plan C: top-down dart (vertical view) – concentric + fins, no directional rotation tracking
customCursor.innerHTML = '<div class="cc-outer"></div><div class="cc-inner"></div><div class="cc-dart top-view" aria-hidden="true">\n  <svg class="dart-top" viewBox="0 0 100 100" width="54" height="54">\n    <defs>\n      <radialGradient id="dtCore" cx="50%" cy="50%" r="50%">\n        <stop offset="0%" stop-color="#ffe8dd"/>\n        <stop offset="55%" stop-color="#ff9c64"/>\n        <stop offset="100%" stop-color="#ff5a2d"/>\n      </radialGradient>\n      <linearGradient id="dtShaft" x1="0" x2="0" y1="0" y2="1">\n        <stop offset="0%" stop-color="#fff4ee"/>\n        <stop offset="100%" stop-color="#ffc6a2"/>\n      </linearGradient>\n      <linearGradient id="dtFin" x1="0" x2="1" y1="0" y2="0">\n        <stop offset="0%" stop-color="#2d3f54"/>\n        <stop offset="100%" stop-color="#4f6d90"/>\n      </linearGradient>\n    </defs>\n    <!-- four fins -->\n    <path d="M50 6 L60 22 L50 32 L40 22 Z" fill="url(#dtFin)" stroke="#90b4d2" stroke-width="1.2"/>\n    <path d="M94 50 L78 60 L68 50 L78 40 Z" fill="url(#dtFin)" stroke="#90b4d2" stroke-width="1.2"/>\n    <path d="M50 94 L40 78 L50 68 L60 78 Z" fill="url(#dtFin)" stroke="#90b4d2" stroke-width="1.2"/>\n    <path d="M6 50 L22 40 L32 50 L22 60 Z" fill="url(#dtFin)" stroke="#90b4d2" stroke-width="1.2"/>\n    <!-- shaft circle layers -->\n    <circle cx="50" cy="50" r="18" fill="url(#dtShaft)" stroke="#ffe1d1" stroke-width="1.4"/>\n    <circle cx="50" cy="50" r="10" fill="url(#dtCore)" stroke="#ffd2b8" stroke-width="1"/>\n    <circle class="core-glow" cx="50" cy="50" r="4.2" fill="#fff"/>\n  </svg>\n</div>';
document.body.appendChild(customCursor);
let cursorVisible = false;
let cursorDown = false;
let chargeStart = 0; // (legacy) not used for auto mode
let charging = false;
let power = 0; // 0..1
let quickPulseTimeout: number | null = null;
// Track if the first global click (used for reveal) has already happened so we can skip outside halo for that initial interaction
let firstOutsideEffectSkipped = false;
const QUICK_TAP_THRESHOLD = 140; // ms under which we treat as quick tap
const QUICK_PULSE_POWER = 0.35; // mild power level flash
// For Plan C we no longer rotate the dart by movement direction; keep subtle ambient rotation optional (not implemented yet)
let spinStart = performance.now();
function updateDartAmbient() {
  const dartEl = customCursor.querySelector('.cc-dart.top-view') as HTMLElement | null;
  if(!dartEl) return;
  const now = performance.now();
  // Base slow spin: 8 deg per second + extra up to 240 deg/s when fully charged (ease with power^1.5)
  const baseDegPerMs = 8/1000;
  const extraMax = 240/1000; // deg per ms
  const pEase = Math.pow(power, 1.5);
  const rate = baseDegPerMs + extraMax * pEase;
  const angle = (now - spinStart) * rate;
  // Keep scale / press transform layering: apply rotation on inner svg (safer) or on container with existing transform parts.
  // We'll rotate the svg itself to avoid conflicting with press scale/rotateX.
  const svg = dartEl.querySelector('svg.dart-top') as SVGElement | null;
  if (svg) {
    svg.style.transform = `rotate(${angle.toFixed(2)}deg)`;
  }
}
function ambientLoop() {
  updateDartAmbient();
  requestAnimationFrame(ambientLoop);
}
requestAnimationFrame(ambientLoop);

function setPower(p:number) {
  power = Math.max(0, Math.min(1, p));
  customCursor.style.setProperty('--power', power.toFixed(4));
  if (power > 0 && !charging) { charging = true; customCursor.dataset.charging = '1'; }
  if (power === 0 && charging) { charging = false; delete customCursor.dataset.charging; }
}

function playAutoCharge(finalCb:()=>void) {
  // Timeline segments (ms): charge rise, pre-overshoot (slight enlarge), shrink, hold-min pause, dissipate
  const start = performance.now();
  const riseDur = 140;          // power build
  const overshootDur = 70;      // small enlarge anticipation
  const shrinkDur = 180;        // rapid shrink to min
  const holdMinDur = 30;        // pause at minimum (user requested 30ms)
  const dissipateDur = 80;      // fade / blur return window while staying small (power falls)
  const peakPower = 0.95;
  const total = riseDur + overshootDur + shrinkDur + holdMinDur + dissipateDur;
  // We'll also shrink the dart (scale 1 -> .35) over the whole timeline to simulate release
  const dart = customCursor.querySelector('.cc-dart.top-view') as HTMLElement | null;
  const outer = customCursor.querySelector('.cc-outer') as HTMLElement | null;
  const inner = customCursor.querySelector('.cc-inner') as HTMLElement | null;
  let shockwaveSpawned = false;
  function spawnShockwave() {
    if(!dart) return;
    const wave = document.createElement('div');
    wave.className = 'throw-shockwave';
    dart.appendChild(wave);
    // Remove after animation
    setTimeout(()=> wave.remove(), 500);
  }
  function frame(now:number) {
    const t = now - start;
    let phasePower = 0;
    // 1. Rise power
    if (t < riseDur) {
      const k = t / riseDur;
      phasePower = peakPower * (1 - Math.pow(1-k, 2.2));
    }
    // 2. Overshoot (hold near peak)
    else if (t < riseDur + overshootDur) {
      const k = (t - riseDur)/overshootDur;
      phasePower = peakPower * (0.92 + 0.08 * (1 - Math.pow(1-k,1.4))); // gentle near-constant
    }
    // 3. Shrink (power starts dropping slightly)
    else if (t < riseDur + overshootDur + shrinkDur) {
      const k = (t - riseDur - overshootDur)/shrinkDur;
      phasePower = peakPower * (1 - 0.25*k); // drop 25%
    }
    // 4. Hold min (power low plateau)
    else if (t < riseDur + overshootDur + shrinkDur + holdMinDur) {
      phasePower = peakPower * 0.65;
    }
    // 5. Dissipate (power goes to 0)
    else if (t < total) {
      const k = (t - (total - dissipateDur))/dissipateDur;
      phasePower = peakPower * 0.65 * (1 - k);
    } else {
      // finished
      setPower(0);
      if (dart) {
        dart.style.transform = 'translate(-50%, -50%) scale(1)';
        dart.style.filter = '';
        dart.style.opacity = '';
      }
      if (outer) outer.style.transform = '';
      if (inner) { inner.style.transform = ''; inner.style.opacity=''; }
      finalCb();
      return;
    }
    setPower(phasePower);
    // Compute a unified progress for scaling & visual effects up to shrink end
    const shrinkPhaseStart = riseDur + overshootDur;
    const shrinkPhaseEnd = riseDur + overshootDur + shrinkDur;
    let shrinkProgress = 0;
    if (t >= shrinkPhaseStart) {
      shrinkProgress = Math.min(1, (t - shrinkPhaseStart) / (shrinkDur));
    }
    // Overshoot scale (slight enlargement 1 -> 1.08 then into shrink curve)
    const overshootProgress = Math.min(1, t / (riseDur + overshootDur));
    const overshootScale = 1 + 0.08 * Math.sin(Math.PI * Math.min(1, Math.max(0,(t - riseDur)/overshootDur)) * 0.5); // gentle bump
    // Shrink target scales
    const targetDartMin = 0.2;
    const targetOuterMin = 0.35;
    const targetInnerMin = 0.1;
    const shrinkEase = 1 - Math.pow(1 - shrinkProgress, 1.65);
    const dartScale = (t < shrinkPhaseStart) ? overshootScale : 1 - (1 - targetDartMin) * shrinkEase;
    const outerScale = (t < shrinkPhaseStart) ? overshootScale : 1 - (1 - targetOuterMin) * shrinkEase;
    const innerScale = (t < shrinkPhaseStart) ? overshootScale : 1 - (1 - targetInnerMin) * shrinkEase;
    if (dart) {
      dart.style.transform = `translate(-50%, -50%) scale(${dartScale.toFixed(3)})`;
      // Fade + blur as it shrinks (during shrink + hold + dissipate)
      if (t >= shrinkPhaseStart) {
        const fadeBase = dartScale / 1; // smaller => more fade
        const opacity = 0.25 + fadeBase * 0.75; // 1 ->1, min->~0.25
        const blur = (1 - fadeBase) * 3.2; // up to ~3.2px
        dart.style.opacity = opacity.toFixed(3);
        dart.style.filter = `drop-shadow(0 0 4px rgba(0,0,0,0.55)) blur(${blur.toFixed(2)}px)`;
      } else {
        dart.style.opacity = '1';
        dart.style.filter = 'drop-shadow(0 0 4px rgba(0,0,0,0.55))';
      }
    }
    if (outer) outer.style.transform = `scale(${outerScale.toFixed(3)})`;
    if (inner) {
      inner.style.transform = `scale(${innerScale.toFixed(3)})`;
      if (t >= shrinkPhaseStart) {
        inner.style.opacity = (0.2 + innerScale*0.8).toFixed(3);
      } else inner.style.opacity = '1';
    }
    // Spawn shockwave exactly once when hitting minimum (start of hold phase)
    const holdStart = riseDur + overshootDur + shrinkDur;
    if (!shockwaveSpawned && t >= holdStart) {
      shockwaveSpawned = true;
      spawnShockwave();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function chargeLoop() {
  if (cursorDown) {
    const now = performance.now();
    const elapsed = now - chargeStart;
    // Ease-out curve for power accumulation (up to ~1100ms)
    const dur = 1100;
    const raw = Math.min(1, elapsed / dur);
    const eased = 1 - Math.pow(1 - raw, 2.2); // quadratic-ish ease-out
    setPower(eased);
    requestAnimationFrame(chargeLoop);
  }
}

// --- Board-relative coordinate helpers (normalize to wrapper rect) ---
function normalizeToBoard(x:number, y:number) {
  const rect = wrapper.getBoundingClientRect();
  return { nx: (x - rect.left) / rect.width, ny: (y - rect.top) / rect.height };
}
function absoluteFromNormalized(nx:number, ny:number) {
  const rect = wrapper.getBoundingClientRect();
  return { x: nx * rect.width, y: ny * rect.height };
}

function spawnImpactRipple(x:number, y:number, pwr:number) {
  const { nx, ny } = normalizeToBoard(x,y);
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return; // outside board: ignore
  const ripple = document.createElement('div');
  ripple.className = 'impact-ripple-top';
  const scale = 2 + pwr * 2.6; // max ripple size based on power
  const abs = absoluteFromNormalized(nx, ny);
  ripple.style.left = abs.x + 'px';
  ripple.style.top = abs.y + 'px';
  ripple.style.setProperty('--final-scale', scale.toFixed(2));
  const activeRing = document.querySelector('svg.dartboard .ring[data-active="true"]');
  if (activeRing) {
    const tone = (activeRing as HTMLElement).getAttribute('data-tone');
    if (tone) ripple.dataset.tone = tone;
  }
  wrapper.appendChild(ripple);
  setTimeout(()=> ripple.remove(), 600);
}

// spawnImpactFlash removed

// Persistent hit markers (capped)
const HIT_MARKER_LIMIT = 26;
let hitMarkers: { el:HTMLElement; nx:number; ny:number }[] = [];
function repositionMarkers() {
  const rect = wrapper.getBoundingClientRect();
  hitMarkers.forEach(m => {
    const abs = absoluteFromNormalized(m.nx, m.ny);
    m.el.style.left = abs.x + 'px';
    m.el.style.top = abs.y + 'px';
  });
}
window.addEventListener('resize', repositionMarkers);
function spawnHitMarker(x:number, y:number) {
  const { nx, ny } = normalizeToBoard(x,y);
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
  const mk = document.createElement('div');
  mk.className = 'hit-marker';
  const abs = absoluteFromNormalized(nx, ny);
  mk.style.left = abs.x + 'px';
  mk.style.top = abs.y + 'px';
  wrapper.appendChild(mk);
  requestAnimationFrame(()=> mk.dataset.ready = '1');
  hitMarkers.push({ el: mk, nx, ny });
  if (hitMarkers.length > HIT_MARKER_LIMIT) {
    const old = hitMarkers.shift();
    if (old) old.el.remove();
  }
}

// Outside area click visual feedback (halo + particle burst)
function spawnOutsideHalo(x:number, y:number) {
  const halo = document.createElement('div');
  halo.className = 'outside-click-halo';
  halo.style.left = x + 'px';
  halo.style.top = y + 'px';
  document.body.appendChild(halo);
  setTimeout(()=> halo.remove(), 800);
}

function spawnOutsideBurst(x:number, y:number) {
  const COUNT = 14;
  for (let i=0;i<COUNT;i++) {
    const p = document.createElement('div');
    p.className = 'outside-burst-particle';
    const ang = Math.random()*Math.PI*2;
    const dist = 40 + Math.random()*70; // travel distance
    const tx = Math.cos(ang)*dist;
    const ty = Math.sin(ang)*dist;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.setProperty('--tx', tx.toFixed(2)+'px');
    p.style.setProperty('--ty', ty.toFixed(2)+'px');
    p.style.setProperty('--delay', (Math.random()*0.02).toFixed(3)+'s');
    p.style.opacity = (0.65 + Math.random()*0.35).toFixed(2);
    // slight variation in size & hue
    const size = 4 + Math.random()*4;
    p.style.width = size+'px';
    p.style.height = size+'px';
    p.style.margin = (-size/2)+'px 0 0 '+(-size/2)+'px';
    document.body.appendChild(p);
    setTimeout(()=> p.remove(), 900);
  }
}

function showCustomCursor() {
  if (!cursorVisible) {
    document.body.classList.add('custom-cursor-active');
    cursorVisible = true;
  }
}

function updateCursorPosition(e: PointerEvent) {
  customCursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
}

window.addEventListener('pointermove', (e) => {
  if(!document.body.classList.contains('revealed')) return;
  if (!document.body.classList.contains('disc-open')) {
    showCustomCursor();
  } else if (cursorVisible) {
    document.body.classList.remove('custom-cursor-active');
    cursorVisible = false;
  }
  if (cursorVisible) updateCursorPosition(e);
});
// Replace manual hold with automatic scripted charge on click release inside board
window.addEventListener('pointerdown', () => {
  if(!cursorVisible || document.body.classList.contains('disc-open')) return;
  customCursor.dataset.state = 'down';
});
window.addEventListener('pointerup', (e) => {
  if(!cursorVisible) return;
  delete customCursor.dataset.state;
  // We no longer trigger charge here; board.onRing handles the sequence
});
// Outside-board click detection (use pointerup so position stable). Trigger halo + burst when not clicking dartboard or info disc.
window.addEventListener('click', (e) => {
  if(!document.body.classList.contains('revealed')) return;
  if (document.body.classList.contains('disc-open')) return; // suppressed while disc open
  const target = e.target as HTMLElement | null;
  if (target && (target.closest('.dartboard-wrapper') || target.closest('svg.dartboard'))) return; // board click handled elsewhere
  // Skip the very first outside click effect after reveal (用户需求："在首页第一次点击不要这个效果")
  if (!firstOutsideEffectSkipped) { firstOutsideEffectSkipped = true; return; }
  const x = e.clientX; const y = e.clientY;
  spawnOutsideHalo(x,y);
  spawnOutsideBurst(x,y);
}, { capture:false });
window.addEventListener('pointerleave', (e) => {
  // Only hide when leaving window entirely
  if ((e as PointerEvent).relatedTarget == null) {
    if(cursorVisible) {
      document.body.classList.remove('custom-cursor-active');
      cursorVisible = false;
      cursorDown = false;
      setPower(0);
    }
  }
});

// Ring proximity highlight: listen for active ring change by mutation observer on svg (data-active attributes)
const svgBoard = document.querySelector('svg.dartboard');
if (svgBoard) {
  const mo = new MutationObserver(()=> {
    const active = svgBoard.querySelector('.ring[data-active="true"]');
    if (active) {
      customCursor.setAttribute('data-active-ring', '1');
    } else {
      customCursor.removeAttribute('data-active-ring');
    }
  });
  mo.observe(svgBoard, { attributes:true, subtree:true, attributeFilter:['data-active'] });
}

// Re-enable ring label scrolling
// Removed scrolling labels; labels now static occupying ~half circumference.
// New: smooth continuous scroll for half-span labels (option A)
function animateHalfSpanLabels() {
  const svg = document.querySelector('svg.dartboard');
  if(!svg) return;
  const tps = Array.from(svg.querySelectorAll<SVGTextPathElement>('textPath[data-partial="1"][data-span-length][data-circumference]'));
  if(!tps.length) { requestAnimationFrame(()=> animateHalfSpanLabels()); return; }
  interface Item { tp:SVGTextPathElement; span:number; circ:number; dir:number; speed:number; init:number; }
  const items:Item[] = tps.map((tp,idx)=> ({
    tp,
    span: parseFloat(tp.getAttribute('data-span-length')||'0'),
    circ: parseFloat(tp.getAttribute('data-circumference')||'0'),
    dir: idx % 2 === 0 ? 1 : -1,
  speed: 4 + idx*0.9, // reduced speed for calmer quarter-span scroll
    init: Math.random() // random initial phase 0-1
  })).filter(it=> it.span>0 && it.circ>0);
  if(!items.length) return;
  const start = performance.now();
  function frame(now:number) {
    const t = (now - start)/1000;
    items.forEach(it => {
      const loop = it.circ;
      const px = (it.init*loop + t * it.speed * it.dir) % loop;
      const norm = px < 0 ? px + loop : px;
      const pct = (norm / it.circ) * 100;
      it.tp.setAttribute('startOffset', pct.toFixed(3)+'%');
      // Seam blur removed per user request (keep only smooth random-offset scroll)
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(()=> animateHalfSpanLabels());

// (Removed mobile bottom navigation bar per request)

// Info disc focus trap & initial focus
function trapFocus() {
  if(!infoDisc.dataset.visible) return;
  const heading = infoDisc.querySelector('h2');
  // Collect focusables but move social icons (.s-icon) to the end so first focus isn't LinkedIn.
  const all = Array.from(infoDisc.querySelectorAll<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])'));
  const social = all.filter(el => el.classList.contains('s-icon'));
  const nonSocial = all.filter(el => !el.classList.contains('s-icon'));
  const focusables = [...nonSocial, ...social];
  if (heading instanceof HTMLElement) {
    heading.setAttribute('tabindex','-1');
    heading.focus({ preventScroll:true });
  } else if (focusables.length) {
    focusables[0].focus({ preventScroll:true });
  }
  if (!focusables.length) return;
  function handle(e:KeyboardEvent) {
    if(e.key==='Tab') {
      const first = focusables[0]; const last = focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); (last as HTMLElement).focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); (first as HTMLElement).focus(); }
    }
    if(e.key==='Escape') { hideCard(); }
  }
  infoDisc.addEventListener('keydown', handle, { once:false });
}
// showCard already handles focus + mini-game injection

// Easter egg mini game injection when ring 10 card opens
function injectMiniGameIfNeeded(moduleId:number) {
  if (moduleId !== 10) return;
  const body = infoDisc.querySelector('.body');
  if (!body || body.querySelector('.mini-game')) return;
  const wrap = document.createElement('div');
  wrap.className = 'mini-game';
  wrap.innerHTML = '<div class="score">Score: <span class="s">0</span></div><canvas width="300" height="300"></canvas><button class="throw">Throw</button>';
  body.appendChild(wrap);
  const cvs = wrap.querySelector('canvas')!; const cctx = cvs.getContext('2d')!; const scoreEl = wrap.querySelector('.s')!; const btn = wrap.querySelector('.throw')! as HTMLButtonElement;
  let score=0; let animId:number; let target = { x:150, y:150, r:12 };
  function drawTarget() {
    cctx.clearRect(0,0,300,300);
    for (let i=5;i>0;i--) { cctx.beginPath(); cctx.arc(target.x, target.y, target.r*i, 0, Math.PI*2); cctx.fillStyle = `hsla(${200+i*20} 60% ${20+i*8}% / 0.5)`; cctx.fill(); }
  }
  drawTarget();
  btn.addEventListener('click', ()=> {
    // simulate throw with random deviation
    const dev = () => (Math.random()-0.5)*40;
    const hit = { x: target.x + dev(), y: target.y + dev() };
    cctx.beginPath(); cctx.arc(hit.x, hit.y, 4, 0, Math.PI*2); cctx.fillStyle='#ff9460'; cctx.fill();
    const dist = Math.hypot(hit.x-target.x, hit.y-target.y);
    const gained = Math.max(0, Math.round(50 - dist));
    score += gained; (scoreEl as HTMLElement).textContent = String(score);
  });
}

// Hook into board ring activation to inject mini-game
// Removed legacy re-subscribe logic; unified above listener now handles everything
