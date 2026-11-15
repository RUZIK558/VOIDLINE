import {QUICK_COMMANDS,TACTICAL_TTL} from './tactical.mjs';
export function createTacticalHUD({getTime=()=>Date.now(),onSound=()=>{}}={}){
 const layer=document.createElement('div');layer.id='tacticalMarkers';layer.setAttribute('aria-hidden','true');
 const feed=document.createElement('section');feed.id='tacticalFeed';feed.setAttribute('aria-live','polite');feed.setAttribute('aria-label','Команды союзников');
 const wheel=document.createElement('section');wheel.id='tacticalWheel';wheel.hidden=true;wheel.setAttribute('role','group');wheel.setAttribute('aria-label','Быстрые команды союзникам');
 const panel=document.createElement('div');panel.className='tacticalDial';
 const center=document.createElement('div');center.className='tacticalCenter';center.textContent='СОЮЗНИКАМ';panel.append(center);
 const buttons=QUICK_COMMANDS.map((c,i)=>{const b=document.createElement('div');b.className='tacticalChoice';b.dataset.index=i;b.textContent=(i+1)+' · '+c.text;const angle=i*Math.PI/3;b.style.left=`calc(50% + ${Math.sin(angle)*164}px)`;b.style.top=`calc(50% - ${Math.cos(angle)*116}px)`;panel.append(b);return b;});
 const cursor=document.createElement('i');cursor.className='tacticalCursor';panel.append(cursor);
 const help=document.createElement('p');help.className='tacticalHelp';help.textContent='Мышь или 1–6 · отпусти V для отправки · центр / Esc — отмена';wheel.append(panel,help);document.body.append(layer,feed,wheel);
 const elements=new Map(),seen=new Set();let markers=[],messages=[],team=null;
 function line(name,text,quiet=false){const row=document.createElement('p');row.className=quiet?'tacticalError':'';const b=document.createElement('b');b.textContent=name?name+' · ':'';row.append(b,document.createTextNode(text));feed.append(row);messages.push({row,until:getTime()+3200});while(messages.length>2)messages.shift().row.remove();}
 function reset(){markers=[];for(const el of elements.values())el.remove();elements.clear();for(const m of messages)m.row.remove();messages=[];seen.clear();team=null;}
 return {
  receive(packet,mine){if(packet.reset)reset();if(team!==null&&team!==packet.team)reset();team=packet.team;markers=(packet.markers||[]).filter(m=>m.team===team&&m.until>getTime());const e=packet.event;if(e&&!seen.has(e.id)){seen.add(e.id);if(seen.size>128)seen.delete(seen.values().next().value);if(e.kind!=='ping')line(e.name,e.text);onSound(e.senderId===mine);}},
  error(text){line('',text,true);},reset,
  setTeam(value){if(team!==null&&team!==value)reset();team=value;},
  show(key='V'){wheel.hidden=false;center.textContent='×';help.textContent=`Отпусти ${key} — отправить · Esc — отмена`;this.select(null,0,0);},
  hide(){wheel.hidden=true;},
  select(index,x,y){buttons.forEach((b,i)=>{b.classList.toggle('selected',i===index);b.setAttribute('aria-current',i===index?'true':'false');});cursor.style.transform=`translate(${x}px,${y}px)`;center.textContent=index===null?'×':QUICK_COMMANDS[index].short;},
  update(project,eye,visible=true){const now=getTime();markers=markers.filter(m=>m.until>now);const ids=new Set(markers.map(m=>m.id));for(const[id,el]of elements)if(!ids.has(id)){el.remove();elements.delete(id);}
   for(const m of markers){let el=elements.get(m.id);if(!el){el=document.createElement('div');el.className='tacticalMarker';el.dataset.id=m.id;const icon=document.createElement('i');icon.textContent=m.command==='go_a'?'A':m.command==='go_b'?'B':m.command==='follow'?'›':m.command==='mid'?'•':'•';const label=document.createElement('span');el.append(icon,label);elements.set(m.id,el);layer.append(el);}
    const p=project(m.pos);el.hidden=!visible||!p||p.z<0||p.z>1||p.x<0||p.x>innerWidth||p.y<0||p.y>innerHeight;
    if(!el.hidden){el.style.left=Math.max(22,Math.min(innerWidth-22,p.x))+'px';el.style.top=Math.max(44,Math.min(innerHeight-20,p.y))+'px';const nearAim=Math.hypot(p.x-innerWidth/2,p.y-innerHeight/2)<34;el.style.opacity=String(Math.min(nearAim?.45:1,(m.until-now)/900));const d=Math.round(Math.hypot(m.pos.x-eye.x,m.pos.y-eye.y,m.pos.z-eye.z)),h=m.pos.y-eye.y;el.lastChild.textContent=`${d} м${h>1.5?' ↑':h< -2?' ↓':''}`;}
   }
   messages=messages.filter(m=>{if(m.until<=now){m.row.remove();return false;}return true;});layer.hidden=!visible;feed.hidden=!visible;
  },
  radar(ctx,scale){const now=getTime();for(const m of markers)if(m.until>now){const x=90+m.pos.x*scale,y=107+m.pos.z*scale;ctx.strokeStyle='#a4e5d9';ctx.fillStyle='#142b32';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x+4,y);ctx.lineTo(x,y+4);ctx.lineTo(x-4,y);ctx.closePath();ctx.fill();ctx.stroke();}},
  diagnostics(){return {markers:markers.map(m=>({...m})),messages:messages.length,open:!wheel.hidden};}
 };
}
