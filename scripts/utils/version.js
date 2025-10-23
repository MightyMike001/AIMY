import { APP_VERSION, APP_VERSION_KEY, CHAT_HISTORY_KEY, CHAT_KEY, PRECHAT_KEY } from '../constants.js';

const LOCAL_STORAGE_KEYS_TO_RESET = [CHAT_KEY, CHAT_HISTORY_KEY];

export function ensureFreshVersion(){
  if(typeof window === 'undefined'){
    return { updated: false, currentVersion: APP_VERSION, previousVersion: null };
  }

  let previousVersion = null;
  let updated = false;

  try{
    const storage = window.localStorage;
    previousVersion = storage.getItem(APP_VERSION_KEY);

    if(previousVersion !== APP_VERSION){
      LOCAL_STORAGE_KEYS_TO_RESET.forEach((key) => {
        try{
          storage.removeItem(key);
        }catch{
          /* ignore */
        }
      });

      try{
        window.sessionStorage?.removeItem(PRECHAT_KEY);
      }catch{
        /* ignore */
      }

      storage.setItem(APP_VERSION_KEY, APP_VERSION);
      updated = true;
    }
  }catch(err){
    console.warn('version: unable to synchronize app version', err);
  }

  return { updated, currentVersion: APP_VERSION, previousVersion };
}
