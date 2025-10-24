import './background.js';
import { loadPrechat, savePrechat, clearPrechat } from './prechat-storage.js';
import { initViewportObserver } from './utils/viewport.js';
import { buildPrechatState, validatePrechatState } from '../js/prechat.js';

const form = document.getElementById('precheckForm');
const serialInput = document.getElementById('serialNumber');
const hoursInput = document.getElementById('hoursCounter');
const faultInput = document.getElementById('faultCodes');
const serialError = document.getElementById('serialNumberError');
const hoursError = document.getElementById('hoursCounterError');
const statusEl = document.getElementById('precheckStatus');
const submitBtn = document.getElementById('startChat');
const resetBtn = document.getElementById('resetPrechat');

initViewportObserver();

prefillFromStorage();
updateFormState({ commit: true });

if(serialInput && !serialInput.value){
  window.setTimeout(() => {
    serialInput.focus();
  }, 60);
}

if(form){
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { valid } = updateFormState({ force: true, persist: true, commit: true });
    if(!valid){
      focusFirstInvalid();
      return;
    }
    window.location.href = 'chat.html';
  });
}

[serialInput, hoursInput, faultInput].forEach((input) => {
  if(!input){
    return;
  }
  input.addEventListener('input', () => {
    input.dataset.touched = 'true';
    updateFormState();
  });
  input.addEventListener('blur', () => {
    input.dataset.touched = 'true';
    updateFormState({ persist: true, commit: true });
  });
});

if(resetBtn){
  resetBtn.addEventListener('click', () => {
    clearPrechat();
    [serialInput, hoursInput, faultInput].forEach((input) => {
      if(input){
        input.value = '';
        delete input.dataset.touched;
      }
    });
    updateFormState({ commit: true });
    serialInput?.focus();
  });
}

function prefillFromStorage(){
  const stored = loadPrechat();
  if(!stored){
    if(submitBtn){
      submitBtn.disabled = true;
    }
    return;
  }
  if(serialInput){
    serialInput.value = stored.serialNumber || '';
  }
  if(hoursInput){
    hoursInput.value = stored.hours || '';
  }
  if(faultInput){
    faultInput.value = stored.faultCodes || '';
  }
}

function updateFormState({ force = false, persist = false, commit = false } = {}){
  const state = buildPrechatState({
    serialNumber: serialInput?.value,
    hours: hoursInput?.value,
    faultCodes: faultInput?.value
  });

  if(commit){
    if(serialInput && serialInput.value !== state.serialNumber){
      serialInput.value = state.serialNumber;
    }
    if(hoursInput && hoursInput.value !== state.hours){
      hoursInput.value = state.hours;
    }
    if(faultInput && faultInput.value !== state.faultCodes){
      faultInput.value = state.faultCodes;
    }
  }

  const { errors, valid } = validatePrechatState(state);

  applyFieldState(serialInput, serialError, errors.serialNumber, { force });
  applyFieldState(hoursInput, hoursError, errors.hours, { force });

  if(statusEl){
    statusEl.classList.toggle('ok', valid);
    statusEl.classList.toggle('warn', !valid);
    statusEl.textContent = valid
      ? 'Alles ingevuld. Start de chat met AIMY.'
      : 'Serienummer en urenstand zijn verplicht. Voeg foutcodes toe als je die hebt.';
  }

  if(submitBtn){
    submitBtn.disabled = !valid;
  }

  if(persist){
    savePrechat(state);
  }

  return { state, valid };
}

function applyFieldState(input, errorEl, message, { force }){
  if(!input){
    return;
  }
  if(force){
    input.dataset.touched = 'true';
  }
  const touched = force || input.dataset.touched === 'true';
  const fieldContainer = input.closest('.field');
  const showError = touched && Boolean(message);
  if(fieldContainer){
    fieldContainer.classList.toggle('invalid', touched && message);
  }
  if(errorEl){
    errorEl.textContent = showError ? message : '';
  }
}

function focusFirstInvalid(){
  const invalidField = [serialInput, hoursInput].find((input) => {
    if(!input){
      return false;
    }
    const container = input.closest('.field');
    return container?.classList.contains('invalid');
  });
  invalidField?.focus();
}
