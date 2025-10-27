import { MAX_MESSAGES } from './constants.js';
import { normalizeCitations } from './utils/history.js';
import { sanitizeRichContent } from '../js/security.js';

const streamTextNodes = new WeakMap();
const scheduledScrolls = new WeakMap();

const loaderTemplate = typeof document !== 'undefined'
  ? (() => {
      const template = document.createElement('template');
      template.innerHTML = `
        <div class="forklift-loader" role="status" aria-live="polite">
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
          <span class="loader-text">AIMY is aan het typen<span class="loader-dots" aria-hidden="true">…</span></span>
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

function syncCitationAria(aside){
  if(!aside || typeof document === 'undefined'){
    return;
  }
  const shouldHide = document.body?.classList?.contains('citations-hidden');
  if(shouldHide){
    aside.setAttribute('aria-hidden', 'true');
    aside.setAttribute('hidden', '');
  }else{
    aside.setAttribute('aria-hidden', 'false');
    aside.removeAttribute('hidden');
  }
}

function createCitationList(citations){
  const list = document.createElement('ul');
  list.className = 'citations-list';
  citations.forEach((item) => {
    const entry = document.createElement('li');
    const parts = [`Doc ${item.docId}`];
    if(item.section){
      parts.push(`§${item.section}`);
    }
    entry.textContent = `[${parts.join(', ')}]`;
    list.appendChild(entry);
  });
  return list;
}

function renderBubbleCitations(bubble, citations){
  if(!bubble){
    return null;
  }
  const normalized = normalizeCitations(citations);
  let aside = bubble.querySelector('aside.citations');
  if(!normalized.length){
    if(aside){
      aside.remove();
    }
    return null;
  }

  if(!aside){
    aside = document.createElement('aside');
    aside.className = 'citations';
    bubble.appendChild(aside);
  }else{
    aside.innerHTML = '';
  }

  aside.appendChild(createCitationList(normalized));
  syncCitationAria(aside);
  return aside;
}

function findLastAssistantIndex(messages){
  if(!Array.isArray(messages)){
    return -1;
  }
  for(let i = messages.length - 1; i >= 0; i -= 1){
    if(messages[i]?.role === 'assistant'){
      return i;
    }
  }
  return -1;
}

function findLastAssistantBubble(messagesEl){
  if(!messagesEl){
    return null;
  }
  let node = messagesEl.lastElementChild;
  while(node){
    if(node.classList?.contains('assistant')){
      return node;
    }
    node = node.previousElementSibling;
  }
  return null;
}

function appendLoader(contentEl){
  if(!contentEl){
    return;
  }
  if(loaderTemplate){
    contentEl.appendChild(loaderTemplate.content.cloneNode(true));
  }else{
    contentEl.textContent = 'AIMY is aan het typen…';
  }
}

function normalizeRole(role){
  return role === 'user' ? 'user' : 'assistant';
}

export function addMessage(state, messagesEl, role, content, options = {}){
  const { track = true, scroll = true, loading = false, citations } = options;
  const normalizedRole = normalizeRole(role);
  const normalizedCitations = normalizedRole === 'assistant' ? normalizeCitations(citations) : [];
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
    const sanitized = sanitizeRichContent(typeof content === 'string' ? content : '');
    contentEl.innerHTML = sanitized;
  }
  bubble.appendChild(contentEl);

  if(!loading && normalizedRole === 'assistant'){
    renderBubbleCitations(bubble, normalizedCitations);
  }

  messagesEl.appendChild(bubble);
  if(scroll){
    scheduleScroll(messagesEl);
  }

  if(track){
    state.messages.push({
      role: normalizedRole,
      content: typeof content === 'string' ? content : '',
      citations: normalizedRole === 'assistant' ? normalizedCitations : []
    });
    if(state.messages.length > MAX_MESSAGES){
      state.messages.shift();
    }
  }
  return bubble;
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

export function finalizeAssistantMessage(state, messagesEl){
  const bubble = findLastAssistantBubble(messagesEl);
  if(!bubble){
    return;
  }
  const contentEl = bubble.querySelector('.content');
  if(!contentEl){
    return;
  }
  const lastAssistantIndex = findLastAssistantIndex(state?.messages);
  const rawContent = lastAssistantIndex > -1 && state.messages ? state.messages[lastAssistantIndex].content : '';
  const sanitized = sanitizeRichContent(typeof rawContent === 'string' ? rawContent : '');
  contentEl.innerHTML = sanitized;
  streamTextNodes.delete(contentEl);
}

export function updateLastAssistantCitations(state, messagesEl, citations){
  const normalized = normalizeCitations(citations);

  if(state?.messages){
    const lastAssistantIndex = findLastAssistantIndex(state.messages);
    if(lastAssistantIndex > -1){
      state.messages[lastAssistantIndex].citations = normalized;
    }
  }

  const bubble = findLastAssistantBubble(messagesEl);
  if(bubble){
    renderBubbleCitations(bubble, normalized);
  }

  return normalized;
}

export function renderMessages(state, messagesEl){
  if(!messagesEl){
    return;
  }
  messagesEl.innerHTML = '';
  state.messages.forEach((message) => {
    addMessage(state, messagesEl, message.role, message.content, {
      track: false,
      scroll: false,
      citations: message.citations
    });
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
