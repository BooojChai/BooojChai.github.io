import { MODULES, ModuleContent } from './modules';

interface DartboardOptions { radius: number; rings: number; container: HTMLElement; }

export class Dartboard {
  private svg: SVGSVGElement;
  private opt: DartboardOptions;
  private activeRing: number | null = null;
  private listeners: { ring: (idx:number, x:number, y:number)=>void } = { ring: () => {} };
  private focusRing: number = 0;
  private radii: number[] = []; // store outer radii per ring index (0 center .. n outer)

  constructor(opt: DartboardOptions) {
    this.opt = opt;
  this.svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  this.svg.classList.add('dartboard');
  // Add a small padding around the logical board so that outer ring strokes & glow are not clipped.
  // Previously the outer circle radius exactly touched the viewBox edge (0..radius*2) so stroke (≈5px) was cut.
  const pad = Math.max(6, opt.radius * 0.012); // ~1.2% radius or minimum 6px
  const full = opt.radius * 2;
  this.svg.setAttribute('viewBox', `${-pad} ${-pad} ${full + pad*2} ${full + pad*2}`);
    opt.container.appendChild(this.svg);
    this.draw();
    this.bind();
  }

  onRing(cb:(idx:number, x:number, y:number)=>void) { this.listeners.ring = cb; }

