// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - UTILITAIRES DE FORMATAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Formate un montant en DZD (Dinars Algériens)
 */
export function formatCurrency(amount: number | string | undefined): string {
  if (amount === undefined || amount === null) return '0 DZD';
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) return '0 DZD';
  
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formate une date
 */
export function formatDate(date: string | Date | undefined, options?: {
  includeTime?: boolean;
  short?: boolean;
}): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '-';
  
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: options?.short ? 'short' : 'long',
    day: '2-digit',
    ...(options?.includeTime && {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
  
  return new Intl.DateTimeFormat('fr-FR', opts).format(d);
}

/**
 * Formate un numéro de téléphone algérien
 */
export function formatPhone(phone: string | undefined): string {
  if (!phone) return '-';
  
  // Format: 0XXX XX XX XX
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return cleaned.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
  }
  
  return phone;
}

/**
 * Formate un nombre avec séparateurs de milliers
 */
export function formatNumber(num: number | string | undefined): string {
  if (num === undefined || num === null) return '0';
  
  const n = typeof num === 'string' ? parseFloat(num) : num;
  
  if (isNaN(n)) return '0';
  
  return new Intl.NumberFormat('fr-FR').format(n);
}

/**
 * Tronque un texte avec ellipsis
 */
export function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Formate un pourcentage
 */
export function formatPercent(value: number | string | undefined, decimals = 1): string {
  if (value === undefined || value === null) return '0%';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0%';
  
  return `${num.toFixed(decimals)}%`;
}
