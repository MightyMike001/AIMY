import { fmtBytes } from './utils/format.js';
import { safeRandomId } from './utils/random.js';
import {
  DOC_STATUS,
  sanitizeFileName,
  validateFile,
  describeValidationError,
  getStatusPresentation,
  computeUploadCounters,
  deriveTypeLabel,
  getExtension
} from '../js/docs.js';
import { maxFiles } from '../js/config.js';

function normalizeDocId(value){
  if(typeof value === 'string' && value.trim()){
    return value.trim();
  }
  return safeRandomId('doc');
}

function updateBadges(uploads, ingestBadge, testBadge){
  const { docs, processed, success } = computeUploadCounters(uploads);
  if(ingestBadge){
    ingestBadge.textContent = `Docs: ${docs}`;
  }
  if(testBadge){
    testBadge.textContent = `Tests: ${processed}/${success}`;
  }
}

function createDocElement(upload, removeUpload){
  const el = document.createElement('div');
  el.className = 'doc';

  const dot = document.createElement('div');
  dot.className = 'dot';
  el.appendChild(dot);

  const meta = document.createElement('div');
  meta.className = 'meta';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = upload.name;
  meta.appendChild(name);

  const details = document.createElement('div');
  details.className = 'small';
  const typeLabel = upload.typeLabel || deriveTypeLabel(upload.name);
  details.textContent = `${typeLabel} • ${fmtBytes(upload.size)}`;
  meta.appendChild(details);

  el.appendChild(meta);

  const statusBadge = document.createElement('span');
  statusBadge.className = 'badge doc-status';
  const { text, tone } = getStatusPresentation(upload.status, { error: upload.error });
  statusBadge.textContent = text;
  if(tone){
    statusBadge.dataset.tone = tone;
  }
  if(upload.status === DOC_STATUS.FAIL && upload.error){
    statusBadge.title = upload.error;
  }
  if(upload.status === DOC_STATUS.PROCESSING){
    statusBadge.setAttribute('aria-live', 'polite');
  }
  el.appendChild(statusBadge);

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.id = upload.id;
  button.title = 'Verwijderen';
  button.textContent = 'Verwijder';
  button.disabled = upload.status === DOC_STATUS.PROCESSING;
  button.addEventListener('click', async () => {
    await removeUpload(upload);
  });

  el.appendChild(button);
  return el;
}

