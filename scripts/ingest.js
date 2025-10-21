import { fmtBytes } from './utils/format.js';

function createDocElement(doc, state, render){
  const el = document.createElement('div');
  el.className = 'doc';
  el.innerHTML = `<div class="dot"></div>
    <div class="meta">
      <div class="name">${doc.name}</div>
      <div class="small">${fmtBytes(doc.size)} • ${new Date(doc.uploadedAt).toLocaleString()}</div>
    </div>
    <button data-id="${doc.id}" title="Verwijderen">Verwijder</button>`;
  el.querySelector('button').addEventListener('click', async (ev) => {
    const id = ev.currentTarget.getAttribute('data-id');
    try{
      await fetch(`/api/docs/${id}`, { method: 'DELETE' });
    }catch{
      /* optioneel offline */
    }
    state.docs = state.docs.filter(x => x.id !== id);
    render();
  });
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
    docListEl.innerHTML = '<div class="hint">Nog niets geladen</div>';
    return;
  }
  docListEl.innerHTML = '';
  state.docs.forEach(doc => {
    const el = createDocElement(doc, state, () => renderDocList(state, docListEl, ingestBadge));
    docListEl.appendChild(el);
  });
}

async function uploadDoc(state, file){
  const form = new FormData();
  form.append('file', file);
  const doc = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    uploadedAt: Date.now()
  };
  try{
    const res = await fetch('/api/ingest', { method: 'POST', body: form });
    if(res.ok){
      const data = await res.json();
      if(data && data.doc_id){
        doc.id = data.doc_id;
      }
    }
  }catch{
    /* optioneel offline */
  }
  state.docs.push(doc);
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

  dropEl.addEventListener('dragover', () => {
    dropEl.style.borderColor = 'var(--motrac-red)';
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropEl.addEventListener(eventName, () => {
      dropEl.style.borderColor = '#d1d5db';
    });
  });

  dropEl.addEventListener('click', () => fileInput.click());
  dropEl.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  async function handleFiles(fileList){
    const files = [...fileList];
    if(!files.length){
      return;
    }
    for(const file of files){
      await uploadDoc(state, file);
    }
    render();
  }

  return { render };
}
