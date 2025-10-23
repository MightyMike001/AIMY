const DEFAULT_DOC_NAME = 'Onbekend document';
const DEFAULT_DOC_PREFIX = 'doc';

function toFiniteNumber(value, fallback){
  if(typeof value === 'number' && Number.isFinite(value)){
    return value;
  }
  if(typeof value === 'string'){
    const parsed = Number(value);
    if(Number.isFinite(parsed)){
      return parsed;
    }
  }
  return fallback;
}

function toUploadTimestamp(value, fallback){
  if(typeof value === 'number' && Number.isFinite(value)){
    return value;
  }
  if(typeof value === 'string'){
    const parsed = Date.parse(value);
    if(Number.isFinite(parsed)){
      return parsed;
    }
  }
  return fallback;
}

function computeFallbackDocId({ index, now, prefix }){
  if(typeof crypto?.randomUUID === 'function'){
    return crypto.randomUUID();
  }
  return `${prefix}-${index}-${now}`;
}

function normalizeDocument(doc, { index, now, prefix }){
  const fallbackId = computeFallbackDocId({ index, now, prefix });
  const id = typeof doc?.id === 'string' && doc.id ? doc.id : fallbackId;
  const name = typeof doc?.name === 'string' && doc.name ? doc.name : DEFAULT_DOC_NAME;
  const size = toFiniteNumber(doc?.size, 0);
  const uploadedAt = toUploadTimestamp(doc?.uploadedAt, now);
  return { id, name, size, uploadedAt };
}

export function mapDocuments(docs, { now = Date.now(), prefix = DEFAULT_DOC_PREFIX } = {}){
  if(!Array.isArray(docs)){
    return [];
  }
  return docs.map((doc, index) => normalizeDocument(doc, { index, now, prefix }));
}

function normalizeMessage(message){
  const role = message?.role === 'user' ? 'user' : 'assistant';
  const content = typeof message?.content === 'string' ? message.content : '';
  return { role, content };
}

export function mapMessages(messages, { limit } = {}){
  if(!Array.isArray(messages)){
    return [];
  }
  const normalized = messages.map(normalizeMessage);
  if(Number.isInteger(limit) && limit > 0){
    return normalized.slice(-limit);
  }
  return normalized;
}

export function toStringOr(value, fallback = ''){
  return typeof value === 'string' ? value : fallback;
}

export function ensureIsoString(value, fallback = new Date().toISOString()){
  if(typeof value === 'string'){
    const parsed = Date.parse(value);
    if(Number.isFinite(parsed)){
      return new Date(parsed).toISOString();
    }
  }else if(value instanceof Date && Number.isFinite(value.getTime())){
    return value.toISOString();
  }else if(typeof value === 'number' && Number.isFinite(value)){
    return new Date(value).toISOString();
  }

  if(fallback === null){
    return null;
  }

  if(typeof fallback === 'string'){
    const parsedFallback = Date.parse(fallback);
    if(Number.isFinite(parsedFallback)){
      return new Date(parsedFallback).toISOString();
    }
    return fallback;
  }

  if(fallback instanceof Date && Number.isFinite(fallback.getTime())){
    return fallback.toISOString();
  }

  if(typeof fallback === 'number' && Number.isFinite(fallback)){
    return new Date(fallback).toISOString();
  }

  return new Date().toISOString();
}

export function normalizeHistoryRecord(item, { nowIso = new Date().toISOString(), docPrefix = DEFAULT_DOC_PREFIX } = {}){
  if(!item || typeof item !== 'object' || typeof item.id !== 'string'){
    return null;
  }

  const nowMs = Date.parse(nowIso);
  const docs = mapDocuments(item.docs, {
    now: Number.isFinite(nowMs) ? nowMs : Date.now(),
    prefix: docPrefix
  });
  const messages = mapMessages(item.messages);

  return {
    id: item.id,
    title: toStringOr(item.title),
    serialNumber: toStringOr(item.serialNumber),
    faultCodes: toStringOr(item.faultCodes),
    hours: toStringOr(item.hours),
    createdAt: ensureIsoString(item.createdAt, nowIso),
    updatedAt: ensureIsoString(item.updatedAt, nowIso),
    archived: item.archived === true,
    lastOpenedAt: item.lastOpenedAt == null
      ? null
      : ensureIsoString(item.lastOpenedAt, null),
    messages,
    docs
  };
}
