import mongoose from 'mongoose';
import { defaults } from './core/settings.js';
import { models as dashboardModels } from '../backend/models.js';
const { Schema } = mongoose;
const base = { timestamps: true, minimize: false };
const config = new Schema({ guildId: { type: String, unique: true, required: true }, version: { type: Number, default: 1 }, settings: { type: Schema.Types.Mixed, default: defaults },auditOutbox:{type:[Schema.Types.Mixed],default:[]} }, base);
const audit = new Schema({ guildId: { type: String, required: true, index: true }, actorId: String, action: String, targetId: String, result: String, code: String, correlationId: String, eventKey:String, configVersion: Number, reason: String, module: String, policyVersion: String, expiresAt: { type: Date, required: true } }, base);
audit.index({guildId:1,createdAt:-1});
audit.index({eventKey:1},{unique:true,sparse:true});
audit.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const ticket = new Schema({ id: { type: String, unique: true }, guildId: { type: String, index: true }, ownerId: String, channelId: String, supportRoleId: String, slot: Number, active: { type: Boolean, default: true }, state: { type: String, enum: ['opening', 'open', 'closing', 'closed', 'uncertain', 'failed'] }, operationId: String, expiresAt: Date }, base);
ticket.index({ guildId: 1, ownerId: 1, slot: 1 }, { unique: true, partialFilterExpression: { active: true } });
// O registro só é excluído após a confirmação da limpeza do canal no Discord.
ticket.index({ state: 1, expiresAt: 1 });
const operation = new Schema({ id: { type: String, unique: true }, guildId: String, actorId: String, kind: String, configVersion: Number, workerId:String,leaseUntil:Date,cancelRequested: {type:Boolean,default:false}, payload: Schema.Types.Mixed, hash: String, expiresAt: Date, status: String, result: Schema.Types.Mixed, cleanupAt: { type: Date, default: () => new Date(Date.now() + 7 * 86400000) } }, base);
operation.index({status:1,kind:1,createdAt:1});operation.index({status:1,leaseUntil:1});
operation.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });
const profile = new Schema({ guildId: String, userId: String, xp: { type: Number, default: 0 }, wallet: { type: Number, default: 0 }, lastXpAt: { type: Date, default: () => new Date(0) }, lastDailyAt: { type: Date, default: () => new Date(0) }, fingerprint: String }, base);
profile.index({ guildId: 1, userId: 1 }, { unique: true });
const receipt = new Schema({ key: { type: String, unique: true }, expiresAt: Date }, base);
receipt.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Config = mongoose.model('GuildConfig', config);
export const Audit = mongoose.model('Audit', audit);
export const Ticket = mongoose.model('Ticket', ticket);
export const Operation = mongoose.model('Operation', operation);
export const Profile = mongoose.model('Profile', profile);
export const Receipt = mongoose.model('Receipt', receipt);
export async function connect(uri) {
  mongoose.set('bufferCommands', false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  await Promise.all([Config, Audit, Ticket, Operation, Profile, Receipt, ...dashboardModels].map(m => m.init()));
}
export async function getConfig(guildId) {
  return Config.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId, settings: defaults(), version: 1 } }, { upsert: true, new: true }).lean();
}
export async function once(key, days = 1) {
  try { await Receipt.create({ key, expiresAt: new Date(Date.now() + days * 86400000) }); return true; }
  catch (e) { if (e.code === 11000) return false; throw e; }
}
export const databaseReady = () => mongoose.connection.readyState === 1;
