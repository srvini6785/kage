import 'dotenv/config';
import mongoose from 'mongoose';
import {models as dashboardModels} from '../backend/models.js';
import {Config,Audit,Ticket,Operation,Profile,Receipt} from '../src/db.js';
const models=[Config,Audit,Ticket,Operation,Profile,Receipt,...dashboardModels];
if(process.argv.includes('--dry-run'))console.log(JSON.stringify({migration:'001-dashboard',mode:'dry-run',destructive:false,indexes:models.map(m=>({collection:m.collection.name,indexes:m.schema.indexes()}))},null,2));
else{if(!process.env.MONGO_URI)throw new Error('Configure MONGO_URI no ambiente.');try{await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:8000});for(const m of models)await m.createIndexes();console.log('Índices aditivos criados. Nenhum registro removido.');}catch{console.error('DATABASE_UNAVAILABLE: migração não confirmada.');process.exitCode=1;}finally{await mongoose.disconnect();}}
