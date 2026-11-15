// In-app chat alerts. Text stays text; no HTML from network messages is evaluated.
export function incomingMessages(previous,current){
 if(!previous)return [];
 const known=new Set(previous.filter(m=>!m.mine).map(m=>m.id));
 return current.filter(m=>!m.mine&&!known.has(m.id));
}
export function createChatNotices({doc=globalThis.document,win=globalThis.window,onSound=()=>{},onOpen=()=>{},onUnread=()=>{}}={}){
 const region=doc.createElement('section');region.id='chatNotices';region.setAttribute('aria-live','polite');region.setAttribute('aria-label','Новые сообщения');doc.body.append(region);
 const unread=new Map(),timers=new Set();let lastSound=-Infinity;
 const key=(scope,senderId)=>scope==='p2p'?'p2p:'+senderId:'match';
 const totals=()=>({match:unread.get('match')||0,p2p:[...unread].filter(([k])=>k.startsWith('p2p:')).reduce((n,[,v])=>n+v,0)});
 const publish=()=>onUnread(totals());
 function markRead(scope,senderId){if(scope==='p2p'&&!senderId){for(const k of unread.keys())if(k.startsWith('p2p:'))unread.delete(k);}else unread.delete(key(scope,senderId));publish();}
 function notify({scope='match',senderId='',name='',text='',mine=false,visible=false}){
  if(mine||!String(text).trim())return;
  if(visible&&!doc.hidden&&doc.hasFocus()){markRead(scope,senderId);return;}
  const k=key(scope,senderId);unread.set(k,Math.min(999,(unread.get(k)||0)+1));publish();
  const button=doc.createElement('button');button.className='chatNotice';button.type='button';
  const title=doc.createElement('b'),body=doc.createElement('span');title.textContent=(scope==='p2p'?'P2P · ':'Чат матча · ')+String(name).slice(0,40);body.textContent=String(text).slice(0,180);button.append(title,body);
  button.onclick=()=>{markRead(scope,senderId);button.remove();onOpen(scope,senderId);};
  region.append(button);while(region.children.length>3)region.firstChild.remove();
  const timer=win.setTimeout(()=>{button.remove();timers.delete(timer);},6500);timers.add(timer);
  const now=Date.now();if(now-lastSound>=700){lastSound=now;onSound();}
 }
 return {notify,markRead,get unread(){return totals();},destroy(){for(const t of timers)win.clearTimeout(t);timers.clear();region.remove();unread.clear();}};
}
