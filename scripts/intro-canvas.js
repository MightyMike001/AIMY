import { createBackground } from '../js/bg-canvas.js';

createBackground({
  canvas: '#aimy-protons',
  logo: '.intro-logo'
});

const logoWrapper = document.querySelector('.intro-logo-wrapper');
const logoVideo = logoWrapper?.querySelector('.intro-logo-video');

if(logoWrapper && logoVideo){
  function resetPlayback(){
    logoWrapper.classList.remove('is-playing');
    logoVideo.pause();
    logoVideo.currentTime = 0;
    logoVideo.removeEventListener('ended', handleVideoEnd);
  }

  function handleVideoEnd(){
    resetPlayback();
  }

  function startPlayback(){
    if(logoWrapper.classList.contains('is-playing')){
      return;
    }

    logoWrapper.classList.add('is-playing');
    logoVideo.muted = true;
    logoVideo.playsInline = true;
    logoVideo.currentTime = 0;

    const playPromise = logoVideo.play();
    if(typeof playPromise?.catch === 'function'){
      playPromise.catch(() => {
        resetPlayback();
      });
    }

    logoVideo.removeEventListener('ended', handleVideoEnd);
    logoVideo.addEventListener('ended', handleVideoEnd);
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
}
