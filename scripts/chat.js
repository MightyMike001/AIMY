import { GREETING, MAX_HISTORY, STREAM_DELAY_MS } from './constants.js';
import { addMessage, appendStreamChunk } from './messages.js';
import { resetConversation } from './state.js';
import { clearChatStorage } from './storage.js';

export function createChatController({ state, config, elements }){
  const { messagesEl, inputEl, sendBtn, newChatBtn, tempInput, citationsCheckbox } = elements;

  async function send(){
    if(!inputEl || !messagesEl || !sendBtn){
      return;
    }
    const text = inputEl.value.trim();
    if(!text || state.streaming){
      return;
    }
    addMessage(state, messagesEl, 'user', text);
    inputEl.value = '';
    const history = state.messages.slice(-MAX_HISTORY);
    const docIds = state.docs.map(d => d.id);
    const sharedQueryFields = {
      query: text,
      question: text,
      prompt: text,
      input: text,
      text
    };
    addMessage(state, messagesEl, 'assistant', '');
    state.streaming = true;
    sendBtn.disabled = true;
    if(newChatBtn){
      newChatBtn.disabled = true;
    }

    try{
      const headers = { 'Content-Type': 'application/json' };
      if(config.AUTH_VALUE){
        headers[config.AUTH_HEADER] = config.AUTH_VALUE;
      }
      const body = {
        chat_id: state.chatId,
        ...sharedQueryFields,
        temperature: tempInput ? Number(tempInput.value) : 0.2,
        citations: citationsCheckbox ? citationsCheckbox.checked : false,
        history,
        messages: history,
        chat_history: history,
        history_text: history.map(m => `${m.role}: ${m.content}`).join('\n'),
        doc_ids: docIds,
        documents: docIds
      };

      let data;
      if(/^https?:\/\//.test(config.N8N_WEBHOOK)){
        const resp = await fetch(config.N8N_WEBHOOK, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        if(!resp.ok){
          throw new Error('n8n-webhook niet bereikbaar');
        }
        data = await resp.json();
      }else{
        data = {
          answer: 'Demo-antwoord (n8n URL niet ingesteld). Controleer hoofdschakelaar, noodstop, zekeringen en CAN-bus. Meet accuspanning (>24.0V) en log foutcode 224-01.',
          citations: []
        };
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
      console.error(err);
      appendStreamChunk(state, messagesEl, '\n[!] n8n-webhook niet bereikbaar. Controleer de Production URL & eventuele auth.');
    }finally{
      state.streaming = false;
      sendBtn.disabled = false;
      if(newChatBtn){
        newChatBtn.disabled = false;
      }
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
