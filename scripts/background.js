import initAtomField from './atom-field.js';

const overlay = document.querySelector('.app__overlay');
const logo = document.querySelector('.app__logo');

initAtomField({
  canvas: '#atom-field',
  overlay,
  logo,
  activationClass: 'is-visible'
});
