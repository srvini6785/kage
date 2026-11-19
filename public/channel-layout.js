// A mesma formatação determinística é usada na prévia e no efeito do backend.
export const channelTypes={0:'Texto',2:'Voz',5:'Anúncios · Community',15:'Fórum · Community'};
export const channelEmojis=['','📌','💬','🎮','🔊','📅','🛡️','🎫','📚','🎵','🛒','✦'];
export function channelName(channel,style){const emoji=style.emoji?(channel.emoji??(channel.type===2?'🔊':channel.type===15?'📚':channel.type===5?'📌':'💬')):'';return emoji+(style.separator?'・':emoji?'-':'')+channel.name;}
export function categoryName(category,style){const emoji=style.emoji?(category.emoji??'✦'):'';return emoji+(style.separator?'・':emoji?'-':'')+category.name;}
export function structureOf(draft){if(draft.categories?.length)return {categories:draft.categories,channels:draft.channels};if(!draft.channels.length)return {categories:[],channels:[]};return {categories:[{key:'kage-root',name:'Kage · '+draft.templateId,private:false,emoji:''}],channels:draft.channels.map(c=>({...c,parentKey:'kage-root'}))};}
export function moveItem(items,index,delta){const next=index+delta;if(index<0||next<0||index>=items.length||next>=items.length)return false;[items[index],items[next]]=[items[next],items[index]];return true;}
export function removeCategory(draft,key){draft.categories=draft.categories.filter(c=>c.key!==key);draft.channels=draft.channels.filter(c=>c.parentKey!==key);}
