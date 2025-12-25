/**
 * TerminalStore - MobX store for virtual terminal state
 * 
 * Manages:
 * - Screen buffer (40x20 characters)
 * - Screen updates (flush to BLE)
 * - FPS tracking
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { bleService } from '../services';
import { deviceStore } from './DeviceStore';

// Default terminal size (matches firmware: 32x18 for 390x450 screen with Terminus 24 font)
const DEFAULT_COLS = 32;
const DEFAULT_ROWS = 18;

class TerminalStore {
  // Screen dimensions
  cols: number = DEFAULT_COLS;
  rows: number = DEFAULT_ROWS;
  
  // Screen buffer (ASCII codes)
  buffer: Uint8Array;
  
  // Version counter for reactivity (incremented when buffer changes)
  bufferVersion: number = 0;
  
  // Performance tracking
  lastUpdateTime: number = 0;
  fps: number = 0;
  frameCount: number = 0;
  
  // Update tracking
  isDirty: boolean = false;
  isSending: boolean = false;

  constructor() {
    this.buffer = new Uint8Array(this.cols * this.rows).fill(0x20); // Fill with spaces
    makeAutoObservable(this, {
      buffer: false, // Don't make buffer observable (too large, manual updates)
    });
  }

  // ==========================================================================
  // Computed
  // ==========================================================================

  get screenSize(): number {
    return this.cols * this.rows;
  }

  get bufferAsString(): string {
    // Access bufferVersion to make this reactive
    const _version = this.bufferVersion;
    
    const lines: string[] = [];
    for (let row = 0; row < this.rows; row++) {
      const start = row * this.cols;
      const end = start + this.cols;
      const line = String.fromCharCode(...this.buffer.subarray(start, end));
      lines.push(line);
    }
    return lines.join('\n');
  }
  
  /**
   * Notify observers that buffer has changed
   */
  private notifyBufferChanged(): void {
    runInAction(() => {
      this.bufferVersion++;
    });
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Set screen dimensions
   */
  setSize(cols: number, rows: number): void {
    if (cols === this.cols && rows === this.rows) return;
    
    runInAction(() => {
      this.cols = cols;
      this.rows = rows;
      this.buffer = new Uint8Array(cols * rows).fill(0x20);
      this.isDirty = true;
    });
  }

  /**
   * Clear the screen
   */
  clear(): void {
    this.buffer.fill(0x20);
    this.isDirty = true;
    this.notifyBufferChanged();
  }

  /**
   * Set a character at position
   */
  setChar(col: number, row: number, char: number | string): void {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    
    const index = row * this.cols + col;
    const charCode = typeof char === 'string' ? char.charCodeAt(0) : char;
    this.buffer[index] = charCode;
    this.isDirty = true;
    // Note: we don't notify here for performance - notify after batch updates
  }

  /**
   * Write text at position
   */
  writeText(col: number, row: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
      const x = col + i;
      if (x >= this.cols) break;
      this.setChar(x, row, text.charCodeAt(i));
    }
  }

  /**
   * Fill the entire buffer with new data
   */
  setBuffer(data: Uint8Array | string): void {
    if (typeof data === 'string') {
      // Convert string to buffer, padding with spaces
      const bytes = new TextEncoder().encode(data);
      this.buffer.fill(0x20);
      this.buffer.set(bytes.subarray(0, this.screenSize));
    } else {
      // Copy raw buffer
      this.buffer.set(data.subarray(0, this.screenSize));
    }
    this.isDirty = true;
    this.notifyBufferChanged();
  }

  /**
   * Flush buffer to device
   */
  async flush(): Promise<void> {
    if (!deviceStore.isConnected) {
      console.warn('[TerminalStore] Cannot flush: not connected');
      return;
    }

    if (this.isSending) {
      // Skip this frame if still sending previous
      return;
    }

    runInAction(() => {
      this.isSending = true;
    });

    try {
      await bleService.sendTerminalScreen(this.cols, this.rows, this.buffer);
      
      // Update FPS tracking
      const now = Date.now();
      this.frameCount++;
      
      if (now - this.lastUpdateTime >= 1000) {
        runInAction(() => {
          this.fps = this.frameCount;
          this.frameCount = 0;
          this.lastUpdateTime = now;
        });
      }
      
      this.isDirty = false;
    } catch (err) {
      console.error('[TerminalStore] Flush error:', err);
    } finally {
      runInAction(() => {
        this.isSending = false;
      });
    }
  }

  /**
   * Send clear screen command to device
   */
  async clearDevice(): Promise<void> {
    if (!deviceStore.isConnected) return;
    
    await bleService.sendTerminalClear();
    this.clear();
  }

  // ==========================================================================
  // Demo Patterns
  // ==========================================================================

  /**
   * Fill with test pattern
   */
  fillTestPattern(): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        // Alternating pattern
        const char = ((col + row) % 2 === 0) ? '#' : '.';
        this.setChar(col, row, char);
      }
    }
    this.notifyBufferChanged();
  }

  /**
   * Draw a box
   */
  drawBox(x: number, y: number, width: number, height: number, title?: string): void {
    // Corners
    this.setChar(x, y, '+');
    this.setChar(x + width - 1, y, '+');
    this.setChar(x, y + height - 1, '+');
    this.setChar(x + width - 1, y + height - 1, '+');
    
    // Horizontal lines
    for (let i = 1; i < width - 1; i++) {
      this.setChar(x + i, y, '-');
      this.setChar(x + i, y + height - 1, '-');
    }
    
    // Vertical lines
    for (let i = 1; i < height - 1; i++) {
      this.setChar(x, y + i, '|');
      this.setChar(x + width - 1, y + i, '|');
    }
    
    // Title
    if (title) {
      const titleX = x + Math.floor((width - title.length) / 2);
      this.writeText(titleX, y, title);
    }
    
    this.notifyBufferChanged();
  }
}

// Export singleton
export const terminalStore = new TerminalStore();

