import { ensureFreshVersion } from './utils/version.js';

ensureFreshVersion();

const MOTION_QUERY = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
let reduceMotion = Boolean(MOTION_QUERY?.matches);

const canvas = document.getElementById('atom-field');
const ctx = canvas?.getContext('2d', { alpha: true, desynchronized: true });

let deviceRatio = 1;
let width = 0;
let height = 0;
let animationId = null;
let atoms = [];

const BASE_COUNT = 36;
const MAX_COUNT = 60;

function createAtoms(count) {
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
      createdAt: now + index * 16,
    };
  });
}

function resize() {
  if(!canvas || !ctx){
    return;
  }

  deviceRatio = Math.min(window.devicePixelRatio || 1, 1.6);
  width = Math.round(window.innerWidth * deviceRatio);
  height = Math.round(window.innerHeight * deviceRatio);

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';

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

function clearCanvas() {
  if(!ctx){
    return;
  }
  ctx.clearRect(0, 0, width, height);
}

function drawAtom(atom, time) {
  if(!ctx){
    return;
  }

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

function drawConnections(points) {
  if(!ctx){
    return;
  }

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

function drawFrame(timestamp) {
  if(!ctx){
    return;
  }

  clearCanvas();

  const points = atoms.map((atom) => drawAtom(atom, reduceMotion ? 0 : timestamp));

  drawConnections(points.filter(Boolean));
}

function loop(timestamp) {
  drawFrame(timestamp);
  animationId = window.requestAnimationFrame(loop);
}

function start() {
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

function handleMotionChange(event) {
  reduceMotion = event.matches;
  start();
}

if(canvas && ctx){
  resize();
  start();

  window.addEventListener('resize', () => {
    window.requestAnimationFrame(() => {
      resize();
      start();
    });
  }, { passive: true });

  const overlay = document.querySelector('.intro__overlay');
  if(overlay){
    requestAnimationFrame(() => {
      overlay.classList.add('is-active');
    });
  }

  const logo = document.querySelector('.intro__logo');
  if(logo?.complete === false){
    logo.addEventListener('load', () => {
      logo.classList.add('is-ready');
    }, { once: true });
  } else {
    logo?.classList.add('is-ready');
  }

  if(MOTION_QUERY){
    if(typeof MOTION_QUERY.addEventListener === 'function'){
      MOTION_QUERY.addEventListener('change', handleMotionChange);
    } else if(typeof MOTION_QUERY.addListener === 'function'){
      MOTION_QUERY.addListener(handleMotionChange);
    }
  }

  window.addEventListener('visibilitychange', () => {
    if(document.hidden){
      if(animationId){
        window.cancelAnimationFrame(animationId);
        animationId = null;
      }
    } else {
      start();
    }
  });
}

export {};
