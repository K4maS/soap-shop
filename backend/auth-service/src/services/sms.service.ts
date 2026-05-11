import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// =============================================================
// SMS Service abstraction — легко менять провайдера
// Security: OTP передаётся в SMS, не логируется
// =============================================================

interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

class MockSmsProvider implements SmsProvider {
  async send(phone: string, message: string): Promise<void> {
    // В dev режиме — показываем OTP в консоли (ТОЛЬКО для development)
    if (config.NODE_ENV !== 'production') {
      logger.info(
        { phone: phone.replace(/\d{6}$/, '******'), provider: 'mock' },
        `[DEV] SMS: ${message}`
      );
    } else {
      logger.warn('Mock SMS provider used in production!');
    }
  }
}

class SmsAeroProvider implements SmsProvider {
  async send(phone: string, message: string): Promise<void> {
    const email = config.SMSAERO_EMAIL;
    const apiKey = config.SMSAERO_API_KEY;

    if (!email || !apiKey) {
      throw new Error('SmsAero credentials not configured');
    }

    const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64');

    const params = new URLSearchParams({
      number: phone.replace('+', ''),
      text: message,
      sign: 'SMS Aero',
      channel: 'DIRECT',
    });

    const response = await fetch(
      `https://gate.smsaero.ru/v2/sms/send?${params}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SmsAero error: ${response.status} ${body}`);
    }

    const data = await response.json() as { success: boolean; message?: string };
    if (!data.success) {
      throw new Error(`SmsAero rejected: ${data.message ?? 'unknown'}`);
    }
  }
}

function createProvider(): SmsProvider {
  switch (config.SMS_PROVIDER) {
    case 'smsaero':
      return new SmsAeroProvider();
    case 'mock':
    default:
      return new MockSmsProvider();
  }
}

export class SmsService {
  private readonly provider: SmsProvider;

  constructor() {
    this.provider = createProvider();
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    const message = `Ваш код: ${otp}. Действителен 5 минут. Никому не сообщайте код.`;

    try {
      await this.provider.send(phone, message);
    } catch (err) {
      // Логируем ошибку БЕЗ самого OTP кода
      logger.error(
        {
          err,
          phone: phone.replace(/\d{6}$/, '******'),
          provider: config.SMS_PROVIDER,
        },
        'Failed to send OTP SMS'
      );
      throw err;
    }
  }
}
