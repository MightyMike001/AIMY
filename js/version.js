const VERSION_ENDPOINT = 'version.json';
const FALLBACK_VERSION = 'onbekend';

const versionLabel = document.querySelector('[data-app-version]');
const refreshLink = document.querySelector('[data-refresh-nocache]');

async function loadVersion() {
  if (!versionLabel) return;

  try {
    const response = await fetch(VERSION_ENDPOINT, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Versie ophalen mislukt: ${response.status}`);
    }

    const payload = await response.json();

    if (payload && typeof payload.version === 'string' && payload.version.trim().length > 0) {
      versionLabel.textContent = `Versie: ${payload.version}`;
      return;
    }
  } catch (error) {
    console.warn('Kan versie niet laden', error);
  }

  versionLabel.textContent = `Versie: ${FALLBACK_VERSION}`;
}

function setupRefreshLink() {
  if (!refreshLink) return;

  refreshLink.addEventListener('click', (event) => {
    event.preventDefault();

    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set('nocache', Date.now().toString());

    window.location.assign(targetUrl.toString());
  });
}

loadVersion();
setupRefreshLink();
