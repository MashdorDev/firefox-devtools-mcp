/**
 * Visible overlay shown in the page while the agent is connected: a glowing
 * border, a status label and a cursor that animates to each pointer action.
 * Enabled with --show-cursor; purely visual, never intercepts events.
 */

export const CURSOR_HOST_ID = '__firefox_devtools_mcp_cursor__';

export const CURSOR_MOVE_MS = 400;

export const CURSOR_LABEL = 'AI agent is controlling this browser';

const INSTALL_OVERLAY = `
function installOverlay() {
  const HOST_ID = ${JSON.stringify(CURSOR_HOST_ID)};
  let host = document.getElementById(HOST_ID);
  if (host) {
    return host;
  }
  host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:strict;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = \`
    <style>
      .glow { position:fixed; inset:0; box-shadow: inset 0 0 0 2px rgba(217,119,87,.9), inset 0 0 22px rgba(217,119,87,.5); }
      .label { position:fixed; left:50%; bottom:14px; transform:translateX(-50%); display:flex; align-items:center; gap:8px; padding:7px 14px; border-radius:999px; background:rgba(28,25,23,.92); color:#fff; font: 500 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,.3); white-space:nowrap; }
      .dot { width:8px; height:8px; border-radius:50%; background:rgb(217,119,87); }
      .cursor { position:fixed; left:0; top:0; width:22px; height:22px; opacity:0; will-change:transform; filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
      .ripple { position:fixed; width:28px; height:28px; margin:-14px 0 0 -14px; border-radius:50%; border:2px solid rgb(217,119,87); animation: ripple .45s ease-out forwards; }
      @keyframes ripple { from { transform:scale(.3); opacity:1; } to { transform:scale(1.4); opacity:0; } }
    </style>
    <div class="glow"></div>
    <div class="label"><span class="dot"></span>${CURSOR_LABEL}</div>
    <svg class="cursor" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 1.5 L2 18 L6.6 13.9 L9.6 20.5 L12.5 19.2 L9.6 12.7 L15.8 12.7 Z" fill="rgb(217,119,87)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>\`;
  document.documentElement.appendChild(host);
  return host;
}
`;

/**
 * Registered as a preload script so that every new document gets the overlay.
 */
export const OVERLAY_PRELOAD_FN = `
() => {
  ${INSTALL_OVERLAY}
  if (document.documentElement) {
    installOverlay();
    return;
  }
  const observer = new MutationObserver(() => {
    if (document.documentElement) {
      observer.disconnect();
      installOverlay();
    }
  });
  observer.observe(document, { childList: true });
}
`;

export const INSTALL_OVERLAY_FN = `
() => {
  ${INSTALL_OVERLAY}
  if (document.documentElement) {
    installOverlay();
  }
}
`;

export const REMOVE_OVERLAY_FN = `
() => {
  document.getElementById(${JSON.stringify(CURSOR_HOST_ID)})?.remove();
}
`;

/**
 * Animates the overlay cursor from (fromX, fromY) to (x, y), then plays a
 * press ripple when press is true. Resolves once the move has finished.
 */
export const SHOW_CURSOR_FN = `
async (fromX, fromY, x, y, press, moveMs) => {
  ${INSTALL_OVERLAY}
  const host = installOverlay();
  host.style.visibility = 'visible';
  const root = host.shadowRoot;
  const cursor = root.querySelector('.cursor');

  cursor.style.transition = 'none';
  cursor.style.opacity = '1';
  cursor.style.transform = 'translate(' + fromX + 'px,' + fromY + 'px)';
  cursor.getBoundingClientRect();
  cursor.style.transition = 'transform ' + moveMs + 'ms cubic-bezier(.3,.7,.4,1)';
  cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  await new Promise((r) => setTimeout(r, moveMs));

  if (press) {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    root.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }
}
`;

export const SET_CURSOR_VISIBILITY_FN = `
(visible) => {
  const host = document.getElementById(${JSON.stringify(CURSOR_HOST_ID)});
  if (host) {
    host.style.visibility = visible ? 'visible' : 'hidden';
  }
}
`;
