import initProtonField from '../scripts/proton-field.js';

export function createBackground({
  canvas = '#aimy-protons',
  overlay = '[data-bg-overlay]',
  logo = '[data-bg-logo]',
  activationClass = 'is-active'
} = {}){
  const overlayEl = typeof overlay === 'string' ? document.querySelector(overlay) : overlay;
  const logoEl = typeof logo === 'string' ? document.querySelector(logo) : logo;

  return initProtonField({
    canvas,
    overlay: overlayEl || undefined,
    logo: logoEl || undefined,
    activationClass
  });
}

export default createBackground;
