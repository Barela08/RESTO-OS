// ====================================================================
// RESTO OS - Cryptographic Daily QR Code Service
// ====================================================================

import QRCode from 'qrcode';

export interface QRVerificationResult {
  valid: boolean;
  errorCode?: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'REVOKED_TOKEN';
  message: string;
  tableId?: string;
  tableNumber?: string;
  isRepeatScan?: boolean;
  existingSessionToken?: string;
  repeatRequestId?: string;
}

export class QRService {
  /**
   * Generates a 256-bit cryptographic daily hash token for a table
   */
  public static async generateDailyTokenHash(restaurantId: string, tableId: string, dateStr: string): Promise<string> {
    const raw = `${restaurantId}:${tableId}:${dateStr}:${crypto.randomUUID()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates a high-resolution QR Code Data URL for print or display
   */
  public static async generateQRCodeDataUrl(contentUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(contentUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0B1220',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
    } catch (err) {
      console.error('Error generating QR code:', err);
      return '';
    }
  }

  /**
   * Calculates remaining validity until midnight restaurant-local time
   */
  public static getTimeUntilMidnight(): string {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(23, 59, 59, 999);
    const diffMs = midnight.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
}
