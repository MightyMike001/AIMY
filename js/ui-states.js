// UI state helpers for chat placeholder and toast notifications

function isElement(node){
  return typeof Element !== 'undefined' && node instanceof Element;
}

function createSkeletonBubble(lines){
  const bubble = document.createElement('div');
  bubble.className = 'chat-skeleton-bubble';
  const role = document.createElement('div');
  role.className = 'chat-skeleton-role';
  bubble.appendChild(role);
  for(let i = 0; i < lines.length; i += 1){
    const line = document.createElement('div');
    line.className = 'chat-skeleton-line';
    line.style.setProperty('--line-scale', lines[i]);
    bubble.appendChild(line);
  }
  return bubble;
}

function buildSkeleton(){
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-skeleton';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');
  wrapper.setAttribute('aria-label', 'Berichten aan het laden');
  const bubbles = [
    createSkeletonBubble([0.6, 0.9, 0.45]),
    createSkeletonBubble([0.4, 0.8, 0.7]),
    createSkeletonBubble([0.5, 0.3])
  ];
  bubbles.forEach((bubble, index) => {
    if(index % 2 === 0){
      bubble.classList.add('incoming');
    }
    wrapper.appendChild(bubble);
  });
  const caption = document.createElement('p');
  caption.className = 'chat-skeleton-caption';
  caption.textContent = 'AIMY bereidt het chatvenster voor…';
  wrapper.appendChild(caption);
  return wrapper;
}

function createEmptyCard({ title, description, actionLabel, onAction, tone = 'default' }){
  const card = document.createElement('div');
  card.className = `chat-empty-card chat-empty-card-${tone}`;

  const heading = document.createElement('h3');
  heading.className = 'chat-empty-card-title';
  heading.textContent = title;
  card.appendChild(heading);

  const text = document.createElement('p');
  text.className = 'chat-empty-card-text';
  text.textContent = description;
  card.appendChild(text);

  if(actionLabel && typeof onAction === 'function'){
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary chat-empty-card-action';
    button.textContent = actionLabel;
    button.addEventListener('click', () => {
      onAction();
    });
    card.appendChild(button);
  }

  return card;
}

function buildEmptyState({ hasWebhook, hasDocs, onConnectWebhook, onUploadDocs, onStartChat }){
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-empty-state';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');

  const heading = document.createElement('div');
  heading.className = 'chat-empty-state-header';
  const title = document.createElement('h2');
  title.textContent = 'Welkom! Laten we AIMY klaarzetten.';
  heading.appendChild(title);
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Koppel een webhook en laad documenten om je eerste vraag te stellen.';
  heading.appendChild(subtitle);
  wrapper.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'chat-empty-grid';
  wrapper.appendChild(grid);

  if(!hasWebhook){
    grid.appendChild(createEmptyCard({
      title: 'Verbind je webhook',
      description: 'Gebruik een beveiligde HTTPS-webhook zodat AIMY antwoorden kan ophalen.',
      actionLabel: 'Webhook koppelen',
      onAction: onConnectWebhook
    }));
  }else{
    grid.appendChild(createEmptyCard({
      title: 'Webhook actief',
      description: 'Je webhook is gekoppeld en klaar voor gebruik.',
      tone: 'success'
    }));
  }

  if(!hasDocs){
    grid.appendChild(createEmptyCard({
      title: 'Documenten toevoegen',
      description: 'Upload handleidingen of schema’s zodat AIMY kan meelezen.',
      actionLabel: 'Doc uploaden',
      onAction: onUploadDocs
    }));
  }else{
    grid.appendChild(createEmptyCard({
      title: 'Documenten klaar',
      description: 'Je documenten zijn beschikbaar voor deze sessie.',
      tone: 'success'
    }));
  }

  if(hasWebhook && hasDocs){
    grid.appendChild(createEmptyCard({
      title: 'Start je eerste vraag',
      description: 'Alles staat klaar. Begin met typen om AIMY aan het werk te zetten.',
      actionLabel: 'Open het invoerveld',
      onAction: onStartChat,
      tone: 'accent'
    }));
  }

  return wrapper;
}

function ensurePlaceholder(messagesEl){
  if(!isElement(messagesEl)){
    return null;
  }
  let placeholder = messagesEl.querySelector(':scope > .chat-placeholder');
  if(!placeholder){
    placeholder = document.createElement('div');
    placeholder.className = 'chat-placeholder';
    placeholder.hidden = true;
    messagesEl.appendChild(placeholder);
  }
  return placeholder;
}

