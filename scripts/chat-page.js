import './background.js';
import { GREETING } from './constants.js';
import { state } from './state.js';
import { getElements } from './dom.js';
import { addMessage, appendStreamChunk, renderMessages } from './messages.js';
import { setupIngest } from './ingest.js';
import { loadConfig, persistConfig } from './config.js';
import { initSettings } from './settings.js';
import { createChatController } from './chat.js';
import { setupPersistence, restoreChatState, persistHistorySnapshot } from './storage.js';
import { runTests } from './tests.js';
import { fmtBytes } from './utils/format.js';
import { loadPrechat } from './prechat-storage.js';
import { initViewportObserver } from './utils/viewport.js';
import { normalizeWebhookUrl, sanitizeHeaderValue } from './utils/security.js';

const config = loadConfig();
const elements = getElements();
const defaultPlaceholder = elements.inputEl ? elements.inputEl.getAttribute('placeholder') || '' : '';
const PRECHAT_DISABLED_PLACEHOLDER = 'Open AIMY via de startpagina en vul de werkbongegevens in.';
const BANNER_FAULTS_EMPTY = 'Geen foutcodes opgegeven';

let lastBannerText = '';
let bannerAnimationTimer = null;
let summaryObserver = null;

initViewportObserver();

setupBannerObservers();

applyComposerAvailability(false);
hydratePrechatState();

function hydratePrechatState(){
  const stored = loadPrechat();
  if(!stored || !stored.serialNumber || !stored.hours){
    window.location.replace('prechat.html');
    return;
  }

  state.prechat = {
    serialNumber: stored.serialNumber || '',
    hours: stored.hours || '',
    faultCodes: stored.faultCodes || '',
    ready: true,
    completed: true,
    valid: true,
    summaryMessageIndex: null
  };
  applyComposerAvailability(true);
  renderPrechatSummary();
  persistHistorySnapshot(state);
}

function applyComposerAvailability(ready){
  if(elements.inputEl){
    elements.inputEl.disabled = !ready;
    elements.inputEl.setAttribute('aria-disabled', String(!ready));
    elements.inputEl.placeholder = ready ? defaultPlaceholder : PRECHAT_DISABLED_PLACEHOLDER;
  }
  if(elements.sendBtn && !state.streaming){
    elements.sendBtn.disabled = !ready;
  }
}

function renderPrechatSummary(){
  const prechat = state.prechat || {
    serialNumber: '',
    hours: '',
    faultCodes: ''
  };
  if(elements.summarySerial){
    elements.summarySerial.textContent = prechat.serialNumber || '—';
  }
  if(elements.summaryHours){
    elements.summaryHours.textContent = prechat.hours || '—';
  }
  if(elements.summaryFaults){
    const hasFaults = Boolean(prechat.faultCodes);
    elements.summaryFaults.textContent = hasFaults ? prechat.faultCodes : 'Geen foutcodes opgegeven';
    elements.summaryFaults.classList.toggle('empty', !hasFaults);
  }
  updateBannerInfo(prechat);
}

function updateBannerInfo(source){
  if(!elements.bannerInfo || !elements.bannerSerial || !elements.bannerHours || !elements.bannerFaults){
    return;
  }
  const serial = sanitizeBannerValue(source?.serialNumber);
  const hours = sanitizeBannerValue(source?.hours);
  const faults = sanitizeFaultValue(source?.faultCodes);
  const serialText = serial || '—';
  const hoursText = hours || '—';
  const faultsText = faults || BANNER_FAULTS_EMPTY;
  const bannerText = `${serialText}|${hoursText}|${faultsText}`;
  if(bannerText === lastBannerText){
    return;
  }
  lastBannerText = bannerText;
  elements.bannerSerial.textContent = serialText;
  elements.bannerHours.textContent = hoursText;
  elements.bannerFaults.textContent = faultsText;
  elements.bannerFaults.classList.toggle('empty', !faults);
  triggerBannerAnimation();
}

function triggerBannerAnimation(){
  if(!elements.bannerInfo){
    return;
  }
  elements.bannerInfo.classList.remove('banner-info-animate');
  // Force reflow to restart the animation when the text changes rapidly.
  void elements.bannerInfo.offsetWidth;
  elements.bannerInfo.classList.add('banner-info-animate');
  if(bannerAnimationTimer){
    window.clearTimeout(bannerAnimationTimer);
  }
  bannerAnimationTimer = window.setTimeout(() => {
    elements.bannerInfo?.classList.remove('banner-info-animate');
  }, 920);
}

function sanitizeBannerValue(value){
  if(typeof value !== 'string'){
    return '';
  }
  const trimmed = value.trim();
  if(!trimmed || trimmed === '—'){
    return '';
  }
  return trimmed;
}

function sanitizeFaultValue(value){
  const cleaned = sanitizeBannerValue(value);
  if(!cleaned){
    return '';
  }
  return cleaned.toLowerCase() === BANNER_FAULTS_EMPTY.toLowerCase() ? '' : cleaned;
}

function updateBannerFromElements(){
  updateBannerInfo({
    serialNumber: elements.summarySerial ? elements.summarySerial.textContent || '' : '',
    hours: elements.summaryHours ? elements.summaryHours.textContent || '' : '',
    faultCodes: elements.summaryFaults ? elements.summaryFaults.textContent || '' : ''
  });
}

function setupBannerObservers(){
  if(summaryObserver || !elements.bannerInfo){
    return;
  }
  const targets = [elements.summarySerial, elements.summaryHours, elements.summaryFaults].filter(Boolean);
  if(!targets.length){
    return;
  }
  summaryObserver = new MutationObserver(() => {
    updateBannerFromElements();
  });
  targets.forEach((target) => {
    summaryObserver.observe(target, {
      characterData: true,
      childList: true,
      subtree: true
    });
  });
  updateBannerFromElements();
}

