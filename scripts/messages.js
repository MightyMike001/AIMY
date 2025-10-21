import { MAX_MESSAGES } from './constants.js';

export function addMessage(state, messagesEl, role, content, options = {}){
  const { track = true, scroll = true } = options;
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.innerHTML = `<div class="role">${role === 'user' ? 'Monteur' : 'AIMY'}</div><div class="content"></div>`;
  bubble.querySelector('.content').textContent = content;
  messagesEl.appendChild(bubble);
  if(scroll){
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  if(track){
    state.messages.push({ role: role === 'user' ? 'user' : 'assistant', content });
    if(state.messages.length > MAX_MESSAGES){
      state.messages.shift();
    }
  }
}

export function appendStreamChunk(state, messagesEl, chunk){
  const last = messagesEl.lastElementChild;
  if(!last || !last.classList.contains('assistant')){
    return;
  }
  const contentEl = last.querySelector('.content');
  contentEl.textContent += chunk;
  messagesEl.scrollTop = messagesEl.scrollHeight;
  const lastAssistantIndex = [...state.messages].reverse().findIndex(m => m.role === 'assistant');
  if(lastAssistantIndex > -1){
    const idx = state.messages.length - 1 - lastAssistantIndex;
    const current = state.messages[idx];
    current.content = (current.content || '') + chunk;
  }
}
