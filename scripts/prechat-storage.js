import { PRECHAT_KEY } from './constants.js';
import { createPrechatRecord } from '../js/prechat.js';

const STORAGE_KEY = PRECHAT_KEY;

export function loadPrechat(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
      return null;
    }
    const data = JSON.parse(raw);
    if(!data || typeof data !== 'object'){
      return null;
    }
    const record = createPrechatRecord(data);
    return record;
  }catch{
    return null;
  }
}

export function savePrechat(prechat){
  try{
    const record = createPrechatRecord(prechat);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return record;
  }catch{
    /* ignore */
  }
}

export function clearPrechat(){
  try{
    localStorage.removeItem(STORAGE_KEY);
  }catch{
    /* ignore */
  }
}
