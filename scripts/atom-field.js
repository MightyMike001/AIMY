import { ensureFreshVersion } from './utils/version.js';

ensureFreshVersion();

const MOTION_QUERY = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

export function initAtomField({
  canvas,
  overlay,
  logo,
  activationClass = 'is-active'
} = {}){
  const canvasEl = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
  let ctx = null;

  if(canvasEl){
    try{
      ctx = canvasEl.getContext('2d', { alpha: true, desynchronized: true });
    }catch{
      ctx = null;
    }

    if(!ctx){
      ctx = canvasEl.getContext('2d');
    }
  }

  if(!canvasEl || !ctx){
    return {
      start(){},
      stop(){},
      destroy(){}
    };
  }

  let reduceMotion = Boolean(MOTION_QUERY?.matches);
  let animationId = null;
  let atoms = [];
  let deviceRatio = 1;
  let width = 0;
  let height = 0;

  const BASE_COUNT = 36;
  const MAX_COUNT = 64;

  function createAtoms(count){
    const now = performance.now();
    return Array.from({ length: count }, (_, index) => {
      const baseRadius = (Math.random() * 0.3 + 0.1) * Math.min(width, height);
      return {
        seed: Math.random() * 1000,
        orbitRadius: Math.max(40, baseRadius * (0.32 + Math.random() * 0.48)),
        orbitSpeed: 0.12 + Math.random() * 0.25,
        verticalSkew: 0.78 + Math.random() * 0.3,
        size: 2.2 + Math.random() * 3.4,
        alpha: 0.18 + Math.random() * 0.4,
        offset: Math.random() * Math.PI * 2,
        rotationDirection: Math.random() > 0.5 ? 1 : -1,
        anchorX: Math.random() * width,
        anchorY: Math.random() * height,
        createdAt: now + index * 16
      };
    });
  }

  function resize(){
    deviceRatio = Math.min(window.devicePixelRatio || 1, 1.6);
    width = Math.round(window.innerWidth * deviceRatio);
    height = Math.round(window.innerHeight * deviceRatio);

    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';

    const targetCount = Math.round(
      Math.min(
        MAX_COUNT,
        BASE_COUNT + (window.innerWidth / 360) * 8 + (window.innerHeight / 640) * 6
      )
    );

    atoms = createAtoms(targetCount);

    if(reduceMotion){
      drawFrame(0);
    }
  }

  function clearCanvas(){
    ctx.clearRect(0, 0, width, height);
  }

  function drawAtom(atom, time){
    const elapsed = time ? (time - atom.createdAt) / 1000 : 0;
    const angle = atom.offset + elapsed * atom.orbitSpeed * atom.rotationDirection;
    const orbit = atom.orbitRadius * (0.92 + 0.08 * Math.sin(atom.seed + elapsed * 0.35));
    const x = atom.anchorX + Math.cos(angle) * orbit;
    const y = atom.anchorY + Math.sin(angle) * orbit * atom.verticalSkew;

    const glow = ctx.createRadialGradient(x, y, 0, x, y, atom.size * 5);
    glow.addColorStop(0, `rgba(0, 231, 255, ${0.55 + atom.alpha})`);
    glow.addColorStop(0.6, `rgba(0, 231, 255, ${0.18 + atom.alpha / 2})`);
    glow.addColorStop(1, 'rgba(0, 231, 255, 0)');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, atom.size * deviceRatio, 0, Math.PI * 2);
    ctx.fill();

    return { x, y };
  }

  function drawConnections(points){
    for(let i = 0; i < points.length; i += 1){
      for(let j = i + 1; j < points.length; j += 1){
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const distance = Math.hypot(dx, dy);

        if(distance > 180 * deviceRatio){
          continue;
        }

        const alpha = Math.max(0, 1 - distance / (180 * deviceRatio));
        ctx.strokeStyle = `rgba(200, 167, 106, ${alpha * 0.12})`;
        ctx.lineWidth = 0.6 * deviceRatio;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }

  function drawFrame(timestamp){
    clearCanvas();
    const points = atoms.map((atom) => drawAtom(atom, reduceMotion ? 0 : timestamp));
    drawConnections(points.filter(Boolean));
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

  resize();
  start();

  const resizeHandler = () => {
    window.requestAnimationFrame(() => {
      resize();
      start();
    });
  };

  window.addEventListener('resize', resizeHandler, { passive: true });
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
      window.removeEventListener('resize', resizeHandler);
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

export default initAtomField;
