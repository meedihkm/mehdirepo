// Service SMS - Mock pour le développement
// Remplace par Twilio, Africa's Talking, ou autre provider en production

export interface SMSOptions {
  to: string;
  message: string;
}

export class SMSService {
  async sendSMS(options: SMSOptions): Promise<boolean> {
    // Mock - log le SMS au lieu de l'envoyer
    console.log(`[SMS MOCK] To: ${options.to}, Message: ${options.message}`);
    return true;
  }

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const message = `Votre code de vérification AWID est: ${code}. Valable pendant 10 minutes.`;
    return this.sendSMS({ to: phone, message });
  }
}

export const smsService = new SMSService();

// Stubs pour les fonctions exportées individuellement

export async function sendSms(to: string, message: string): Promise<boolean> {
  // TODO: Implémenter l'envoi de SMS
  console.log(`[SMS STUB] sendSms - To: ${to}, Message: ${message}`);
  return true;
}

export async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  // TODO: Implémenter l'envoi d'OTP par SMS
  console.log(`[SMS STUB] sendOtpSms - Phone: ${phone}, Code: ${code}`);
  return true;
}

export async function sendOrderNotificationSms(
  phone: string,
  orderId: string,
  status: string
): Promise<boolean> {
  // TODO: Implémenter la notification de commande par SMS
  console.log(`[SMS STUB] sendOrderNotificationSms - Phone: ${phone}, Order: ${orderId}, Status: ${status}`);
  return true;
}

export async function sendDeliveryNotificationSms(
  phone: string,
  deliveryId: string,
  status: string
): Promise<boolean> {
  // TODO: Implémenter la notification de livraison par SMS
  console.log(`[SMS STUB] sendDeliveryNotificationSms - Phone: ${phone}, Delivery: ${deliveryId}, Status: ${status}`);
  return true;
}

export default {
  sendSms,
  sendOtpSms,
  sendOrderNotificationSms,
  sendDeliveryNotificationSms,
  SMSService,
  smsService,
};
