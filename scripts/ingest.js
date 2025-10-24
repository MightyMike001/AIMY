import { fmtBytes } from './utils/format.js';
import { safeRandomId } from './utils/random.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'doc', 'docx', 'md', 'html', 'json', 'csv']);
const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/g;
const MAX_NAME_LENGTH = 120;

function sanitizeFileName(name){
  if(typeof name !== 'string'){
    return 'document';
  }
  const cleaned = name.replace(CONTROL_CHARS_PATTERN, '').trim();
  if(!cleaned){
    return 'document';
  }
  if(cleaned.length <= MAX_NAME_LENGTH){
    return cleaned;
  }
  const lastDot = cleaned.lastIndexOf('.');
  const extension = lastDot > 0 && lastDot < cleaned.length - 1 ? cleaned.slice(lastDot) : '';
  const baseLength = Math.max(1, MAX_NAME_LENGTH - extension.length);
  const base = cleaned.slice(0, baseLength).trimEnd();
  return `${base}${extension}` || 'document';
}

function normalizeDocId(value){
  if(typeof value === 'string' && value.trim()){
    return value.trim();
  }
  return safeRandomId('doc');
}

function createDocElement(doc, state, render){
  const el = document.createElement('div');
  el.className = 'doc';

  const dot = document.createElement('div');
  dot.className = 'dot';
  el.appendChild(dot);

  const meta = document.createElement('div');
  meta.className = 'meta';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = doc.name;
  meta.appendChild(name);

  const metaDetails = document.createElement('div');
  metaDetails.className = 'small';
  metaDetails.textContent = `${fmtBytes(doc.size)} • ${new Date(doc.uploadedAt).toLocaleString()}`;
  meta.appendChild(metaDetails);

  el.appendChild(meta);

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.id = doc.id;
  button.title = 'Verwijderen';
  button.textContent = 'Verwijder';
  button.addEventListener('click', async (ev) => {
    const id = ev.currentTarget.getAttribute('data-id');
    if(!id){
      return;
    }
    try{
      await fetch(`/api/docs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }catch{
      /* optioneel offline */
    }
    state.docs = state.docs.filter(x => x.id !== id);
    render();
  });

  el.appendChild(button);
  return el;
}

export function renderDocList(state, docListEl, ingestBadge){
  if(!docListEl){
    return;
  }
  if(ingestBadge){
    ingestBadge.textContent = `Docs: ${state.docs.length}`;
  }
  if(!state.docs.length){
    docListEl.textContent = '';
    const empty = document.createElement('div');
    empty.className = 'hint';
    empty.textContent = 'Nog niets geladen';
    docListEl.appendChild(empty);
    return;
  }
  docListEl.textContent = '';
  const fragment = document.createDocumentFragment();
  state.docs.forEach(doc => {
    const el = createDocElement(doc, state, () => renderDocList(state, docListEl, ingestBadge));
    fragment.appendChild(el);
  });
  docListEl.appendChild(fragment);
}

async function uploadDoc(state, file){
  if(file.size > MAX_FILE_SIZE){
    console.warn('Bestand te groot om te uploaden', { name: file.name, size: file.size });
    return;
  }

  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if(extension && !ALLOWED_EXTENSIONS.has(extension)){
    console.warn('Bestandstype niet toegestaan', { name: file.name });
    return;
  }

  const form = new FormData();
  form.append('file', file);
  const doc = {
    id: safeRandomId('doc'),
    name: sanitizeFileName(file.name),
    size: file.size,
    uploadedAt: Date.now()
  };
  try{
    const res = await fetch('/api/ingest', { method: 'POST', body: form });
    if(res.ok){
      const data = await res.json();
      if(data && data.doc_id){
        doc.id = normalizeDocId(data.doc_id);
      }
    }
  }catch{
    /* optioneel offline */
  }
  const existingIndex = state.docs.findIndex(existing => existing.id === doc.id);
  if(existingIndex > -1){
    state.docs[existingIndex] = doc;
  }else{
    state.docs.push(doc);
  }
}

export function setupIngest({ state, dropEl, fileInput, docListEl, ingestBadge }){
  const render = () => renderDocList(state, docListEl, ingestBadge);
  render();

  if(!dropEl || !fileInput){
    return { render };
  }

  function preventDefaults(e){
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropEl.addEventListener(eventName, preventDefaults, false);
  });

  const setDropHighlight = (active) => {
    dropEl.classList.toggle('is-dragover', Boolean(active));
  };

  ['dragenter', 'dragover'].forEach(eventName => {
    dropEl.addEventListener(eventName, () => setDropHighlight(true));
  });

  ['dragleave', 'drop', 'dragend'].forEach(eventName => {
    dropEl.addEventListener(eventName, () => setDropHighlight(false));
  });

  dropEl.addEventListener('click', () => fileInput.click());
  dropEl.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  async function handleFiles(fileList){
    const files = Array.from(fileList).filter((item) => item instanceof File);
    if(!files.length){
      setDropHighlight(false);
      return;
    }
    for(const file of files){
      await uploadDoc(state, file);
    }
    setDropHighlight(false);
    render();
  }

  return { render };
}
