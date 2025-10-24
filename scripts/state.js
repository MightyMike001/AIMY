import { GREETING } from './constants.js';
import { safeRandomId } from './utils/random.js';

export const state = {
  docs: [],
  messages: [
    { role: 'assistant', content: GREETING }
  ],
  chatId: safeRandomId('chat'),
  streaming: false,
  prechat: {
    serialNumber: '',
    hours: '',
    faultCodes: '',
    ready: false,
    completed: false,
    valid: false,
    summaryMessageIndex: null
  }
};

export function resetConversation(){
  state.chatId = safeRandomId('chat');
  state.messages = [
    { role: 'assistant', content: GREETING }
  ];
}
