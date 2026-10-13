import {test,mock} from 'node:test';import assert from 'node:assert/strict';
let requests=[],rejectTemperature=false;
mock.module('@anthropic-ai/sdk',{defaultExport:class {constructor(){this.messages={stream:(params,opts)=>{
 requests.push({params,opts});if(rejectTemperature&&'temperature'in params)throw Object.assign(new Error('temperature is unsupported'),{status:400});
 const result={content:[{type:'tool_use',id:'submit',name:'submit_brief',input:{claims:[]}}],usage:{input_tokens:100,output_tokens:20}};
 return {async*[Symbol.asyncIterator](){yield{type:'message_start',message:{usage:{input_tokens:100}}};yield{type:'content_block_delta',delta:{type:'input_json_delta',partial_json:'{"claims":'}};},finalMessage:async()=>result,abort(){}};
 }};}}});
process.env.ANTHROPIC_API_KEY='test-only';
const{streamToolCompletion}=await import('../models/anthropic.js');
const params={model:'claude-sonnet-5-5',system:[{type:'text',text:'system',cache_control:{type:'ephemeral'}}],messages:[{role:'user',content:[{type:'tool_result',tool_use_id:'read',content:'data'}]}],tools:[],tool_choice:{type:'tool',name:'submit_brief'},maxTokens:8000,signal:new AbortController().signal};
test('Anthropic tool adapter preserves structured content, caching, forced tool, output cap and effort without thinking budget',async()=>{
 requests=[];rejectTemperature=false;const events=[];for await(const e of streamToolCompletion(params))events.push(e);
 assert.equal(events.at(-1).content[0].name,'submit_brief');assert.equal(events.find(e=>e.type==='token').text,'{"claims":');
 const req=requests[0];assert.deepEqual(req.params.messages,params.messages);assert.deepEqual(req.params.system,params.system);assert.deepEqual(req.params.tool_choice,params.tool_choice);
 assert.equal(req.params.max_tokens,8000);assert.equal(req.params.temperature,0.2);assert.equal(req.params.output_config.effort,'medium');assert.equal(req.params.thinking,undefined);assert.equal(req.opts.maxRetries,0);
});
test('temperature rejection retries once without temperature and keeps medium effort',async()=>{
 requests=[];rejectTemperature=true;const events=[];for await(const e of streamToolCompletion(params))events.push(e);
 assert.equal(requests.length,2);assert.equal(requests[1].params.temperature,undefined);assert.equal(requests[1].params.output_config.effort,'medium');assert.equal(events.at(-1).type,'done');
});
