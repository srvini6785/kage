import { createHash, randomUUID } from 'node:crypto';

export const MODULES = ['automod', 'antinuke', 'tickets', 'setup', 'levels', 'economy', 'embeds'];
export const STATES = ['disabled', 'observe', 'enforce'];
export const PERMISSIONS = { ManageGuild: 32n, Administrator: 8n };
export class KageError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export function requireThat(condition, code, message, status = 403) {
  if (!condition) throw new KageError(code, message, status);
}
export function canManageGuild(member, ownerId) {
  return member?.id === ownerId || Boolean(member?.permissions?.has('ManageGuild'));
}
export function canManageBits(bits) {
  try { const n = BigInt(bits); return Boolean(n & (32n | 8n)); } catch { return false; }
}
export function sameScope(actual, expected) {
  requireThat(Boolean(actual) && actual === expected, 'KAGE-SCOPE', 'Acesso indisponível neste servidor.');
}
export function assertModule(config, module, { effect = false } = {}) {
  requireThat(MODULES.includes(module), 'KAGE-MODULE', 'Módulo desconhecido.', 400);
  const state = config?.modules?.[module];
  requireThat(STATES.includes(state) && state !== 'disabled', 'KAGE-MODULE-DISABLED', 'Este módulo está desativado.', 409);
  requireThat(!config.paused, 'KAGE-PAUSED', 'As ações do Kage estão pausadas.', 409);
  if (effect) requireThat(state === 'enforce', 'KAGE-OBSERVE', 'O módulo está em observação; nenhuma ação foi aplicada.', 409);
}
export function hashPlan(plan) { return createHash('sha256').update(JSON.stringify(plan)).digest('hex'); }
export function createPlan({ guildId, actorId, version, kind, payload, now = Date.now() }) {
  return { id: randomUUID(), guildId, actorId, configVersion: version, kind, payload, hash: hashPlan(payload), expiresAt: new Date(now + 5 * 60_000), status: 'pending' };
}
export function validatePlan(plan, { guildId, actorId, version, now = Date.now() }) {
  requireThat(plan && plan.status === 'pending', 'KAGE-PLAN-USED', 'Plano indisponível ou já utilizado.', 409);
  sameScope(plan.guildId, guildId);
  requireThat(plan.actorId === actorId, 'KAGE-PLAN-ACTOR', 'Somente quem criou o plano pode confirmá-lo.');
  requireThat(new Date(plan.expiresAt).getTime() > now, 'KAGE-PLAN-EXPIRED', 'O plano expirou. Gere uma nova prévia.', 409);
  requireThat(plan.configVersion === version, 'KAGE-PLAN-STALE', 'A configuração mudou. Gere uma nova prévia.', 409);
  requireThat(plan.hash === hashPlan(plan.payload), 'KAGE-PLAN-TAMPERED', 'O plano não corresponde à prévia.', 409);
  return plan;
}
export function levelForXp(xp) { return Math.floor(Math.sqrt(Math.max(0, xp) / 100)); }
export function redactSecrets(value) { return String(value ?? '').replace(/[\w-]{20,}\.[\w-]{6}\.[\w-]{20,}/g, '[credencial ocultada]').replace(/https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+/gi, '[webhook ocultado]').replace(/\b(?:Bearer|Bot)\s+[A-Za-z0-9._~+\/-]{20,}/g, '[token ocultado]').replace(/(mongodb(?:\+srv)?:\/\/)[^\s]+/gi, '[conexão ocultada]'); }
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function inertText(value) { return String(value ?? '').replace(/@(everyone|here)/gi, '@\u200b$1').slice(0, 1800); }
export function retentionDate(days, now = Date.now()) { return new Date(now + days * 86_400_000); }

export class SlidingWindow {
  constructor({ windowMs = 10_000, limit = 6, maxKeys = 20_000 } = {}) { this.windowMs = windowMs; this.limit = limit; this.maxKeys = maxKeys; this.entries = new Map(); }
  hit(key, eventId, now = Date.now()) {
    let list = (this.entries.get(key) || []).filter(e => e.at > now - this.windowMs);
    if (list.some(e => e.id === eventId)) return { exceeded: false, duplicate: true, count: list.length };
    list.push({ at: now, id: eventId });
    this.entries.delete(key); this.entries.set(key, list.slice(-this.limit - 1));
    if (this.entries.size > this.maxKeys) this.entries.delete(this.entries.keys().next().value);
    return { exceeded: list.length > this.limit, duplicate: false, count: list.length };
  }
}
