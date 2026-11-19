import {z} from 'zod';
import {snowflake} from './schemas.js';
const reason=z.string().trim().min(1,'Informe o motivo.').max(400);
const base={reason};
const member={...base,targetId:snowflake};
export const cleanupFilters=z.object({count:z.number().int().min(1).max(100),userId:snowflake.optional(),bots:z.enum(['all','only','exclude']).default('all'),contains:z.string().max(100).default(''),links:z.boolean().default(false),attachments:z.boolean().default(false),before:z.iso.datetime().optional(),after:z.iso.datetime().optional()}).strict().refine(f=>!f.before||!f.after||Date.parse(f.after)<Date.parse(f.before),'A data inicial deve ser anterior à final.');
export const moderationSchema=z.discriminatedUnion('action',[
 ...['ban','kick','warn','unban'].map(action=>z.object({action:z.literal(action),...member}).strict()),
 z.object({action:z.literal('timeout'),...member,minutes:z.number().int().min(1).max(40320)}).strict(),
 z.object({action:z.literal('unwarn'),...member,punishmentId:z.uuid()}).strict(),
 z.object({action:z.literal('slowmode'),...base,channelId:snowflake,seconds:z.number().int().min(0).max(21600)}).strict(),
 ...['lock','unlock'].map(action=>z.object({action:z.literal(action),...base,channelId:snowflake}).strict()),
 ...['role-add','role-remove'].map(action=>z.object({action:z.literal(action),...member,roleId:snowflake,riskConfirmation:z.string().max(100).default('')}).strict()),
 z.object({action:z.literal('cleanup'),...base,channelId:snowflake,filters:cleanupFilters}).strict()
]);
export const batchBanSchema=z.object({targetIds:z.array(snowflake).min(1).max(20).refine(ids=>new Set(ids).size===ids.length,'Há IDs duplicados.'),reason}).strict();