function sharePrechatIntro(){
  if(!elements.messagesEl || !state.prechat){
    return;
  }

  const prechat = state.prechat;
  const faultsText = prechat.faultCodes ? prechat.faultCodes : 'geen foutcodes opgegeven';
  const summaryText = [
    'Top, ik heb de volgende gegevens ontvangen:',
    `• Serienummer: ${prechat.serialNumber || 'onbekend'}`,
    `• Urenstand: ${prechat.hours || 'onbekend'}`,
    `• Foutcodes: ${faultsText}`,
    'Laat me weten waarbij ik kan helpen.'
  ].join('\n');

  const summaryIndex = typeof prechat.summaryMessageIndex === 'number' ? prechat.summaryMessageIndex : null;
  if(summaryIndex != null && state.messages[summaryIndex]){
    state.messages[summaryIndex].content = summaryText;
    const existingBubble = elements.messagesEl.children[summaryIndex];
    if(existingBubble){
      const contentEl = existingBubble.querySelector('.content');
      if(contentEl){
        contentEl.textContent = summaryText;
      }
    }
    persistHistorySnapshot(state);
    return;
  }

  const replaceableGreeting = state.messages.length === 1 && state.messages[0].content === GREETING;
  if(replaceableGreeting){
    state.messages[0].content = summaryText;
    prechat.summaryMessageIndex = 0;
    const firstBubble = elements.messagesEl.firstElementChild;
    if(firstBubble){
      const contentEl = firstBubble.querySelector('.content');
      if(contentEl){
        contentEl.textContent = summaryText;
      }
    }
    persistHistorySnapshot(state);
    return;
  }

  addMessage(state, elements.messagesEl, 'assistant', summaryText, { track: true });
  prechat.summaryMessageIndex = state.messages.length - 1;
  persistHistorySnapshot(state);
}

initSettings({
  settingsBtn: elements.settingsBtn,
  settingsModal: elements.settingsModal,
  closeSettingsBtn: elements.closeSettingsBtn
});

const restoreResult = restoreChatState(state);

if(restoreResult?.error){
  console.warn('chat-page: kon chat niet herstellen uit opslag');
}

if(elements.messagesEl){
  renderMessages(state, elements.messagesEl);
}

persistHistorySnapshot(state);

if(elements.messagesEl && !elements.messagesEl.childElementCount){
  addMessage(state, elements.messagesEl, 'assistant', GREETING, { track: false, scroll: false });
}

if(state.prechat && state.prechat.ready){
  sharePrechatIntro();
}

setupIngest({
  state,
  dropEl: elements.drop,
  fileInput: elements.fileInput,
  docListEl: elements.docList,
  ingestBadge: elements.ingestBadge
});

if(elements.webhookInput){
  elements.webhookInput.value = config.N8N_WEBHOOK;
  elements.webhookInput.addEventListener('change', () => {
    const normalized = normalizeWebhookUrl(elements.webhookInput.value);
    config.N8N_WEBHOOK = normalized;
    elements.webhookInput.value = normalized;
    persistConfig(config);
  });
}

if(elements.authInput){
  elements.authInput.value = config.AUTH_VALUE;
  elements.authInput.addEventListener('change', () => {
    const sanitized = sanitizeHeaderValue(elements.authInput.value);
    config.AUTH_VALUE = sanitized;
    elements.authInput.value = sanitized;
    persistConfig(config);
  });
}

const chat = createChatController({
  state,
  config,
  elements
});

if(elements.sendBtn){
  elements.sendBtn.addEventListener('click', () => chat.send());
}

if(elements.inputEl){
  elements.inputEl.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      chat.send();
    }
  });
}

if(elements.newChatBtn){
  elements.newChatBtn.addEventListener('click', () => {
    chat.resetChat();
    if(state.prechat && state.prechat.ready){
      window.requestAnimationFrame(() => {
        sharePrechatIntro();
      });
    }
  });
}

if(elements.editPrechatBtn){
  elements.editPrechatBtn.addEventListener('click', () => {
    updateBannerInfo(state.prechat);
    window.location.href = 'prechat.html';
  });
}

window.addEventListener('focus', syncPrechatFromStorage);
window.addEventListener('pageshow', () => {
  if(document.visibilityState === 'visible'){
    syncPrechatFromStorage();
  }
});

function syncPrechatFromStorage(){
  const stored = loadPrechat();
  if(!stored){
    return;
  }
  const serial = stored.serialNumber || '';
  const hours = stored.hours || '';
  const faults = stored.faultCodes || '';
  const ready = Boolean(serial && hours);
  const prechat = state.prechat;
  const changed =
    !prechat ||
    prechat.serialNumber !== serial ||
    prechat.hours !== hours ||
    prechat.faultCodes !== faults;
  if(!changed){
    return;
  }
  if(!state.prechat){
    state.prechat = {
      serialNumber: serial,
      hours,
      faultCodes: faults,
      ready,
      completed: ready,
      valid: ready,
      summaryMessageIndex: null
    };
  }else{
    state.prechat.serialNumber = serial;
    state.prechat.hours = hours;
    state.prechat.faultCodes = faults;
    state.prechat.ready = ready;
    state.prechat.completed = state.prechat.ready;
    state.prechat.valid = state.prechat.ready;
  }
  applyComposerAvailability(ready);
  renderPrechatSummary();
  if(state.prechat.ready){
    sharePrechatIntro();
  }
}

setupPersistence(state);

runTests({
  state,
  fmtBytes,
  send: chat.send,
  resetChat: chat.resetChat,
  appendStreamChunk,
  addMessage,
  messagesEl: elements.messagesEl,
  testBadge: elements.testBadge
});
