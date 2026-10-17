import {Hono} from 'hono';
import {requireAuth} from '../middleware/auth.js';
import {requireHumanActor} from '../middleware/human-actor.js';
import {supabaseAdmin} from '../lib/supabase.js';
import {brandBookGuidelinesEnabled,createBrandBookService,buildBookZip} from '../lib/brand-book-service.js';
const render=async props=>(await import('../../../shared/brand-book/render.js')).renderGuidelines(props);
export function createBrandBookRoutes({db=supabaseAdmin,auth=requireAuth,human=requireHumanActor,enabled=brandBookGuidelinesEnabled,service=createBrandBookService({db,renderGuidelines:render})}={}){
 const app=new Hono();
 app.use('*',async(c,next)=>{if(!enabled())return c.json({error:'Not found'},404);c.header('Cache-Control','no-store');c.header('Referrer-Policy','no-referrer');c.header('X-Content-Type-Options','nosniff');return next();});
 const errorResponse=(c,error)=>c.json({code:error.code||'BOOK_UNAVAILABLE',error:error.code?error.message:'Brand Book is temporarily unavailable.'},error.status||503);
 const wrap=handler=>async c=>{try{return await handler(c);}catch(error){return errorResponse(c,error);}};
 app.get('/shared/:token/assets/:name',wrap(async c=>{const asset=await service.sharedAsset(c.req.param('token'),c.req.param('name'));c.header('Content-Security-Policy',"default-src 'none'; sandbox");return c.body(new Uint8Array(asset.bytes),200,{'Content-Type':asset.mime});}));
 app.get('/shared/:token',async c=>{c.header('Content-Security-Policy',"default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");try{return c.html(await service.sharedHTML(c.req.param('token')));}catch(error){
  const locale=/^es\b/i.test(c.req.header('Accept-Language')||'')?'es':/^ar\b/i.test(c.req.header('Accept-Language')||'')?'ar':'en';
  const copy={en:['Brand Book unavailable','This link has expired, was revoked, or is temporarily unavailable. Ask the brand owner for a new link.'],es:['Brand Book no disponible','El enlace ha caducado, se ha revocado o no está disponible temporalmente. Solicita uno nuevo al responsable de marca.'],ar:['Brand Book غير متاح','انتهت صلاحية الرابط أو ألغي أو أنه غير متاح مؤقتاً. اطلب رابطاً جديداً من مسؤول العلامة.']}[locale];
  return c.html(`<!doctype html><html lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy[0]}</title><style>body{margin:0;background:#faf9f5;color:#252525;font:18px/1.6 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}main{padding:40px;max-width:580px}h1{font-size:36px;line-height:1.15}</style></head><body><main><p>Brand Book</p><h1>${copy[0]}</h1><p>${copy[1]}</p></main></body></html>`,error.status||503);
 }});
 app.get('/:brandId/export',auth,wrap(async c=>{const {files,filename}=await service.packageExport(c.get('auth'),c.req.param('brandId'),c.req.query('version'),c.req.query());return c.body(new Uint8Array(buildBookZip(files)),200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${filename}"`});}));
 app.get('/:brandId/shares',auth,wrap(async c=>c.json(await service.shares(c.get('auth'),c.req.param('brandId')))));
 app.post('/:brandId/shares',auth,human,wrap(async c=>{const body=await c.req.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body))return c.json({error:'Invalid share request'},400);return c.json(await service.createShare(c.get('auth'),c.req.param('brandId'),body),201);}));
 app.delete('/:brandId/shares/:shareId',auth,human,wrap(async c=>c.json(await service.revokeShare(c.get('auth'),c.req.param('brandId'),c.req.param('shareId')))));
 app.get('/:brandId',auth,wrap(async c=>c.json(await service.snapshot(c.get('auth'),c.req.param('brandId'),c.req.query('version')))));
 return app;
}
export default createBrandBookRoutes;
