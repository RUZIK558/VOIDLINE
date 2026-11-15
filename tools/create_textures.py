from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
import random,math
p=Path(__file__).resolve().parent.parent/'public'/'assets';p.mkdir(exist_ok=True)
r=random.Random(606); n=1024
im=Image.new('RGB',(n,n)); pix=im.load(); rough=Image.new('L',(n,n)); rp=rough.load(); height=Image.new('L',(n,n));hp=height.load()
colors=[(70,79,66),(91,103,86),(39,47,46),(127,112,86),(54,64,59),(84,96,89),(27,34,35),(157,143,115),(47,59,62),(82,99,104),(51,62,64),(135,144,143),(92,97,87),(118,124,111),(35,43,42),(162,150,122)]
for y in range(n):
 for x in range(n):
  k=(y//256)*4+x//256; c=colors[k];noise=r.uniform(-4,4);weave=((x%4==0)-(y%4==0))*3
  v=int(noise+weave);pix[x,y]=tuple(max(0,min(255,a+v))for a in c);rp[x,y]=int(195+r.uniform(-12,12));hp[x,y]=int(128+weave*3+noise)
d=ImageDraw.Draw(im);hd=ImageDraw.Draw(height)
for row in range(4):
 for col in range(4):
  x=col*256;y=row*256
  for inset in [9,15]:
   d.rounded_rectangle((x+inset,y+inset,x+256-inset,y+256-inset),radius=18,outline=tuple(min(255,a+15)for a in colors[row*4+col]),width=2)
  for yy in range(y+22,y+235,9):
   d.line((x+12,yy,x+12,yy+4),fill=(155,152,127),width=1);hd.line((x+12,yy,x+12,yy+4),fill=156,width=1)
  if row in [0,1]:
   d.rounded_rectangle((x+82,y+93,x+174,y+162),radius=7,fill=tuple(max(0,a-7) for a in colors[row*4+col]),outline=(101,112,98),width=2)
   for j in range(5):d.line((x+90,y+107+j*10,x+166,y+107+j*10),fill=(46,56,49),width=2)
im.save(p/'operator-albedo.png');rough.save(p/'operator-roughness.png')
height=height.filter(ImageFilter.GaussianBlur(.6));h=height.load();normal=Image.new('RGB',(n,n));np=normal.load()
for y in range(n):
 for x in range(n):
  dx=(h[(x+1)%n,y]-h[(x-1)%n,y])/255;dy=(h[x,(y+1)%n]-h[x,(y-1)%n])/255;z=1/math.sqrt(dx*dx+dy*dy+1);np[x,y]=(int(128-dx*z*127),int(128+dy*z*127),int(128+z*127))
normal.save(p/'operator-normal.png')
print('Authored 1024px atlas: albedo, roughness, tangent-space normal')
