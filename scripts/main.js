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

const config = loadConfig();
const elements = getElements();

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
  elements.newChatBtn.addEventListener('click', () => chat.resetChat());
}

if(elements.quickContainer && elements.inputEl){
  elements.quickContainer.addEventListener('click', (e) => {
    if(e.target.matches('.tag')){
      elements.inputEl.value = e.target.getAttribute('data-q');
      elements.inputEl.focus();
    }
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
