export const $ = (selector, el = document) => el.querySelector(selector);
export const $$ = (selector, el = document) => [...el.querySelectorAll(selector)];

export function getElements(){
  return {
    messagesEl: $('#messages'),
    inputEl: $('#input'),
    sendBtn: $('#send'),
    newChatBtn: $('#newChat'),
    docList: $('#docList'),
    ingestBadge: $('#ingestStatus'),
    testBadge: $('#testBadge'),
    webhookInput: $('#webhookUrl'),
    authInput: $('#authToken'),
    settingsBtn: $('#settingsBtn'),
    settingsModal: $('#settingsModal'),
    closeSettingsBtn: $('#closeSettings'),
    drop: $('#drop'),
    fileInput: $('#file'),
    tempInput: $('#temp'),
    citationsCheckbox: $('#citations'),
    summarySerial: $('#summarySerial'),
    summaryHours: $('#summaryHours'),
    summaryFaults: $('#summaryFaults'),
    editPrechatBtn: $('#editPrechat'),
    bannerInfo: $('#banner-info')
  };
}
