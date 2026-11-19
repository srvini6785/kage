import test from 'node:test';
import assert from 'node:assert/strict';
import { auditEnvironment } from '../scripts/staging-audit.js';

const base = {
  NODE_ENV: 'production',
  DISCORD_TOKEN: 'synthetic-bot-token-0123456789abcdef',
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'synthetic-client-secret-0123456789',
  DISCORD_REDIRECT_URI: 'https://kage.example/auth/callback',
  DISCORD_GUILD_ID: '223456789012345678',
  MONGO_URI: 'mongodb://127.0.0.1:27017/kage',
  SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  SESSION_ENCRYPTION_KEY: 'fedcba9876543210fedcba9876543210',
  PUBLIC_ORIGIN: 'https://kage.example'
};

test('Configuração completa de staging passa sem falhas', () => {
  const report = auditEnvironment(base);
  assert.equal(report.ok, true);
  assert.equal(report.checks.filter(check => check.level === 'fail').length, 0);
});

test('Variáveis obrigatórias ausentes falham e não expõem valores', () => {
  const report = auditEnvironment({ ...base, DISCORD_TOKEN: '', SESSION_SECRET: '' });
  assert.equal(report.ok, false);
  const ids = report.checks.filter(check => check.level === 'fail').map(check => check.id);
  assert.ok(ids.includes('env.DISCORD_TOKEN'));
  assert.ok(ids.includes('env.SESSION_SECRET'));
  assert.ok(!JSON.stringify(report).includes(base.SESSION_ENCRYPTION_KEY));
  assert.ok(!JSON.stringify(report).includes(base.DISCORD_TOKEN));
});

test('Produção recusa origem HTTP e callback fora do PUBLIC_ORIGIN', () => {
  const insecure = auditEnvironment({ ...base, PUBLIC_ORIGIN: 'http://kage.example' });
  assert.equal(insecure.ok, false);
  assert.ok(insecure.checks.some(check => check.id === 'origin.https' && check.level === 'fail'));
  const mismatch = auditEnvironment({ ...base, DISCORD_REDIRECT_URI: 'https://outro.example/auth/callback' });
  assert.equal(mismatch.ok, true);
  assert.ok(mismatch.checks.some(check => check.id === 'oauth.redirect.origin' && check.level === 'warn'));
});

test('Placeholders, booleanos inválidos e IA incompleta são sinalizados', () => {
  const placeholder = auditEnvironment({ ...base, DISCORD_TOKEN: 'COLOQUE_SEU_TOKEN_AQUI' });
  assert.ok(placeholder.checks.some(check => check.id === 'placeholder.DISCORD_TOKEN' && check.level === 'warn'));
  const boolean = auditEnvironment({ ...base, ENABLE_MESSAGE_CONTENT: 'sim' });
  assert.ok(boolean.checks.some(check => check.id === 'boolean.ENABLE_MESSAGE_CONTENT' && check.level === 'fail'));
  const ai = auditEnvironment({ ...base, AI_PROVIDER_APPROVED: 'true' });
  assert.equal(ai.ok, false);
  assert.ok(ai.checks.some(check => check.id === 'ai.url' && check.level === 'fail'));
});

test('Banco sem nome, segredo curto e servidor ausente geram avisos', () => {
  const report = auditEnvironment({ ...base, MONGO_URI: 'mongodb://127.0.0.1:27017', SESSION_SECRET: 'curto', DISCORD_GUILD_ID: '' });
  assert.equal(report.ok, false);
  assert.ok(report.checks.some(check => check.id === 'mongo.database' && check.level === 'warn'));
  assert.ok(report.checks.some(check => check.id === 'session.length' && check.level === 'fail'));
  assert.ok(report.checks.some(check => check.id === 'discord.guildId.missing' && check.level === 'warn'));
});
