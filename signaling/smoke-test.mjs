import { spawn } from 'node:child_process'
import WebSocket from 'ws'
import { setTimeout as delay } from 'node:timers/promises'
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('../signaling/',import.meta.url),env:{...process.env,PORT:'31991'},stdio:'ignore'})
const connect=()=>new Promise((resolve,reject)=>{const ws=new WebSocket('ws://127.0.0.1:31991');ws.once('open',()=>resolve(ws));ws.once('error',reject)})
const message=ws=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('message timeout')),2000);ws.once('message',data=>{clearTimeout(timer);resolve(JSON.parse(data))})})
try{
 await delay(700)
 const a=await connect();a.send(JSON.stringify({type:'join',roomId:'testroom123456'}));const first=await message(a);if(first.type!=='joined')throw Error('first join failed')
 const b=await connect();b.send(JSON.stringify({type:'join',roomId:'testroom123456'}));const second=await message(b);if(second.type!=='joined')throw Error('second join failed')
 const joined=await message(a);if(joined.type!=='peer-joined')throw Error('peer event missing')
 const c=await connect();c.send(JSON.stringify({type:'join',roomId:'testroom123456'}));const full=await message(c);if(full.code!=='ROOM_FULL')throw Error('room capacity failed')
 b.send(JSON.stringify({type:'offer',data:{type:'offer',sdp:'test'}}));const offer=await message(a);if(offer.type!=='offer')throw Error('offer relay failed')
 a.close();b.close();c.close()
 console.log('PASS: two joins, peer notification, third peer rejected, SDP relay')
}catch(e){console.error('FAIL',e);process.exitCode=1}finally{server.kill()}
