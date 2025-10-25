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

const WEBHOOK_PING_TIMEOUT_MS = 5000;
const WEBHOOK_STATUS_STATES = {
  empty: { tone: 'muted', text: 'Niet ingesteld' },
  idle: { tone: 'muted', text: 'Nog niet getest' },
  loading: { tone: 'loading', text: 'Verbinding testen…' },
  success: { tone: 'success', text: 'Webhook OK' },
  error: { tone: 'error', text: 'Onbereikbaar' },
  invalid: { tone: 'error', text: 'Ongeldige URL' },
  timeout: { tone: 'error', text: 'Onbereikbaar (timeout 5s)' }
};

export function validateUrl(value){
  if(typeof value !== 'string'){
    return false;
  }
  const trimmed = value.trim();
  if(!trimmed){
    return false;
  }
  try{
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  }catch{
    return false;
  }
}

export async function pingEndpoint(url, token, headerName = 'X-AIMY-Token'){
  if(typeof url !== 'string' || !url.trim()){
    return { ok: false };
  }

  let signal;
  let controller = null;
  let timeoutId = null;
  if(typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'){
    signal = AbortSignal.timeout(WEBHOOK_PING_TIMEOUT_MS);
  }else if(typeof AbortController !== 'undefined'){
    controller = new AbortController();
    signal = controller.signal;
    timeoutId = window.setTimeout(() => controller.abort(), WEBHOOK_PING_TIMEOUT_MS);
  }

  const headers = { Accept: 'application/json' };
  if(token){
    headers[headerName] = token;
  }

  async function tryRequest(method){
    try{
      const response = await fetch(url, { method, headers, signal });
      return response;
    }catch(err){
      if(err?.name === 'AbortError' || err?.name === 'TimeoutError'){
        throw err;
      }
      return null;
    }
  }

  try{
    let response = await tryRequest('OPTIONS');
    if(response && response.ok){
      return { ok: true, status: response.status, method: 'OPTIONS' };
    }
    const needsGetFallback = !response || response.status === 405 || response.status >= 400;
    if(needsGetFallback){
      response = await tryRequest('GET');
    }
    if(response && response.ok){
      return { ok: true, status: response.status, method: 'GET' };
    }
    return { ok: false, status: response ? response.status : null };
  }catch(err){
    const timeout = err?.name === 'AbortError' || err?.name === 'TimeoutError';
    return { ok: false, timeout };
  }finally{
    if(timeoutId){
      window.clearTimeout(timeoutId);
    }
  }
}

const config = loadConfig();
const elements = getElements();
const defaultPlaceholder = elements.inputEl ? elements.inputEl.getAttribute('placeholder') || '' : '';
const PRECHAT_DISABLED_PLACEHOLDER = 'Open AIMY via de startpagina en vul de werkbongegevens in.';
const BANNER_FAULTS_EMPTY = 'Geen foutcodes opgegeven';

let lastBannerText = '';
let bannerAnimationTimer = null;
let webhookPingSeq = 0;
const webhookStatusEl = elements.webhookStatus;
let lastPingSnapshot = {
  url: config.N8N_WEBHOOK || '',
  token: config.AUTH_VALUE || '',
  status: config.N8N_WEBHOOK ? 'idle' : 'empty'
};

function renderWebhookStatus(state){
  if(!webhookStatusEl){
    return;
  }
  const status = WEBHOOK_STATUS_STATES[state] || WEBHOOK_STATUS_STATES.idle;
  webhookStatusEl.textContent = status.text;
  webhookStatusEl.dataset.tone = status.tone;
}

function handleWebhookInputEvent(){
  if(!elements.webhookInput){
    return;
  }
  const raw = elements.webhookInput.value.trim();
  if(!raw){
    renderWebhookStatus('empty');
    return;
  }
  if(!validateUrl(raw)){
    renderWebhookStatus('invalid');
    return;
  }
  const normalized = normalizeWebhookUrl(raw);
  if(!normalized){
    renderWebhookStatus('invalid');
    return;
  }
  if(lastPingSnapshot.url === normalized && lastPingSnapshot.status){
    renderWebhookStatus(lastPingSnapshot.status);
    return;
  }
  renderWebhookStatus('idle');
}

