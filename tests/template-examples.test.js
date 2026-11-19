import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {templates} from '../public/catalog.js';
import {importTemplate} from '../bot-shared/templates.js';
import {parseTemplateFile} from '../public/template-file.js';
test('Treze arquivos de exemplo portáteis passam pelos validadores local e servidor',async()=>{for(const t of templates){const text=await readFile(new URL('../templates/'+t.id+'-v2.json',import.meta.url),'utf8'),server=importTemplate(text),browser=parseTemplateFile(text);assert.deepEqual(server,browser);assert.equal(server.id,t.id);assert.equal(server.version,2);assert.equal(server.name,t.name);assert.deepEqual(server.channels.map(c=>c.type),t.channels.map(c=>c.type));assert.equal(server.categories.length,t.categories.length);}});
