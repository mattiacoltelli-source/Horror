import sys, numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
src=sys.argv[1]; outd=sys.argv[2]
import os; os.makedirs(outd,exist_ok=True)
im=Image.open(src).convert('RGB'); a=np.asarray(im).astype(float); H,W=a.shape[:2]
red=a[:,:,0]-(a[:,:,1]+a[:,:,2])/2; lum=a.mean(2)
alpha=np.clip(np.maximum((red-12)/45,(215-lum)/70),0,1)
bin_=alpha>0.35
lab,n=ndi.label(ndi.binary_dilation(bin_,iterations=2))
objs=ndi.find_objects(lab)
cell=W/7; rh=H/7
comps=[]
for i,sl in enumerate(objs):
    area=int(((lab[sl]==i+1)&bin_[sl]).sum())
    if area<25: continue
    comps.append(dict(sl=sl,area=area,lab=i+1,cx=(sl[1].start+sl[1].stop)/2,cy=(sl[0].start+sl[0].stop)/2))
big=[c for c in comps if c['area']>=700]
for c in comps: c['cell']=(int(min(6,c['cy']//rh)),int(min(6,c['cx']//cell)))
def gap(c,b):
    y0,y1=c['sl'][0].start,c['sl'][0].stop; by0,by1=b['sl'][0].start,b['sl'][0].stop
    x0,x1=c['sl'][1].start,c['sl'][1].stop; bx0,bx1=b['sl'][1].start,b['sl'][1].stop
    dy=max(0,by0-y1,y0-by1); dx=max(0,bx0-x1,x0-bx1); return (dx*dx+dy*dy)**.5
groups={}
for c in big: groups.setdefault(c['cell'],[]).append(c)
for c in comps:
    if c in big: continue
    groups.setdefault(c['cell'],[]).append(c)
LAB=list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")+['À','È','É','Ì','Ò','Ù',"'",',','.','?','!','-',':']+list("0123456789")
pos=[(r,c) for r in range(7) for c in range(7)]
print('mancanti',[p for p in pos if p not in groups])
meta={}
for k,p in enumerate(pos):
    if p not in groups: continue
    g=groups[p]
    y0=max(0,min(c['sl'][0].start for c in g)-2); y1=min(H,max(c['sl'][0].stop for c in g)+2)
    x0=max(0,min(c['sl'][1].start for c in g)-2); x1=min(W,max(c['sl'][1].stop for c in g)+2)
    keep=np.zeros(bin_.shape,bool)
    for c in g: keep[c['sl']]|=(lab[c['sl']]==c['lab'])
    keep=ndi.binary_dilation(keep,iterations=3)[y0:y1,x0:x1]
    al=alpha[y0:y1,x0:x1]*keep
    l=a[y0:y1,x0:x1].mean(2)/255
    col=np.stack([0.50+0.55*l,0.03+0.10*l,0.035+0.10*l],2)*255
    Image.fromarray(np.dstack([col,al*255]).astype('uint8'),'RGBA').save(f'{outd}/{k:02d}.png')
    meta[LAB[k]]={'i':k,'w':int(x1-x0),'h':int(y1-y0)}
json.dump(meta,open(f'{outd}/meta.json','w'),ensure_ascii=False)
