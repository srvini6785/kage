import {createHash} from 'node:crypto';
export function sessionCryptoSecret(value){return createHash('sha256').update(String(value)).digest('base64url')+'Aa1!bB2@';}
