import { createBackground } from '../js/bg-canvas.js';

createBackground({
  canvas: '#aimy-protons',
  logo: '.intro-logo'
});

const logoWrapper = document.querySelector('.intro-logo-wrapper');
const logoVideo = logoWrapper?.querySelector('.intro-logo-video');

if(logoWrapper && logoVideo){
  let isAttemptingPlayback = false;
  let hideDelayHandle = null;

  function showVideo(){
    if(hideDelayHandle !== null){
      window.clearTimeout(hideDelayHandle);
      hideDelayHandle = null;
    }

    if(!logoWrapper.classList.contains('is-playing')){
      logoWrapper.classList.add('is-playing');
    }
  }

  function stopVideoPlayback(){
    logoVideo.pause();
    if(logoVideo.currentTime !== 0){
      logoVideo.currentTime = 0;
    }
  }

  function hideVideo({ immediate = false } = {}){
    const performHide = () => {
      logoWrapper.classList.remove('is-playing');
      stopVideoPlayback();
    };

    if(immediate){
      performHide();
      return;
    }

    hideDelayHandle = window.setTimeout(() => {
      hideDelayHandle = null;
      performHide();
    }, 120);
  }

  function handleVideoEnd(){
    isAttemptingPlayback = false;
    hideVideo();
  }

  function resetPlayback(){
    isAttemptingPlayback = false;
    hideVideo({ immediate: true });
    logoVideo.removeEventListener('ended', handleVideoEnd);
    logoVideo.removeEventListener('playing', showVideo);
  }

  function startPlayback(){
    if(isAttemptingPlayback){
      if(logoWrapper.classList.contains('is-playing')){
        logoVideo.currentTime = 0;
      }
      return;
    }

    isAttemptingPlayback = true;
    logoVideo.muted = true;
    logoVideo.playsInline = true;
    logoVideo.currentTime = 0;

    logoVideo.removeEventListener('ended', handleVideoEnd);
    logoVideo.removeEventListener('playing', showVideo);
    logoVideo.addEventListener('ended', handleVideoEnd, { once: true });
    logoVideo.addEventListener('playing', showVideo, { once: true });

    // Fade in the video immediately to create a subtle transition.
    requestAnimationFrame(showVideo);

    const playPromise = logoVideo.play();
    if(playPromise && typeof playPromise.then === 'function'){
      playPromise
        .then(() => {
          if(logoVideo.paused){
            resetPlayback();
          }
        })
        .catch(() => {
          resetPlayback();
        });
    } else {
      // If play() does not return a promise, optimistically show the video.
      showVideo();
    }
  }

  function handleKeydown(event){
    if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
      event.preventDefault();
      startPlayback();
    }
  }

  logoWrapper.addEventListener('click', startPlayback);
  logoWrapper.addEventListener('keydown', handleKeydown);
  logoVideo.addEventListener('error', resetPlayback);
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      resetPlayback();
    }
  });
}
