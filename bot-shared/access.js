import {z} from 'zod';
import {snowflake} from './schemas.js';
export const dashboardScopes=['view','settings','security','moderation','messages','structure','roles','backups','schedules','audit'];
export const accessSchema=z.object({version:z.number().int().min(0),grants:z.array(z.object({roleId:snowflake,scopes:z.array(z.enum(dashboardScopes)).min(1).max(10)}).strict()).max(20)}).strict().refine(p=>new Set(p.grants.map(g=>g.roleId)).size===p.grants.length,'Cargo duplicado.');
export const consentVersions={terms:'2026-11-11',privacy:'2026-11-11',cookies:'2026-11-11'};
