import { MAX_MESSAGES } from './constants.js';

const FORKLIFT_LOADER_HTML = `
  <div class="forklift-loader">
    <div class="forklift-scene" aria-hidden="true">
      <div class="forklift-track"></div>
      <div class="forklift-move">
        <div class="forklift-body">
          <div class="forklift-cabin"></div>
          <div class="forklift-wheel front"></div>
          <div class="forklift-wheel back"></div>
          <div class="forklift-mast">
            <div class="forklift-fork"></div>
          </div>
        </div>
        <div class="forklift-box"></div>
      </div>
    </div>
    <span class="loader-text">AIMY is het antwoord aan het laden…</span>
  </div>
`;

export function addMessage(state, messagesEl, role, content, options = {}){
  const { track = true, scroll = true, loading = false } = options;
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.innerHTML = `<div class="role">${role === 'user' ? 'Monteur' : 'AIMY'}</div><div class="content"></div>`;
  const contentEl = bubble.querySelector('.content');
  if(loading){
    bubble.classList.add('loading');
    contentEl.innerHTML = FORKLIFT_LOADER_HTML;
  }else{
    contentEl.textContent = content;
  }
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
  if(last.classList.contains('loading')){
    last.classList.remove('loading');
    contentEl.textContent = '';
  }
  contentEl.textContent += chunk;
  messagesEl.scrollTop = messagesEl.scrollHeight;
  const lastAssistantIndex = [...state.messages].reverse().findIndex(m => m.role === 'assistant');
  if(lastAssistantIndex > -1){
    const idx = state.messages.length - 1 - lastAssistantIndex;
    const current = state.messages[idx];
    current.content = (current.content || '') + chunk;
  }
}
