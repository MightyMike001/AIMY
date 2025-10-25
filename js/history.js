import { mapDocuments, mapMessages, toStringOr } from '../scripts/utils/history.js';

export const HISTORY_STORAGE_KEY = 'aimy.history.v1';

const DEFAULT_TITLE = 'Zonder serienummer – geen foutcodes';

function normalizeTimestamp(value, fallback = Date.now()){
  if(typeof value === 'number' && Number.isFinite(value)){
    return value;
  }
  if(typeof value === 'string'){
    const numeric = Number(value);
    if(Number.isFinite(numeric)){
      return numeric;
    }
    const parsed = Date.parse(value);
    if(Number.isFinite(parsed)){
      return parsed;
    }
  }
  if(value instanceof Date && Number.isFinite(value.getTime())){
    return value.getTime();
  }
  return Number.isFinite(fallback) ? fallback : Date.now();
}

function extractFirstFaultCode(faultCodes){
  const raw = toStringOr(faultCodes).trim();
  if(!raw){
    return '';
  }
  const commaSeparated = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if(commaSeparated.length){
    return commaSeparated[0];
  }
  const whitespaceSeparated = raw
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean);
  return whitespaceSeparated[0] || '';
}

export function createHistoryTitle(serialNumber, faultCodes){
  const serialPart = toStringOr(serialNumber).trim() || 'Zonder serienummer';
  const faultPart = extractFirstFaultCode(faultCodes) || 'geen foutcodes';
  return `${serialPart} – ${faultPart}`;
}

export function normalizeHistoryItem(item, { fallbackTs = Date.now(), docPrefix } = {}){
  if(!item || typeof item !== 'object'){
    return null;
  }
  const id = toStringOr(item.id).trim();
  if(!id){
    return null;
  }

  const serialNumber = toStringOr(item.serialNumber).trim();
  const faultCodes = toStringOr(item.faultCodes).trim();
  const hours = toStringOr(item.hours).trim();
  const providedTitle = toStringOr(item.title).trim();
  const title = providedTitle || createHistoryTitle(serialNumber, faultCodes) || DEFAULT_TITLE;
  const tsSource = item.ts ?? item.updatedAt ?? item.lastOpenedAt ?? item.createdAt;
  const ts = normalizeTimestamp(tsSource, fallbackTs);
  const archived = item.archived === true;

  const nowForDocs = normalizeTimestamp(tsSource, fallbackTs);
  const messages = mapMessages(item.messages);
  const docs = mapDocuments(item.docs, { now: nowForDocs, prefix: docPrefix });

  return {
    id,
    title,
    ts,
    archived,
    messages,
    docs,
    serialNumber,
    faultCodes,
    hours
  };
}