function renderList({ uploads, docListEl, ingestBadge, testBadge, removeUpload }){
  updateBadges(uploads, ingestBadge, testBadge);
  if(!docListEl){
    return;
  }
  docListEl.textContent = '';
  if(!uploads.length){
    const empty = document.createElement('div');
    empty.className = 'hint';
    empty.textContent = 'Nog niets geladen';
    docListEl.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  uploads.forEach((upload) => {
    fragment.appendChild(createDocElement(upload, removeUpload));
  });
  docListEl.appendChild(fragment);
}

export function renderDocList(state, docListEl, ingestBadge, testBadge = null){
  const uploads = Array.isArray(state.docs)
    ? state.docs.map((doc) => {
        const name = typeof doc?.name === 'string' && doc.name ? doc.name : 'document';
        const size = Number.isFinite(doc?.size) ? doc.size : 0;
        const uploadedAt = Number.isFinite(doc?.uploadedAt) ? doc.uploadedAt : Date.now();
        const docId = typeof doc?.id === 'string' && doc.id ? doc.id : safeRandomId('doc');
        const typeLabel = doc?.type || deriveTypeLabel(name);
        const extension = doc?.extension || getExtension(name);
        return {
          id: docId,
          docId,
          name,
          size,
          uploadedAt,
          status: DOC_STATUS.OK,
          error: null,
          typeLabel,
          extension
        };
      })
    : [];

  async function removeUpload(upload){
    if(!upload?.docId){
      return;
    }
    try{
      await fetch(`/api/docs/${encodeURIComponent(upload.docId)}`, { method: 'DELETE' });
    }catch{
      /* optioneel offline */
    }
    state.docs = state.docs.filter((doc) => doc.id !== upload.docId);
    renderDocList(state, docListEl, ingestBadge, testBadge);
  }

  renderList({ uploads, docListEl, ingestBadge, testBadge, removeUpload });
}

export function setupIngest({ state, dropEl, fileInput, docListEl, ingestBadge, testBadge, onUploadsChange }){
  const uploads = [];
  const notifyUploadsChange = typeof onUploadsChange === 'function' ? onUploadsChange : () => {};
  const MAX_FILES = Number.isInteger(maxFiles) && maxFiles > 0 ? maxFiles : Infinity;

  if(!Array.isArray(state.docs)){
    state.docs = [];
  }

  state.docs = state.docs.map((doc) => {
    const name = sanitizeFileName(doc?.name || 'document');
    const size = Number.isFinite(doc?.size) ? doc.size : 0;
    const uploadedAt = Number.isFinite(doc?.uploadedAt) ? doc.uploadedAt : Date.now();
    const id = typeof doc?.id === 'string' && doc.id ? doc.id : safeRandomId('doc');
    const typeLabel = doc?.type || deriveTypeLabel(name);
    const extension = doc?.extension || getExtension(name);
    uploads.push({
      id: safeRandomId('upload'),
      docId: id,
      name,
      size,
      uploadedAt,
      status: DOC_STATUS.OK,
      error: null,
      typeLabel,
      extension
    });
    return { id, name, size, uploadedAt, type: typeLabel, extension };
  });

  function renderUploads(){
    renderList({ uploads, docListEl, ingestBadge, testBadge, removeUpload });
    const atLimit = uploads.length >= MAX_FILES;
    if(fileInput){
      fileInput.disabled = atLimit;
      fileInput.setAttribute('aria-disabled', String(atLimit));
    }
    if(dropEl){
      dropEl.classList.toggle('is-disabled', atLimit);
      dropEl.setAttribute('aria-disabled', String(atLimit));
      if(Number.isFinite(MAX_FILES)){
        dropEl.dataset.maxFiles = String(MAX_FILES);
      }else{
        delete dropEl.dataset.maxFiles;
      }
    }
    notifyUploadsChange();
  }

  async function removeUpload(upload){
    const index = uploads.findIndex((item) => item.id === upload.id);
    if(index === -1){
      return;
    }
    uploads.splice(index, 1);
    if(upload.docId){
      state.docs = state.docs.filter((doc) => doc.id !== upload.docId);
      try{
        await fetch(`/api/docs/${encodeURIComponent(upload.docId)}`, { method: 'DELETE' });
      }catch{
        /* optioneel offline */
      }
    }
    renderUploads();
  }

  async function processUpload(entry, file){
    entry.status = DOC_STATUS.PROCESSING;
    entry.error = null;
    renderUploads();

    const form = new FormData();
    form.append('file', file, entry.name);
    if(state.chatId){
      form.append('sessionId', state.chatId);
    }

    try{
      const res = await fetch('/api/ingest', { method: 'POST', body: form });
      if(res && res.ok){
        let data = null;
        try{
          data = await res.json();
        }catch{
          data = null;
        }
        const docId = normalizeDocId(data?.doc_id || data?.id || entry.docId);
        entry.docId = docId;
        entry.status = DOC_STATUS.OK;
        entry.error = null;
        entry.uploadedAt = Date.now();

        const docRecord = {
          id: docId,
          name: entry.name,
          size: entry.size,
          uploadedAt: entry.uploadedAt,
          type: entry.typeLabel,
          extension: entry.extension
        };
        const existingIndex = state.docs.findIndex((doc) => doc.id === docId);
        if(existingIndex > -1){
          state.docs[existingIndex] = docRecord;
        }else{
          state.docs.push(docRecord);
        }
      }else{
        entry.status = DOC_STATUS.FAIL;
        entry.error = res ? `HTTP ${res.status}` : 'Upload mislukt';
        entry.docId = null;
      }
    }catch{
      entry.status = DOC_STATUS.FAIL;
      entry.error = 'Netwerkfout';
      entry.docId = null;
    }

    if(entry.status !== DOC_STATUS.OK){
      state.docs = state.docs.filter((doc) => doc.id !== entry.docId);
    }

    renderUploads();
  }

  function queueFile(file){
    const validation = validateFile(file);
    const name = sanitizeFileName(file.name);
    const entry = {
      id: safeRandomId('upload'),
      docId: null,
      name,
      size: file.size,
      uploadedAt: Date.now(),
      status: validation.ok ? DOC_STATUS.QUEUED : DOC_STATUS.FAIL,
      error: validation.ok ? null : describeValidationError(validation.error),
      typeLabel: validation.ok ? validation.typeLabel : deriveTypeLabel(name),
      extension: validation.extension || getExtension(name)
    };
    uploads.push(entry);
    renderUploads();
    return { entry, validation };
  }

  async function handleFiles(fileList){
    const files = Array.from(fileList).filter((item) => item instanceof File);
    if(!files.length){
      setDropHighlight(false);
      return;
    }
    const remainingSlots = MAX_FILES - uploads.length;
    if(remainingSlots <= 0){
      setDropHighlight(false);
      return;
    }
    const limitedFiles = Number.isFinite(MAX_FILES) ? files.slice(0, remainingSlots) : files;
    if(limitedFiles.length < files.length){
      console.warn('Maximum number of uploads reached. Ignoring extra files.');
    }
    for(const file of limitedFiles){
      const { entry, validation } = queueFile(file);
      if(validation.ok){
        await processUpload(entry, file);
      }
    }
    setDropHighlight(false);
    if(fileInput){
      fileInput.value = '';
    }
  }

  function setDropHighlight(active){
    if(dropEl){
      dropEl.classList.toggle('is-dragover', Boolean(active));
    }
  }

  renderUploads();

  if(!dropEl || !fileInput){
    return { render: renderUploads };
  }

  function preventDefaults(event){
    event.preventDefault();
    event.stopPropagation();
  }

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dropEl.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropEl.addEventListener(eventName, () => setDropHighlight(true));
  });

  ['dragleave', 'drop', 'dragend'].forEach((eventName) => {
    dropEl.addEventListener(eventName, () => setDropHighlight(false));
  });

  dropEl.addEventListener('click', () => fileInput.click());
  dropEl.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
  fileInput.addEventListener('change', (event) => handleFiles(event.target.files));

  return { render: renderUploads };
}
