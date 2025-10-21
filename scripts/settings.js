export function initSettings({ settingsBtn, settingsModal, closeSettingsBtn }){
  if(!settingsModal){
    return { open: () => {}, close: () => {} };
  }

  const open = () => {
    settingsModal.setAttribute('aria-hidden', 'false');
  };

  const close = () => {
    settingsModal.setAttribute('aria-hidden', 'true');
  };

  settingsBtn?.addEventListener('click', open);
  closeSettingsBtn?.addEventListener('click', close);

  settingsModal.addEventListener('click', (e) => {
    if(e.target === settingsModal){
      close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && settingsModal.getAttribute('aria-hidden') === 'false'){
      close();
    }
  });

  return { open, close };
}
