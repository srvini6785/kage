// @ts-check
/** @typedef {import('../types/contracts.js').Contracts} Contracts */
/** @typedef {{request:(path:string,method:string,body:unknown)=>Promise<unknown>}} Transport */
const paths={wizard:'wizard/preview',message:'embeds',role:'roles',security:'security/policy/preview',schedule:'schedules/preview',access:'access/preview'};
/**
 * @template {keyof Contracts} K
 * @param {Transport} api
 * @param {string} guildId
 * @param {K} resource
 * @param {Contracts[K]} body
 */
export function writeTyped(api,guildId,resource,body){return api.request('guilds/'+encodeURIComponent(guildId)+'/'+paths[resource],'POST',body);}
