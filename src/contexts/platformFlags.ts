const _hostname = window.location.hostname;
const _SEGUWALLET = ['seguwallet.mx', 'www.seguwallet.mx', 'app.seguwallet.mx'];
const _CHAVA = ['agentedeseguros.ai', 'www.agentedeseguros.ai'];
export const isMoviPlatform = !_SEGUWALLET.includes(_hostname) && !_CHAVA.includes(_hostname);
