import { loadChatHistory, setChatArchived, removeChatFromHistory, markChatOpened } from './storage.js';
import { savePrechat } from './prechat-storage.js';
import { CHAT_KEY } from './constants.js';
import { initThemeToggle } from './theme.js';

const searchInput = document.getElementById('historySearch');
const activeListEl = document.getElementById('historyActiveList');
const archivedListEl = document.getElementById('historyArchivedList');
const activeEmptyEl = document.getElementById('historyEmptyActive');
const archivedEmptyEl = document.getElementById('historyEmptyArchived');
const activeCountEl = document.getElementById('historyActiveCount');
const archivedCountEl = document.getElementById('historyArchivedCount');
const themeToggle = document.getElementById('themeToggle');

initThemeToggle({ toggleBtn: themeToggle });

let query = '';
let historyItems = [];

refreshHistory();

if(searchInput){
  searchInput.addEventListener('input', (event) => {
    query = event.target.value || '';
    render();
  });
}

document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible'){
    refreshHistory();
  }
});

function refreshHistory(){
  historyItems = loadChatHistory().sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || '') || 0;
    const bTime = Date.parse(b.updatedAt || '') || 0;
    return bTime - aTime;
  });
  render();
}

function render(){
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? historyItems.filter(item => matchesQuery(item, normalizedQuery))
    : historyItems.slice();

  const active = filtered.filter(item => !item.archived);
  const archived = filtered.filter(item => item.archived);

  updateCount(activeCountEl, active.length);
  updateCount(archivedCountEl, archived.length);

  renderList(activeListEl, active, false);
  renderList(archivedListEl, archived, true);

  toggleEmpty(activeEmptyEl, active.length === 0);
  toggleEmpty(archivedEmptyEl, archived.length === 0);
}

function matchesQuery(item, normalizedQuery){
  const haystacks = [
    item.title,
    item.serialNumber,
    item.faultCodes,
    item.hours
  ];
  const preview = getPreview(item);
  if(preview){
    haystacks.push(preview);
  }
  const combined = haystacks.filter(Boolean).join(' \n ').toLowerCase();
  return combined.includes(normalizedQuery);
}

function renderList(container, items, archived){
  if(!container){
    return;
  }
  container.innerHTML = '';
  if(!items.length){
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    fragment.appendChild(createHistoryCard(item, archived));
  });
  container.appendChild(fragment);
}

function createHistoryCard(item, archived){
  const card = document.createElement('article');
  card.className = 'history-item card panel';
  card.setAttribute('role', 'listitem');
  card.dataset.id = item.id;

  const header = document.createElement('div');
  header.className = 'history-item-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'history-item-title';
  titleEl.textContent = item.title || 'Onbekend serienummer';
  header.appendChild(titleEl);

  const metaEl = document.createElement('span');
  metaEl.className = 'history-item-meta tiny';
  metaEl.textContent = formatMeta(item, archived);
  header.appendChild(metaEl);

  card.appendChild(header);

  const tags = document.createElement('div');
  tags.className = 'history-item-tags';
  tags.appendChild(createBadge(`Urenstand: ${item.hours || '—'}`));
  tags.appendChild(createBadge(`Berichten: ${item.messages?.length || 0}`));
  tags.appendChild(createBadge(`Docs: ${item.docs?.length || 0}`));
  card.appendChild(tags);

  const previewText = getPreview(item);
  if(previewText){
    const previewEl = document.createElement('p');
    previewEl.className = 'history-item-preview';
    previewEl.textContent = previewText;
    card.appendChild(previewEl);
  }

  const actions = document.createElement('div');
  actions.className = 'history-item-actions';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'btn primary small';
  openBtn.textContent = 'Openen';
  openBtn.addEventListener('click', () => openChat(item));
  actions.appendChild(openBtn);

  const archiveBtn = document.createElement('button');
  archiveBtn.type = 'button';
  archiveBtn.className = 'btn secondary small';
  archiveBtn.textContent = archived ? 'Terugzetten' : 'Archiveer';
  archiveBtn.addEventListener('click', () => {
    setChatArchived(item.id, !archived);
    refreshHistory();
  });
  actions.appendChild(archiveBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn secondary small history-delete';
  deleteBtn.textContent = 'Verwijderen';
  deleteBtn.addEventListener('click', () => {
    const confirmDelete = window.confirm('Weet je zeker dat je deze chat permanent wilt verwijderen?');
    if(!confirmDelete){
      return;
    }
    removeChatFromHistory(item.id);
    refreshHistory();
  });
  actions.appendChild(deleteBtn);

  card.appendChild(actions);

  return card;
}

function createBadge(text){
  const span = document.createElement('span');
  span.className = 'badge';
  span.textContent = text;
  return span;
}

function getPreview(item){
  if(!Array.isArray(item.messages) || !item.messages.length){
    return '';
  }
  const lastMessage = [...item.messages].reverse().find(m => m && typeof m.content === 'string' && m.content.trim());
  return lastMessage ? lastMessage.content.trim().slice(0, 280) : '';
}

function formatMeta(item, archived){
  const updated = Date.parse(item.updatedAt || '') || Date.now();
  const updatedText = new Date(updated).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  if(archived){
    return `Gearchiveerd • bijgewerkt op ${updatedText}`;
  }
  return `Bijgewerkt op ${updatedText}`;
}

function openChat(item){
  try{
    const payload = {
      messages: Array.isArray(item.messages) ? item.messages : [],
      docs: Array.isArray(item.docs) ? item.docs : [],
      chatId: item.id
    };
    localStorage.setItem(CHAT_KEY, JSON.stringify(payload));
  }catch{
    /* ignore */
  }
  savePrechat({
    serialNumber: item.serialNumber || '',
    hours: item.hours || '',
    faultCodes: item.faultCodes || ''
  });
  markChatOpened(item.id);
  window.location.href = 'chat.html';
}

function toggleEmpty(el, show){
  if(!el){
    return;
  }
  el.hidden = !show;
}

function updateCount(el, count){
  if(!el){
    return;
  }
  el.textContent = count === 1 ? '1 chat' : `${count} chats`;
}
