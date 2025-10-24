const cryptoGlobal = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null;

function fallbackId(prefix){
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

export function safeRandomId(prefix = 'id'){
  if(cryptoGlobal && typeof cryptoGlobal.randomUUID === 'function'){
    try{
      return cryptoGlobal.randomUUID();
    }catch{
      // ignore and fall back
    }
  }
  return fallbackId(prefix);
}
