export const messagePresets=[
 {id:'welcome',name:'Boas-vindas',title:'Boas-vindas, {usuario}',description:'Você chegou a {servidor}. Somos {contagem} membros. Leia as regras e aproveite a comunidade.'},
 {id:'rules',name:'Regras',title:'Regras de {servidor}',description:'1. Respeite todas as pessoas.\n2. Não envie spam nem convites sem autorização.\n3. Proteja dados pessoais.\n4. Procure a equipe para pedir revisão.'},
 {id:'announcement',name:'Anúncio',title:'Novidades de {servidor}',description:'Edite este anúncio antes de publicar.'},
 {id:'warning',name:'Aviso de moderação',title:'Aviso da equipe',description:'Revise as regras de {servidor}. Se precisar de esclarecimento, procure a equipe.'},
 {id:'ticket',name:'Resposta de ticket',title:'Atendimento iniciado',description:'Olá, {usuario}. Descreva sua solicitação e aguarde a equipe. Não envie senhas ou tokens.'},
 {id:'departure',name:'Saída',title:'Até a próxima, {usuario}',description:'Obrigado por participar de {servidor}.'}
];
export function messagePreset(id,channelId=''){const p=messagePresets.find(p=>p.id===id);if(!p)throw new Error('Modelo desconhecido.');return {mode:'v1',title:p.title,description:p.description,color:'#F26A21',channelId,fields:[],author:'',footer:'Kage',image:'',thumbnail:'',buttons:[]};}
