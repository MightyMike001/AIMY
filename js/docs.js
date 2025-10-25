/**
 * Document upload helpers shared between legacy pages and the modern chat UI.
 * De functies in dit bestand zijn bewust frameworkloos gehouden zodat ze
 * eenvoudig in vanilla-omgevingen te gebruiken zijn.
 */
import { allowedTypes } from './config.js';

export const DOC_STATUS = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  OK: 'ok',
  FAIL: 'fail'
});

export const STATUS_LABELS = Object.freeze({
  [DOC_STATUS.QUEUED]: 'Queued',
  [DOC_STATUS.PROCESSING]: 'Processing',
  [DOC_STATUS.OK]: 'OK',
  [DOC_STATUS.FAIL]: 'Fail'
});

export const STATUS_TONES = Object.freeze({
  [DOC_STATUS.QUEUED]: 'muted',
  [DOC_STATUS.PROCESSING]: 'loading',
  [DOC_STATUS.OK]: 'success',
  [DOC_STATUS.FAIL]: 'error'
});

const ALLOWED_TYPES = Array.isArray(allowedTypes) ? allowedTypes : [];

export const ALLOWED_EXTENSIONS = new Map(ALLOWED_TYPES);

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/g;
const MAX_NAME_LENGTH = 120;

export function sanitizeFileName(name){
  if(typeof name !== 'string'){
    return 'document';
  }
  const cleaned = name.replace(CONTROL_CHARS_PATTERN, '').trim();
  if(!cleaned){
    return 'document';
  }
  if(cleaned.length <= MAX_NAME_LENGTH){
    return cleaned;
  }
  const lastDot = cleaned.lastIndexOf('.');
  const extension = lastDot > 0 && lastDot < cleaned.length - 1 ? cleaned.slice(lastDot) : '';
  const baseLength = Math.max(1, MAX_NAME_LENGTH - extension.length);
  const base = cleaned.slice(0, baseLength).trimEnd();
  return `${base}${extension}` || 'document';
}

export function getExtension(name){
  if(typeof name !== 'string'){
    return '';
  }
  const trimmed = name.trim();
  if(!trimmed){
    return '';
  }
  const lastDot = trimmed.lastIndexOf('.');
  if(lastDot <= 0 || lastDot >= trimmed.length - 1){
    return '';
  }
  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function deriveTypeLabel(name, fallback = 'DOC'){
  const ext = getExtension(name);
  if(ext && ALLOWED_EXTENSIONS.has(ext)){
    return ALLOWED_EXTENSIONS.get(ext) || fallback;
  }
  if(ext){
    return ext.toUpperCase();
  }
  return fallback;
}

export function validateFile(file){
  const FileCtor = typeof File === 'function' ? File : null;
  if(!FileCtor || !(file instanceof FileCtor)){
    return { ok: false, error: 'invalid', extension: '' };
  }
  const extension = getExtension(file.name);
  if(!extension || !ALLOWED_EXTENSIONS.has(extension)){
    return { ok: false, error: 'type', extension };
  }
  if(file.size > MAX_FILE_SIZE_BYTES){
    return { ok: false, error: 'size', extension };
  }
  return {
    ok: true,
    extension,
    typeLabel: ALLOWED_EXTENSIONS.get(extension)
  };
}

export function describeValidationError(code){
  switch(code){
    case 'size':
      return 'Te groot (>15 MB)';
    case 'type':
      return 'Niet toegestaan';
    case 'invalid':
    default:
      return 'Ongeldig bestand';
  }
}

export function getStatusPresentation(status, { error } = {}){
  const tone = STATUS_TONES[status] || 'muted';
  const base = STATUS_LABELS[status] || '—';
  if(status === DOC_STATUS.FAIL && error){
    return { text: `${base}: ${error}`, tone };
  }
  return { text: base, tone };
}

export function computeUploadCounters(uploads){
  const counters = { docs: 0, processed: 0, success: 0 };
  if(!Array.isArray(uploads)){
    return counters;
  }
  for(const item of uploads){
    if(!item){
      continue;
    }
    if(item.status === DOC_STATUS.OK){
      counters.docs += 1;
      counters.processed += 1;
      counters.success += 1;
    }else if(item.status === DOC_STATUS.FAIL){
      counters.processed += 1;
    }
  }
  return counters;
}
