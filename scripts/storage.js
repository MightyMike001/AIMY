import { CHAT_KEY, GREETING } from './constants.js';
import { addMessage } from './messages.js';
import { resetConversation } from './state.js';
import { renderDocList } from './ingest.js';

const CHAT_HISTORY_KEY = 'aimy.chat-history';

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
    return data
      .filter(item => item && typeof item === 'object' && typeof item.id === 'string')
      .map(item => ({
        id: item.id,
        title: typeof item.title === 'string' ? item.title : '',
        serialNumber: typeof item.serialNumber === 'string' ? item.serialNumber : '',
        faultCodes: typeof item.faultCodes === 'string' ? item.faultCodes : '',
        hours: typeof item.hours === 'string' ? item.hours : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
        archived: item.archived === true,
        lastOpenedAt: typeof item.lastOpenedAt === 'string' ? item.lastOpenedAt : null,
        messages: Array.isArray(item.messages)
          ? item.messages
              .map(msg => ({
                role: msg && msg.role === 'user' ? 'user' : 'assistant',
                content: msg && typeof msg.content === 'string' ? msg.content : ''
              }))
          : [],
        docs: Array.isArray(item.docs)
          ? item.docs.map((doc, index) => {
            const uploadedAtNumber = (() => {
              if(typeof doc?.uploadedAt === 'number' && Number.isFinite(doc.uploadedAt)){
                return doc.uploadedAt;
              }
              if(typeof doc?.uploadedAt === 'string'){
                const parsed = Date.parse(doc.uploadedAt);
                if(Number.isFinite(parsed)){
                  return parsed;
                }
              }
              return Date.now();
            })();
            const sizeNumber = (() => {
              if(typeof doc?.size === 'number' && Number.isFinite(doc.size)){
                return doc.size;
              }
              if(typeof doc?.size === 'string'){
                const parsed = Number(doc.size);
                return Number.isFinite(parsed) ? parsed : 0;
              }
              return 0;
            })();
            const fallbackId = typeof crypto?.randomUUID === 'function'
              ? crypto.randomUUID()
              : `doc-${index}-${Date.now()}`;
            return {
              id: doc && typeof doc.id === 'string' && doc.id ? doc.id : fallbackId,
              name: doc && typeof doc.name === 'string' ? doc.name : 'Onbekend document',
              size: sizeNumber,
              uploadedAt: uploadedAtNumber
            };
          })
          : []
      }));
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
    state.docs = Array.isArray(dump.docs) ? dump.docs.map(d => ({ ...d })) : [];
    renderDocList(state, docListEl, ingestBadge);

    if(typeof dump.chatId === 'string' && dump.chatId){
      state.chatId = dump.chatId;
    }

    const restoredMessages = Array.isArray(dump.messages) ? dump.messages.slice(-50) : [];
    if(restoredMessages.length){
      state.messages = restoredMessages.map(m => ({
        role: m && m.role === 'user' ? 'user' : 'assistant',
        content: m && m.content != null ? String(m.content) : ''
      }));
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
    const serialNumber = typeof prechat.serialNumber === 'string' ? prechat.serialNumber : '';
    const faultCodes = typeof prechat.faultCodes === 'string' ? prechat.faultCodes : '';
    const hours = typeof prechat.hours === 'string' ? prechat.hours : '';
    if(!serialNumber){
      return;
    }

    const history = readHistory();
    const now = new Date().toISOString();
    const messages = Array.isArray(state.messages)
      ? state.messages.slice(-100).map(msg => ({
        role: msg && msg.role === 'user' ? 'user' : 'assistant',
        content: msg && typeof msg.content === 'string' ? msg.content : ''
      }))
      : [];

    const docs = Array.isArray(state.docs)
      ? state.docs.map((doc, index) => {
        const fallbackId = typeof crypto?.randomUUID === 'function'
          ? crypto.randomUUID()
          : `doc-${index}-${Date.now()}`;
        const sizeNumber = (() => {
          if(typeof doc?.size === 'number' && Number.isFinite(doc.size)){
            return doc.size;
          }
          if(typeof doc?.size === 'string'){
            const parsed = Number(doc.size);
            return Number.isFinite(parsed) ? parsed : 0;
          }
          return 0;
        })();
        const uploadedAtNumber = (() => {
          if(typeof doc?.uploadedAt === 'number' && Number.isFinite(doc.uploadedAt)){
            return doc.uploadedAt;
          }
          if(typeof doc?.uploadedAt === 'string'){
            const parsed = Date.parse(doc.uploadedAt);
            if(Number.isFinite(parsed)){
              return parsed;
            }
          }
          return Date.now();
        })();
        return {
          id: doc && typeof doc.id === 'string' && doc.id ? doc.id : fallbackId,
          name: doc && typeof doc.name === 'string' ? doc.name : 'Onbekend document',
          size: sizeNumber,
          uploadedAt: uploadedAtNumber
        };
      })
      : [];

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
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      archived: existing?.archived === true,
      lastOpenedAt: existing?.lastOpenedAt || null
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
