import {z} from 'zod';
export const snowflake=z.string().regex(/^\d{17,20}$/);
export const text=n=>z.string().max(n).refine(s=>!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(s),'Caracteres de controle não permitidos.');
export const color=z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const mediaUrl=z.string().max(2048).refine(s=>{if(!s)return true;try{const u=new URL(s);return u.protocol==='https:'&&['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname)&&!u.username&&!u.password&&!/\.svg(?:$|\?)/i.test(u.pathname);}catch{return false;}},'Use uma imagem HTTPS do Discord; SVG não é aceito.');
export const key=z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/).refine(s=>!/^\d{17,20}$/.test(s),'Use uma chave local, não um ID Discord.');
export const templated=n=>text(n).refine(s=>[...s.matchAll(/\{([^{}]+)\}/g)].every(m=>['usuario','servidor','contagem'].includes(m[1])),'Variável desconhecida.');
export const assetId=z.string().uuid().or(z.literal(''));
