from PIL import Image, ImageFilter
import numpy as np, os, sys
from scipy import ndimage as ndi
SAT,TANMIX,FADE,THR0,SPECK,STR0=[float(x) for x in sys.argv[1:7]]
rng=np.random.default_rng(55)
W=1600; im=Image.open('door_raw.png').convert('RGB'); h=round(im.height*W/im.width)
im=im.resize((W,h),Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.4,45,2))
a=np.asarray(im).astype(float); g=a.mean(2,keepdims=True); a=g+(a-g)*SAT
tan=np.array([150.,136.,118.])
def nz(s,sy=None): n=ndi.gaussian_filter(rng.random((h,W)),(sy or s,s)); return (n-n.mean())/n.std()
a=a*(1-TANMIX)+tan*TANMIX*0.62; a=a*np.array([0.9,0.88,0.86])+8
fade=np.clip(0.5+0.5*nz(W/8),0,1)**1.1*FADE; a=a*(1-fade[...,None])+tan*0.55*fade[...,None]
a+=ndi.gaussian_filter(rng.normal(0,1,(h,W)),0.9)[...,None]*13
yy,xx=np.mgrid[0:h,0:W].astype(float)
u=(xx-W/2)/(W/2); v=(yy-h/2)/(h/2); v=np.where(v>0,v*0.3,v)
s=(np.abs(u)**3.2+np.abs(v)**3.2)**(1/3.2); e=1-s
e=e+nz(W/7)*0.085+nz(W/22)*0.05+nz(W/70)*0.022+nz(W/220)*0.008
t=np.clip(e/0.20,0,1); alpha=t*t*(3-2*t)
peel=(nz(W/34)+nz(W/140)*0.5)>(THR0+np.clip(e/0.25,0,1)*0.9); peel=ndi.binary_dilation(peel,iterations=1)
speck=(nz(W/120)>SPECK)|(nz(W/60)>SPECK+0.35)
streak=nz(W/450,W/14)>(STR0+(1-np.clip((yy/h-0.3)/0.7,0,1))*2.0)
alpha=alpha*(1-0.93*ndi.gaussian_filter(peel.astype(float),1.2))*(1-0.75*ndi.gaussian_filter(speck.astype(float),0.8))*(1-0.85*ndi.gaussian_filter(streak.astype(float),1.0))
alpha*=0.85+0.15*np.clip(1-fade*1.2,0,1)
k=W/8.0; hole=(np.abs(xx-W/2)<1.02*k)&(yy>h-2.55*k); alpha[hole]=0
a*=(0.8+0.2*np.clip(alpha*1.3,0,1))[...,None]
o=Image.fromarray(np.dstack([np.clip(a,0,255).astype(np.uint8),(np.clip(alpha,0,1)*255).astype(np.uint8)]),'RGBA')
out='/home/user/Horror/assets/tex/pic_mural_door.webp'; o.save(out,quality=74,method=6); print(o.size,os.path.getsize(out)//1024,'KB')
bg=Image.new('RGB',o.size,(70,50,40)); bg.paste(o,(0,0),o); bg.resize((800,round(800*h/W))).save('door_preview.png')
