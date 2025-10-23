const CSS_APP_HEIGHT = '--app-height';
const CSS_APP_WIDTH = '--app-width';

function updateViewportVars(){
  const root = document.documentElement;
  if(!root){
    return;
  }

  const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
  const width = Math.round(window.visualViewport?.width || window.innerWidth || 0);

  if(Number.isFinite(height) && height > 0){
    root.style.setProperty(CSS_APP_HEIGHT, `${height}px`);
  }

  if(Number.isFinite(width) && width > 0){
    root.style.setProperty(CSS_APP_WIDTH, `${width}px`);
  }
}

let initialized = false;

export function initViewportObserver(){
  if(initialized){
    updateViewportVars();
    return;
  }
  initialized = true;

  updateViewportVars();

  const resizeHandler = () => updateViewportVars();
  window.addEventListener('resize', resizeHandler, { passive: true });
  window.addEventListener('orientationchange', resizeHandler, { passive: true });

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', resizeHandler, { passive: true });
    window.visualViewport.addEventListener('scroll', resizeHandler, { passive: true });
  }
}
