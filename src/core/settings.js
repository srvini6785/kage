import { z } from 'zod';
import { MODULES } from './policy.js';

const state = z.enum(['disabled', 'observe', 'enforce']);
const snowflake = z.string().regex(/^\d{17,20}$/).or(z.literal(''));
export const settingsSchema = z.object({
  modules: z.object(Object.fromEntries(MODULES.map(name => [name, state]))).strict(),
  automod: z.object({ maxMessages: z.number().int().min(3).max(30), windowSeconds: z.number().int().min(3).max(60), maxMentions: z.number().int().min(3).max(30), deleteSpam: z.boolean() }).strict(),
  antinuke: z.object({ threshold: z.number().int().min(3).max(30), windowSeconds: z.number().int().min(10).max(300) }).strict(),
  tickets: z.object({ categoryId: snowflake, supportRoleId: snowflake, maxOpen: z.number().int().min(1).max(5), retentionDays: z.number().int().min(1).max(90) }).strict(),
  levels: z.object({ xpPerMessage: z.number().int().min(1).max(100), cooldownSeconds: z.number().int().min(15).max(300) }).strict(),
  economy: z.object({ dailyAmount: z.number().int().min(1).max(10000) }).strict(),
  logChannelId: snowflake,
  auditRetentionDays: z.number().int().min(1).max(90),
  moderationPolicyEnabled:z.boolean().default(false),
  paused: z.boolean()
}).strict();
export function defaults() {
  return { modules: Object.fromEntries(MODULES.map(m => [m, 'disabled'])), automod: { maxMessages: 6, windowSeconds: 10, maxMentions: 6, deleteSpam: false }, antinuke: { threshold: 5, windowSeconds: 30 }, tickets: { categoryId: '', supportRoleId: '', maxOpen: 1, retentionDays: 7 }, levels: { xpPerMessage: 15, cooldownSeconds: 60 }, economy: { dailyAmount: 100 }, logChannelId: '', auditRetentionDays: 30, moderationPolicyEnabled:false, paused: false };
}
