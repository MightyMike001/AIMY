import { GREETING } from './constants.js';
import { createSessionId } from '../js/session.js';

export const state = {
  docs: [],
  messages: [
    { role: 'assistant', content: GREETING }
  ],
  chatId: createSessionId(),
  sending: false,
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
  state.chatId = createSessionId(state.prechat?.serialNumber);
  state.messages = [
    { role: 'assistant', content: GREETING }
  ];
  state.sending = false;
  state.streaming = false;
}
