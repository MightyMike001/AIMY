const DEFAULT_WEBHOOK = 'https://aimy.dev/smoke';
const DEFAULT_SERIAL = 'SMOKE-UNIT';
const DEFAULT_HOURS = '1';
const SMOKE_ANSWER = 'Smoke test geslaagd!';
const WAIT_TIMEOUT_MS = 8000;
const WAIT_INTERVAL_MS = 50;

function wait(ms){
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitFor(predicate, { timeoutMs = WAIT_TIMEOUT_MS, intervalMs = WAIT_INTERVAL_MS } = {}){
  const deadline = Date.now() + timeoutMs;
  while(Date.now() < deadline){
    if(predicate()){
      return true;
    }
    // eslint-disable-next-line no-await-in-loop
    await wait(intervalMs);
  }
  return predicate();
}

function logStep(label, ok, detail = ''){
  const icon = ok ? '✅' : '❌';
  const suffix = detail ? ` – ${detail}` : '';
  console.log(`${icon} ${label}${suffix}`);
}

function createFetchMock({ webhookUrl, answerText }){
  const original = window.fetch ? window.fetch.bind(window) : null;
  const stats = { ping: 0, chat: 0, ingest: 0 };

  async function mockFetch(input, init = {}){
    const url = typeof input === 'string' ? input : input?.url;
    const method = (init?.method || 'GET').toUpperCase();

    if(url && webhookUrl && url === webhookUrl){
      if(method === 'POST'){
        stats.chat += 1;
        const body = JSON.stringify({ answer: answerText, citations: [] });
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if(method === 'OPTIONS' || method === 'GET'){
        stats.ping += 1;
        return new Response(null, { status: method === 'OPTIONS' ? 204 : 200 });
      }
    }

    if(url && url.endsWith('/api/ingest') && method === 'POST'){
      stats.ingest += 1;
      return new Response(JSON.stringify({ doc_id: 'smoke-doc' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if(url && url.includes('/api/docs/') && method === 'DELETE'){
      return new Response(null, { status: 204 });
    }

    if(original){
      return original(input, init);
    }
    throw new Error('window.fetch niet beschikbaar voor smoke test');
  }

  return {
    mockFetch,
    stats,
    restore(){
      if(original){
        window.fetch = original;
      }
    }
  };
}

export async function runSmokeTest({ webhook: webhookOverride, token: tokenOverride } = {}){
  if(typeof window === 'undefined' || typeof document === 'undefined'){
    throw new Error('Smoke test vereist een browseromgeving.');
  }

  const [{ loadConfig, persistConfig }, { pingEndpoint }, { state }, { renderDocList }, { persistHistorySnapshot }, { getElements }, { CHAT_HISTORY_KEY }] = await Promise.all([
    import('../scripts/config.js'),
    import('../scripts/chat-page.js'),
    import('../scripts/state.js'),
    import('../scripts/ingest.js'),
    import('../scripts/storage.js'),
    import('../scripts/dom.js'),
    import('../scripts/constants.js')
  ]);

  const start = Date.now();
  const elements = getElements();
  if(!elements?.inputEl || !elements?.sendBtn){
    logStep('UI controleren', false, 'Chat elementen niet gevonden');
    return { ok: false };
  }

  const config = loadConfig();
  if(webhookOverride){
    config.N8N_WEBHOOK = webhookOverride;
  }
  if(!config.N8N_WEBHOOK){
    config.N8N_WEBHOOK = DEFAULT_WEBHOOK;
  }
  if(tokenOverride){
    config.AUTH_VALUE = tokenOverride;
  }
  persistConfig(config);
  logStep('Instellingen laden', true, config.N8N_WEBHOOK ? 'webhook klaar' : 'demo-modus');

  const webhookUrl = config.N8N_WEBHOOK;
  const fetchMock = createFetchMock({ webhookUrl, answerText: SMOKE_ANSWER });
  const originalFetch = window.fetch;
  window.fetch = fetchMock.mockFetch;

  try{
    const pingResult = await pingEndpoint(webhookUrl, config.AUTH_VALUE, config.AUTH_HEADER);
    const pingOk = !!pingResult?.ok;
    const pingDetail = pingOk
      ? `${pingResult.method || 'GET'} ${pingResult.status || 200}`
      : 'Geen verbinding';
    logStep('Webhook ping', pingOk, pingDetail);

    const docId = `smoke-doc-${Date.now()}`;
    const docRecord = {
      id: docId,
      name: 'test.pdf',
      size: 1024,
      uploadedAt: Date.now(),
      type: 'PDF',
      extension: 'pdf'
    };
    const existingIndex = Array.isArray(state.docs)
      ? state.docs.findIndex((doc) => doc.id === docId)
      : -1;
    if(existingIndex > -1){
      state.docs[existingIndex] = docRecord;
    }else{
      if(!Array.isArray(state.docs)){
        state.docs = [];
      }
      state.docs.push(docRecord);
    }
    renderDocList(state, elements.docList, elements.ingestBadge, elements.testBadge);
    const uploadOk = Array.isArray(state.docs) && state.docs.some((doc) => doc.id === docId);
    logStep('Upload test.pdf', uploadOk, uploadOk ? 'mock opgeslagen' : 'mislukt');

    state.prechat = {
      ...(state.prechat || {}),
      serialNumber: state.prechat?.serialNumber || DEFAULT_SERIAL,
      hours: state.prechat?.hours || DEFAULT_HOURS,
      faultCodes: state.prechat?.faultCodes || '',
      ready: true,
      completed: true,
      valid: true
    };
    if(elements.inputEl){
      elements.inputEl.disabled = false;
      elements.inputEl.setAttribute('aria-disabled', 'false');
    }
    if(elements.sendBtn){
      elements.sendBtn.disabled = false;
    }

    const previousAssistantCount = Array.isArray(state.messages)
      ? state.messages.filter((message) => message?.role === 'assistant').length
      : 0;

    elements.inputEl.value = 'test';
    const sendWait = waitFor(() => {
      const assistantMessages = Array.isArray(state.messages)
        ? state.messages.filter((message) => message?.role === 'assistant')
        : [];
      const received = assistantMessages.some((message) => message?.content?.includes(SMOKE_ANSWER));
      return received && !state.streaming && !state.sending;
    });
    elements.sendBtn.click();
    const sendOk = await sendWait;
    const newAssistantCount = Array.isArray(state.messages)
      ? state.messages.filter((message) => message?.role === 'assistant').length
      : 0;
    logStep('Bericht versturen', sendOk, sendOk ? 'antwoord ontvangen' : 'timeout');

    const responseOk = sendOk && newAssistantCount > previousAssistantCount;
    logStep('Respons controleren', responseOk, responseOk ? SMOKE_ANSWER : 'geen antwoord');

    persistHistorySnapshot(state);
    let historyOk = false;
    try{
      const raw = localStorage.getItem(CHAT_HISTORY_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        historyOk = Array.isArray(parsed) && parsed.some((item) => item?.id === state.chatId);
      }
    }catch{
      historyOk = false;
    }
    logStep('Geschiedenis opslaan', historyOk, historyOk ? 'snapshot bewaard' : 'geen entry');

    const durationMs = Date.now() - start;
    return {
      ok: historyOk && responseOk && sendOk && uploadOk && pingOk,
      stats: fetchMock.stats,
      durationMs
    };
  }catch(err){
    logStep('Smoke test', false, err?.message || 'onbekende fout');
    return { ok: false, error: err };
  }finally{
    fetchMock.restore();
    if(originalFetch){
      window.fetch = originalFetch;
    }
    const duration = Date.now() - start;
    logStep('Totale duur', true, `${duration}ms`);
  }
}