  private draw() {
    const { radius, rings } = this.opt;
  const group = document.createElementNS('http://www.w3.org/2000/svg','g');
  // Because we padded the viewBox, origin (0,0) is now shifted by -pad, so translate by radius to center.
  group.setAttribute('transform', `translate(${radius},${radius})`);

    // Red core + alternating white / black outward (0..6 used)
    const palette = [
      { fill:'#c40020', stroke:'#ff4a5e' }, // 0 red core
      { fill:'#ffffff', stroke:'#d4d4d4' }, // 1 white
      { fill:'#060606', stroke:'#2a2a2a' }, // 2 black
      { fill:'#ffffff', stroke:'#d4d4d4' }, // 3 white
      { fill:'#060606', stroke:'#2a2a2a' }, // 4 black
      { fill:'#ffffff', stroke:'#d4d4d4' }, // 5 white
      { fill:'#060606', stroke:'#2a2a2a' }, // 6 black (outermost used)
      // reserves
      { fill:'#ffffff', stroke:'#d4d4d4' }, // 7
      { fill:'#060606', stroke:'#2a2a2a' }, // 8
      { fill:'#ffffff', stroke:'#d4d4d4' }, // 9
      { fill:'#060606', stroke:'#2a2a2a' }  // 10
    ];
    // Define labels for 7 rings (0 center to 6 outer)
    const labels = [
      'CORE · IDENTITY · PURPOSE · ',
      'FOCUS · ATTENTION · DEPTH · ',
      'LEARNING · GROWTH · ITERATION · ',
      'CREATIVITY · DESIGN · AESTHETICS · ',
      'SYSTEMS · ARCHITECTURE · STRUCTURE · ',
      'EXECUTION · SHIPPING · IMPACT · ',
      'REFLECTION · ADAPTATION · BALANCE · '
    ];

    // Recompute radii so that core is a smaller fixed fraction and remaining rings share equal thickness.
    const CORE_FRACTION_OF_TOTAL = 0.12; // core radius relative to total board radius
    const coreRadius = radius * CORE_FRACTION_OF_TOTAL;
    const remainingRings = rings; // rings 1..rings
    const ringThickness = (radius - coreRadius) / remainingRings;
    for (let i = rings; i >= 0; i--) {
      let rOuter: number;
      if (i === 0) {
        rOuter = coreRadius; // smallest core
      } else {
        rOuter = coreRadius + ringThickness * i; // uniform thickness increments
      }
      this.radii[i] = rOuter;
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('r', rOuter.toFixed(2));
      circle.dataset['ring'] = String(i);
      circle.classList.add('ring');
      const sw = Math.max(1.2, radius*0.0105);
      const { fill, stroke } = palette[i] || palette[palette.length-1];
      circle.setAttribute('fill', fill);
      circle.setAttribute('stroke', stroke);
      circle.setAttribute('stroke-width', sw.toString());
      circle.setAttribute('stroke-opacity','0.9');
      // Tag tone for differential hover/active styling: center red, alternating white/black outward
      if (i === 0) {
        circle.dataset['tone'] = 'red';
      } else if (fill === '#ffffff') {
        circle.dataset['tone'] = 'light';
      } else if (fill === '#060606') {
        circle.dataset['tone'] = 'dark';
      }
      group.appendChild(circle);

      // Add scrolling label text on ring (skip center 0 for clarity if too tight)
      if (i > 0) {
        const pathId = `ring-path-${i}`;
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        const rMid = rOuter - ((radius / (rings+1)) * 0.5); // mid of band
        path.setAttribute('id', pathId);
        path.setAttribute('d', describeCircle(0,0, rMid));
        path.setAttribute('fill','none');
        group.appendChild(path);

        const text = document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('class','ring-label');
        text.setAttribute('aria-hidden','true');
  const textPath = document.createElementNS('http://www.w3.org/2000/svg','textPath');
  textPath.setAttribute('href', `#${pathId}`);
  const unit = labels[i].trim().replace(/\s+/g,' ');
  // Build repeated string until rendered length >= 0.55 * circumference (half + small buffer)
  // We cannot measure before element is in DOM; temporarily set base then extend after append in a microtask.
  textPath.textContent = unit;
  textPath.dataset.base = unit;
  textPath.dataset.partial = '1'; // mark for half-circle smooth scroll
  textPath.setAttribute('startOffset','0%');
        // Tag tone only (do not set fill here; CSS will handle transparency & contrast)
        if (i % 2 === 1) {
          textPath.dataset['tone'] = 'light-base';
        } else {
          textPath.dataset['tone'] = 'dark-base';
        }
        text.appendChild(textPath);
        group.appendChild(text);
      }
    }

    // bullseye inner highlight
    const bull = document.createElementNS('http://www.w3.org/2000/svg','circle');
    bull.setAttribute('r', (radius/(rings+1)*0.55).toFixed(2));
    bull.setAttribute('fill', 'radial-gradient(#fff,#000)');

    this.svg.appendChild(group);
    // After appended, measure each partial and expand to target length (~55% circumference)
    queueMicrotask(()=> {
  const partials = this.svg.querySelectorAll('textPath[data-partial="1"]');
  // Remove any inline fill attributes (if legacy code added them before this patch) so CSS can control opacity
  partials.forEach(tp => { if (tp.hasAttribute('fill')) tp.removeAttribute('fill'); });
      partials.forEach(tp => {
        try {
          const href = tp.getAttribute('href');
          if(!href) return;
          const path = this.svg.querySelector<SVGPathElement>(href);
          if(!path || !path.getTotalLength) return;
          const circ = path.getTotalLength();
          const target = circ * 0.25; // quarter span target
          const baseRaw = (tp as SVGTextPathElement).dataset.base || '';
          const sep = ' · ';
          // Split on existing bullet separators ignoring surrounding spaces; drop empties
          const words = baseRaw.split(/\s*·\s*/).map(w=>w.trim()).filter(Boolean);
          // Build normalized cycle with exactly one separator between words
          const cycle = words.map(w=> w.toUpperCase()).join(sep) + sep; // trailing sep for loop concatenation
          let current = '';
          let len = 0;
          let safety = 0;
          while(len < target && safety < 80) {
            current += cycle; // append full cycle
            (tp as any).textContent = current.trimEnd();
            len = (tp as unknown as SVGTextContentElement).getComputedTextLength();
            safety++;
          }
          // Now trim trailing separator if it causes an orphan
          // Ensure no double separators (we always used cycle pattern so none expected) and no trailing bare separator
          if(current.endsWith(sep)) {
            current = current.slice(0, -sep.length); // remove trailing sep
            (tp as any).textContent = current;
            len = (tp as unknown as SVGTextContentElement).getComputedTextLength();
          }
          tp.setAttribute('data-span-length', String(len));
          tp.setAttribute('data-circumference', String(circ));
        } catch { /* ignore */ }
      });
    });
  }

