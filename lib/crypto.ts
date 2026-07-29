import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer | null {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) return null;
  return crypto.scryptSync(encryptionKey, 'salt', KEY_LENGTH);
}

// Prefixo para diferenciar texto cifrado de texto puro
const PLAIN_PREFIX = 'plain:';

export function encrypt(text: string): string {
  const key = getKey();
  if (!key) {
    // Sem ENCRYPTION_KEY: armazena sem criptografia
    return PLAIN_PREFIX + text;
  }
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Erro ao criptografar:', error);
    throw new Error('Falha na criptografia');
  }
}

export function decrypt(encryptedData: string): string {
  // Dados armazenados sem criptografia
  if (encryptedData.startsWith(PLAIN_PREFIX)) {
    return encryptedData.slice(PLAIN_PREFIX.length);
  }

  const key = getKey();
  if (!key) {
    // ENCRYPTION_KEY removida mas dado foi criptografado : não consegue ler
    throw new Error('ENCRYPTION_KEY necessária para descriptografar este valor');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato inválido');
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    throw new Error('Falha na descriptografia');
  }
}

/**
 * Gera um ID aleatório para webhooks
 */
export function generateWebhookId(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Gera um secret aleatório para webhooks
 */
export function generateWebhookSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Valida assinatura de webhook
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Erro ao validar assinatura:', error);
    return false;
  }
}
