import { createBackground } from '../js/bg-canvas.js';

createBackground({
  canvas: '#proton-field',
  logo: '.intro-logo'
});

const logoTrigger = document.querySelector('.intro-logo-trigger');
const logoVideo = logoTrigger?.querySelector('.intro-logo-video');

if(logoTrigger && logoVideo){
  const reduceMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function resetPlayback(){
    logoTrigger.classList.remove('is-playing');
    logoVideo.pause();
    logoVideo.currentTime = 0;
    logoTrigger.setAttribute('aria-pressed', 'false');
  }

  function startPlayback(){
    if(reduceMotionQuery.matches){
      resetPlayback();
      return;
    }

    logoTrigger.classList.add('is-playing');
    logoTrigger.setAttribute('aria-pressed', 'true');
    logoVideo.pause();
    logoVideo.currentTime = 0;

    const playPromise = logoVideo.play();
    if(typeof playPromise?.catch === 'function'){
      playPromise.catch(() => {
        resetPlayback();
      });
    }
  }

  function handleVisibilityChange(){
    if(document.hidden){
      resetPlayback();
    }
  }

  logoTrigger.addEventListener('click', startPlayback);
  logoVideo.addEventListener('ended', resetPlayback);
  logoVideo.addEventListener('error', resetPlayback);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const onReduceMotionChange = event => {
    if(event.matches){
      resetPlayback();
    }
  };

  if(typeof reduceMotionQuery.addEventListener === 'function'){
    reduceMotionQuery.addEventListener('change', onReduceMotionChange);
  }else if(typeof reduceMotionQuery.addListener === 'function'){
    reduceMotionQuery.addListener(onReduceMotionChange);
  }
}
