import { CHAT_KEY, GREETING } from './constants.js';
import { addMessage } from './messages.js';
import { resetConversation } from './state.js';
import { renderDocList } from './ingest.js';

export function setupPersistence(state){
  window.addEventListener('beforeunload', () => {
    try{
      const dump = {
        messages: state.messages,
        docs: state.docs,
        chatId: state.chatId
      };
      localStorage.setItem(CHAT_KEY, JSON.stringify(dump));
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
