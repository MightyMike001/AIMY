const hasWindow = typeof window !== 'undefined';
const hasDocument = typeof document !== 'undefined';
const hasElement = typeof Element !== 'undefined';
const hasHTMLElement = typeof HTMLElement !== 'undefined';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function isElementVisible(element){
  if(!hasHTMLElement || !(element instanceof HTMLElement)){
    return false;
  }
  if(element.hidden){
    return false;
  }
  const ariaHiddenParent = typeof element.closest === 'function'
    ? element.closest('[aria-hidden="true"]')
    : null;
  if(ariaHiddenParent && ariaHiddenParent !== element){
    return false;
  }
  const style = hasWindow && typeof window.getComputedStyle === 'function'
    ? window.getComputedStyle(element)
    : null;
  if(style && (style.display === 'none' || style.visibility === 'hidden')){
    return false;
  }
  return true;
}

export function getFocusableElements(container){
  if(!hasDocument || !hasElement || !container){
    return [];
  }
  const root = container instanceof Element ? container : null;
  if(!root){
    return [];
  }
  const elements = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
  return elements.filter((el) => isElementVisible(el));
}

export function createFocusTrap(container, { initialFocus } = {}){
  if(!hasDocument || !hasElement || !container){
    return {
      activate(){},
      deactivate(){},
      isActive(){
        return false;
      }
    };
  }

  if(!container.hasAttribute('tabindex')){
    container.setAttribute('tabindex', '-1');
  }

  let active = false;
  let previouslyFocused = null;

  function focusInitial(){
    if(typeof document === 'undefined'){
      return;
    }
    const focusable = getFocusableElements(container);
    let target = null;
    if(typeof initialFocus === 'function'){
      target = initialFocus(focusable);
    }else if(hasHTMLElement && initialFocus instanceof HTMLElement){
      target = initialFocus;
    }
    if(target && container.contains(target)){
      target.focus({ preventScroll: true });
      return;
    }
    if(focusable.length > 0){
      focusable[0].focus({ preventScroll: true });
      return;
    }
    container.focus({ preventScroll: true });
  }

  function handleKeydown(event){
    if(!active || event.key !== 'Tab'){
      return;
    }
    const focusable = getFocusableElements(container);
    if(focusable.length === 0){
      event.preventDefault();
      container.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if(event.shiftKey){
      if(current === first || !container.contains(current)){
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
      return;
    }

    if(current === last){
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function activate(){
    if(active){
      return;
    }
    previouslyFocused = hasHTMLElement && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    active = true;
    container.addEventListener('keydown', handleKeydown);
    focusInitial();
  }

  function deactivate(){
    if(!active){
      return;
    }
    active = false;
    container.removeEventListener('keydown', handleKeydown);
    const target = previouslyFocused;
    previouslyFocused = null;
    if(target && typeof target.focus === 'function' && (!hasDocument || document.contains(target))){
      target.focus({ preventScroll: true });
    }
  }

  return {
    activate,
    deactivate,
    isActive(){
      return active;
    }
  };
}

export function setAriaPressed(control, pressed){
  if(!hasHTMLElement || !(control instanceof HTMLElement)){
    return;
  }
  control.setAttribute('aria-pressed', pressed ? 'true' : 'false');
}
