const THEME_KEY = 'aimy-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

function getStoredTheme(){
  try{
    const stored = localStorage.getItem(THEME_KEY);
    if(stored === THEMES.DARK || stored === THEMES.LIGHT){
      return stored;
    }
  }catch{
    /* ignore */
  }
  return null;
}

function storeTheme(theme){
  try{
    localStorage.setItem(THEME_KEY, theme);
  }catch{
    /* ignore */
  }
}

function prefersDark(){
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateToggleLabel(btn, theme){
  if(!btn){
    return;
  }
  const nextTheme = theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  const icon = nextTheme === THEMES.LIGHT ? '🌙' : '🌑';
  const label = nextTheme === THEMES.LIGHT ? 'Licht thema' : 'Donker thema';
  btn.textContent = `${icon} ${label}`;
  btn.setAttribute('aria-label', `Schakel naar ${label.toLowerCase()}`);
  btn.setAttribute('data-next-theme', nextTheme);
  btn.setAttribute('aria-pressed', theme === THEMES.DARK ? 'true' : 'false');
}

function applyTheme(theme){
  document.body?.setAttribute('data-theme', theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT);
}

export function initThemeToggle({ toggleBtn }){
  const stored = getStoredTheme();
  let manualOverride = Boolean(stored);
  let currentTheme = stored || (prefersDark() ? THEMES.DARK : THEMES.LIGHT);

  applyTheme(currentTheme);
  updateToggleLabel(toggleBtn, currentTheme);

  if(toggleBtn){
    toggleBtn.addEventListener('click', () => {
      currentTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
      manualOverride = true;
      applyTheme(currentTheme);
      updateToggleLabel(toggleBtn, currentTheme);
      storeTheme(currentTheme);
    });
  }

  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if(media){
    const listener = (event) => {
      if(manualOverride){
        return;
      }
      currentTheme = event.matches ? THEMES.DARK : THEMES.LIGHT;
      applyTheme(currentTheme);
      updateToggleLabel(toggleBtn, currentTheme);
    };
    if(typeof media.addEventListener === 'function'){
      media.addEventListener('change', listener);
    }else if(typeof media.addListener === 'function'){
      media.addListener(listener);
    }
  }
}
