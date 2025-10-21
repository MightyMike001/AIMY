export function runTests({ state, fmtBytes, send, resetChat, appendStreamChunk, addMessage, messagesEl, testBadge }){
  const tests = [];
  const assert = (name, condition) => tests.push({ name, ok: !!condition });

  try{
    assert('fmtBytes(1024) → 1.0 KB', fmtBytes(1024).startsWith('1.0 K'));
  }catch{
    assert('fmtBytes', false);
  }

  try{
    assert('send() bestaat', typeof send === 'function');
  }catch{
    assert('send()', false);
  }

  try{
    assert('resetChat() bestaat', typeof resetChat === 'function');
  }catch{
    assert('resetChat()', false);
  }

  try{
    const fakeState = { messages: [{ role: 'assistant', content: '' }] };
    const container = document.createElement('div');
    container.className = 'messages';
    const bubble = document.createElement('div');
    bubble.className = 'bubble assistant';
    bubble.innerHTML = '<div class="role"></div><div class="content"></div>';
    container.appendChild(bubble);
    appendStreamChunk(fakeState, container, 'X');
    const ok = fakeState.messages[0].content.endsWith('X') && bubble.querySelector('.content').textContent.endsWith('X');
    assert('appendStreamChunk werkt', ok);
  }catch{
    assert('appendStreamChunk', false);
  }

  try{
    const history = state.messages.slice(-12);
    assert('history max 12', history.length <= 12);
  }catch{
    assert('history cap', false);
  }

  const okCount = tests.filter(t => t.ok).length;
  if(testBadge){
    testBadge.textContent = `Tests: ${okCount}/${tests.length}`;
  }
  console.table(tests);
}
