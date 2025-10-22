import { GREETING } from './constants.js';
import { state } from './state.js';
import { getElements } from './dom.js';
import { addMessage, appendStreamChunk } from './messages.js';
import { setupIngest } from './ingest.js';
import { loadConfig, persistConfig } from './config.js';
import { initSettings } from './settings.js';
import { createChatController } from './chat.js';
import { setupPersistence, restoreChat } from './storage.js';
import { runTests } from './tests.js';
import { fmtBytes } from './utils/format.js';
import { initThemeToggle } from './theme.js';
import { loadPrechat } from './prechat-storage.js';

const config = loadConfig();
const elements = getElements();
const defaultPlaceholder = elements.inputEl ? elements.inputEl.getAttribute('placeholder') || '' : '';
const PRECHAT_DISABLED_PLACEHOLDER = 'Open AIMY via de startpagina en vul de werkbongegevens in.';

applyComposerAvailability(false);
hydratePrechatState();

function hydratePrechatState(){
  const stored = loadPrechat();
  if(!stored || !stored.serialNumber || !stored.hours){
    window.location.replace('index.html');
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
    return;
  }

  addMessage(state, elements.messagesEl, 'assistant', summaryText, { track: true });
  prechat.summaryMessageIndex = state.messages.length - 1;
}

initThemeToggle({
  toggleBtn: elements.themeToggle
});

initSettings({
  settingsBtn: elements.settingsBtn,
  settingsModal: elements.settingsModal,
  closeSettingsBtn: elements.closeSettingsBtn
});

restoreChat({
  state,
  messagesEl: elements.messagesEl,
  docListEl: elements.docList,
  ingestBadge: elements.ingestBadge
});

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
    const value = elements.webhookInput.value.trim();
    config.N8N_WEBHOOK = value || '';
    persistConfig(config);
  });
}

if(elements.authInput){
  elements.authInput.value = config.AUTH_VALUE;
  elements.authInput.addEventListener('change', () => {
    config.AUTH_VALUE = elements.authInput.value;
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
    window.location.href = 'index.html';
  });
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
