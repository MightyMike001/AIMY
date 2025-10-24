import { ensureFreshVersion } from './utils/version.js';

ensureFreshVersion();

const MOTION_QUERY = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

function getContext(canvasEl){
  if(!canvasEl){
    return null;
  }

  let context = null;

  try{
    context = canvasEl.getContext('2d', { alpha: true, desynchronized: true });
  }catch{
    context = null;
  }

  if(!context){
    context = canvasEl.getContext('2d');
  }

  return context;
}

export function initProtonField({
  canvas,
  overlay,
  logo,
  activationClass = 'is-active'
} = {}){
  const canvasEl = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
  const ctx = getContext(canvasEl);

  if(!canvasEl || !ctx){
    return {
      start(){},
      stop(){},
      destroy(){}
    };
  }

  const containerEl = canvasEl.closest('#aimy-bg') || canvasEl.parentElement || document.body;
  const visualViewport = window.visualViewport;

  let reduceMotion = Boolean(MOTION_QUERY?.matches);
  let animationId = null;
  let deviceRatio = 1;
  let width = 0;
  let height = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  let protons = [];
  let resizeFrame = null;
  let resizeObserver = null;

  const BASE_COUNT = 24;
  const MAX_COUNT = 48;
  const DENSITY_DIVISOR = 60000;

  function createPalette(){
    const palettes = [
      { r: 92, g: 197, b: 255 },
      { r: 255, g: 96, b: 180 },
      { r: 160, g: 128, b: 255 }
    ];

    return palettes[Math.floor(Math.random() * palettes.length)];
  }

  function createAnchors(){
    const cx = width / 2;
    const cy = height / 2;
    const spreadX = Math.max(width * 0.18, 180 * deviceRatio);
    const spreadY = Math.max(height * 0.16, 160 * deviceRatio);

    return [
      { x: cx - spreadX, y: cy - spreadY },
      { x: cx + spreadX * 0.6, y: cy - spreadY * 1.2 },
      { x: cx + spreadX, y: cy + spreadY },
      { x: cx - spreadX * 1.2, y: cy + spreadY * 0.6 }
    ];
  }

  function createProtons(count){
    const now = performance.now();
    const anchors = createAnchors();
    const longestSide = Math.max(width, height);

    return Array.from({ length: count }, (_, index) => {
      const anchor = anchors[index % anchors.length];
      const palette = createPalette();
      const baseOrbit = (0.18 + Math.random() * 0.42) * longestSide;

      return {
        seed: Math.random() * 1000,
        anchorX: anchor.x + (Math.random() - 0.5) * spreadValue(longestSide, 0.22),
        anchorY: anchor.y + (Math.random() - 0.5) * spreadValue(longestSide, 0.18),
        baseOrbit,
        orbitJitter: baseOrbit * (0.12 + Math.random() * 0.24),
        orbitSpeed: 0.006 + Math.random() * 0.014,
        verticalSkew: 0.62 + Math.random() * 0.42,
        size: 2.4 + Math.random() * 3.6,
        glow: palette,
        flare: 0.42 + Math.random() * 0.36,
        offset: Math.random() * Math.PI * 2,
        rotationDirection: Math.random() > 0.5 ? 1 : -1,
        pulseSpeed: 0.18 + Math.random() * 0.32,
        trailStrength: 0.05 + Math.random() * 0.08,
        createdAt: now + index * 18
      };
    });
  }

  function spreadValue(base, ratio){
    return base * ratio + 120 * deviceRatio;
  }

  function sizeCanvas(){
    if(!containerEl){
      return;
    }

    const rect = containerEl.getBoundingClientRect();
    const nextCssWidth = Math.max(1, Math.round(rect.width));
    const nextCssHeight = Math.max(1, Math.round(rect.height));
    const nextDeviceRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    cssWidth = nextCssWidth;
    cssHeight = nextCssHeight;
    deviceRatio = nextDeviceRatio;
    width = Math.floor(cssWidth * deviceRatio);
    height = Math.floor(cssHeight * deviceRatio);

    if(canvasEl.width !== width){
      canvasEl.width = width;
    }

    if(canvasEl.height !== height){
      canvasEl.height = height;
    }

    canvasEl.style.width = `${cssWidth}px`;
    canvasEl.style.height = `${cssHeight}px`;

    const area = cssWidth * cssHeight;
    const targetDensity = Math.max(BASE_COUNT, area / DENSITY_DIVISOR);
    const targetCount = Math.round(
      Math.min(
        MAX_COUNT,
        targetDensity
      )
    );

    protons = createProtons(targetCount);

    if(reduceMotion){
      drawFrame(0);
    }
  }

  function queueResize(){
    if(resizeFrame){
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = null;
    }

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      sizeCanvas();
      start();
    });
  }

  function drawBackdrop(time){
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.1,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.75
    );

    const pulse = reduceMotion ? 0.4 : 0.4 + Math.sin(time * 0.00018) * 0.08;
    gradient.addColorStop(0, `rgba(11, 40, 78, ${0.32 + pulse})`);
    gradient.addColorStop(0.55, 'rgba(5, 16, 38, 0.42)');
    gradient.addColorStop(1, 'rgba(2, 4, 12, 0.82)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawEnergyContours(time){
    const base = Math.max(width, height) * 0.36;
    const layers = 5;

    ctx.globalCompositeOperation = 'lighter';
    for(let i = 0; i < layers; i += 1){
      const progress = ((time * 0.00004) + i * 0.18) % 1;
      const radius = base + progress * base * 1.8;
      const alpha = Math.max(0, 0.08 - progress * 0.08);

      ctx.beginPath();
      ctx.ellipse(
        width * 0.5,
        height * 0.5,
        radius,
        radius * 0.68,
        i % 2 === 0 ? 0.35 : -0.35,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = `rgba(96, 200, 255, ${alpha})`;
      ctx.lineWidth = 1.1 * deviceRatio;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawProton(proton, time){
    const elapsed = time ? (time - proton.createdAt) / 1000 : 0;
    const wobble = Math.sin(proton.seed + elapsed * proton.pulseSpeed) * proton.orbitJitter;
    const pulse = 0.6 + Math.sin(proton.seed * 2 + elapsed * proton.pulseSpeed * 1.6) * 0.2;
    const angle = proton.offset + elapsed * proton.orbitSpeed * proton.rotationDirection;
    const orbit = proton.baseOrbit + wobble;
    const x = proton.anchorX + Math.cos(angle) * orbit;
    const y = proton.anchorY + Math.sin(angle) * orbit * proton.verticalSkew;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, proton.size * 18 * deviceRatio);
    const { r, g, b } = proton.glow;
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.66 + pulse * 0.22})`);
    gradient.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${0.25 + pulse * 0.18})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, proton.size * deviceRatio * (0.9 + pulse * 0.3), 0, Math.PI * 2);
    ctx.fill();

    return { x, y, glow: proton.glow, pulse };
  }

  function drawTrails(points){
    ctx.globalCompositeOperation = 'lighter';
    for(let i = 0; i < points.length; i += 1){
      for(let j = i + 1; j < points.length; j += 1){
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const distance = Math.hypot(dx, dy);

        if(distance > 260 * deviceRatio){
          continue;
        }

        const intensity = 1 - distance / (260 * deviceRatio);
        const alpha = intensity * 0.08;

        if(alpha <= 0){
          continue;
        }

        const midX = (points[i].x + points[j].x) / 2;
        const midY = (points[i].y + points[j].y) / 2;
        const gradient = ctx.createRadialGradient(
          midX,
          midY,
          0,
          midX,
          midY,
          distance * 0.7
        );

        const color = i % 2 === 0 ? points[i].glow : points[j].glow;
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(
          midX,
          midY,
          distance * 0.32,
          distance * 0.18,
          Math.atan2(dy, dx),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFrame(timestamp){
    const time = reduceMotion ? 0 : timestamp;
    drawBackdrop(time);
    ctx.globalCompositeOperation = 'lighter';
    const points = protons.map((proton) => drawProton(proton, time));
    ctx.globalCompositeOperation = 'source-over';
    drawTrails(points.filter(Boolean));
    if(!reduceMotion){
      drawEnergyContours(time);
    }
  }

  function loop(timestamp){
    drawFrame(timestamp);
    animationId = window.requestAnimationFrame(loop);
  }

  function start(){
    if(animationId){
      window.cancelAnimationFrame(animationId);
      animationId = null;
    }

    if(reduceMotion){
      drawFrame(0);
      return;
    }

    animationId = window.requestAnimationFrame(loop);
  }

  function stop(){
    if(animationId){
      window.cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function handleMotionChange(event){
    reduceMotion = event.matches;
    start();
  }

  sizeCanvas();
  start();

  const onWindowResize = () => {
    queueResize();
  };

  if(typeof ResizeObserver === 'function' && containerEl){
    resizeObserver = new ResizeObserver(() => {
      queueResize();
    });
    resizeObserver.observe(containerEl);
  }

  window.addEventListener('resize', onWindowResize, { passive: true });
  window.addEventListener('orientationchange', onWindowResize);
  if(visualViewport && typeof visualViewport.addEventListener === 'function'){
    visualViewport.addEventListener('resize', onWindowResize);
  }
  window.addEventListener('visibilitychange', () => {
    if(document.hidden){
      stop();
    } else {
      start();
    }
  });

  if(MOTION_QUERY){
    if(typeof MOTION_QUERY.addEventListener === 'function'){
      MOTION_QUERY.addEventListener('change', handleMotionChange);
    } else if(typeof MOTION_QUERY.addListener === 'function'){
      MOTION_QUERY.addListener(handleMotionChange);
    }
  }

  if(overlay){
    requestAnimationFrame(() => {
      overlay.classList.add(activationClass);
    });
  }

  if(logo){
    const logoEl = typeof logo === 'string' ? document.querySelector(logo) : logo;
    if(logoEl){
      const ready = () => logoEl.classList.add('is-ready');
      if(logoEl.complete === false){
        logoEl.addEventListener('load', ready, { once: true });
      } else {
        ready();
      }
    }
  }

  return {
    start,
    stop,
    destroy(){
      stop();
      if(resizeFrame){
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = null;
      }

      if(resizeObserver){
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('orientationchange', onWindowResize);
      if(visualViewport && typeof visualViewport.removeEventListener === 'function'){
        visualViewport.removeEventListener('resize', onWindowResize);
      }

      if(MOTION_QUERY){
        if(typeof MOTION_QUERY.removeEventListener === 'function'){
          MOTION_QUERY.removeEventListener('change', handleMotionChange);
        } else if(typeof MOTION_QUERY.removeListener === 'function'){
          MOTION_QUERY.removeListener(handleMotionChange);
        }
      }
    }
  };
}

export default initProtonField;
