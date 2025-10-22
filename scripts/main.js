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
const defaultPlaceholder = elements.inputEl ? elements.inputEl.getAttribute('placeholder') || '' : '';
const PRECHECK_DISABLED_PLACEHOLDER = 'Vul eerst serienummer, urenstand en foutcodes in.';

function applyComposerAvailability(ready){
  if(elements.inputEl){
    elements.inputEl.disabled = !ready;
    elements.inputEl.setAttribute('aria-disabled', String(!ready));
    elements.inputEl.placeholder = ready ? defaultPlaceholder : PRECHECK_DISABLED_PLACEHOLDER;
  }
  if(elements.sendBtn && !state.streaming){
    elements.sendBtn.disabled = !ready;
  }
}

function updatePrecheck({ force = false } = {}){
  if(!state.prechat){
    state.prechat = {
      serialNumber: '',
      hours: '',
      faultCodes: '',
      ready: false
    };
  }

  const fields = [
    {
      input: elements.serialInput,
      errorEl: elements.serialError,
      key: 'serialNumber',
      validate: (value) => /^\d{1,12}$/.test(value),
      message: 'Gebruik maximaal 12 cijfers.'
    },
    {
      input: elements.hoursInput,
      errorEl: elements.hoursError,
      key: 'hours',
      validate: (value) => /^\d{1,5}$/.test(value),
      message: 'Vul de urenstand in (maximaal 5 cijfers).'
    },
    {
      input: elements.faultInput,
      errorEl: elements.faultError,
      key: 'faultCodes',
      validate: (value) => value.length > 0,
      message: 'Vul één of meer foutcodes in.'
    }
  ];

  let allValid = true;

  fields.forEach((field) => {
    if(!field.input){
      allValid = false;
      return;
    }

    const value = field.input.value.trim();
    const valid = value.length > 0 && field.validate(value);
    const touched = force || field.input.dataset.touched === 'true';

    if(force){
      field.input.dataset.touched = 'true';
    }

    if(touched){
      field.input.dataset.touched = 'true';
    }

    const fieldContainer = field.input.closest('.field');
    if(fieldContainer){
      fieldContainer.classList.toggle('invalid', touched && !valid);
    }

    if(field.errorEl){
      field.errorEl.textContent = touched && !valid ? field.message : '';
    }

    state.prechat[field.key] = value;

    if(!valid){
      allValid = false;
    }
  });

  state.prechat.ready = allValid;

  if(elements.precheckStatus){
    elements.precheckStatus.classList.toggle('ok', allValid);
    elements.precheckStatus.classList.toggle('warn', !allValid);
    elements.precheckStatus.textContent = allValid
      ? 'Alle verplichte gegevens zijn ingevuld. Je kunt nu chatten.'
      : 'Vul alle verplichte velden in om te starten met chatten.';
  }

  applyComposerAvailability(allValid);

  return allValid;
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

const precheckInputs = [elements.serialInput, elements.hoursInput, elements.faultInput];

precheckInputs.forEach((input) => {
  if(!input){
    return;
  }

  input.addEventListener('input', () => {
    input.dataset.touched = 'true';
    updatePrecheck();
  });

  input.addEventListener('blur', () => {
    input.dataset.touched = 'true';
    updatePrecheck();
  });
});

if(elements.precheckForm){
  elements.precheckForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const valid = updatePrecheck({ force: true });
    if(valid && elements.inputEl && !elements.inputEl.disabled){
      elements.inputEl.focus();
    }
  });
}

updatePrecheck();

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
