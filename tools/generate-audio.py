#!/usr/bin/env python3
"""Original deterministic VOIDLINE sound effects. No third-party recordings.
Rebuild: python3 tools/generate-audio.py. 44.1kHz, mono, 16-bit PCM.
"""
from pathlib import Path
import math, random, wave, struct, json
SR=44100
OUT=Path(__file__).resolve().parents[1]/'public/assets/audio'
OUT.mkdir(parents=True,exist_ok=True)
manifest={}
def save(name,seconds,fn):
 rng=random.Random('VOIDLINE-1.1-'+name); data=[fn(i/SR,rng) for i in range(round(seconds*SR))]
 peak=max(abs(v) for v in data) or 1;scale=.82/peak
 pcm=struct.pack('<'+'h'*len(data),*(round(max(-1,min(1,v*scale))*32767) for v in data))
 with wave.open(str(OUT/(name+'.wav')),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm)
 manifest[name]={'file':name+'.wav','seconds':len(data)/SR,'bytes':len(pcm)+44}
def pulse(t,start,freq,duration,noise,rng):
 u=t-start
 if u<0 or u>duration:return 0
 e=min(1,u/.002)*math.exp(-u/(duration/5))
 return e*((1-noise)*math.sin(2*math.pi*freq*u)+noise*rng.uniform(-1,1))
guns={'rifle':(115,.24,.62),'ak47':(82,.34,.72),'m4a1s':(175,.19,.26),'awp':(54,.65,.8),'ssg08':(92,.43,.61),'mp9':(205,.16,.65),'p90':(245,.17,.7),'pistol':(240,.16,.22),'glock':(185,.2,.65),'deagle':(73,.42,.72)}
for name,(freq,decay,noise) in guns.items():
 def shot(t,r,f=freq,d=decay,n=noise):
  return pulse(t,0,f,d,n,r)+.55*pulse(t,.001,f*.64,d,.12,r)+.24*pulse(t,.048,f*1.8,d*.65,.8,r)+.09*pulse(t,.105,f,d*.7,.8,r)
 save('shot-'+name,decay+.16,shot)
for surf,f,n in [('stone',140,.8),('metal',420,.4),('sand',95,.95),('snow',270,.93)]:
 for v in range(3):
  def step(t,r,f=f,n=n,v=v):
   return pulse(t,0,f*(1+v*.08),.13,n,r)+.5*pulse(t,.035,65,.17,.2,r)+(.2*pulse(t,.075,f*2.7,.12,.35,r) if surf=='metal' else 0)
  save('step-'+surf+'-'+str(v),.23,step)
for group,f in [('rifle',390),('pistol',630),('sniper',240)]:
 def reload(t,r,f=f):
  return sum(pulse(t,a,f*k,d,n,r)*amp for a,k,d,n,amp in [(0,1,.1,.5,.5),(.19,.6,.18,.7,.6),(.62,1.4,.12,.6,1),(.83,.8,.15,.45,.7)])
 save('reload-'+group,1.05,reload)
for name,notes in {
 'round':[(0,330),(.13,440),(.26,660)],'live':[(0,550),(.12,825)],'win':[(0,440),(.18,554),(.36,659),(.54,880)],
 'loss':[(0,330),(.22,294),(.44,220)],'plant':[(0,740),(.13,930),(.26,740)],'defuse':[(0,880),(.15,660),(.3,990)],
 'chat':[(0,790),(.11,1050)],'buy':[(0,660),(.07,990)],'beep':[(0,1500)],'hit':[(0,1150)],'scope':[(0,410)]
}.items():
 save(name,max(a for a,f in notes)+.28,lambda t,r,notes=notes:sum(pulse(t,a,f,.23,.015,r) for a,f in notes))
for name,d,f,n in [('explosion',1.3,45,.85),('flash',.5,1700,.85),('hiss',.9,1400,.99),('throw',.19,260,.85),('bounce',.18,640,.45),('knife',.22,380,.95),('hurt',.22,80,.35),('equip',.27,560,.65),('land',.27,75,.6),('jump',.13,160,.85),('dry',.1,950,.25)]:
 save(name,d,lambda t,r,d=d,f=f,n=n:pulse(t,0,f,d,n,r)+.2*pulse(t,.035,f*.53,d*.65,.4,r))
(OUT/'manifest.json').write_text(json.dumps({'license':'CC0-1.0; original synthesis, no third-party recordings','sampleRate':SR,'sounds':manifest},indent=2)+'\n')
(OUT/'LICENSE.txt').write_text('VOIDLINE original synthesized sound effects\nGenerated with tools/generate-audio.py; no third-party samples.\nDedicated to the public domain under CC0 1.0.\nhttps://creativecommons.org/publicdomain/zero/1.0/\n')
print('Generated',len(manifest),'original WAV sounds;',sum(v['bytes'] for v in manifest.values()),'bytes')
