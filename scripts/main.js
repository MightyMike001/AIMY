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
const PRECHECK_DISABLED_PLACEHOLDER = 'Vul eerst serienummer en urenstand in (foutcodes zijn optioneel).';
const SERIAL_PATTERN = /^[A-Za-z0-9-]{5,20}$/;
const HOURS_PATTERN = /^\d{1,6}$/;
const FAULT_PATTERN = /^[A-Za-z0-9,\-\s]+$/;

ensurePrechatState();

function ensurePrechatState(){
  if(!state.prechat){
    state.prechat = {
      serialNumber: '',
      hours: '',
      faultCodes: '',
      ready: false,
      completed: false,
      valid: false,
      summaryMessageIndex: null
    };
  }
  return state.prechat;
}

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

function renderPrechatSummary(){
  const prechat = ensurePrechatState();
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
  const prechat = ensurePrechatState();
  if(!elements.messagesEl){
    return;
  }

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

function showPrechat(){
  const prechat = ensurePrechatState();
  prechat.completed = false;
  prechat.ready = false;
  applyComposerAvailability(false);
  document.body.classList.add('prechat');
  if(elements.precheckPage){
    elements.precheckPage.setAttribute('aria-hidden', 'false');
  }
  window.requestAnimationFrame(() => {
    updatePrecheck();
  });
  window.setTimeout(() => {
    if(elements.serialInput){
      elements.serialInput.focus();
    }
  }, 60);
}

function completePrecheck(){
  const valid = updatePrecheck({ force: true });
  if(!valid){
    return;
  }
  const prechat = ensurePrechatState();
  prechat.completed = true;
  prechat.ready = true;
  applyComposerAvailability(true);
  renderPrechatSummary();
  document.body.classList.remove('prechat');
  if(elements.precheckPage){
    elements.precheckPage.setAttribute('aria-hidden', 'true');
  }
  sharePrechatIntro();
  if(elements.inputEl){
    window.requestAnimationFrame(() => {
      elements.inputEl.focus();
    });
  }
}

function updatePrecheck({ force = false } = {}){
  const prechat = ensurePrechatState();

  const fields = [
    {
      input: elements.serialInput,
      errorEl: elements.serialError,
      key: 'serialNumber',
      normalize: (value) => value.toUpperCase(),
      validate: (value) => value.length > 0 && SERIAL_PATTERN.test(value),
      message: 'Gebruik 5-20 tekens (letters, cijfers of streepje).'
    },
    {
      input: elements.hoursInput,
      errorEl: elements.hoursError,
      key: 'hours',
      normalize: (value) => value.replace(/\D+/g, ''),
      validate: (value) => value.length > 0 && HOURS_PATTERN.test(value),
      message: 'Vul de urenstand in met maximaal 6 cijfers.'
    },
    {
      input: elements.faultInput,
      errorEl: elements.faultError,
      key: 'faultCodes',
      normalize: (value) => {
        let normalized = value.toUpperCase().replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
        normalized = normalized.replace(/,\s*$/, '');
        return normalized;
      },
      validate: (value) => value.length === 0 || FAULT_PATTERN.test(value),
      message: 'Gebruik alleen cijfers, letters, spaties, komma\'s of koppeltekens.'
    }
  ];

  let allValid = true;

  fields.forEach((field) => {
    if(!field.input){
      allValid = false;
      return;
    }

    let value = field.input.value.trim();
    if(field.normalize){
      value = field.normalize(value);
      if(field.input.value !== value){
        field.input.value = value;
      }
    }

    const valid = field.validate(value);
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

    prechat[field.key] = value;

    if(!valid){
      allValid = false;
    }
  });

  prechat.valid = allValid;
  const canChat = prechat.completed && allValid;
  prechat.ready = canChat;

  if(elements.precheckStatus){
    elements.precheckStatus.classList.toggle('ok', allValid);
    elements.precheckStatus.classList.toggle('warn', !allValid);
    elements.precheckStatus.textContent = allValid
      ? 'Gegevens compleet. Start de chat met AIMY.'
      : 'Serienummer en urenstand zijn verplicht. Voeg foutcodes toe als je die hebt.';
  }

  if(prechat.completed){
    applyComposerAvailability(canChat);
  }else{
    applyComposerAvailability(false);
  }

  renderPrechatSummary();

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
  elements.newChatBtn.addEventListener('click', () => {
    chat.resetChat();
    if(state.prechat && state.prechat.ready){
      window.requestAnimationFrame(() => {
        sharePrechatIntro();
      });
    }
  });
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
    completePrecheck();
  });
}

if(elements.editPrechatBtn){
  elements.editPrechatBtn.addEventListener('click', () => {
    showPrechat();
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
