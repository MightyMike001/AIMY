import { ensureIsoString, mapDocuments, mapMessages, toStringOr } from '../utils/history.js';
import { ensureFaultCodeList, formatFaultCodes } from '../../js/prechat.js';

const DEFAULT_HISTORY_LIMIT = 12;
const DEFAULT_MAX_LENGTH = 4000;
const MAX_HISTORY_MESSAGE_LIMIT = 100;
const MAX_DOC_IDS = 50;

function normalizeString(value){
  if(typeof value !== 'string'){
    return '';
  }
  return value.trim();
}

export function sanitizePrompt(value, { maxLength = DEFAULT_MAX_LENGTH } = {}){
  if(typeof value !== 'string'){
    return '';
  }
  const trimmed = value.trim();
  if(trimmed.length <= maxLength){
    return trimmed;
  }
  return trimmed.slice(0, maxLength);
}

export function buildMessageWindow(messages, {
  limit = DEFAULT_HISTORY_LIMIT,
  maxLength = DEFAULT_MAX_LENGTH
} = {}){
  if(!Array.isArray(messages) || limit <= 0){
    return [];
  }
  return messages
    .slice(-limit)
    .map((message) => ({
      role: message?.role === 'user' ? 'user' : 'assistant',
      content: sanitizePrompt(message?.content || '', { maxLength })
    }));
}

export function selectDocIds(docs, { limit = MAX_DOC_IDS } = {}){
  if(!Array.isArray(docs) || limit <= 0){
    return [];
  }
  const unique = [];
  const seen = new Set();
  for(const doc of docs){
    const rawId = normalizeString(typeof doc?.id === 'string' ? doc.id : String(doc?.id ?? ''));
    if(!rawId){
      continue;
    }
    if(seen.has(rawId)){
      continue;
    }
    seen.add(rawId);
    unique.push(rawId);
    if(unique.length >= limit){
      break;
    }
  }
  return unique;
}

function normalizePrechat(prechat){
  const serialNumber = normalizeString(toStringOr(prechat?.serialNumber));
  const hours = normalizeString(toStringOr(prechat?.hours));
  const faultCodeList = ensureFaultCodeList(prechat?.faultCodeList || prechat?.faultCodes);
  const faultCodes = formatFaultCodes(faultCodeList);
  return {
    serialNumber,
    hours,
    faultCodes,
    faultCodeList,
    ready: prechat?.ready === true,
    completed: prechat?.completed === true,
    valid: prechat?.valid === true
  };
}

export function preparePrechatPayload(prechat){
  const normalized = normalizePrechat(prechat);
  return {
    serialNumber: normalized.serialNumber,
    hours: normalized.hours,
    faultCodes: normalized.faultCodes,
    faultCodeList: normalized.faultCodeList,
    ready: normalized.ready,
    completed: normalized.completed,
    valid: normalized.valid
  };
}

export function buildHistoryEntry(state, {
  existing = null,
  nowIso = new Date().toISOString()
} = {}){
  if(!state || typeof state.chatId !== 'string' || !state.chatId){
    return null;
  }
  const prechat = normalizePrechat(state.prechat);
  if(!prechat.serialNumber){
    return null;
  }

  const messages = mapMessages(state.messages, { limit: MAX_HISTORY_MESSAGE_LIMIT });
  const docs = mapDocuments(state.docs);
  const title = prechat.faultCodes
    ? `${prechat.serialNumber} – ${prechat.faultCodes}`
    : prechat.serialNumber;

  return {
    id: state.chatId,
    title,
    serialNumber: prechat.serialNumber,
    faultCodes: prechat.faultCodes,
    faultCodeList: prechat.faultCodeList,
    hours: prechat.hours,
    messages,
    docs,
    createdAt: ensureIsoString(existing?.createdAt, nowIso),
    updatedAt: nowIso,
    archived: existing?.archived === true,
    lastOpenedAt: existing?.lastOpenedAt == null
      ? null
      : ensureIsoString(existing.lastOpenedAt, null)
  };
}

export function buildMetadata(prechat){
  const normalized = normalizePrechat(prechat);
  return {
    serialNumber: normalized.serialNumber,
    hours: normalized.hours,
    faultCodes: normalized.faultCodes,
    faultCodeList: normalized.faultCodeList
  };
}

export const constants = {
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_MAX_LENGTH,
  MAX_HISTORY_MESSAGE_LIMIT,
  MAX_DOC_IDS
};
