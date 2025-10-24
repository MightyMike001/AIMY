const NUMERIC_DECIMAL_SEPARATOR = '.';

function toString(value){
  if(typeof value === 'string'){
    return value;
  }
  if(value == null){
    return '';
  }
  return String(value);
}

export function normalizeSerial(value){
  return toString(value).trim().toUpperCase();
}

export function normalizeHoursInput(value){
  const trimmed = toString(value).trim().replace(/,/g, NUMERIC_DECIMAL_SEPARATOR);
  if(!trimmed){
    return '';
  }

  const filtered = trimmed.replace(/[^0-9.\-]/g, '');
  let sign = '';
  let rest = filtered;
  if(rest.startsWith('-')){
    sign = '-';
    rest = rest.slice(1);
  }
  rest = rest.replace(/-/g, '');

  const [integerPartRaw, ...decimalParts] = rest.split(NUMERIC_DECIMAL_SEPARATOR);
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, '');
  const decimalPart = decimalParts.join('');

  const hasInteger = integerPart.length > 0;
  const hasDecimals = decimalPart.length > 0;

  if(!hasInteger && !hasDecimals){
    return sign;
  }

  const integer = hasInteger ? integerPart : '0';
  const decimals = hasDecimals ? decimalPart : '';
  const base = decimals ? `${integer}${NUMERIC_DECIMAL_SEPARATOR}${decimals}` : integer;
  return sign ? `${sign}${base}` : base;
}

export function parseHoursValue(value){
  const normalized = normalizeHoursInput(value);
  if(!normalized){
    return { text: '', value: Number.NaN };
  }
  const numeric = Number(normalized);
  return {
    text: normalized,
    value: Number.isFinite(numeric) ? numeric : Number.NaN
  };
}

export function ensureFaultCodeList(value){
  if(Array.isArray(value)){
    return value
      .map(code => normalizeSerial(code))
      .filter(code => code.length > 0)
      .filter((code, index, array) => array.indexOf(code) === index);
  }
  const input = toString(value);
  if(!input.trim()){
    return [];
  }
  return input
    .split(/[\s,]+/)
    .map((token) => normalizeSerial(token))
    .filter((token) => token.length > 0)
    .filter((token, index, array) => array.indexOf(token) === index);
}

export function formatFaultCodes(faultCodeList){
  if(!Array.isArray(faultCodeList) || faultCodeList.length === 0){
    return '';
  }
  return faultCodeList.join(', ');
}

export function parseFaultCodesInput(value){
  const faultCodeList = ensureFaultCodeList(value);
  return {
    list: faultCodeList,
    text: formatFaultCodes(faultCodeList)
  };
}

export function buildPrechatState({ serialNumber, hours, hoursValue, faultCodes, faultCodeList } = {}){
  const normalizedSerial = normalizeSerial(serialNumber);
  const hoursSource = typeof hours === 'string' && hours.trim().length > 0
    ? hours
    : hoursValue;
  const hoursInfo = parseHoursValue(hoursSource);
  const faults = faultCodeList && Array.isArray(faultCodeList)
    ? { list: ensureFaultCodeList(faultCodeList), text: formatFaultCodes(faultCodeList) }
    : parseFaultCodesInput(faultCodes);

  const text = hoursInfo.text;
  const numericValue = Number.isFinite(hoursInfo.value) ? Number(hoursInfo.value) : Number.NaN;

  return {
    serialNumber: normalizedSerial,
    hours: text,
    hoursValue: Number.isFinite(numericValue) ? numericValue : Number.NaN,
    faultCodes: faults.text,
    faultCodeList: faults.list
  };
}

export function validatePrechatState(state){
  const errors = {
    serialNumber: '',
    hours: ''
  };
  const serialValid = state.serialNumber.trim().length > 0;
  if(!serialValid){
    errors.serialNumber = 'Serienummer is verplicht.';
  }

  const hasHours = state.hours.trim().length > 0;
  const hoursValid = hasHours && Number.isFinite(state.hoursValue) && state.hoursValue >= 0;
  if(!hasHours){
    errors.hours = 'Urenstand is verplicht.';
  }else if(!hoursValid){
    errors.hours = 'Gebruik een getal groter of gelijk aan 0. Gebruik een punt voor decimalen.';
  }

  return {
    errors,
    valid: serialValid && hoursValid
  };
}

export function createPrechatRecord(payload = {}){
  const state = buildPrechatState(payload);
  const hoursValue = Number.isFinite(state.hoursValue) && state.hoursValue >= 0
    ? state.hoursValue
    : null;
  const record = {
    serialNumber: state.serialNumber,
    hours: state.hours,
    hoursValue,
    faultCodes: state.faultCodes,
    faultCodeList: state.faultCodeList
  };
  return record;
}
