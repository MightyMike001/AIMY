import { createBackground } from '../js/bg-canvas.js';

createBackground({
  canvas: '#aimy-protons',
  logo: '.intro-logo'
});

const logoWrapper = document.querySelector('.intro-logo-wrapper');
const logoVideo = logoWrapper?.querySelector('.intro-logo-video');

if(logoWrapper && logoVideo){
  let isAttemptingPlayback = false;

  function handleVideoEnd(){
    resetPlayback();
  }

  function handleVideoPlaying(){
    logoWrapper.classList.add('is-playing');
  }

  function resetPlayback(){
    isAttemptingPlayback = false;
    logoWrapper.classList.remove('is-playing');
    logoVideo.pause();
    logoVideo.currentTime = 0;
    logoVideo.removeEventListener('ended', handleVideoEnd);
    logoVideo.removeEventListener('playing', handleVideoPlaying);
  }

  function startPlayback(){
    if(isAttemptingPlayback){
      if(logoWrapper.classList.contains('is-playing')){
        logoVideo.currentTime = 0;
        const restartPromise = logoVideo.play();
        if(typeof restartPromise?.catch === 'function'){
          restartPromise.catch(() => {
            resetPlayback();
          });
        }
      }
      return;
    }

    isAttemptingPlayback = true;
    logoVideo.muted = true;
    logoVideo.playsInline = true;
    logoVideo.currentTime = 0;

    logoVideo.removeEventListener('ended', handleVideoEnd);
    logoVideo.removeEventListener('playing', handleVideoPlaying);
    logoVideo.addEventListener('ended', handleVideoEnd);
    logoVideo.addEventListener('playing', handleVideoPlaying);

    const playPromise = logoVideo.play();
    if(typeof playPromise?.catch === 'function'){
      playPromise.catch(() => {
        resetPlayback();
      });
    }

    if(typeof playPromise?.then === 'function'){
      playPromise.then(() => {
        if(!logoWrapper.classList.contains('is-playing')){
          logoWrapper.classList.add('is-playing');
        }
      }).catch(() => {
        // Swallow the rejection because the catch above handles it.
      });
    }
  }

  function handleKeydown(event){
    if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
      event.preventDefault();
      startPlayback();
    }
  }

  logoWrapper.addEventListener('click', startPlayback);
  logoWrapper.addEventListener('pointerdown', startPlayback, { passive: true });
  logoWrapper.addEventListener('keydown', handleKeydown);
  logoVideo.addEventListener('error', resetPlayback);
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      resetPlayback();
    }
  });
}
