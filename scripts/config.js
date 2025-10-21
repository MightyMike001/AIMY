import { CONFIG_KEY, DEFAULT_CONFIG } from './constants.js';

export function loadConfig(){
  const config = { ...DEFAULT_CONFIG };
  try{
    const raw = localStorage.getItem(CONFIG_KEY);
    if(raw){
      const stored = JSON.parse(raw);
      if(stored && typeof stored === 'object'){
        if(typeof stored.N8N_WEBHOOK === 'string' && stored.N8N_WEBHOOK.trim()){
          config.N8N_WEBHOOK = stored.N8N_WEBHOOK.trim();
        }
        if(typeof stored.AUTH_HEADER === 'string' && stored.AUTH_HEADER.trim()){
          config.AUTH_HEADER = stored.AUTH_HEADER.trim();
        }
        if(typeof stored.AUTH_VALUE === 'string'){
          config.AUTH_VALUE = stored.AUTH_VALUE;
        }
      }
    }
  }catch{
    /* localStorage mogelijk niet beschikbaar */
  }
  return config;
}

export function persistConfig(config){
  try{
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      N8N_WEBHOOK: config.N8N_WEBHOOK,
      AUTH_HEADER: config.AUTH_HEADER,
      AUTH_VALUE: config.AUTH_VALUE
    }));
  }catch{
    /* ignore */
  }
}
