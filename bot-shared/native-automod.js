import {z} from 'zod';
const id=z.string().regex(/^\d{17,20}$/),unique=a=>new Set(a).size===a.length;
const list=(item,max)=>z.array(item).max(max).refine(unique,'Itens duplicados.');
const words=max=>list(z.string().trim().min(1).max(60),max);
const keyword=z.object({keywordFilter:words(1000).default([]),regexPatterns:list(z.string().min(1).max(260),10).default([]),allowList:words(100).default([])}).strict().refine(m=>m.keywordFilter.length+m.regexPatterns.length>0,'Informe palavras ou regex Rust.');
const trigger=z.discriminatedUnion('triggerType',[
 z.object({triggerType:z.literal(1),triggerMetadata:keyword}).strict(),
 z.object({triggerType:z.literal(6),triggerMetadata:keyword}).strict(),
 z.object({triggerType:z.literal(3),triggerMetadata:z.object({}).strict().default({})}).strict(),
 z.object({triggerType:z.literal(4),triggerMetadata:z.object({presets:list(z.union([z.literal(1),z.literal(2),z.literal(3)]),3).min(1),allowList:words(1000).default([])}).strict()}).strict(),
 z.object({triggerType:z.literal(5),triggerMetadata:z.object({mentionTotalLimit:z.number().int().min(1).max(50),mentionRaidProtectionEnabled:z.boolean().default(false)}).strict()}).strict()
]);
const action=z.discriminatedUnion('type',[
 z.object({type:z.literal(1),customMessage:z.string().max(150).default('')}).strict(),
 z.object({type:z.literal(2),channelId:id}).strict(),
 z.object({type:z.literal(4)}).strict(),
 z.object({type:z.literal(3),durationSeconds:z.number().int().min(1).max(2419200)}).strict()
]);
export const nativeRuleSchema=z.object({name:z.string().trim().min(1).max(100),trigger,actions:z.array(action).min(1).max(3).refine(a=>unique(a.map(x=>x.type)),'Uma ação de cada tipo.'),enabled:z.boolean().default(false),exemptRoles:list(id,20).default([]),exemptChannels:list(id,50).default([])}).strict().refine(r=>!r.actions.some(a=>a.type===3)||[1,5].includes(r.trigger.triggerType),'Timeout só é permitido em palavras-chave e menções.').refine(r=>r.trigger.triggerType===6?r.actions.every(a=>[2,4].includes(a.type)):r.actions.every(a=>a.type!==4),'Bloqueio de interação é reservado ao filtro de perfil.');
const reason=z.string().trim().min(3).max(400);
export const nativeMutationSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),rule:nativeRuleSchema,reason}).strict(),
 z.object({action:z.literal('edit'),ruleId:id,rule:nativeRuleSchema,reason}).strict(),
 z.object({action:z.literal('disable'),ruleId:id,reason}).strict()
]);
export const nativeCaps={1:6,3:1,4:1,5:1,6:1};
