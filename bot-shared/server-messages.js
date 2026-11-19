import {z} from 'zod';
import {snowflake,key,color,mediaUrl,templated,assetId} from './primitives.js';
// A versão do construtor aceita só texto e imagens. O editor completo mantém seu próprio contrato.
export const serverMessageSchema=z.discriminatedUnion('mode',[
 z.object({mode:z.literal('v1'),title:templated(256),description:templated(4096),color,image:mediaUrl.default(''),thumbnail:mediaUrl.default(''),imageAssetId:assetId.default(''),thumbnailAssetId:assetId.default('')}).strict().refine(m=>m.title.length+m.description.length>0,'Informe o texto da mensagem.'),
 z.object({mode:z.literal('v2'),text:templated(4000).min(1),color,image:mediaUrl.default(''),imageAssetId:assetId.default('')}).strict()
]);
export const builderEmbedSchema=z.object({kind:z.literal('server-message'),key,target:z.object({channelId:snowflake.or(z.literal('')).default(''),channelKey:key.or(z.literal('')).default('')}).strict().refine(t=>!t.channelId||!t.channelKey,'Escolha um único destino.'),message:serverMessageSchema}).strict();
export function builderMessageToEmbed(row,channelId=''){return {...row.message,channelId};}
export function hasAdvancedBuilderContent(e){return !!(e.buttons?.length||e.sections?.length||e.fileAssetIds?.length);}
