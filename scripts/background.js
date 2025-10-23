import { ensureFreshVersion } from './utils/version.js';

ensureFreshVersion();

const MOTION_QUERY = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let reduceMotion = Boolean(MOTION_QUERY && MOTION_QUERY.matches);

const scene = document.querySelector('.background-scene');
const neuronCanvas = scene ? scene.querySelector('#neurons') : null;
const protonCanvas = scene ? scene.querySelector('#protons') : null;

if(scene && neuronCanvas && protonCanvas){
  const neuronCtx = neuronCanvas.getContext('2d');
  const protonCtx = protonCanvas.getContext('2d');

  if(neuronCtx && protonCtx){
    const NODES_COUNT = 68;
    const PROTON_COUNT = 26;
    let DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    let width = 0;
    let height = 0;
    let nodes = [];
    let protons = [];
    let neuronHandle = null;
    let protonHandle = null;
    let neuronScheduler = 'raf';
    let protonScheduler = 'raf';

    function getViewportSize(){
      const width = Math.max(
        window.innerWidth || 0,
        document.documentElement ? document.documentElement.clientWidth : 0,
        scene.clientWidth || 0
      );
      const heightCandidates = [
        window.innerHeight || 0,
        document.documentElement ? document.documentElement.clientHeight : 0,
        scene.clientHeight || 0
      ];
      if(window.visualViewport && window.visualViewport.height){
        heightCandidates.push(window.visualViewport.height);
      }
      const height = Math.max(...heightCandidates);
      return { width, height };
    }

    function resize({ reseed = false } = {}){
      DPR = Math.min(window.devicePixelRatio || 1, 1.6);
      const { width: viewportWidth, height: viewportHeight } = getViewportSize();
      const pixelWidth = Math.floor(viewportWidth * DPR);
      const pixelHeight = Math.floor(viewportHeight * DPR);
      if(neuronCanvas.width !== pixelWidth){
        neuronCanvas.width = pixelWidth;
      }
      if(neuronCanvas.height !== pixelHeight){
        neuronCanvas.height = pixelHeight;
      }
      if(protonCanvas.width !== pixelWidth){
        protonCanvas.width = pixelWidth;
      }
      if(protonCanvas.height !== pixelHeight){
        protonCanvas.height = pixelHeight;
      }
      neuronCanvas.style.width = '100%';
      neuronCanvas.style.height = '100%';
      protonCanvas.style.width = '100%';
      protonCanvas.style.height = '100%';
      scene.style.width = `${viewportWidth}px`;
      scene.style.height = `${viewportHeight}px`;
      scene.style.setProperty('--viewport-width', `${viewportWidth}px`);
      scene.style.setProperty('--viewport-height', `${viewportHeight}px`);
      const prevWidth = width || pixelWidth;
      const prevHeight = height || pixelHeight;
      width = neuronCanvas.width;
      height = neuronCanvas.height;
      if(reseed || nodes.length === 0){
        nodes = Array.from({ length: NODES_COUNT }, () => ({
          x: Math.random() * width,
          y: Math.random() * height * 0.8 + height * 0.1,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: 1 + Math.random() * 2,
          p: Math.random() * Math.PI * 2
        }));
      } else if(prevWidth > 0 && prevHeight > 0){
        const scaleX = width / prevWidth;
        const scaleY = height / prevHeight;
        nodes = nodes.map(node => ({
          ...node,
          x: node.x * scaleX,
          y: node.y * scaleY
        }));
      }
      if(reseed || protons.length === 0){
        protons = Array.from({ length: PROTON_COUNT }, () => ({
          a: Math.random() * Math.PI * 2,
          d: 90 + Math.random() * 230,
          sp: 0.0025 + Math.random() * 0.0035,
          s: 2 + Math.random() * 2.4,
          ph: Math.random() * Math.PI * 2
        }));
      }
    }

    function drawNeuronsFrame(){
      neuronCtx.clearRect(0, 0, width, height);
      for(let a = 0; a < nodes.length; a += 1){
        let links = 0;
        for(let b = a + 1; b < nodes.length && links < 5; b += 1){
          const dx = nodes[a].x - nodes[b].x;
          const dy = nodes[a].y - nodes[b].y;
          const distance = Math.hypot(dx, dy);
          if(distance < 130 * DPR){
            neuronCtx.strokeStyle = `rgba(200,167,106,${(1 - distance / (130 * DPR)) * 0.32})`;
            neuronCtx.lineWidth = 1;
            neuronCtx.beginPath();
            neuronCtx.moveTo(nodes[a].x, nodes[a].y);
            neuronCtx.lineTo(nodes[b].x, nodes[b].y);
            neuronCtx.stroke();
            links += 1;
          }
        }
      }
      const time = performance.now();
      for(const node of nodes){
        node.x += node.vx;
        node.y += node.vy;
        if(node.x < 0 || node.x > width){
          node.vx *= -1;
        }
        if(node.y < 0 || node.y > height){
          node.vy *= -1;
        }
        const pulse = 0.65 + 0.35 * Math.sin(time / 700 + node.p);
        const gradient = neuronCtx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 4.4);
        gradient.addColorStop(0, 'rgba(255,255,255,.9)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        neuronCtx.fillStyle = gradient;
        neuronCtx.globalAlpha = 0.7 * pulse;
        neuronCtx.beginPath();
        neuronCtx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        neuronCtx.fill();
        neuronCtx.globalAlpha = 1;
      }
    }

    function drawProtonsFrame(){
      protonCtx.clearRect(0, 0, protonCanvas.width, protonCanvas.height);
      protonCtx.globalCompositeOperation = 'lighter';
      const centerX = protonCanvas.width / 2;
      const centerY = protonCanvas.height / 2;
      const time = performance.now();

      for(let i = 0; i < protons.length; i += 1){
        const xi = centerX + Math.cos(protons[i].a) * protons[i].d;
        const yi = centerY + Math.sin(protons[i].a) * protons[i].d * (0.82 + 0.18 * Math.sin(time / 1800));
        for(let j = i + 1; j < protons.length; j += 1){
          const xj = centerX + Math.cos(protons[j].a) * protons[j].d;
          const yj = centerY + Math.sin(protons[j].a) * protons[j].d * (0.82 + 0.18 * Math.sin(time / 1800));
          const distance = Math.hypot(xi - xj, yi - yj);
          if(distance < 140 * DPR){
            const alpha = (1 - distance / (140 * DPR)) * 0.38;
            const gradient = protonCtx.createLinearGradient(xi, yi, xj, yj);
            gradient.addColorStop(0, `rgba(160,0,32,${alpha})`);
            gradient.addColorStop(1, `rgba(200,167,106,${alpha})`);
            protonCtx.strokeStyle = gradient;
            protonCtx.lineWidth = 1;
            protonCtx.beginPath();
            protonCtx.moveTo(xi, yi);
            protonCtx.lineTo(xj, yj);
            protonCtx.stroke();
          }
        }
      }

      for(const proton of protons){
        proton.a += proton.sp;
        const px = centerX + Math.cos(proton.a) * proton.d;
        const py = centerY + Math.sin(proton.a) * proton.d * (0.82 + 0.18 * Math.sin(time / 2000));
        const size = proton.s * (0.8 + 0.2 * Math.sin(time / 520 + proton.ph));
        const gradient = protonCtx.createRadialGradient(px, py, 0, px, py, size * 4);
        gradient.addColorStop(0, 'rgba(0,231,255,.95)');
        gradient.addColorStop(1, 'rgba(0,231,255,0)');
        protonCtx.fillStyle = gradient;
        protonCtx.beginPath();
        protonCtx.arc(px, py, size, 0, Math.PI * 2);
        protonCtx.fill();
      }

      protonCtx.globalCompositeOperation = 'source-over';
    }

    function scheduleNeurons(){
      if(reduceMotion){
        neuronScheduler = 'timeout';
        neuronHandle = window.setTimeout(loopNeurons, 120);
      } else {
        neuronScheduler = 'raf';
        neuronHandle = window.requestAnimationFrame(loopNeurons);
      }
    }

    function scheduleProtons(){
      if(reduceMotion){
        protonScheduler = 'timeout';
        protonHandle = window.setTimeout(loopProtons, 120);
      } else {
        protonScheduler = 'raf';
        protonHandle = window.requestAnimationFrame(loopProtons);
      }
    }

    function loopNeurons(){
      drawNeuronsFrame();
      scheduleNeurons();
    }

    function loopProtons(){
      drawProtonsFrame();
      scheduleProtons();
    }

    function start(){
      cancel();
      drawNeuronsFrame();
      drawProtonsFrame();
      scheduleNeurons();
      scheduleProtons();
    }

    function cancel(){
      if(neuronHandle){
        if(neuronScheduler === 'timeout'){
          window.clearTimeout(neuronHandle);
        } else {
          window.cancelAnimationFrame(neuronHandle);
        }
        neuronHandle = null;
      }
      if(protonHandle){
        if(protonScheduler === 'timeout'){
          window.clearTimeout(protonHandle);
        } else {
          window.cancelAnimationFrame(protonHandle);
        }
        protonHandle = null;
      }
      neuronScheduler = 'raf';
      protonScheduler = 'raf';
    }

    resize({ reseed: true });
    start();

    window.addEventListener('resize', () => {
      window.requestAnimationFrame(() => {
        resize({ reseed: true });
        start();
      });
    });

    if(MOTION_QUERY && typeof MOTION_QUERY.addEventListener === 'function'){
      MOTION_QUERY.addEventListener('change', (event) => {
        reduceMotion = event.matches;
        start();
      });
    } else if(MOTION_QUERY && typeof MOTION_QUERY.addListener === 'function'){
      MOTION_QUERY.addListener((event) => {
        reduceMotion = event.matches;
        start();
      });
    }

    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'hidden'){
        cancel();
      } else {
        start();
      }
    });
  }
}
