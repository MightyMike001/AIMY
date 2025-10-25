import { mapDocuments, mapMessages, toStringOr } from '../utils/history.js';
import { createHistoryTitle } from '../../js/history.js';
import { maxMessageLen } from '../../js/config.js';

const DEFAULT_HISTORY_LIMIT = 12;
const DEFAULT_MAX_LENGTH = Number.isInteger(maxMessageLen) && maxMessageLen > 0 ? maxMessageLen : 4000;
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
  const faultCodes = normalizeString(toStringOr(prechat?.faultCodes));
  return {
    serialNumber,
    hours,
    faultCodes,
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
    ready: normalized.ready,
    completed: normalized.completed,
    valid: normalized.valid
  };
}

export function buildHistoryEntry(state, {
  existing = null,
  now = Date.now()
} = {}){
  if(!state || typeof state.chatId !== 'string' || !state.chatId){
    return null;
  }
  const prechat = normalizePrechat(state.prechat);

  const messages = mapMessages(state.messages, { limit: MAX_HISTORY_MESSAGE_LIMIT });
  const docs = mapDocuments(state.docs);
  const title = createHistoryTitle(prechat.serialNumber, prechat.faultCodes);
  const timestamp = Number.isFinite(now) ? now : Date.now();

  return {
    id: state.chatId,
    title,
    ts: timestamp,
    archived: existing?.archived === true,
    serialNumber: prechat.serialNumber,
    faultCodes: prechat.faultCodes,
    hours: prechat.hours,
    messages,
    docs
  };
}

export function buildMetadata(prechat){
  const normalized = normalizePrechat(prechat);
  return {
    serialNumber: normalized.serialNumber,
    hours: normalized.hours,
    faultCodes: normalized.faultCodes
  };
}

export const constants = {
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_MAX_LENGTH,
  MAX_HISTORY_MESSAGE_LIMIT,
  MAX_DOC_IDS,
  maxMessageLen
};
