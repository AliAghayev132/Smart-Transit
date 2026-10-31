import { crypto } from "#lib";
import { config } from "#config";

/**
 * IP ünvanının geri çevrilməz qısa HMAC-ı — anonimliyi saxlayaraq eyni şəbəkə mənbəyini tanımaq üçün.
 * IP özü bazaya yazılmır.
 */
const hashIp = (ip) =>
  ip
    ? crypto
        .createHmac("sha256", config.encryptionKey)
        .update(String(ip))
        .digest("hex")
        .slice(0, 16)
    : undefined;

export { hashIp };