function setPlaceholderState(messagesEl, placeholder, mode){
  if(!placeholder || !isElement(messagesEl)){
    return;
  }
  const validModes = ['loading', 'empty', 'ready', 'hidden'];
  const nextMode = validModes.includes(mode) ? mode : 'hidden';
  placeholder.innerHTML = '';
  if(nextMode === 'hidden'){
    placeholder.hidden = true;
    messagesEl.classList.remove('chat-has-placeholder');
    return;
  }
  messagesEl.classList.add('chat-has-placeholder');
  placeholder.hidden = false;
  placeholder.dataset.mode = nextMode;
}

export function createChatUiStateManager({
  messagesEl,
  onConnectWebhook = () => {},
  onUploadDocs = () => {},
  onStartChat = () => {}
} = {}){
  const placeholder = ensurePlaceholder(messagesEl);
  let currentMode = 'hidden';

  function renderSkeleton(){
    if(!placeholder){
      return;
    }
    const content = buildSkeleton();
    placeholder.appendChild(content);
  }

  function renderEmptyState({ hasWebhook, hasDocs }){
    if(!placeholder){
      return;
    }
    const content = buildEmptyState({
      hasWebhook,
      hasDocs,
      onConnectWebhook,
      onUploadDocs,
      onStartChat
    });
    placeholder.appendChild(content);
  }

  function renderReadyState(){
    if(!placeholder){
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-ready-state';
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-live', 'polite');

    const title = document.createElement('h3');
    title.textContent = 'Je bent klaar om te chatten met AIMY.';
    wrapper.appendChild(title);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary chat-ready-action';
    button.textContent = 'Open het invoerveld';
    button.addEventListener('click', () => {
      onStartChat();
    });
    wrapper.appendChild(button);

    placeholder.appendChild(wrapper);
  }

  function transitionTo(mode, payload){
    if(!placeholder || !messagesEl){
      return;
    }
    if(mode === currentMode && mode !== 'empty'){
      return;
    }
    currentMode = mode;
    setPlaceholderState(messagesEl, placeholder, mode);
    if(mode === 'hidden'){
      return;
    }
    if(mode === 'loading'){
      renderSkeleton();
    }else if(mode === 'empty'){
      renderEmptyState(payload || { hasWebhook: false, hasDocs: false });
    }else if(mode === 'ready'){
      renderReadyState();
    }
  }

  return {
    showLoading(){
      transitionTo('loading');
    },
    update({ hasMessages, hasWebhook, hasDocs }){
      if(hasMessages){
        transitionTo('hidden');
        return;
      }
      if(!hasWebhook || !hasDocs){
        transitionTo('empty', { hasWebhook, hasDocs });
        return;
      }
      transitionTo('ready');
    },
    hide(){
      transitionTo('hidden');
    }
  };
}

let toastContainer = null;

function ensureToastContainer(){
  if(typeof document === 'undefined'){
    return null;
  }
  if(toastContainer && document.body && document.body.contains(toastContainer)){
    return toastContainer;
  }
  if(!document.body){
    return null;
  }
  const container = document.createElement('div');
  container.className = 'toast-stack';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Meldingen');
  document.body.appendChild(container);
  toastContainer = container;
  return toastContainer;
}

function hideToast(toast){
  if(!toast){
    return;
  }
  if(toast.dataset.dismissing === 'true'){
    return;
  }
  toast.dataset.dismissing = 'true';
  toast.classList.remove('visible');
  const fallback = window.setTimeout(() => {
    toast.removeEventListener('transitionend', remove);
    toast.remove();
  }, 220);
  const remove = () => {
    toast.removeEventListener('transitionend', remove);
    window.clearTimeout(fallback);
    toast.remove();
  };
  toast.addEventListener('transitionend', remove);
}

function showToast(variant, message){
  if(typeof document === 'undefined'){
    return;
  }
  const container = ensureToastContainer();
  if(!container){
    return;
  }
  while(container.children.length >= 4){
    container.removeChild(container.firstElementChild);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  const role = variant === 'error' ? 'alert' : 'status';
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';
  toast.setAttribute('role', role);
  toast.setAttribute('aria-live', ariaLive);

  const text = document.createElement('p');
  text.className = 'toast-message';
  text.textContent = message;
  toast.appendChild(text);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Melding sluiten');
  close.textContent = '×';
  close.addEventListener('click', () => {
    hideToast(toast);
  });
  toast.appendChild(close);

  container.appendChild(toast);
  // Force layout so transition triggers
  void toast.offsetWidth;
  toast.classList.add('visible');

  window.setTimeout(() => {
    hideToast(toast);
  }, 5000);
}

export function errorToast(message){
  showToast('error', message || 'Er is een fout opgetreden.');
}

export function infoToast(message){
  showToast('info', message || 'Melding');
}

