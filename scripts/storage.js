import { CHAT_KEY, CHAT_HISTORY_KEY } from './constants.js';
import { resetConversation } from './state.js';
import {
  mapDocuments,
  mapMessages,
  normalizeHistoryRecord
} from './utils/history.js';
import { buildHistoryEntry } from './domain/conversation.js';

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

export function restoreChatState(state){
  try{
    const raw = localStorage.getItem(CHAT_KEY);
    if(!raw){
      state.streaming = false;
      return { restored: false };
    }
    const dump = JSON.parse(raw);
    if(!dump){
      state.streaming = false;
      return { restored: false };
    }
    state.docs = mapDocuments(dump.docs);

    if(typeof dump.chatId === 'string' && dump.chatId){
      state.chatId = dump.chatId;
    }

    const restoredMessages = mapMessages(dump.messages, { limit: 50 });
    if(restoredMessages.length){
      state.messages = restoredMessages;
    }
    state.streaming = false;
    return {
      restored: restoredMessages.length > 0,
      messages: state.messages,
      docs: state.docs
    };
  }catch{
    resetConversation();
    state.streaming = false;
    return {
      restored: false,
      messages: state.messages,
      docs: state.docs,
      error: true
    };
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
    const history = readHistory();
    const nowIso = new Date().toISOString();
    const existingIndex = history.findIndex(item => item.id === state.chatId);
    const existing = existingIndex > -1 ? history[existingIndex] : null;
    const entry = buildHistoryEntry(state, { existing, nowIso });
    if(!entry){
      return;
    }

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
