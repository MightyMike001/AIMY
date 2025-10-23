import { CHAT_KEY, CHAT_HISTORY_KEY, GREETING } from './constants.js';
import { addMessage } from './messages.js';
import { resetConversation } from './state.js';
import { renderDocList } from './ingest.js';
import {
  ensureIsoString,
  mapDocuments,
  mapMessages,
  normalizeHistoryRecord,
  toStringOr
} from './utils/history.js';

function readHistory(){
  try{
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if(!raw){
      return [];
    }
    const data = JSON.parse(raw);
    if(!Array.isArray(data)){
      return [];
    }
    const nowIso = new Date().toISOString();
    return data
      .map(item => normalizeHistoryRecord(item, { nowIso }))
      .filter(Boolean);
  }catch{
    return [];
  }
}

function writeHistory(history){
  try{
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  }catch{
    /* ignore */
  }
}

export function setupPersistence(state){
  window.addEventListener('beforeunload', () => {
    try{
      const dump = {
        messages: state.messages,
        docs: state.docs,
        chatId: state.chatId
      };
      localStorage.setItem(CHAT_KEY, JSON.stringify(dump));
      persistHistorySnapshot(state);
    }catch{
      /* ignore */
    }
  });
}

export function restoreChat({ state, messagesEl, docListEl, ingestBadge }){
  try{
    const raw = localStorage.getItem(CHAT_KEY);
    if(!raw){
      return;
    }
    const dump = JSON.parse(raw);
    if(!dump){
      return;
    }
    state.docs = mapDocuments(dump.docs);
    renderDocList(state, docListEl, ingestBadge);

    if(typeof dump.chatId === 'string' && dump.chatId){
      state.chatId = dump.chatId;
    }

    const restoredMessages = mapMessages(dump.messages, { limit: 50 });
    if(restoredMessages.length){
      state.messages = restoredMessages;
      messagesEl.innerHTML = '';
      state.messages.forEach(m => {
        addMessage(state, messagesEl, m.role === 'user' ? 'user' : 'assistant', m.content, { track: false, scroll: false });
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    state.streaming = false;
  }catch{
    resetConversation();
    messagesEl.innerHTML = '';
    addMessage(state, messagesEl, 'assistant', GREETING, { track: false, scroll: false });
    state.streaming = false;
  }
}

export function clearChatStorage(){
  try{
    localStorage.removeItem(CHAT_KEY);
  }catch{
    /* ignore */
  }
}

export function persistHistorySnapshot(state){
  try{
    if(!state || typeof state.chatId !== 'string' || !state.chatId){
      return;
    }
    const prechat = state.prechat || {};
    const serialNumber = toStringOr(prechat.serialNumber);
    const faultCodes = toStringOr(prechat.faultCodes);
    const hours = toStringOr(prechat.hours);
    if(!serialNumber){
      return;
    }

    const history = readHistory();
    const nowIso = new Date().toISOString();
    const messages = mapMessages(state.messages, { limit: 100 });
    const docs = mapDocuments(state.docs);
    const title = faultCodes ? `${serialNumber} – ${faultCodes}` : serialNumber;

    const existingIndex = history.findIndex(item => item.id === state.chatId);
    const existing = existingIndex > -1 ? history[existingIndex] : null;
    const entry = {
      id: state.chatId,
      title,
      serialNumber,
      faultCodes,
      hours,
      messages,
      docs,
      createdAt: ensureIsoString(existing?.createdAt, nowIso),
      updatedAt: nowIso,
      archived: existing?.archived === true,
      lastOpenedAt: existing?.lastOpenedAt == null
        ? null
        : ensureIsoString(existing.lastOpenedAt, null)
    };

    if(existingIndex > -1){
      history[existingIndex] = entry;
    }else{
      history.push(entry);
    }
    writeHistory(history);
  }catch{
    /* ignore */
  }
}

export function loadChatHistory(){
  return readHistory();
}

export function setChatArchived(chatId, archived){
  const history = readHistory();
  const index = history.findIndex(item => item.id === chatId);
  if(index === -1){
    return null;
  }
  history[index].archived = Boolean(archived);
  history[index].updatedAt = new Date().toISOString();
  writeHistory(history);
  return history[index];
}

export function removeChatFromHistory(chatId){
  const history = readHistory();
  const filtered = history.filter(item => item.id !== chatId);
  writeHistory(filtered);
}

export function markChatOpened(chatId){
  const history = readHistory();
  const index = history.findIndex(item => item.id === chatId);
  if(index === -1){
    return null;
  }
  history[index].lastOpenedAt = new Date().toISOString();
  history[index].updatedAt = history[index].lastOpenedAt;
  writeHistory(history);
  return history[index];
}
