/**
 * Unit tests for DomInteractions.uploadFileByUid
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowsingContext, Script } from 'webdriver-bidi-protocol';
import { DomInteractions } from '../../src/firefox/dom.js';
import type { BiDiFacade } from '../../src/firefox/bidi.js';

const CONTEXT = 'context-1' as BrowsingContext.BrowsingContext;
const TARGET = { sharedId: 'target' } as Script.SharedReference;

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'upload-file-test-'));
  mkdirSync(join(root, 'folder', 'sub'), { recursive: true });
  writeFileSync(join(root, 'folder', 'b.txt'), 'b');
  writeFileSync(join(root, 'folder', 'sub', 'a.txt'), 'a');
  writeFileSync(join(root, 'single.txt'), 'single');
  mkdirSync(join(root, 'empty'));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function createBidi(attached: string[] = []) {
  const sendCommand = vi.fn(async () => ({}));
  const callFunction = vi.fn(async (_context: unknown, fn: string) =>
    fn.includes('relativePaths') ? attached : true
  );
  const callFunctionRaw = vi.fn(async () => ({ type: 'node', sharedId: 'helper' }));
  const bidi = { sendCommand, callFunction, callFunctionRaw } as unknown as BiDiFacade;
  return { bidi, sendCommand, callFunction, callFunctionRaw };
}

describe('DomInteractions.uploadFileByUid', () => {
  it('should set a single file on the input', async () => {
    const { bidi, sendCommand, callFunctionRaw } = createBidi();
    const dom = new DomInteractions(bidi, async () => TARGET);

    await dom.uploadFileByUid(CONTEXT, 'uid-1', join(root, 'single.txt'));

    expect(sendCommand).toHaveBeenCalledWith('input.setFiles', {
      context: CONTEXT,
      element: TARGET,
      files: [join(root, 'single.txt')],
    });
    expect(callFunctionRaw).not.toHaveBeenCalled();
  });

  it('should set every file of a folder on a helper input with relative paths', async () => {
    const { bidi, sendCommand } = createBidi(['folder/b.txt', 'folder/sub/a.txt']);
    const dom = new DomInteractions(bidi, async () => TARGET);

    await dom.uploadFileByUid(CONTEXT, 'uid-1', join(root, 'folder'));

    expect(sendCommand).toHaveBeenCalledWith('input.setFiles', {
      context: CONTEXT,
      element: { sharedId: 'helper' },
      files: [join(root, 'folder', 'b.txt'), join(root, 'folder', 'sub', 'a.txt')],
    });
  });

  it('should fail when the page loses the folder structure', async () => {
    const { bidi } = createBidi(['', '']);
    const dom = new DomInteractions(bidi, async () => TARGET);

    await expect(dom.uploadFileByUid(CONTEXT, 'uid-1', join(root, 'folder'))).rejects.toThrow(
      'folder structure'
    );
  });

  it('should reject an empty folder', async () => {
    const { bidi, sendCommand } = createBidi();
    const dom = new DomInteractions(bidi, async () => TARGET);

    await expect(dom.uploadFileByUid(CONTEXT, 'uid-1', join(root, 'empty'))).rejects.toThrow(
      'contains no files'
    );
    expect(sendCommand).not.toHaveBeenCalled();
  });
});
