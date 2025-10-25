const SERIAL_PARAM = 'serial';
const HOURS_PARAM = 'hours';
const FAULT_PARAM = 'fault';
const SERIAL_MAX_LENGTH = 20;
const HOURS_MAX_LENGTH = 6;
const DEFAULT_SERIAL_FALLBACK = 'NO-SN';

function sanitizeSerial(value){
  if(typeof value !== 'string'){
    return '';
  }
  const upper = value.trim().toUpperCase();
  if(!upper){
    return '';
  }
  const cleaned = upper.replace(/[^A-Z0-9-]/g, '');
  if(!cleaned){
    return '';
  }
  return cleaned.slice(0, SERIAL_MAX_LENGTH);
}

function sanitizeHours(value){
  if(typeof value !== 'string'){
    return '';
  }
  const digits = value.replace(/\D+/g, '').slice(0, HOURS_MAX_LENGTH);
  return digits.trim();
}

function sanitizeFaults(value){
  if(typeof value !== 'string'){
    return '';
  }
  const upper = value.trim().toUpperCase();
  if(!upper){
    return '';
  }
  const normalized = upper
    .replace(/[^A-Z0-9,\-\s]/g, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/, '');
  return normalized;
}

function hasQueryParam(params, name){
  try{
    return params.has(name);
  }catch{
    return false;
  }
}

export function createSessionId(serial, now = Date.now()){
  const sanitizedSerial = sanitizeSerial(serial) || DEFAULT_SERIAL_FALLBACK;
  const unixTs = Number.isFinite(now) ? Math.max(0, Math.floor(now / 1000)) : Math.floor(Date.now() / 1000);
  return `${sanitizedSerial}-${unixTs}`;
}

export function createSessionContext({ search = '' , now = Date.now() } = {}){
  let params;
  try{
    params = new URLSearchParams(typeof search === 'string' ? search : '');
  }catch{
    params = new URLSearchParams('');
  }

  const serial = sanitizeSerial(params.get(SERIAL_PARAM));
  const hours = sanitizeHours(params.get(HOURS_PARAM));
  const faultCodes = sanitizeFaults(params.get(FAULT_PARAM));
  const hasParams = [SERIAL_PARAM, HOURS_PARAM, FAULT_PARAM].some(name => hasQueryParam(params, name));
  const sessionId = createSessionId(serial, now);

  return {
    serialNumber: serial,
    hours,
    faultCodes,
    hasParams,
    sessionId
  };
}

export function sanitizeSessionPayload({ serialNumber, hours, faultCodes }){
  return {
    serialNumber: sanitizeSerial(serialNumber),
    hours: sanitizeHours(hours),
    faultCodes: sanitizeFaults(faultCodes)
  };
}

export const sessionParams = Object.freeze({
  SERIAL_PARAM,
  HOURS_PARAM,
  FAULT_PARAM
});
