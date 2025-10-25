const ALLOWED_TAGS = new Set(['B', 'I', 'CODE', 'PRE', 'A', 'UL', 'OL', 'LI']);
const URL_SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const TEXT_NODE = typeof Node !== 'undefined' ? Node.TEXT_NODE : 3;
const COMMENT_NODE = typeof Node !== 'undefined' ? Node.COMMENT_NODE : 8;
const ELEMENT_NODE = typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1;

function unwrapNode(node){
  const parent = node.parentNode;
  if(!parent){
    node.remove();
    return;
  }
  while(node.firstChild){
    parent.insertBefore(node.firstChild, node);
  }
  parent.removeChild(node);
}

function sanitizeAttributes(element){
  const tagName = element.tagName.toUpperCase();
  Array.from(element.attributes).forEach(attr => {
    const name = attr.name.toLowerCase();
    if(name.startsWith('on') || name === 'style'){
      element.removeAttribute(attr.name);
      return;
    }
    if(tagName !== 'A' || name !== 'href'){
      element.removeAttribute(attr.name);
      return;
    }
    const rawValue = attr.value.trim();
    if(!rawValue){
      element.removeAttribute(attr.name);
      return;
    }
    if(rawValue.startsWith('#') || rawValue.startsWith('/')){
      element.setAttribute('href', rawValue);
      return;
    }
    try{
      const base = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://example.com';
      const url = new URL(rawValue, base);
      if(!URL_SAFE_PROTOCOLS.has(url.protocol)){
        element.removeAttribute(attr.name);
        return;
      }
      element.setAttribute('href', url.href);
    }catch{
      element.removeAttribute(attr.name);
    }
  });
}

function sanitizeNode(node){
  if(node.nodeType === TEXT_NODE){
    return;
  }
  if(node.nodeType === COMMENT_NODE){
    node.remove();
    return;
  }
  if(node.nodeType === ELEMENT_NODE){
    const tagName = node.tagName.toUpperCase();
    if(tagName === 'SCRIPT' || tagName === 'IFRAME' || tagName === 'STYLE'){
      node.remove();
      return;
    }
    if(!ALLOWED_TAGS.has(tagName)){
      unwrapNode(node);
      return;
    }
    sanitizeAttributes(node);
    Array.from(node.childNodes).forEach(child => sanitizeNode(child));
  }else if(node.childNodes){
    Array.from(node.childNodes).forEach(child => sanitizeNode(child));
  }
}

export function sanitizeRichContent(input){
  if(typeof document === 'undefined'){
    return typeof input === 'string' ? input : '';
  }
  if(typeof input !== 'string' || !input){
    return '';
  }
  const template = document.createElement('template');
  template.innerHTML = input;
  Array.from(template.content.childNodes).forEach(child => sanitizeNode(child));
  return template.innerHTML;
}
