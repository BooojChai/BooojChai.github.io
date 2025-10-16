import { MODULES, ModuleContent } from './modules';

interface DartboardOptions { radius: number; rings: number; container: HTMLElement; }

export class Dartboard {
  private svg: SVGSVGElement;
  private opt: DartboardOptions;
  private activeRing: number | null = null;
  private listeners: { ring: (idx:number, x:number, y:number)=>void } = { ring: () => {} };
  private focusRing: number = 0;
  private radii: number[] = []; // store outer radii per ring index (0 center .. n outer)
  // Board-wide sheen (mirror-like highlight) state
  private sheenGrad: SVGRadialGradientElement | null = null;
  private sheenCircle: SVGCircleElement | null = null;
  private sheenRAF: number | null = null;
  private sheenState = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, lastMove: 0 };

  constructor(opt: DartboardOptions) {
    this.opt = opt;
  this.svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  this.svg.classList.add('dartboard');
  // Add a small padding around the logical board so that outer ring strokes & glow are not clipped.
  // Previously the outer circle radius exactly touched the viewBox edge (0..radius*2) so stroke (≈5px) was cut.
  // Increase padding to accommodate thicker outer halo and blur
  // Compute minimal padding based on outer halo spread so the board doesn't shrink visually
  const HALO_SCALE = 1.09; // keep in sync with outer halo circle radius factor
  const haloExtra = opt.radius * (HALO_SCALE - 1); // how far halo extends beyond outer ring
  const pad = Math.max(14, haloExtra + opt.radius * 0.03); // extra ~3% margin to avoid edge artifacts
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

    // Define gradients/filters for the central disc tech style (black/white/red)
    // We attach <defs> once per draw; IDs are stable.
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    // Core radial red gradient (slightly transparent)
    const gradCore = document.createElementNS('http://www.w3.org/2000/svg','radialGradient');
    gradCore.setAttribute('id','grad-core');
    gradCore.setAttribute('cx','50%'); gradCore.setAttribute('cy','50%'); gradCore.setAttribute('r','60%');
  const s0 = document.createElementNS('http://www.w3.org/2000/svg','stop'); s0.setAttribute('offset','0%'); s0.setAttribute('stop-color','#ff7684'); s0.setAttribute('stop-opacity','1');
  const s1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); s1.setAttribute('offset','56%'); s1.setAttribute('stop-color','#d10026'); s1.setAttribute('stop-opacity','0.98');
  const s2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','#5a0010'); s2.setAttribute('stop-opacity','0.95');
    gradCore.append(s0,s1,s2);
    // Specular highlight (white to transparent), offset towards top-left for sheen
    const gradSpec = document.createElementNS('http://www.w3.org/2000/svg','radialGradient');
    gradSpec.setAttribute('id','grad-spec');
    gradSpec.setAttribute('cx','36%'); gradSpec.setAttribute('cy','34%'); gradSpec.setAttribute('r','46%');
  const sp0 = document.createElementNS('http://www.w3.org/2000/svg','stop'); sp0.setAttribute('offset','0%'); sp0.setAttribute('stop-color','#ffffff'); sp0.setAttribute('stop-opacity','0.78');
  const sp1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); sp1.setAttribute('offset','35%'); sp1.setAttribute('stop-color','#ffffff'); sp1.setAttribute('stop-opacity','0.36');
    const sp2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); sp2.setAttribute('offset','100%'); sp2.setAttribute('stop-color','#ffffff'); sp2.setAttribute('stop-opacity','0');
    gradSpec.append(sp0,sp1,sp2);
    // Soft outer red glow (center transparent -> edge reddish -> transparent)
    const gradGlow = document.createElementNS('http://www.w3.org/2000/svg','radialGradient');
    gradGlow.setAttribute('id','grad-core-glow');
    gradGlow.setAttribute('cx','50%'); gradGlow.setAttribute('cy','50%'); gradGlow.setAttribute('r','100%');
    const gg0 = document.createElementNS('http://www.w3.org/2000/svg','stop'); gg0.setAttribute('offset','0%'); gg0.setAttribute('stop-color','#ff4055'); gg0.setAttribute('stop-opacity','0');
  const gg1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); gg1.setAttribute('offset','60%'); gg1.setAttribute('stop-color','#ff4055'); gg1.setAttribute('stop-opacity','0.35');
    const gg2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); gg2.setAttribute('offset','100%'); gg2.setAttribute('stop-color','#ff4055'); gg2.setAttribute('stop-opacity','0');
    gradGlow.append(gg0,gg1,gg2);
  // Light ring gradient (white base with slight edge falloff)
  const gradLight = document.createElementNS('http://www.w3.org/2000/svg','radialGradient');
  gradLight.setAttribute('id','ring-light');
  gradLight.setAttribute('gradientUnits','userSpaceOnUse');
  gradLight.setAttribute('cx','0'); gradLight.setAttribute('cy','0'); gradLight.setAttribute('r', String(radius));
  const rl0 = document.createElementNS('http://www.w3.org/2000/svg','stop'); rl0.setAttribute('offset','0%'); rl0.setAttribute('stop-color','#ffffff'); rl0.setAttribute('stop-opacity','1');
  const rl1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); rl1.setAttribute('offset','72%'); rl1.setAttribute('stop-color','#f0f0f0'); rl1.setAttribute('stop-opacity','0.98');
  const rl2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); rl2.setAttribute('offset','100%'); rl2.setAttribute('stop-color','#d6d6d6'); rl2.setAttribute('stop-opacity','0.98');
  gradLight.append(rl0, rl1, rl2);
  // Dark ring gradient (black base with subtle inner lift and outer deepen)
  const gradDark = document.createElementNS('http://www.w3.org/2000/svg','radialGradient');
  gradDark.setAttribute('id','ring-dark');
  gradDark.setAttribute('gradientUnits','userSpaceOnUse');
  gradDark.setAttribute('cx','0'); gradDark.setAttribute('cy','0'); gradDark.setAttribute('r', String(radius));
  const rd0 = document.createElementNS('http://www.w3.org/2000/svg','stop'); rd0.setAttribute('offset','0%'); rd0.setAttribute('stop-color','#0a0a0a'); rd0.setAttribute('stop-opacity','1');
  const rd1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); rd1.setAttribute('offset','68%'); rd1.setAttribute('stop-color','#0f0f0f'); rd1.setAttribute('stop-opacity','1');
  const rd2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); rd2.setAttribute('offset','100%'); rd2.setAttribute('stop-color','#1f1f1f'); rd2.setAttribute('stop-opacity','1');
  gradDark.append(rd0, rd1, rd2);
  // Board-wide subtle sheen overlay (very faint white sheen across rings)
  const gradBoardSheen = document.createElementNS('http://www.w3.org/2000/svg','radialGradient');
  gradBoardSheen.setAttribute('id','board-sheen');
  // Use user space so we can move highlight center with pointer in board coordinates
  gradBoardSheen.setAttribute('gradientUnits','userSpaceOnUse');
  gradBoardSheen.setAttribute('cx','0');
  gradBoardSheen.setAttribute('cy', String(-radius * 0.18));
  gradBoardSheen.setAttribute('r', String(radius * 0.9));
  const bs0 = document.createElementNS('http://www.w3.org/2000/svg','stop'); bs0.setAttribute('offset','0%'); bs0.setAttribute('stop-color','#ffffff'); bs0.setAttribute('stop-opacity','0.16');
  const bs1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); bs1.setAttribute('offset','55%'); bs1.setAttribute('stop-color','#ffffff'); bs1.setAttribute('stop-opacity','0.08');
  const bs2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); bs2.setAttribute('offset','100%'); bs2.setAttribute('stop-color','#ffffff'); bs2.setAttribute('stop-opacity','0');
  gradBoardSheen.append(bs0, bs1, bs2);
  // Outer halo radial gradient (screen blend), bell-shaped and soft to avoid banding
  const gradOuterHalo = document.createElementNS('http://www.w3.org/2000/svg','radialGradient');
  gradOuterHalo.setAttribute('id','outer-halo');
  gradOuterHalo.setAttribute('gradientUnits','objectBoundingBox');
  gradOuterHalo.setAttribute('cx','50%'); gradOuterHalo.setAttribute('cy','50%');
  gradOuterHalo.setAttribute('r','50%');
  const oh0 = document.createElementNS('http://www.w3.org/2000/svg','stop'); oh0.setAttribute('offset','0%');  oh0.setAttribute('stop-color','#ffffff'); oh0.setAttribute('stop-opacity','0');
  const oh1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); oh1.setAttribute('offset','78%'); oh1.setAttribute('stop-color','#f7fbff'); oh1.setAttribute('stop-opacity','0.06');
  const oh2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); oh2.setAttribute('offset','88%'); oh2.setAttribute('stop-color','#f7fbff'); oh2.setAttribute('stop-opacity','0.2');
  const oh3 = document.createElementNS('http://www.w3.org/2000/svg','stop'); oh3.setAttribute('offset','96%'); oh3.setAttribute('stop-color','#f7fbff'); oh3.setAttribute('stop-opacity','0.12');
  const oh4 = document.createElementNS('http://www.w3.org/2000/svg','stop'); oh4.setAttribute('offset','100%'); oh4.setAttribute('stop-color','#f7fbff'); oh4.setAttribute('stop-opacity','0');
  gradOuterHalo.append(oh0, oh1, oh2, oh3, oh4);
  // Gentle blur to smooth any edge artifacts
  const haloBlur = document.createElementNS('http://www.w3.org/2000/svg','filter');
  haloBlur.setAttribute('id','outer-halo-soften');
  haloBlur.setAttribute('x','-10%'); haloBlur.setAttribute('y','-10%');
  haloBlur.setAttribute('width','120%'); haloBlur.setAttribute('height','120%');
  const hb = document.createElementNS('http://www.w3.org/2000/svg','feGaussianBlur'); hb.setAttribute('in','SourceGraphic'); hb.setAttribute('stdDeviation','1.2');
  haloBlur.appendChild(hb);
  defs.append(gradCore, gradSpec, gradGlow, gradLight, gradDark, gradBoardSheen, gradOuterHalo, haloBlur);
  this.sheenGrad = gradBoardSheen;
    this.svg.appendChild(defs);

    // Original palette: red core + alternating white / black outward (0..6 used)
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
      // Ring 1 (index 1): Growing
      'GROWING · LEARNING · EVOLVING · ',
      // Ring 2 (index 2): Career
      'CAREER · JOURNEY · EXPERIENCE · ',
      // Ring 3 (index 3): Music related (requested)
      'MELODY · RHYTHM · HARMONY · MUSIC · GROOVE · ',
      // Ring 4 (index 4): Sounds related (requested)
      'SOUND · VIBRATION · FREQUENCY · RESONANCE · ECHO · ',
      // Ring 5 (index 5): Execution remains
      'EXECUTION · SHIPPING · IMPACT · ',
      // Ring 6 (index 6): Moon / Light related (requested)
      'MOON · LIGHT · LUNAR · GLOW · NIGHT · RADIANCE · '
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
      let { fill, stroke } = palette[i] || palette[palette.length-1];
      // Apply tech gradient + slight transparency for core (ring 0)
      if (i === 0) {
        circle.setAttribute('fill', 'url(#grad-core)');
        circle.setAttribute('fill-opacity','0.88');
        stroke = '#ff6674';
      } else {
        // Alternate ring styling with subtle gradients & a touch of transparency
        if (fill === '#ffffff') {
          circle.setAttribute('fill','url(#ring-light)');
          circle.setAttribute('fill-opacity','0.9');
        } else if (fill === '#060606') {
          circle.setAttribute('fill','url(#ring-dark)');
          circle.setAttribute('fill-opacity','0.9');
        }
      }
      circle.setAttribute('fill', circle.getAttribute('fill') || fill);
      circle.setAttribute('stroke', stroke);
      circle.setAttribute('stroke-width', sw.toString());
  circle.setAttribute('stroke-opacity','0.8');
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

  // Center overlays: subtle specular highlight and soft red glow
  // Specular highlight sits within the core
  const coreR = this.radii[0] || (radius * 0.12);
  const spec = document.createElementNS('http://www.w3.org/2000/svg','circle');
  spec.setAttribute('r', (coreR * 0.86).toFixed(2));
  spec.setAttribute('fill','url(#grad-spec)');
  spec.setAttribute('opacity','0.95');
  spec.setAttribute('pointer-events','none');
  // Soft outer glow slightly larger than core edge
  const glow = document.createElementNS('http://www.w3.org/2000/svg','circle');
  glow.setAttribute('r', (coreR * 1.28).toFixed(2));
  glow.setAttribute('fill','url(#grad-core-glow)');
  glow.setAttribute('opacity','0.95');
  glow.setAttribute('pointer-events','none');

  this.svg.appendChild(group);
  // place overlays above core inside the translated group so they stay centered
  group.appendChild(glow);
  group.appendChild(spec);
  // Board-wide sheen overlay (very faint), above rings but beneath labels
  const sheen = document.createElementNS('http://www.w3.org/2000/svg','circle');
  sheen.setAttribute('class','board-sheen');
  sheen.setAttribute('r', this.radii[rings].toFixed(2));
  sheen.setAttribute('fill','url(#board-sheen)');
  sheen.setAttribute('opacity','0.38');
  sheen.setAttribute('pointer-events','none');
  // Insert sheen beneath labels but above rings: place before the first .ring-label if present
  const firstLabel = group.querySelector('.ring-label');
  if (firstLabel) group.insertBefore(sheen, firstLabel);
  else group.appendChild(sheen);
  this.sheenCircle = sheen;

  // Outer halo using filled radial gradient ring
  const outerR = this.radii[rings];
  const halo = document.createElementNS('http://www.w3.org/2000/svg','circle');
  halo.setAttribute('class','outer-halo');
  halo.setAttribute('pointer-events','none');
  halo.setAttribute('r', (outerR * 1.09).toFixed(2));
  halo.setAttribute('fill','url(#outer-halo)');
  halo.setAttribute('opacity','0.62');
  halo.style.mixBlendMode = 'screen';
  halo.setAttribute('filter','url(#outer-halo-soften)');
  // Insert under labels (and above rings), and beneath sheen for subtler composite
  if (this.sheenCircle) group.insertBefore(halo, this.sheenCircle);
  else if (firstLabel) group.insertBefore(halo, firstLabel);
  else group.appendChild(halo);
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
      // update sheen target toward pointer (normalized -1..1 in board radius)
      this.updateSheenTarget(pt.x, pt.y);
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

  // --- Board sheen pointer-follow highlight ---
  private updateSheenTarget(x:number, y:number) {
    const R = this.opt.radius;
    // Normalize to -1..1 range relative to center, clamp inward slightly
    const nx = Math.max(-1, Math.min(1, x / R));
    const ny = Math.max(-1, Math.min(1, y / R));
    const inward = 0.85; // keep highlight somewhat within the disc
    this.sheenState.tx = nx * inward * R;
    this.sheenState.ty = ny * inward * R * 0.7 - R * 0.18; // bias upward a bit like a light from top
    this.sheenState.lastMove = performance.now();
    if (!this.sheenRAF) this.startSheenLoop();
  }
  private startSheenLoop() {
    const loop = () => {
      // Inertia update
      this.sheenState.vx += (this.sheenState.tx - this.sheenState.x) * 0.14;
      this.sheenState.vy += (this.sheenState.ty - this.sheenState.y) * 0.14;
      this.sheenState.vx *= 0.80; this.sheenState.vy *= 0.80;
      this.sheenState.x += this.sheenState.vx; this.sheenState.y += this.sheenState.vy;
      if (this.sheenGrad) {
        this.sheenGrad.setAttribute('cx', this.sheenState.x.toFixed(2));
        this.sheenGrad.setAttribute('cy', this.sheenState.y.toFixed(2));
      }
      // Idle drift if no movement
      const idle = performance.now() - this.sheenState.lastMove > 900;
      if (idle) {
        const t = performance.now() * 0.0008;
        const R = this.opt.radius;
        const dx = Math.cos(t) * R * 0.12;
        const dy = Math.sin(t*1.23) * R * 0.08 - R * 0.18;
        this.sheenState.tx = dx; this.sheenState.ty = dy;
      }
      this.sheenRAF = requestAnimationFrame(loop);
    };
    if (!this.sheenRAF) this.sheenRAF = requestAnimationFrame(loop);
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
