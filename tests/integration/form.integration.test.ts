/**
 * Integration tests for form interaction
 * Tests with real Firefox browser in headless mode
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestFirefox,
  closeFirefox,
  waitForElementInSnapshot,
  waitForPageLoad,
  fixtureUrl,
  fixturesPath,
} from '../helpers/firefox.js';
import { join } from 'node:path';
import type { FirefoxClient } from '@/firefox/index.js';

describe('Form Interaction Integration Tests', () => {
  let firefox: FirefoxClient;

  beforeAll(async () => {
    firefox = await createTestFirefox();
  });

  afterAll(async () => {
    await closeFirefox(firefox);
  });

  it('should hover over element by UID', async () => {
    const fixturePath = fixtureUrl('form.html');
    await firefox.navigate(fixturePath);

    // Wait for page to be fully loaded
    await waitForPageLoad();

    // Wait for submit button to appear in snapshot
    const submitBtn = await waitForElementInSnapshot(
      firefox,
      (node) => node.id === 'submitBtn',
      10000
    );

    expect(submitBtn).toBeDefined();

    // Hover should not throw
    await expect(firefox.hoverByUid(submitBtn.uid)).resolves.not.toThrow();
  }, 15000);

  it('should set the files of a file input without opening a dialog', async () => {
    await firefox.navigate(fixtureUrl('form.html'));
    await waitForPageLoad();
    await firefox.evaluate(
      `document.getElementById('file').addEventListener('change', (e) => { window.__changed = e.target.files[0]?.name; })`
    );

    const fileInput = await waitForElementInSnapshot(firefox, (node) => node.id === 'file', 10000);
    await firefox.uploadFileByUid(fileInput.uid, join(fixturesPath, 'simple.html'));

    expect(await firefox.evaluate(`document.getElementById('file').files[0]?.name`)).toBe(
      'simple.html'
    );
    expect(await firefox.evaluate('window.__changed')).toBe('simple.html');
  }, 15000);

  it('should reject a uid that is not a file input', async () => {
    await firefox.navigate(fixtureUrl('form.html'));
    await waitForPageLoad();

    const nameInput = await waitForElementInSnapshot(firefox, (node) => node.id === 'name', 10000);
    await expect(
      firefox.uploadFileByUid(nameInput.uid, join(fixturesPath, 'simple.html'))
    ).rejects.toThrow('<input type=file>');
  }, 15000);
});
