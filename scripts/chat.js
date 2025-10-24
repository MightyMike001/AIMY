import { GREETING, MAX_HISTORY, STREAM_DELAY_MS } from './constants.js';
import { addMessage, appendStreamChunk } from './messages.js';
import { resetConversation } from './state.js';
import { clearChatStorage, persistHistorySnapshot } from './storage.js';
import { normalizeWebhookUrl, safeStringify } from './utils/security.js';
import {
  buildMessageWindow,
  buildMetadata,
  preparePrechatPayload,
  sanitizePrompt,
  selectDocIds
} from './domain/conversation.js';

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const DEMO_FALLBACK_MESSAGE = 'Demo-antwoord (n8n URL niet ingesteld). Controleer hoofdschakelaar, noodstop, zekeringen en CAN-bus. Meet accuspanning (>24.0V) en log foutcode 224-01.';

function wait(ms){
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

function getLastAssistantIndex(state){
  if(!state?.messages || !state.messages.length){
    return -1;
  }
  for(let i = state.messages.length - 1; i >= 0; i -= 1){
    if(state.messages[i]?.role === 'assistant'){
      return i;
    }
  }
  return -1;
}

function showAssistantError(state, messagesEl, message, onRetry){
  const lastBubble = messagesEl?.lastElementChild;
  if(!lastBubble || !lastBubble.classList.contains('assistant')){
    return;
  }
  const contentEl = lastBubble.querySelector('.content');
  if(!contentEl){
    return;
  }
  lastBubble.classList.remove('loading');
  contentEl.innerHTML = '';

  const messageEl = document.createElement('p');
  messageEl.className = 'chat-error';
  messageEl.textContent = message;
  contentEl.appendChild(messageEl);

  if(typeof onRetry === 'function'){
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-ghost btn-small chat-retry';
    retryBtn.textContent = 'Opnieuw';
    retryBtn.addEventListener('click', () => {
      retryBtn.disabled = true;
      onRetry();
    });
    contentEl.appendChild(retryBtn);
  }

  const lastAssistant = getLastAssistantIndex(state);
  if(lastAssistant > -1){
    state.messages[lastAssistant].content = message;
  }
}

function createTimeoutSignal(){
  if(typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'){
    return {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cleanup(){},
      cancel(){}
    };
  }
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    cleanup(){
      window.clearTimeout(timeoutId);
    },
    cancel(){
      controller.abort();
    }
  };
}

export function createChatController({ state, config, elements }){
  const { messagesEl, inputEl, sendBtn, newChatBtn, tempInput, citationsCheckbox } = elements;

  async function send(options = {}){
    const { retryContent } = options;
    if(!inputEl || !messagesEl || !sendBtn){
      return;
    }

    if(!state.prechat || !state.prechat.ready){
      return;
    }

    const providedText = typeof retryContent === 'string' ? retryContent : inputEl.value;
    const text = sanitizePrompt(providedText);
    if(!text || state.streaming){
      return;
    }
    const isRetry = typeof retryContent === 'string';
    if(!isRetry){
      addMessage(state, messagesEl, 'user', text);
      persistHistorySnapshot(state);
      inputEl.value = '';
    }
    const history = buildMessageWindow(state.messages, { limit: MAX_HISTORY });
    const uniqueDocIds = selectDocIds(state.docs);
    const prechat = preparePrechatPayload(state.prechat);

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
        metadata: buildMetadata(prechat),
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
        let lastError = null;
        for(let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1){
          const { signal, cleanup, cancel } = createTimeoutSignal();
          try{
            const resp = await fetch(targetWebhook, {
              method: 'POST',
              headers,
              body,
              signal
            });
            cleanup();
            if(resp.status >= 500){
              lastError = new Error(`webhook antwoordt met status ${resp.status}`);
              if(attempt < MAX_RETRY_ATTEMPTS - 1){
                await wait(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
                continue;
              }
              throw lastError;
            }
            if(!resp.ok){
              throw new Error(`webhook antwoordt met status ${resp.status}`);
            }
            data = await resp.json();
            lastError = null;
            break;
          }catch(err){
            cleanup();
            const aborted = err?.name === 'AbortError' || err?.name === 'TimeoutError';
            const networkIssue = err instanceof TypeError;
            lastError = err;
            if(attempt < MAX_RETRY_ATTEMPTS - 1 && (aborted || networkIssue)){
              await wait(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
              continue;
            }
            if(attempt < MAX_RETRY_ATTEMPTS - 1 && lastError?.message?.includes('status 5')){
              await wait(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
              continue;
            }
            cancel?.();
            throw err;
          }
        }
        if(lastError){
          throw lastError;
        }
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
        const retryMessage = aborted
          ? 'Timeout: geen antwoord ontvangen van de webhook. Controleer je verbinding en probeer het opnieuw.'
          : 'AIMY kon geen verbinding maken met de webhook. Controleer de HTTPS-URL of authenticatie en probeer het opnieuw.';
        showAssistantError(state, messagesEl, retryMessage, () => {
          send({ retryContent: text });
        });
      }
    }finally{
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
