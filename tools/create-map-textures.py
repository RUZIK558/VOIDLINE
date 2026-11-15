from PIL import Image,ImageFilter,ImageDraw
import random,math
from pathlib import Path
R=Path(__file__).resolve().parents[1]/'public/assets';N=1024;random.seed(719)
# Periodic multiscale mineral variation with subtle pores and plaster cracks.
base=Image.new('L',(N,N),128)
for scale,amp in [(16,24),(64,16),(256,12),(1024,13)]:
 noise=Image.frombytes('L',(scale,scale),bytes(random.randint(0,255) for _ in range(scale*scale))).resize((N,N),Image.Resampling.BICUBIC)
 import PIL.ImageChops
 base=PIL.ImageChops.add(base,noise,scale=1,offset=-128).point(lambda x:max(0,min(255,x))) if False else base
 # blend rather than accumulating clipping
 base=Image.blend(base,noise,amp/70)
h=base.copy();d=ImageDraw.Draw(h)
for i in range(24):
 x,y=random.randrange(N),random.randrange(N)
 pts=[(x,y)]
 for j in range(random.randint(2,6)):
  x+=random.randint(-28,28);y+=random.randint(5,35);pts.append((x,y))
 d.line(pts,fill=65,width=1)
pix=h.load();out=Image.new('RGB',(N,N));o=out.load();normal=Image.new('RGB',(N,N));nn=normal.load();rough=Image.new('L',(N,N));rr=rough.load()
for y in range(N):
 for x in range(N):
  v=pix[x,y]-128;o[x,y]=(max(0,min(255,195+int(v*.6))),max(0,min(255,178+int(v*.65))),max(0,min(255,143+int(v*.7))))
  dx=(pix[(x+1)%N,y]-pix[(x-1)%N,y])*.65;dy=(pix[x,(y+1)%N]-pix[x,(y-1)%N])*.65;l=math.sqrt(dx*dx+dy*dy+64*64)
  nn[x,y]=(int(127-dx/l*127),int(127+dy/l*127),int(127+64/l*127));rr[x,y]=max(170,min(245,211+int(v*.5)))
out.save(R/'plaster-albedo.jpg',quality=93);normal.save(R/'plaster-normal.png');rough.save(R/'plaster-roughness.png')
print('1024px plaster albedo / tangent normal / roughness generated')