async function commitWebhookInput({ forcePing = false } = {}){
  if(!elements.webhookInput){
    return;
  }
  const raw = elements.webhookInput.value.trim();
  if(!raw){
    config.N8N_WEBHOOK = '';
    lastPingSnapshot = { url: '', token: config.AUTH_VALUE || '', status: 'empty' };
    persistConfig(config);
    renderWebhookStatus('empty');
    return;
  }
  if(!validateUrl(raw)){
    config.N8N_WEBHOOK = '';
    lastPingSnapshot = { url: '', token: config.AUTH_VALUE || '', status: 'invalid' };
    persistConfig(config);
    renderWebhookStatus('invalid');
    return;
  }
  const normalized = normalizeWebhookUrl(raw);
  if(!normalized){
    config.N8N_WEBHOOK = '';
    lastPingSnapshot = { url: '', token: config.AUTH_VALUE || '', status: 'invalid' };
    persistConfig(config);
    renderWebhookStatus('invalid');
    return;
  }
  if(elements.webhookInput.value !== normalized){
    elements.webhookInput.value = normalized;
  }
  if(config.N8N_WEBHOOK !== normalized){
    config.N8N_WEBHOOK = normalized;
    persistConfig(config);
  }
  const currentToken = config.AUTH_VALUE || '';
  const previous = lastPingSnapshot;
  let shouldPing = forcePing;
  if(!shouldPing){
    if(!previous.url){
      shouldPing = true;
    }else if(previous.url !== normalized || previous.token !== currentToken){
      shouldPing = true;
    }else if(previous.status !== 'success' && previous.status !== 'loading'){
      shouldPing = true;
    }
  }
  if(!shouldPing){
    renderWebhookStatus(previous.status || 'success');
    lastPingSnapshot = { ...previous, url: normalized, token: currentToken };
    return;
  }

  const requestId = ++webhookPingSeq;
  lastPingSnapshot = { url: normalized, token: currentToken, status: 'loading' };
  renderWebhookStatus('loading');
  let result;
  try{
    result = await pingEndpoint(normalized, currentToken, config.AUTH_HEADER);
  }catch{
    result = { ok: false };
  }
  if(requestId !== webhookPingSeq){
    return;
  }
  if(result?.ok){
    lastPingSnapshot = { url: normalized, token: currentToken, status: 'success' };
    renderWebhookStatus('success');
  }else if(result?.timeout){
    lastPingSnapshot = { url: normalized, token: currentToken, status: 'timeout' };
    renderWebhookStatus('timeout');
  }else{
    lastPingSnapshot = { url: normalized, token: currentToken, status: 'error' };
    renderWebhookStatus('error');
  }
}

function persistToken(){
  if(!elements.authInput){
    return;
  }
  const sanitized = sanitizeHeaderValue(elements.authInput.value);
  if(elements.authInput.value !== sanitized){
    elements.authInput.value = sanitized;
  }
  if(config.AUTH_VALUE !== sanitized){
    config.AUTH_VALUE = sanitized;
  }
  persistConfig(config);
  if(elements.webhookInput && elements.webhookInput.value.trim()){
    commitWebhookInput({ forcePing: true });
  }else if(elements.webhookInput){
    handleWebhookInputEvent();
  }
}

initViewportObserver();

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
  closeSettingsBtn: elements.closeSettingsBtn,
  webhookInput: elements.webhookInput,
  authInput: elements.authInput,
  citationsCheckbox: elements.citationsCheckbox,
  config,
  onWebhookInput: handleWebhookInputEvent,
  onWebhookCommit: commitWebhookInput,
  onTokenPersist: persistToken
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
  ingestBadge: elements.ingestBadge,
  testBadge: elements.testBadge
});

if(webhookStatusEl){
  renderWebhookStatus(lastPingSnapshot.status);
}

if(elements.webhookInput && config.N8N_WEBHOOK){
  window.requestAnimationFrame(() => {
    commitWebhookInput({ forcePing: true });
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
