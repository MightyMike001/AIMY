import './background.js';
import { loadPrechat, savePrechat, clearPrechat } from './prechat-storage.js';
import { initThemeToggle } from './theme.js';
import { initViewportObserver } from './utils/viewport.js';

const SERIAL_PATTERN = /^[A-Za-z0-9-]{5,20}$/;
const HOURS_PATTERN = /^\d{1,6}$/;
const FAULT_PATTERN = /^[A-Za-z0-9,\-\s]+$/;

const form = document.getElementById('precheckForm');
const serialInput = document.getElementById('serialNumber');
const hoursInput = document.getElementById('hoursCounter');
const faultInput = document.getElementById('faultCodes');
const serialError = document.getElementById('serialNumberError');
const hoursError = document.getElementById('hoursCounterError');
const faultError = document.getElementById('faultCodesError');
const statusEl = document.getElementById('precheckStatus');
const submitBtn = document.getElementById('startChat');
const resetBtn = document.getElementById('resetPrechat');
const themeToggle = document.getElementById('themeToggle');

initViewportObserver();
initThemeToggle({ toggleBtn: themeToggle });

prefillFromStorage();
updateFormState();

if(serialInput && !serialInput.value){
  window.setTimeout(() => {
    serialInput.focus();
  }, 60);
}

if(form){
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const valid = updateFormState({ force: true });
    if(!valid){
      return;
    }
    const payload = {
      serialNumber: serialInput ? serialInput.value.trim().toUpperCase() : '',
      hours: hoursInput ? hoursInput.value.trim() : '',
      faultCodes: faultInput ? faultInput.value.trim() : ''
    };
    savePrechat(payload);
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
    updateFormState();
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
    updateFormState();
    serialInput?.focus();
  });
}

function prefillFromStorage(){
  const stored = loadPrechat();
  if(!stored){
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

function updateFormState({ force = false } = {}){
  const fields = [
    {
      input: serialInput,
      errorEl: serialError,
      normalize: (value) => value.toUpperCase(),
      validate: (value) => value.length > 0 && SERIAL_PATTERN.test(value),
      message: 'Gebruik 5-20 tekens (letters, cijfers of streepje).'
    },
    {
      input: hoursInput,
      errorEl: hoursError,
      normalize: (value) => value.replace(/\D+/g, ''),
      validate: (value) => value.length > 0 && HOURS_PATTERN.test(value),
      message: 'Vul de urenstand in met maximaal 6 cijfers.'
    },
    {
      input: faultInput,
      errorEl: faultError,
      normalize: (value) => {
        const cleaned = value.toUpperCase().replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
        return cleaned.replace(/,\s*$/, '');
      },
      validate: (value) => value.length === 0 || FAULT_PATTERN.test(value),
      message: 'Gebruik alleen cijfers, letters, spaties, komma\'s of koppeltekens.'
    }
  ];

  let allValid = true;

  fields.forEach((field) => {
    if(!field.input){
      return;
    }
    let value = field.input.value.trim();
    if(field.normalize){
      const normalized = field.normalize(value);
      if(normalized !== field.input.value){
        field.input.value = normalized;
      }
      value = normalized.trim();
    }

    const valid = field.validate ? field.validate(value) : true;
    const touched = force || field.input.dataset.touched === 'true';

    if(force){
      field.input.dataset.touched = 'true';
    }

    const fieldContainer = field.input.closest('.field');
    if(fieldContainer){
      fieldContainer.classList.toggle('invalid', touched && !valid);
    }

    if(field.errorEl){
      field.errorEl.textContent = touched && !valid ? field.message : '';
    }

    if(!valid){
      allValid = false;
    }
  });

  if(statusEl){
    statusEl.classList.toggle('ok', allValid);
    statusEl.classList.toggle('warn', !allValid);
    statusEl.textContent = allValid
      ? 'Alles ingevuld. Start de chat met AIMY.'
      : 'Serienummer en urenstand zijn verplicht. Voeg foutcodes toe als je die hebt.';
  }

  if(submitBtn){
    submitBtn.disabled = !allValid;
  }

  return allValid;
}
