import { ensureFaultCodeList, formatFaultCodes, normalizeSerial } from './prechat.js';

export function normalizeSearchQuery(value){
  return typeof value === 'string' ? value.trim() : '';
}

export function extractSearchTokens(query){
  const normalized = normalizeSearchQuery(query);
  if(!normalized){
    return [];
  }
  return normalized
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => normalizeSerial(token));
}

export function debounce(fn, wait = 300){
  let timer = null;
  return function debounced(...args){
    if(timer){
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

export function matchHistoryItem(item, tokens){
  if(!tokens.length){
    return true;
  }
  const serial = normalizeSerial(item?.serialNumber || item?.title || '');
  const faults = formatFaultCodes(ensureFaultCodeList(item?.faultCodeList || item?.faultCodes));
  const searchSpace = `${serial} ${faults}`;
  if(!searchSpace.trim()){
    return false;
  }
  const upperSearch = normalizeSerial(searchSpace);
  return tokens.every((token) => upperSearch.includes(token));
}

export function filterHistoryItems(items, tokens){
  if(!Array.isArray(items)){
    return [];
  }
  if(!tokens.length){
    return items.slice();
  }
  return items.filter((item) => matchHistoryItem(item, tokens));
}

function escapeHtml(text){
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHighlightRegex(tokens){
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if(!uniqueTokens.length){
    return null;
  }
  const escaped = uniqueTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'gi');
}

export function highlightMatches(text, tokens){
  const input = typeof text === 'string' ? text : '';
  if(!tokens.length){
    return escapeHtml(input);
  }
  const regex = buildHighlightRegex(tokens);
  if(!regex){
    return escapeHtml(input);
  }
  let lastIndex = 0;
  let result = '';
  input.replace(regex, (match, _group, offset) => {
    result += escapeHtml(input.slice(lastIndex, offset));
    result += `<mark class="history-highlight">${escapeHtml(match)}</mark>`;
    lastIndex = offset + match.length;
    return match;
  });
  result += escapeHtml(input.slice(lastIndex));
  return result;
}

export function toDisplayFaultCodes(value){
  const list = ensureFaultCodeList(value);
  return formatFaultCodes(list);
}
