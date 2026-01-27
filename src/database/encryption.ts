// Encryption key management using expo-secure-store
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_NAME = 'clearhead_encryption_key';
const BACKUP_PASSWORD_KEY = 'clearhead_backup_password';

// Generate a random encryption key
function generateEncryptionKey(): string {
    const array = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        array[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Get or create the main encryption key
export async function getEncryptionKey(): Promise<string> {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);

    if (!key) {
        key = generateEncryptionKey();
        await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
    }

    return key;
}

// Set backup password (user-defined for .clearhead files)
export async function setBackupPassword(password: string): Promise<void> {
    await SecureStore.setItemAsync(BACKUP_PASSWORD_KEY, password);
}

// Get backup password
export async function getBackupPassword(): Promise<string | null> {
    return SecureStore.getItemAsync(BACKUP_PASSWORD_KEY);
}

// Check if backup password exists
export async function hasBackupPassword(): Promise<boolean> {
    const password = await SecureStore.getItemAsync(BACKUP_PASSWORD_KEY);
    return password !== null;
}

// Clear all secure data (for app reset)
export async function clearSecureData(): Promise<void> {
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME);
    await SecureStore.deleteItemAsync(BACKUP_PASSWORD_KEY);
}

// --- Robust UTF-8 and Base64 Helpers ---

// Convert Unicode string to UTF-8 Byte Array
function stringToUtf8Bytes(str: string): Uint8Array {
    const utf8 = [];
    for (let i = 0; i < str.length; i++) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f));
        }
        // Surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff) << 10)
                | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >> 18),
                0x80 | ((charcode >> 12) & 0x3f),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f));
        }
    }
    return new Uint8Array(utf8);
}

// Convert UTF-8 Byte Array to Unicode string
function utf8BytesToString(bytes: Uint8Array): string {
    let str = "";
    let i = 0;
    while (i < bytes.length) {
        let c = bytes[i++];
        if (c > 127) {
            if (c > 191 && c < 224) {
                if (i >= bytes.length) throw new Error('UTF-8 decode error');
                c = ((c & 31) << 6) | (bytes[i++] & 63);
            }
            else if (c > 223 && c < 240) {
                if (i + 1 >= bytes.length) throw new Error('UTF-8 decode error');
                c = ((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            }
            else if (c > 239 && c < 248) {
                if (i + 2 >= bytes.length) throw new Error('UTF-8 decode error');
                c = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            }
        }
        if (c <= 0xffff) str += String.fromCharCode(c);
        else if (c <= 0x10ffff) {
            c -= 0x10000;
            str += String.fromCharCode(c >> 10 | 0xd800)
                + String.fromCharCode(c & 0x3ff | 0xdc00);
        }
    }
    return str;
}

// Convert Byte Array to Base64 String
function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Convert Base64 String to Byte Array
function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// --- Safe Encryption Logic ---

export function encryptData(data: string, password: string): string {
    // 1. Convert data JSON -> UTF-8 Bytes
    const dataBytes = stringToUtf8Bytes(data);

    // 2. Convert password -> UTF-8 Bytes
    const passwordBytes = stringToUtf8Bytes(password);

    // 3. XOR Encyption (Byte-level)
    const encryptedBytes = new Uint8Array(dataBytes.length);
    const passLen = passwordBytes.length;

    for (let i = 0; i < dataBytes.length; i++) {
        encryptedBytes[i] = dataBytes[i] ^ passwordBytes[i % passLen];
    }

    // 4. Return as Base64
    return bytesToBase64(encryptedBytes);
}

export function decryptData(encryptedBase64: string, password: string): string {
    // 1. Decode Base64 -> Encrypted Bytes
    let encryptedBytes: Uint8Array;
    try {
        encryptedBytes = base64ToBytes(encryptedBase64);
    } catch (e) {
        console.error('Base64 decode failed', e);
        return '';
    }

    // 2. Convert password -> UTF-8 Bytes
    const passwordBytes = stringToUtf8Bytes(password);

    // 3. XOR Decryption (Byte-level)
    const decryptedBytes = new Uint8Array(encryptedBytes.length);
    const passLen = passwordBytes.length;

    for (let i = 0; i < encryptedBytes.length; i++) {
        decryptedBytes[i] = encryptedBytes[i] ^ passwordBytes[i % passLen];
    }

    // 4. Convert Bytes -> UTF-8 String (Original JSON)
    try {
        return utf8BytesToString(decryptedBytes);
    } catch (e) {
        console.error('UTF-8 decode failed', e);
        return ''; // Return empty to signal corrupted/wrong password
    }
}
