import { GREETING } from './constants.js';

export const state = {
  docs: [],
  messages: [
    { role: 'assistant', content: GREETING }
  ],
  chatId: crypto.randomUUID(),
  streaming: false,
  prechat: {
    serialNumber: '',
    hours: '',
    faultCodes: '',
    ready: false
  }
};

export function resetConversation(){
  state.chatId = crypto.randomUUID();
  state.messages = [
    { role: 'assistant', content: GREETING }
  ];
}
