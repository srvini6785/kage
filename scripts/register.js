import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandDefinitions } from '../src/bot.js';
const { DISCORD_TOKEN: token, DISCORD_CLIENT_ID: id, DISCORD_GUILD_ID: guildId } = process.env;
if (!token || !id || !guildId) throw new Error('Configure token, client ID e um servidor de desenvolvimento no .env.');
const rest = new REST({ version: '10' }).setToken(token);
try { await rest.put(Routes.applicationGuildCommands(id, guildId), { body: commandDefinitions() }); console.log('Comandos registrados no servidor de desenvolvimento.'); }
catch { console.error('Não foi possível registrar os comandos. Confira credenciais, servidor e conexão.'); process.exitCode = 1; }
