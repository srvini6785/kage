export const securityDefaults=()=>({
  "version": 0,
  "retentionDays": 30,
  "alertChannelId": "",
  "exemptRoleIds": [],
  "exemptChannelIds": [],
  "raid": {
    "state": "disabled",
    "entries": 10,
    "windowSeconds": 60,
    "minAccountDays": 7,
    "action": "alert",
    "quarantineRoleId": ""
  },
  "verification": {
    "state": "disabled",
    "method": "button",
    "memberRoleId": "",
    "quarantineRoleId": "",
    "channelId": "",
    "messageId": "",
    "ttlMinutes": 30
  },
  "invites": {
    "state": "disabled",
    "allowCodes": [],
    "action": "alert"
  },
  "ai": {
    "state": "disabled",
    "level": "medium",
    "providerApproved": false
  },
  "rules": []
});
export const moderationDefaults=()=>({
  "version": 0,
  "dm": {
    "enabled": false,
    "template": "Kage · {servidor}: {acao}. Motivo: {motivo}."
  },
  "escalation": {
    "state": "disabled",
    "windowDays": 30,
    "steps": []
  }
});

export const memberDefaults=()=>({version:0,welcome:{state:'disabled',embed:{mode:'v1',title:'Boas-vindas, {usuario}',description:'Você chegou a {servidor}. Somos {contagem} membros.',color:'#F26A21',channelId:''}},boost:{state:'disabled',roleId:'',guildBoostThreshold:2,scope:'guild-threshold-active-booster'}});
export const logDefaults=()=>({version:0,enabled:false,channelId:'',maskIdentifiers:true,filters:{joins:true,leaves:true,messages:false,roles:true,channels:true,punishments:true}});
