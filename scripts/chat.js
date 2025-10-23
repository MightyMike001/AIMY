import { GREETING, MAX_HISTORY, STREAM_DELAY_MS } from './constants.js';
import { addMessage, appendStreamChunk } from './messages.js';
import { resetConversation } from './state.js';
import { clearChatStorage, persistHistorySnapshot } from './storage.js';
import { normalizeWebhookUrl, safeStringify } from './utils/security.js';

const REQUEST_TIMEOUT_MS = 15000;
const MAX_PROMPT_LENGTH = 4000;
const DEMO_FALLBACK_MESSAGE = 'Demo-antwoord (n8n URL niet ingesteld). Controleer hoofdschakelaar, noodstop, zekeringen en CAN-bus. Meet accuspanning (>24.0V) en log foutcode 224-01.';

export function createChatController({ state, config, elements }){
  const { messagesEl, inputEl, sendBtn, newChatBtn, tempInput, citationsCheckbox } = elements;

  function sanitizePrompt(value){
    if(typeof value !== 'string'){
      return '';
    }
    const trimmed = value.trim();
    if(trimmed.length <= MAX_PROMPT_LENGTH){
      return trimmed;
    }
    return trimmed.slice(0, MAX_PROMPT_LENGTH);
  }

  function createHistorySnapshot(messages){
    return messages.slice(-MAX_HISTORY).map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: sanitizePrompt(message.content || '')
    }));
  }

  async function send(){
    if(!inputEl || !messagesEl || !sendBtn){
      return;
    }

    if(!state.prechat || !state.prechat.ready){
      return;
    }

    const text = sanitizePrompt(inputEl.value);
    if(!text || state.streaming){
      return;
    }
    addMessage(state, messagesEl, 'user', text);
    persistHistorySnapshot(state);
    inputEl.value = '';
    const history = createHistorySnapshot(state.messages);
    const docIds = state.docs
      .map(doc => (typeof doc?.id === 'string' ? doc.id : String(doc?.id || '')).trim())
      .filter(id => Boolean(id))
      .slice(0, 50);
    const uniqueDocIds = Array.from(new Set(docIds));
    const prechat = state.prechat || {
      serialNumber: '',
      hours: '',
      faultCodes: '',
      ready: false
    };

    const sharedQueryFields = {
      query: text,
      question: text,
      prompt: text,
      input: text,
      text
    };
    addMessage(state, messagesEl, 'assistant', '', { loading: true });
    state.streaming = true;
    sendBtn.disabled = true;
    if(newChatBtn){
      newChatBtn.disabled = true;
    }

    const targetWebhook = normalizeWebhookUrl(config.N8N_WEBHOOK);
    const useDemo = !targetWebhook;
    let timeoutId = null;
    let controller = null;
    let signal = null;
    if(!useDemo){
      if(typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'){
        signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      }else{
        controller = new AbortController();
        signal = controller.signal;
        timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      }
    }

    try{
      const headers = { 'Content-Type': 'application/json' };
      if(config.AUTH_VALUE){
        headers[config.AUTH_HEADER] = config.AUTH_VALUE;
      }
      const payload = {
        chat_id: state.chatId,
        ...sharedQueryFields,
        temperature: tempInput ? Number(tempInput.value) : 0.2,
        citations: citationsCheckbox ? citationsCheckbox.checked : false,
        history,
        messages: history,
        chat_history: history,
        history_text: history.map(m => `${m.role}: ${m.content}`).join('\n'),
        doc_ids: uniqueDocIds,
        documents: uniqueDocIds,
        prechat,
        metadata: {
          serialNumber: prechat.serialNumber,
          hours: prechat.hours,
          faultCodes: prechat.faultCodes
        },
        serial_number: prechat.serialNumber,
        serienummer: prechat.serialNumber,
        hours: prechat.hours,
        urenstand: prechat.hours,
        fault_codes: prechat.faultCodes
      };

      let data;
      if(useDemo){
        data = { answer: DEMO_FALLBACK_MESSAGE, citations: [] };
      }else{
        const body = safeStringify(payload);
        if(!body){
          throw new Error('kon verzoek niet serialiseren');
        }

        const resp = await fetch(targetWebhook, {
          method: 'POST',
          headers,
          body,
          signal
        });
        if(!resp.ok){
          throw new Error(`webhook antwoordt met status ${resp.status}`);
        }
        data = await resp.json();
      }

      const answer = (data.answer || '[geen antwoord]').toString();
      for(let i = 0; i < answer.length; i++){
        appendStreamChunk(state, messagesEl, answer[i]);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, STREAM_DELAY_MS));
      }
      if(Array.isArray(data.citations) && data.citations.length){
        const appendix = `\n\n— Bronnen:\n${data.citations.map(c => `• ${c.doc_id} p.${c.page}${c.section ? ` (${c.section})` : ''}`).join('\n')}`;
        appendStreamChunk(state, messagesEl, appendix);
      }
    }catch(err){
      const aborted = err?.name === 'AbortError' || err?.name === 'TimeoutError';
      console.error('chat:send failed', { error: err?.message, aborted });
      if(useDemo){
        appendStreamChunk(state, messagesEl, '\n[!] Demo-antwoord kon niet worden weergegeven.');
      }else{
        const message = aborted
          ? '\n[!] Timeout: geen antwoord ontvangen van de webhook. Probeer het opnieuw of controleer de verbinding.'
          : '\n[!] Webhook niet bereikbaar. Controleer de HTTPS-URL en eventuele authenticatie.';
        appendStreamChunk(state, messagesEl, message);
      }
    }finally{
      if(timeoutId){
        window.clearTimeout(timeoutId);
      }
      controller?.abort();
      state.streaming = false;
      sendBtn.disabled = !(state.prechat && state.prechat.ready);
      if(newChatBtn){
        newChatBtn.disabled = false;
      }
      persistHistorySnapshot(state);
    }
  }

  function resetChat(){
    if(state.streaming || !messagesEl){
      return;
    }
    resetConversation();
    clearChatStorage();
    messagesEl.innerHTML = '';
    addMessage(state, messagesEl, 'assistant', GREETING, { track: false, scroll: false });
    if(inputEl){
      inputEl.value = '';
      inputEl.focus();
    }
  }

  return { send, resetChat };
}
