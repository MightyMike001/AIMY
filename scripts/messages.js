import { MAX_MESSAGES } from './constants.js';

const streamTextNodes = new WeakMap();
const scheduledScrolls = new WeakMap();

const loaderTemplate = typeof document !== 'undefined'
  ? (() => {
      const template = document.createElement('template');
      template.innerHTML = `
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
      return template;
    })()
  : null;

function scheduleNextFrame(callback){
  if(typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
    window.requestAnimationFrame(callback);
  }else{
    window.setTimeout(callback, 16);
  }
}

function scheduleScroll(container){
  if(!container){
    return;
  }
  if(scheduledScrolls.get(container)){
    return;
  }
  scheduledScrolls.set(container, true);
  scheduleNextFrame(() => {
    container.scrollTop = container.scrollHeight;
    scheduledScrolls.delete(container);
  });
}

function appendLoader(contentEl){
  if(!contentEl){
    return;
  }
  if(loaderTemplate){
    contentEl.appendChild(loaderTemplate.content.cloneNode(true));
  }else{
    contentEl.textContent = 'AIMY is het antwoord aan het laden…';
  }
}

function normalizeRole(role){
  return role === 'user' ? 'user' : 'assistant';
}

export function addMessage(state, messagesEl, role, content, options = {}){
  const { track = true, scroll = true, loading = false } = options;
  const normalizedRole = normalizeRole(role);
  const bubble = document.createElement('div');
  bubble.className = `bubble ${normalizedRole}`;

  const roleEl = document.createElement('div');
  roleEl.className = 'role';
  roleEl.textContent = normalizedRole === 'user' ? 'Monteur' : 'AIMY';
  bubble.appendChild(roleEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'content';
  if(loading){
    bubble.classList.add('loading');
    appendLoader(contentEl);
  }else{
    contentEl.textContent = typeof content === 'string' ? content : '';
  }
  bubble.appendChild(contentEl);

  messagesEl.appendChild(bubble);
  if(scroll){
    scheduleScroll(messagesEl);
  }

  if(track){
    state.messages.push({ role: normalizedRole, content: typeof content === 'string' ? content : '' });
    if(state.messages.length > MAX_MESSAGES){
      state.messages.shift();
    }
  }
}

export function appendStreamChunk(state, messagesEl, chunk){
  if(typeof chunk !== 'string' || !chunk){
    return;
  }
  const last = messagesEl.lastElementChild;
  if(!last || !last.classList.contains('assistant')){
    return;
  }
  const contentEl = last.querySelector('.content');
  if(!contentEl){
    return;
  }
  if(last.classList.contains('loading')){
    last.classList.remove('loading');
    contentEl.textContent = '';
  }

  let textNode = streamTextNodes.get(contentEl);
  if(!textNode || !contentEl.contains(textNode)){
    textNode = document.createTextNode(contentEl.textContent || '');
    if(contentEl.textContent){
      contentEl.textContent = '';
    }
    contentEl.appendChild(textNode);
    streamTextNodes.set(contentEl, textNode);
  }

  textNode.textContent += chunk;
  scheduleScroll(messagesEl);

  const lastAssistantIndex = [...state.messages].reverse().findIndex(m => m.role === 'assistant');
  if(lastAssistantIndex > -1){
    const idx = state.messages.length - 1 - lastAssistantIndex;
    const current = state.messages[idx];
    current.content = (current.content || '') + chunk;
  }
}
