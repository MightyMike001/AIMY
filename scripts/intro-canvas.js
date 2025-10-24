import { createBackground } from '../js/bg-canvas.js';

createBackground({
  canvas: '#aimy-protons',
  logo: '#heroImage'
});

const hero = document.querySelector('.intro-hero');
const heroVideo = document.getElementById('heroVideo');

if(hero && heroVideo){
  let isPlaying = false;
  let canPlayHandler = null;

  function deactivateHero(){
    hero.classList.remove('is-playing');
  }

  function clearCanPlayHandler(){
    if(canPlayHandler){
      heroVideo.removeEventListener('canplay', canPlayHandler);
      canPlayHandler = null;
    }
  }

  function resetVideoState(){
    deactivateHero();
    heroVideo.pause();
    if(heroVideo.currentTime !== 0){
      heroVideo.currentTime = 0;
    }
    heroVideo.removeEventListener('ended', handleVideoEnded);
    clearCanPlayHandler();
    isPlaying = false;
  }

  function handleVideoEnded(){
    resetVideoState();
  }

  function attemptPlayback(){
    const playAttempt = heroVideo.play();
    if(playAttempt && typeof playAttempt.then === 'function'){
      playAttempt
        .then(() => {
          if(heroVideo.paused){
            resetVideoState();
            return;
          }
          hero.classList.add('is-playing');
        })
        .catch(() => {
          resetVideoState();
        });
    } else {
      if(heroVideo.paused){
        resetVideoState();
        return;
      }
      hero.classList.add('is-playing');
    }
  }

  function preparePlayback(){
    clearCanPlayHandler();

    const handler = () => {
      heroVideo.removeEventListener('canplay', handler);
      if(canPlayHandler === handler){
        canPlayHandler = null;
      }
      attemptPlayback();
    };

    canPlayHandler = handler;
    heroVideo.addEventListener('canplay', handler, { once: true });

    if(heroVideo.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA){
      requestAnimationFrame(handler);
    } else {
      heroVideo.load();
    }
  }

  function startPlayback(){
    if(isPlaying){
      return;
    }

    isPlaying = true;
    heroVideo.currentTime = 0;
    heroVideo.muted = true;
    heroVideo.playsInline = true;

    heroVideo.removeEventListener('ended', handleVideoEnded);
    heroVideo.addEventListener('ended', handleVideoEnded, { once: true });

    preparePlayback();
  }

  function handleKeydown(event){
    if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
      event.preventDefault();
      startPlayback();
    }
  }

  function handleVideoError(){
    resetVideoState();
  }

  hero.addEventListener('click', startPlayback);
  hero.addEventListener('keydown', handleKeydown);
  heroVideo.addEventListener('error', handleVideoError);
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      resetVideoState();
    }
  });
}
