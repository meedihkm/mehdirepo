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
