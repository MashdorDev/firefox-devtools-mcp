/**
 * Integration tests for the --show-cursor overlay
 * Tests with real Firefox browser in headless mode
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestFirefox,
  closeFirefox,
  waitForElementInSnapshot,
  waitForPageLoad,
  fixtureUrl,
} from '../helpers/firefox.js';
import type { FirefoxClient } from '@/firefox/index.js';
import { CURSOR_HOST_ID } from '@/firefox/cursor.js';

describe('Show Cursor Integration Tests', () => {
  let firefox: FirefoxClient;

  beforeAll(async () => {
    firefox = await createTestFirefox({ showCursor: true });
  });

  afterAll(async () => {
    await closeFirefox(firefox);
  });

  it('should move the overlay cursor to the clicked element without blocking the click', async () => {
    await firefox.navigate(fixtureUrl('form.html'));
    await waitForPageLoad();
    await firefox.evaluate(
      `document.getElementById('submitBtn').addEventListener('click', (e) => { e.preventDefault(); window.__clicked = true; })`
    );

    const submitBtn = await waitForElementInSnapshot(
      firefox,
      (node) => node.id === 'submitBtn',
      10000
    );
    await firefox.clickByUid(submitBtn.uid);

    const state = (await firefox.evaluate(`(() => {
      const host = document.getElementById(${JSON.stringify(CURSOR_HOST_ID)});
      const cursor = host.shadowRoot.querySelector('.cursor').getBoundingClientRect();
      const btn = document.getElementById('submitBtn').getBoundingClientRect();
      return {
        clicked: window.__clicked === true,
        visibility: host.style.visibility,
        dx: Math.abs(cursor.left - (btn.left + btn.right) / 2),
        dy: Math.abs(cursor.top - (btn.top + btn.bottom) / 2),
      };
    })()`)) as { clicked: boolean; visibility: string; dx: number; dy: number };

    expect(state.clicked).toBe(true);
    expect(state.visibility).toBe('visible');
    expect(state.dx).toBeLessThan(2);
    expect(state.dy).toBeLessThan(2);
  }, 20000);

  it('should restore the overlay after a screenshot', async () => {
    await firefox.takeScreenshotPage();

    const visibility = await firefox.evaluate(
      `document.getElementById(${JSON.stringify(CURSOR_HOST_ID)}).style.visibility`
    );
    expect(visibility).toBe('visible');
  }, 15000);
});
