/**
 * Visible cursor overlay drawn in the page while the agent drives pointer input.
 * Enabled with --show-cursor; purely visual, never intercepts events.
 */

export const CURSOR_HOST_ID = '__firefox_devtools_mcp_cursor__';

export const CURSOR_MOVE_MS = 400;

/**
 * Animates the overlay cursor from (fromX, fromY) to (x, y), then plays a
 * press ripple when press is true. Resolves once the move has finished.
 */
export const SHOW_CURSOR_FN = `
async (fromX, fromY, x, y, press, moveMs) => {
  const HOST_ID = ${JSON.stringify(CURSOR_HOST_ID)};
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:strict;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = \`
      <style>
        .glow { position:fixed; inset:0; box-shadow: inset 0 0 0 2px rgba(217,119,87,.9), inset 0 0 18px rgba(217,119,87,.55); opacity:0; transition: opacity .3s; }
        .glow.on { opacity:1; }
        .cursor { position:fixed; left:0; top:0; width:22px; height:22px; will-change:transform; filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
        .ripple { position:fixed; width:28px; height:28px; margin:-14px 0 0 -14px; border-radius:50%; border:2px solid rgb(217,119,87); animation: ripple .45s ease-out forwards; }
        @keyframes ripple { from { transform:scale(.3); opacity:1; } to { transform:scale(1.4); opacity:0; } }
      </style>
      <div class="glow"></div>
      <svg class="cursor" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 1.5 L2 18 L6.6 13.9 L9.6 20.5 L12.5 19.2 L9.6 12.7 L15.8 12.7 Z" fill="rgb(217,119,87)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>\`;
    document.documentElement.appendChild(host);
  }
  host.style.visibility = 'visible';
  const root = host.shadowRoot;
  const cursor = root.querySelector('.cursor');
  const glow = root.querySelector('.glow');

  glow.classList.add('on');
  clearTimeout(host.__glowTimer);
  host.__glowTimer = setTimeout(() => glow.classList.remove('on'), 2000);

  cursor.style.transition = 'none';
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
