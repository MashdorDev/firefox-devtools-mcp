/**
 * Unit tests for the --show-cursor overlay in DomInteractions
 */

import { describe, it, expect, vi } from 'vitest';
import type { BrowsingContext, Script } from 'webdriver-bidi-protocol';
import { DomInteractions } from '../../src/firefox/dom.js';
import type { BiDiFacade } from '../../src/firefox/bidi.js';
import {
  OVERLAY_PRELOAD_FN,
  REMOVE_OVERLAY_FN,
  SET_CURSOR_VISIBILITY_FN,
  SHOW_CURSOR_FN,
} from '../../src/firefox/cursor.js';

const CONTEXT = 'context-1' as BrowsingContext.BrowsingContext;
const ELEMENT = { sharedId: 'el-1' } as Script.SharedReference;

function createBidi() {
  const sendCommand = vi.fn(async (method: string) => {
    if (method === 'browsingContext.captureScreenshot') {
      return { data: 'png-data' };
    }
    if (method === 'script.addPreloadScript') {
      return { script: 'preload-1' };
    }
    if (method === 'browsingContext.getTree') {
      return { contexts: [{ context: 'tab-1' }, { context: 'tab-2' }] };
    }
    return {};
  });
  const callFunction = vi.fn(async (_context: unknown, fn: string, _args: Script.LocalValue[]) => {
    if (fn.includes('getBoundingClientRect') && !fn.includes('HOST_ID')) {
      return { x: 100, y: 50 };
    }
    return true;
  });
  const bidi = { sendCommand, callFunction } as unknown as BiDiFacade;
  return { bidi, sendCommand, callFunction };
}

function cursorArgs(callFunction: ReturnType<typeof createBidi>['callFunction']) {
  return callFunction.mock.calls
    .filter(([, fn]) => fn === SHOW_CURSOR_FN)
    .map(([, , args]) => args.map((v) => (v as { value: unknown }).value));
}

describe('DomInteractions cursor overlay', () => {
  it('should not draw the cursor by default', async () => {
    const { bidi, callFunction } = createBidi();
    const dom = new DomInteractions(bidi, async () => ELEMENT);

    await dom.clickByUid(CONTEXT, 'uid-1');

    expect(cursorArgs(callFunction)).toHaveLength(0);
  });

  it('should animate the cursor from its last position before clicking', async () => {
    const { bidi, sendCommand, callFunction } = createBidi();
    const dom = new DomInteractions(bidi, async () => ELEMENT, { showCursor: true });

    await dom.clickByUid(CONTEXT, 'uid-1');
    await dom.hoverByUid(CONTEXT, 'uid-1');

    expect(cursorArgs(callFunction)).toEqual([
      [100, 50, 100, 50, true, 400],
      [100, 50, 100, 50, false, 400],
    ]);

    const cursorOrder = Math.min(
      ...callFunction.mock.calls
        .map(([, fn], i) =>
          fn === SHOW_CURSOR_FN ? callFunction.mock.invocationCallOrder[i] : Infinity
        )
        .filter((n): n is number => n !== undefined)
    );
    expect(cursorOrder).toBeLessThan(Math.min(...sendCommand.mock.invocationCallOrder));
  });

  it('should still click when drawing the cursor fails', async () => {
    const { bidi, sendCommand, callFunction } = createBidi();
    callFunction.mockImplementation(async (_context: unknown, fn: string) => {
      if (fn === SHOW_CURSOR_FN) {
        throw new Error('CSP');
      }
      return { x: 1, y: 1 };
    });
    const dom = new DomInteractions(bidi, async () => ELEMENT, { showCursor: true });

    await dom.clickByUid(CONTEXT, 'uid-1');

    expect(sendCommand).toHaveBeenCalledWith('input.performActions', expect.anything());
  });

  it('should hide the cursor while taking a screenshot', async () => {
    const { bidi, sendCommand, callFunction } = createBidi();
    const dom = new DomInteractions(bidi, async () => ELEMENT, { showCursor: true });

    expect(await dom.takeScreenshotPage(CONTEXT)).toBe('png-data');

    const visibility = callFunction.mock.calls
      .filter(([, fn]) => fn === SET_CURSOR_VISIBILITY_FN)
      .map(([, , args]) => (args[0] as { value: unknown }).value);
    expect(visibility).toEqual([false, true]);
    const [hideOrder = 0, showOrder = 0] = callFunction.mock.invocationCallOrder;
    const [captureOrder = 0] = sendCommand.mock.invocationCallOrder;
    expect(hideOrder).toBeLessThan(captureOrder);
    expect(showOrder).toBeGreaterThan(captureOrder);
  });

  it('should register the overlay for new documents and draw it in open tabs', async () => {
    const { bidi, sendCommand, callFunction } = createBidi();
    const dom = new DomInteractions(bidi, async () => ELEMENT, { showCursor: true });

    await dom.installOverlay();
    await dom.installOverlay();

    const preloads = sendCommand.mock.calls.filter(([m]) => m === 'script.addPreloadScript');
    expect(preloads).toHaveLength(1);
    expect(sendCommand).toHaveBeenCalledWith('script.addPreloadScript', {
      functionDeclaration: OVERLAY_PRELOAD_FN,
      sandbox: expect.any(String),
    });
    expect(callFunction.mock.calls.map(([ctx]) => ctx)).toEqual(['tab-1', 'tab-2']);
  });

  it('should remove the preload script and the overlay from open tabs', async () => {
    const { bidi, sendCommand, callFunction } = createBidi();
    const dom = new DomInteractions(bidi, async () => ELEMENT, { showCursor: true });

    await dom.installOverlay();
    callFunction.mockClear();
    await dom.removeOverlay();

    expect(sendCommand).toHaveBeenCalledWith('script.removePreloadScript', {
      script: 'preload-1',
    });
    expect(callFunction.mock.calls.filter(([, fn]) => fn === REMOVE_OVERLAY_FN)).toHaveLength(2);
  });

  it('should not touch the page when showCursor is off', async () => {
    const { bidi, sendCommand, callFunction } = createBidi();
    const dom = new DomInteractions(bidi, async () => ELEMENT);

    await dom.installOverlay();
    await dom.removeOverlay();

    expect(sendCommand).not.toHaveBeenCalled();
    expect(callFunction).not.toHaveBeenCalled();
  });
});
