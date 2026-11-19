import type {z} from 'zod';
import {wizardSchema,embedSchema,roleSchema} from '../bot-shared/schemas.js';
import {securityPolicySchema} from '../bot-shared/security.js';
import {scheduleSchema} from '../bot-shared/schedules.js';
import {accessSchema} from '../bot-shared/access.js';
export type Wizard=z.infer<typeof wizardSchema>;
export type MessageDraft=z.infer<typeof embedSchema>;
export type RoleDraft=z.infer<typeof roleSchema>;
export type SecurityPolicy=z.infer<typeof securityPolicySchema>;
export type Schedule=z.infer<typeof scheduleSchema>;
export type Access=z.infer<typeof accessSchema>;
export type OperationState='preview'|'queued'|'running'|'applied'|'partial'|'failed'|'unknown'|'cancelled'|'reconciled';
export interface Failure {ok:false;code:string;message:string;requestId:string;correlationId:string;state:OperationState;applied:'unknown'|'not_applied';retryable:false;nextAction:'review'|'reconcile';fieldErrors:readonly {field:string;message:string}[]}
export interface Versioned<T>{version:number;draft:T}
export interface Contracts {wizard:Versioned<Wizard>;message:MessageDraft;role:RoleDraft;security:SecurityPolicy;schedule:Schedule;access:Access}
export type TypedWriter=<K extends keyof Contracts>(resource:K,body:Contracts[K])=>Promise<unknown>;
