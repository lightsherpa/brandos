import test from 'node:test';
import assert from 'node:assert/strict';
import {groupedDeliveryGraph} from './grouped-delivery-canvas.js';
import {deliveryCopy} from '../locales/grouped-deliverables-copy.js';

test('Granada keeps Brand Core → Brief → three deliverables → Delivery as connected draggable nodes',()=>{
 const pieces=['social_post','email','hero_kv'].map(type=>({id:`${type}-1`,type}));
 const graph=groupedDeliveryGraph({title:'Granada, primera rebanada'},pieces,deliveryCopy('en'));
 assert.equal(graph.nodes.filter(node=>node.piece).length,3);
 assert.deepEqual(graph.nodes.map(node=>node.id),['bio','brief','social_post-1','email-1','hero_kv-1','delivery']);
 assert.deepEqual(graph.edges.map(edge=>[edge.from,edge.to]),[['bio','brief'],...pieces.flatMap(piece=>[['brief',piece.id],[piece.id,'delivery']])]);
 assert.ok(graph.nodes.every(node=>Number.isFinite(node.x)&&Number.isFinite(node.y)&&node.w>0));
 assert.ok(graph.nodes.filter(node=>node.piece).every(node=>node.x>graph.nodes[1].x));
 const updated=groupedDeliveryGraph({title:'Granada, primera rebanada'},pieces.map(piece=>({...piece,status:'delivered'})),deliveryCopy('es'));
 assert.deepEqual(updated.nodes.map(node=>node.id),graph.nodes.map(node=>node.id),'polling and localization preserve node identity');
});
