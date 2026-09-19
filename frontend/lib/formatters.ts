export function formatCurrency(amount: number, currency: string = 'TZS'): string {
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${currency} ${formatted}`;
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+255') && cleaned.length === 13) {
    return `+255 ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`;
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

export interface ProviderInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  borderActive: string;
  bgLight: string;
  promptInstructions: string;
  logoUrl?: string;
}

export const PROVIDER_MAP: Record<string, ProviderInfo> = {
  VODACOM_TZA: {
    id: 'VODACOM_TZA',
    name: 'Vodacom M-Pesa',
    shortName: 'M-Pesa',
    color: '#00A859',
    textColor: '#FFFFFF',
    borderActive: 'border-emerald-500 ring-emerald-500/30',
    bgLight: 'bg-emerald-500/10',
    promptInstructions: 'Enter your M-Pesa PIN on your phone to authorize payment.',
    logoUrl: '/providers/mpesa.png',
  },
  AIRTEL_TZA: {
    id: 'AIRTEL_TZA',
    name: 'Airtel Money',
    shortName: 'Airtel Money',
    color: '#E60000',
    textColor: '#FFFFFF',
    borderActive: 'border-rose-500 ring-rose-500/30',
    bgLight: 'bg-rose-500/10',
    promptInstructions: 'Check your screen and enter your Airtel Money PIN.',
    logoUrl: '/providers/airtel.png',
  },
  TIGO_TZA: {
    id: 'TIGO_TZA',
    name: 'Mixx by Yas (Tigo)',
    shortName: 'Mixx by Yas',
    color: '#00377B',
    textColor: '#FFFFFF',
    borderActive: 'border-blue-500 ring-blue-500/30',
    bgLight: 'bg-blue-500/10',
    promptInstructions: 'Enter your Mixx PIN to confirm the transaction.',
    logoUrl: '/providers/mixx.png',
  },
  HALOTEL_TZA: {
    id: 'HALOTEL_TZA',
    name: 'Halotel HaloPesa',
    shortName: 'HaloPesa',
    color: '#FF6E00',
    textColor: '#FFFFFF',
    borderActive: 'border-orange-500 ring-orange-500/30',
    bgLight: 'bg-orange-500/10',
    promptInstructions: 'A HaloPesa push notification will prompt for your secret PIN.',
    logoUrl: '/providers/halopesa.png',
  },
};

/**
 * Detects Tanzania provider from phone prefix
 */
export function detectProviderFromPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s+-]/g, '');
  let local = cleaned;
  if (local.startsWith('255')) {
    local = '0' + local.slice(3);
  }

  if (local.length < 3) return null;

  const prefix3 = local.slice(0, 3);
  // Vodacom: 074, 075, 076
  if (['074', '075', '076'].includes(prefix3)) {
    return 'VODACOM_TZA';
  }
  // Tigo: 065, 067, 071
  if (['065', '067', '071'].includes(prefix3)) {
    return 'TIGO_TZA';
  }
  // Airtel: 068, 069, 078
  if (['068', '069', '078'].includes(prefix3)) {
    return 'AIRTEL_TZA';
  }
  // Halotel: 062
  if (prefix3 === '062') {
    return 'HALOTEL_TZA';
  }

  return null;
}

export function formatTimeRemaining(expiresAt: string): {
  minutes: number;
  seconds: number;
  formatted: string;
  isExpired: boolean;
} {
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = expiryTime - now;

  if (isNaN(expiryTime) || diffMs <= 0) {
    return { minutes: 0, seconds: 0, formatted: '00:00', isExpired: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return { minutes, seconds, formatted, isExpired: false };
}
