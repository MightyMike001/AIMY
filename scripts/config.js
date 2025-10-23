import { CONFIG_KEY, DEFAULT_CONFIG } from './constants.js';
import { normalizeWebhookUrl, readRuntimeConfig, sanitizeHeaderName, sanitizeHeaderValue, safeStringify } from './utils/security.js';

function applyConfig(base, source){
  if(!source || typeof source !== 'object'){
    return;
  }
  if(typeof source.N8N_WEBHOOK === 'string'){
    base.N8N_WEBHOOK = normalizeWebhookUrl(source.N8N_WEBHOOK);
  }
  if(typeof source.AUTH_HEADER === 'string'){
    base.AUTH_HEADER = sanitizeHeaderName(source.AUTH_HEADER);
  }
  if(typeof source.AUTH_VALUE === 'string'){
    base.AUTH_VALUE = sanitizeHeaderValue(source.AUTH_VALUE);
  }
}

export function loadConfig(){
  const config = { ...DEFAULT_CONFIG };

  const runtimeConfig = readRuntimeConfig();
  applyConfig(config, runtimeConfig);

  try{
    const raw = localStorage.getItem(CONFIG_KEY);
    if(raw){
      const stored = JSON.parse(raw);
      applyConfig(config, stored);
    }
  }catch{
    /* localStorage mogelijk niet beschikbaar */
  }
  return config;
}

export function persistConfig(config){
  try{
    const snapshot = {
      N8N_WEBHOOK: normalizeWebhookUrl(config.N8N_WEBHOOK),
      AUTH_HEADER: sanitizeHeaderName(config.AUTH_HEADER),
      AUTH_VALUE: sanitizeHeaderValue(config.AUTH_VALUE)
    };
    config.N8N_WEBHOOK = snapshot.N8N_WEBHOOK;
    config.AUTH_HEADER = snapshot.AUTH_HEADER;
    config.AUTH_VALUE = snapshot.AUTH_VALUE;
    localStorage.setItem(CONFIG_KEY, safeStringify(snapshot));
  }catch{
    /* ignore */
  }
}
