const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function readRuntimeConfig(){
  try{
    if(window.__AIMY_RUNTIME_CONFIG__ && typeof window.__AIMY_RUNTIME_CONFIG__ === 'object'){
      return window.__AIMY_RUNTIME_CONFIG__;
    }
  }catch{
    /* window niet beschikbaar */
  }

  const script = document.getElementById('aimy-runtime-config');
  if(!script){
    const meta = document.querySelector('meta[name="aimy-runtime-config"]');
    if(meta){
      try{
        const content = meta.getAttribute('content') || '';
        if(content.trim()){
          const data = JSON.parse(content);
          if(data && typeof data === 'object'){
            return data;
          }
        }
      }catch{
        /* invalide meta */
      }
    }
    return null;
  }

  try{
    const text = script.textContent || script.innerText || '';
    if(!text.trim()){
      return null;
    }
    const data = JSON.parse(text);
    if(data && typeof data === 'object'){
      return data;
    }
  }catch{
    /* ongeldige JSON – negeren */
  }

  return null;
}

export function normalizeWebhookUrl(value){
  if(typeof value !== 'string'){
    return '';
  }
  const trimmed = value.trim();
  if(!trimmed){
    return '';
  }

  if(trimmed.startsWith('/')){
    return trimmed;
  }

  try{
    const base = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://example.com';
    const url = new URL(trimmed, base);
    if(url.protocol === 'https:' || (url.protocol === 'http:' && LOCALHOST_HOSTS.has(url.hostname))){
      return url.toString();
    }
  }catch{
    /* ongeldige URL */
  }

  return '';
}

export function sanitizeHeaderName(value){
  if(typeof value !== 'string'){
    return 'X-AIMY-Token';
  }
  const upper = value.trim().toUpperCase();
  if(!upper){
    return 'X-AIMY-Token';
  }
  const cleaned = upper.replace(/[^A-Z0-9-]/g, '');
  return cleaned || 'X-AIMY-Token';
}

export function sanitizeHeaderValue(value){
  if(typeof value !== 'string'){
    return '';
  }
  return value.replace(/[\r\n]/g, '').trim();
}

export function safeStringify(value){
  try{
    return JSON.stringify(value);
  }catch(err){
    console.warn('safeStringify: kon waarde niet serialiseren', err);
    return null;
  }
}
