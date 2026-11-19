import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandDefinitions } from '../src/bot.js';
const { DISCORD_TOKEN: token, DISCORD_CLIENT_ID: id, DISCORD_GUILD_ID: guildId } = process.env;
const global = process.argv.includes('--global');
if (!token || !id || (!global && !guildId)) throw new Error(global ? 'Configure token e client ID no .env.' : 'Configure token, client ID e um servidor de desenvolvimento no .env.');
const rest = new REST({ version: '10' }).setToken(token);
try {
  const route = global ? Routes.applicationCommands(id) : Routes.applicationGuildCommands(id, guildId);
  await rest.put(route, { body: commandDefinitions() });
  console.log(global ? 'Comandos registrados globalmente; a propagação pode levar até uma hora.' : 'Comandos registrados no servidor de desenvolvimento.');
}
catch { console.error('Não foi possível registrar os comandos. Confira credenciais, servidor e conexão.'); process.exitCode = 1; }