  private bind() {
    this.svg.addEventListener('pointermove', (e) => {
      const pt = this.getLocalPoint(e);
      const ring = this.pointToRing(pt.x, pt.y);
      if (ring !== this.activeRing) {
        this.setActive(ring);
      }
    });
    this.svg.addEventListener('pointerleave', () => this.setActive(null));
    this.svg.addEventListener('click', (e) => {
      let ring: number | null = null;
      const target = (e.target as HTMLElement).closest('circle.ring') as SVGCircleElement | null;
      const debug = isDebug();
      let fallbackRing: number | null = null;
      let localPt: { x:number; y:number } | null = null;
      let distance: number | null = null;
      if (target && target.dataset.ring) {
        ring = Number(target.dataset.ring);
      } else {
        localPt = this.getLocalPoint(e);
        distance = Math.sqrt(localPt.x*localPt.x + localPt.y*localPt.y);
        fallbackRing = this.pointToRing(localPt.x, localPt.y);
        ring = fallbackRing;
      }
      if (debug) {
        try {
          const rect = this.svg.getBoundingClientRect();
          const vb = this.svg.viewBox.baseVal;
          const info = {
            event: 'click',
            client: { x: e.clientX, y: e.clientY },
            svgRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            viewBox: { x: vb.x, y: vb.y, w: vb.width, h: vb.height },
            targetRingAttr: target?.dataset.ring ?? null,
            radii: [...this.radii],
            localPoint: localPt,
            distance,
            deltas: distance!=null ? this.radii.map((r,i)=> ({ ring:i, diff: (r - distance!).toFixed(2) })) : null,
            fallbackRing,
            finalRing: ring,
          };
          console.log('[DARTBOARD DEBUG]', info);
        } catch(err) {
          console.warn('[DARTBOARD DEBUG] logging error', err);
        }
      }
      if (ring != null) this.listeners.ring(ring, e.clientX, e.clientY);
    });
  }

  private setActive(idx:number|null) {
    this.activeRing = idx;
    this.svg.querySelectorAll('.ring').forEach(el => {
      const ring = Number((el as SVGCircleElement).dataset['ring']);
      el.toggleAttribute('data-active', ring === idx);
      el.toggleAttribute('data-focus', ring === this.focusRing);
    });
    // Highlight corresponding label (textPath with href to ring-path-<idx>)
    this.svg.querySelectorAll('.ring-label').forEach(lab => lab.removeAttribute('data-lit'));
    if (idx != null) {
      const tp = this.svg.querySelector(`.ring-label textPath[href="#ring-path-${idx}"]`);
      if (tp) {
        const parent = tp.closest('.ring-label') as SVGElement | null;
        if (parent) parent.setAttribute('data-lit','true');
      }
    }
  }

  private getLocalPoint(evt: PointerEvent) {
    const rect = this.svg.getBoundingClientRect();
    // compute relative coords inside svg viewBox space
    const vb = this.svg.viewBox.baseVal;
    const scaleX = rect.width / vb.width;
    const scaleY = rect.height / vb.height;
    const sx = evt.clientX - rect.left;
    const sy = evt.clientY - rect.top;
    // convert to viewBox coordinates then shift center (0,0) to board center
    const vx = vb.x + sx/scaleX;
    const vy = vb.y + sy/scaleY;
    const cx = vb.x + vb.width/2;
    const cy = vb.y + vb.height/2;
    return { x: vx - cx, y: vy - cy };
  }

  private pointToRing(x:number,y:number): number|null {
    const d = Math.sqrt(x*x + y*y);
    // radii currently stored with index meaning ring id (0 center .. n outer)
    for (let i = 0; i < this.radii.length; i++) {
      if (d <= this.radii[i]) return i;
    }
    return null;
  }

  focusNext(delta:number) {
    const max = this.opt.rings; // 10
    this.focusRing = (this.focusRing + delta + (max+1)) % (max+1);
    this.svg.querySelectorAll('.ring').forEach(el => {
      const ring = Number((el as SVGCircleElement).dataset['ring']);
      el.toggleAttribute('data-focus', ring === this.focusRing);
    });
  }

  activateFocused() {
    // approximate center coordinate for focused ring (use board center for now)
    const rect = this.svg.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    this.listeners.ring(this.focusRing, cx, cy);
  }

}

// Describe circle path for textPath
function describeCircle(cx:number, cy:number, r:number) {
  return `M ${cx-r}, ${cy} A ${r} ${r} 0 1 1 ${cx+r} ${cy} A ${r} ${r} 0 1 1 ${cx-r} ${cy}`;
}

// Debug flag helper: enabled if URL has ?debug=1 or localStorage 'dartboard-debug' === '1'
function isDebug(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (window.location && window.location.search.includes('debug=1')) return true;
    if (localStorage.getItem('dartboard-debug') === '1') return true;
  } catch { /* ignore */ }
  return false;
}

export function getModuleByRing(ring:number): ModuleContent | undefined {
  // Direct mapping 0..n to MODULES id 0..n
  return MODULES.find(m=>m.id===ring);
}
