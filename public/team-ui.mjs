import {getMap} from './maps.mjs';
export function createTeamUI(onChoose,onCancel){
 const el=document.createElement('div');el.id='teamDialog';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','teamTitle');
 el.innerHTML='<section><span class="eyebrow">JOIN OPERATION / ВХОД В МАТЧ</span><h2 id="teamTitle">ВЫБЕРИ КОМАНДУ</h2><p id="teamMap"></p><div class="teamCards"><button data-team="CT"><strong>КТ</strong><span>ЗАЩИТА</span><small></small><p>Не дай установить бомбу.<br>Разминируй заряд на A / B.</p></button><button data-team="T"><strong>Т</strong><span>АТАКА</span><small></small><p>Займи одну из точек.<br>Установи и защити заряд.</p></button></div><div class="teamActions"><button data-team="auto">АВТОБАЛАНС</button><button id="teamCancel" class="secondary">НАЗАД</button></div><p id="teamMessage" role="status">Сторона выбирается перед входом на сервер.</p></section>';
 document.body.append(el);
 for(const b of el.querySelectorAll('[data-team]'))b.onclick=()=>{for(const x of el.querySelectorAll('button'))x.disabled=true;document.getElementById('teamMessage').textContent='Входим в матч…';onChoose(b.dataset.team);};
 document.getElementById('teamCancel').onclick=onCancel;
 el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();onCancel();}if(e.key==='Tab'){const fields=[...el.querySelectorAll('button:not(:disabled)')],first=fields[0],last=fields.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 return {hide(){el.hidden=true;},isOpen:()=>!el.hidden,show(info,preferred='auto'){
 el.hidden=false;for(const x of el.querySelectorAll('button'))x.disabled=false;
 document.getElementById('teamMap').textContent=getMap(info.mapId).name+' · '+(info.mode==='events'?'Рандомные ивенты':'Классический матч')+' · до 5 × 5';
 for(const b of el.querySelectorAll('.teamCards button')){const c=info.sides[b.dataset.team];b.disabled=c.humans>=5;b.querySelector('small').textContent=c.humans+'/5 игроков · '+c.bots+' ботов'+(b.disabled?' · ЗАПОЛНЕНО':'');}
 document.getElementById('teamMessage').textContent='Боты освобождают место игрокам. Во время боя — вход со следующего раунда.';
 const focus=el.querySelector(`[data-team="${['CT','T'].includes(preferred)?preferred:'auto'}"]`);(focus.disabled?document.getElementById('teamCancel'):focus).focus();
 }};
}
