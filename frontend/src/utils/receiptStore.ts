import type { Receipt } from '../api/types';

const RECEIPTS_KEY = 'bt032_owner_receipts_v1';

export function getStoredReceipts(): Record<string, Receipt> {
  try {
    const data = localStorage.getItem(RECEIPTS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error('Failed to parse owner receipts from localStorage', err);
    return {};
  }
}

export function saveReceipt(receipt: Receipt): void {
  try {
    const receipts = getStoredReceipts();
    receipts[receipt.file_id] = receipt;
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
  } catch (err) {
    console.error('Failed to save owner receipt to localStorage', err);
  }
}

export function getReceiptForFile(file_id: string): Receipt | undefined {
  const receipts = getStoredReceipts();
  return receipts[file_id];
}

export function removeReceiptForFile(file_id: string): void {
  try {
    const receipts = getStoredReceipts();
    delete receipts[file_id];
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
  } catch (err) {
    console.error('Failed to remove receipt from localStorage', err);
  }
}

export function clearAllReceipts(): void {
  try {
    localStorage.removeItem(RECEIPTS_KEY);
  } catch (err) {
    console.error('Failed to clear receipts', err);
  }
}
