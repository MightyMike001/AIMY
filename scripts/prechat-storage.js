const STORAGE_KEY = 'aimy.prechat';

export function loadPrechat(){
  try{
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if(!raw){
      return null;
    }
    const data = JSON.parse(raw);
    if(!data || typeof data !== 'object'){
      return null;
    }
    return {
      serialNumber: typeof data.serialNumber === 'string' ? data.serialNumber : '',
      hours: typeof data.hours === 'string' ? data.hours : '',
      faultCodes: typeof data.faultCodes === 'string' ? data.faultCodes : ''
    };
  }catch{
    return null;
  }
}

export function savePrechat(prechat){
  try{
    const payload = {
      serialNumber: prechat.serialNumber || '',
      hours: prechat.hours || '',
      faultCodes: prechat.faultCodes || ''
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }catch{
    /* ignore */
  }
}

export function clearPrechat(){
  try{
    sessionStorage.removeItem(STORAGE_KEY);
  }catch{
    /* ignore */
  }
}
