import { CONFIG_KEY } from './constants.js';
import { sanitizeHeaderValue, safeStringify } from './utils/security.js';
import { createFocusTrap, setAriaPressed } from '../js/a11y.js';

const SAVE_DEBOUNCE_MS = 500;
const SAVE_FEEDBACK_MS = 2000;

function readSettingsSnapshot(){
  try{
    const raw = localStorage.getItem(CONFIG_KEY);
    if(!raw){
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  }catch{
    return {};
  }
}

function writeSettingsSnapshot(nextSnapshot){
  const serialized = safeStringify(nextSnapshot);
  if(!serialized){
    return;
  }
  try{
    localStorage.setItem(CONFIG_KEY, serialized);
  }catch{
    /* ignore storage errors */
  }
}

export function initSettings({
  settingsBtn,
  settingsModal,
  closeSettingsBtn,
  webhookInput,
  authInput,
  citationsCheckbox,
  config,
  onWebhookInput,
  onWebhookCommit,
  onTokenPersist
} = {}){
  if(!settingsModal){
    return { open: () => {}, close: () => {} };
  }

  const modalCard = settingsModal.querySelector('.modal-card');
  const focusTrap = createFocusTrap(settingsModal, {
    initialFocus(focusable){
      if(closeSettingsBtn && settingsModal.contains(closeSettingsBtn)){
        return closeSettingsBtn;
      }
      return Array.isArray(focusable) && focusable.length > 0 ? focusable[0] : null;
    }
  });
  let feedbackTimer = null;
  let saveTimer = null;

  let saveIndicator = null;
  if(modalCard){
    saveIndicator = modalCard.querySelector('.settings-save-indicator');
    if(!saveIndicator){
      saveIndicator = document.createElement('div');
      saveIndicator.className = 'settings-save-indicator';
      saveIndicator.textContent = 'Opgeslagen ✓';
      saveIndicator.setAttribute('role', 'status');
      saveIndicator.setAttribute('aria-live', 'polite');
      modalCard.append(saveIndicator);
    }
  }

  const storedSettings = readSettingsSnapshot();

  if(settingsBtn){
    setAriaPressed(settingsBtn, false);
  }

  if(webhookInput){
    const initialWebhook = typeof storedSettings.N8N_WEBHOOK === 'string' ? storedSettings.N8N_WEBHOOK : '';
    const fallbackWebhook = config?.N8N_WEBHOOK || '';
    webhookInput.value = initialWebhook || fallbackWebhook;
    if((initialWebhook || fallbackWebhook) && config){
      config.N8N_WEBHOOK = initialWebhook || fallbackWebhook;
    }
  }

  if(authInput){
    const initialToken = typeof storedSettings.AUTH_VALUE === 'string' && storedSettings.AUTH_VALUE
      ? storedSettings.AUTH_VALUE
      : config?.AUTH_VALUE || '';
    authInput.value = initialToken;
    if(initialToken && config){
      config.AUTH_VALUE = initialToken;
    }
  }

  if(citationsCheckbox){
    if(typeof storedSettings.SHOW_CITATIONS === 'boolean'){
      citationsCheckbox.checked = storedSettings.SHOW_CITATIONS;
    }
  }

  if(typeof onWebhookInput === 'function'){
    onWebhookInput();
  }

  function showIndicator(){
    if(!saveIndicator){
      return;
    }
    saveIndicator.classList.add('is-visible');
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      saveIndicator.classList.remove('is-visible');
    }, SAVE_FEEDBACK_MS);
  }

  function updateSnapshot(){
    const nextSnapshot = { ...readSettingsSnapshot() };

    if(webhookInput){
      nextSnapshot.N8N_WEBHOOK = webhookInput.value.trim();
    }

    if(authInput){
      const sanitized = sanitizeHeaderValue(authInput.value);
      if(sanitized !== authInput.value){
        authInput.value = sanitized;
      }
      nextSnapshot.AUTH_VALUE = sanitized;
    }

    if(config && typeof config.AUTH_HEADER === 'string'){
      nextSnapshot.AUTH_HEADER = config.AUTH_HEADER;
    }

    if(citationsCheckbox){
      nextSnapshot.SHOW_CITATIONS = !!citationsCheckbox.checked;
    }

    writeSettingsSnapshot(nextSnapshot);
    showIndicator();
  }

  function scheduleSave({ immediate = false } = {}){
    window.clearTimeout(saveTimer);
    if(immediate){
      saveTimer = null;
      updateSnapshot();
      return;
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      updateSnapshot();
    }, SAVE_DEBOUNCE_MS);
  }

  if(webhookInput){
    const handleInput = () => {
      if(typeof onWebhookInput === 'function'){
        onWebhookInput();
      }
      scheduleSave();
    };
    webhookInput.addEventListener('input', handleInput);
    webhookInput.addEventListener('change', () => {
      if(typeof onWebhookCommit === 'function'){
        onWebhookCommit();
      }
      scheduleSave({ immediate: true });
    });
    webhookInput.addEventListener('blur', () => {
      if(typeof onWebhookCommit === 'function'){
        onWebhookCommit();
      }
      scheduleSave({ immediate: true });
    });
  }

  if(authInput){
    const handleToken = ({ immediate, persist }) => {
      if(persist && typeof onTokenPersist === 'function'){
        onTokenPersist();
      }
      scheduleSave({ immediate });
    };
    authInput.addEventListener('input', () => handleToken({ immediate: false, persist: false }));
    authInput.addEventListener('change', () => handleToken({ immediate: true, persist: true }));
    authInput.addEventListener('blur', () => handleToken({ immediate: true, persist: true }));
  }

  if(citationsCheckbox){
    citationsCheckbox.addEventListener('change', () => {
      scheduleSave({ immediate: true });
    });
  }

  const isOpen = () => settingsModal.getAttribute('aria-hidden') === 'false';

  const open = () => {
    if(isOpen()){
      return;
    }
    settingsModal.setAttribute('aria-hidden', 'false');
    setAriaPressed(settingsBtn, true);
    focusTrap.activate();
  };

  const close = () => {
    if(!isOpen()){
      return;
    }
    settingsModal.setAttribute('aria-hidden', 'true');
    setAriaPressed(settingsBtn, false);
    focusTrap.deactivate();
  };

  settingsBtn?.addEventListener('click', () => {
    if(isOpen()){
      close();
    }else{
      open();
    }
  });
  closeSettingsBtn?.addEventListener('click', close);

  settingsModal.addEventListener('click', (e) => {
    if(e.target === settingsModal){
      close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && isOpen()){
      e.preventDefault();
      close();
    }
  });

  return { open, close };
}
