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
    webhookStatus: $('#webhookStatus'),
    authInput: $('#authToken'),
    settingsBtn: $('#settingsBtn'),
    settingsModal: $('#settingsModal'),
    closeSettingsBtn: $('#closeSettings'),
    drop: $('#drop'),
    fileInput: $('#file'),
    tempInput: $('#temp'),
    citationsCheckbox: $('#citations'),
    bannerInfo: $('#banner-info'),
    bannerSerial: $('#bannerSerial'),
    bannerHours: $('#bannerHours'),
    bannerFaults: $('#bannerFaults')
  };
}
