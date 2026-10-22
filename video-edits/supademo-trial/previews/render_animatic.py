import subprocess, os, sys
S=sys.argv[1]; RAW=sys.argv[2]; OUT=sys.argv[3]
W,H=1280,720; K=W/1920
B="/usr/share/fonts/opentype/inter/Inter-Bold.otf"; SB="/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
MAG="0xD6248F"; DARK="0x18222B"; INK="0x0C111D"
SEG=[(13.60,25.62,0.00,50),(25.62,30.40,12.02,56),(30.92,42.55,16.80,50),(64.10,64.62,28.43,57),(64.98,74.98,28.95,52),(74.98,85.10,38.95,50)]
def M(r):
    for a,b,t,s in reversed(SEG):
        if r>=a-1e-3: return t+r-a
FX,FY=1760/3,900/3   # face in 1280 space
tid=[0]
def tf(s):
    tid[0]+=1; p=f"{S}/anim/txt/t{tid[0]}.txt"; open(p,"w").write(s); return p
def dt(text,x,y,size,color="white",font=B,en=None,extra=""):
    e=f":enable='between(t,{en[0]:.2f},{en[1]:.2f})'" if en else ""
    return f"drawtext=fontfile={font}:textfile={tf(text)}:x={x}:y={y}:fontsize={size*K:.0f}:fontcolor={color}{extra}{e}"
def box(x,y,w,h,color,en=None):
    e=f":enable='between(t,{en[0]:.2f},{en[1]:.2f})'" if en else ""
    return f"drawbox=x={x*K:.0f}:y={y*K:.0f}:w={w*K:.0f}:h={h*K:.0f}:color={color}:t=fill{e}"
inputs=[]; fc=[]
from PIL import Image, ImageDraw, ImageFont, ImageFilter
pngs=[]
def png(img,en,name):
    p=f"{S}/anim/txt/{name}.png"; img.save(p); pngs.append((p,en))
def rr(d,box,r,fill): d.rounded_rectangle(box,r,fill=fill)
def badge_img(w,h,label,fs):
    pad=60; im=Image.new("RGBA",(int(w*K)+2*pad,int(h*K)+2*pad),(0,0,0,0)); g=Image.new("RGBA",im.size,(0,0,0,0))
    rr(ImageDraw.Draw(g),(pad,pad,pad+w*K,pad+h*K),int(28*K),(214,36,143,170)); g=g.filter(ImageFilter.GaussianBlur(18))
    im=Image.alpha_composite(im,g); d=ImageDraw.Draw(im); rr(d,(pad,pad,pad+w*K,pad+h*K),int(28*K),(214,36,143,255))
    f=ImageFont.truetype(B,int(fs*K)); d.text((im.size[0]/2,im.size[1]/2),label,font=f,fill="white",anchor="mm"); return im,pad
def badge(x,y,w,h,label,fs,en,name):
    im,pad=badge_img(w,h,label,fs); png(im,en,name); pngs[-1]=pngs[-1]+(int(x*K-im.size[0]/2),int(y*K-im.size[1]/2))
def caption(text,hl,en,name):
    f=ImageFont.truetype(B,int(62*K)); words=text.split(); sp=f.getlength(" ")
    tw=sum(f.getlength(w) for w in words)+sp*(len(words)-1); im=Image.new("RGBA",(W,int(140*K)),(0,0,0,0))
    sh=Image.new("RGBA",im.size,(0,0,0,0)); ds=ImageDraw.Draw(sh); d=ImageDraw.Draw(im); x=(W-tw)/2; y=im.size[1]/2
    for i,w in enumerate(words):
        col=(214,36,143) if any(a<=i<=b for a,b in hl) else (255,255,255)
        ds.text((x+2,y+4),w,font=f,fill=(0,0,0,190),anchor="lm"); d.text((x,y),w,font=f,fill=col,anchor="lm"); x+=f.getlength(w)+sp
    out=Image.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)),im); png(out,en,name); pngs[-1]=pngs[-1]+(0,int(870*K-im.size[1]/2))
for i,(a,b,t,s) in enumerate(SEG):
    inputs+=["-ss",f"{a:.3f}","-t",f"{b-a:.3f}","-i",RAW]
    z=s/50; sw,sh=round(W*z/2)*2,round(H*z/2)*2
    fc.append(f"[{i}:v]fps=30,scale={sw}:{sh},crop={W}:{H}:{FX*z-FX:.0f}:{FY*z-FY:.0f},setsar=1[v{i}];[{i}:a]aresample=48000,afade=t=in:d=0.04,afade=t=out:st={b-a-0.05:.3f}:d=0.05[a{i}]")
fc.append("".join(f"[v{i}][a{i}]" for i in range(len(SEG)))+f"concat=n={len(SEG)}:v=1:a=1[base][aud]")
# grade + vignette on A-roll
fc.append("[base]eq=brightness=-0.02:saturation=1.05,colorbalance=rm=0.03:bm=-0.03,vignette=angle=0.55[ar]")
cur="ar"; n=0
def ov(src_chain, en, x=0, y=0):
    global cur,n
    n+=1; fc.append(f"{src_chain}[g{n}]"); fc.append(f"[{cur}][g{n}]overlay={x}:{y}:enable='between(t,{en[0]:.2f},{en[1]:.2f})'[o{n}]"); cur=f"o{n}"
def card(bg,dur,grid=False):
    c=f"color=c={bg}:s={W}x{H}:r=30:d={dur}"
    if grid: c+=f",drawgrid=w={96*K:.0f}:h={96*K:.0f}:t=1:c=0xE6E6EC,vignette=angle=0.9"
    else: c+=",vignette=angle=0.8"
    return c
# GFX01 logos
t0,t1=M(16.54),M(23.34)
ch=card("white",49.5,True)
ch+=","+dt("We studied 1,000+ SaaS product demos","(w-tw)/2",f"{150*K:.0f}",74,INK)
import random; random.seed(7)
dots=[(x,340) for x in [260,596,924,1098,1436,1660]]+[(x,512) for x in [426,766,930,1266,1520]]+[(x,684) for x in [250,594,1096,1350,1600]]
for x,y in dots: ch+=","+box(x-8,y-8,16,16,"0x252B37" if random.random()>0.3 else "0x818CF8",(t0+random.random()*0.9,99))
for (x,y),l,at,nx in [((1436,340),"B",M(17.84),M(18.74)),((594,684),"LS",M(18.74),M(19.44)),((1266,512),"LV",M(19.44),99)]:
    ch+=","+box(x-66,y-66,132,132,"0x444CE7",(at,nx))+","+dt(l,f"{x*K:.0f}-tw/2",f"{y*K:.0f}-th/2",60,"white",B,(at,nx))
for j in range(34):
    x,y=180+random.random()*1560,780+random.random()*240
    ch+=","+box(x,y,9,9,"0x9AA0AC",(M(20.96)+random.random()*1.1,99))
ov(ch,(t0,t1))
# GFX02 badges
t0,t1=M(24.48),M(30.40)
ch=f"color=c=black@0:s={W}x{H}:r=30:d=49.5,format=rgba"
for i,(x,lab,en) in enumerate([(330,"1",(t0,M(28.56))),(330,"2",(M(28.56),t1)),(1590,"?",(t0+0.22,t1))]):
    badge(x,537,266,266,lab,165,en,f"badge{i}")
ch+=","+dt("Are product demos really that profitable?",f"{140*K:.0f}",f"{925*K:.0f}",46,"white",SB,(M(25.66),M(28.5)),":shadowcolor=black@0.6:shadowx=2:shadowy=2")
ch+=","+dt("Do they need to be a video?",f"{140*K:.0f}",f"{925*K:.0f}",46,"white",SB,(M(28.56),t1),":shadowcolor=black@0.6:shadowx=2:shadowy=2")
ov(ch,(t0,t1))
# GFX03 one thing
t0,t1=M(31.14),M(36.76)
ov(card("white",49.5,True),(t0,t1))
badge(962,531,424,330,"1",215,(M(31.92),t1),"card1")
# GFX04
t0,t1=M(67.52),M(74.98)
ch=card(DARK,49.5)+","+box(574,72,780,440,"0xF6F6F8")
for k in range(8):
    c,r=k%4,k//4; ch+=","+box(574+118+c*182-84,72+158+r*176-80,168,160,"0x111418" if k in (1,5) else "white")
for w,x,r in [("Beautiful",600,67.96),("Expensive",972,69.12),("Useless",1320,70.82)]:
    ch+=","+dt(w,f"{x*K:.0f}-tw/2",f"{615*K:.0f}-th/2",46,"white",B,(M(r),99))
ov(ch,(t0,t1))
# GFX05 in this video (list card) + PiP
t0,t1=M(74.98),M(80.96)
items=["Watched vs. Used","The Pattern","Demo Length","Interactivity","Personalisation","Placement","Measurement"]; ops=[1,1,.72,.45,.28,.16,.08]
ch=card(DARK,49.5)+","+dt("In this video",f"{160*K:.0f}",f"{150*K:.0f}-th/2",72,"white",SB)
for k,it in enumerate(items):
    x,y,at=290+12*k*k,310+104*k,t0+0.55+k*0.16
    ch+=","+dt(str(k+1),f"{x*K:.0f}-tw/2",f"{y*K:.0f}-th/2",30,f"0xD6248F@{ops[k]}",B,(at,99))
    ch+=","+dt(it,f"{(x+58)*K:.0f}",f"{y*K:.0f}-th/2",36,f"white@{ops[k]}",SB,(at,99))
ov(ch,(t0,t1))
# PiP: split the current A-roll-only stream isn't available post-overlay, so reuse the A06 input
pw,ph=round(1000*K/2)*2,round(540*K/2)*2
fc.append(f"[5:v]fps=30,scale={pw}:-2,crop={pw}:{ph},setpts=PTS+{t0:.3f}/TB[pip]")
fc.append(f"[{cur}][pip]overlay={(1364-500)*K:.0f}:{(540-270)*K:.0f}:eof_action=pass:enable='between(t,{t0+0.1:.2f},{t1-0.1:.2f})'[pp]"); cur="pp"
# GFX06
t0,t1=M(82.38),M(85.10)
ch=f"color=c=black@0:s={W}x{H}:r=30:d=49.5,format=rgba,"+dt("+200,000",f"{923*K:.0f}-tw/2",f"{800*K:.0f}-th/2",124,MAG,B)+","+dt("Companies",f"{560*K:.0f}",f"{896*K:.0f}-th/2",54,"white",B,None,":shadowcolor=black@0.6:shadowx=2:shadowy=2")
ov(ch,(t0,t1))
# captions (word-by-word reveal approximated with cumulative drawtext)
CAPS=[("We studied a thousand product demos",[[2,3]],13.72,16.50),
("and we did it to answer two simple questions",[[6,8]],23.34,25.62),
("Because the demos that convert",[],36.82,38.70),
("the best are not the prettiest",[[5,5]],38.76,40.88),
("or most impressive ones",[[1,2]],40.94,42.55)]
fr=Image.new("RGBA",(W,H),(24,34,43,255)); ImageDraw.Draw(fr).rounded_rectangle((int(20*K),int(20*K),W-int(20*K),H-int(20*K)),int(26*K),fill=(0,0,0,0))
png(fr,(M(65.26),M(67.52)),"frame"); pngs[-1]=pngs[-1]+(0,0)
for k,(text,hl,a,b) in enumerate(CAPS): caption(text,hl,(M(a)-0.04,M(b)),f"cap{k}")
nin=len(SEG)
for k,(p,en,x,y) in enumerate(pngs):
    inputs+=["-loop","1","-framerate","30","-t","49.5","-i",p]
    fc.append(f"[{cur}][{nin+k}:v]overlay={x}:{y}:enable='between(t,{en[0]:.2f},{en[1]:.2f})'[q{k}]"); cur=f"q{k}"
fc.append(f"[{cur}]format=yuv420p[vout]")
open(f"{S}/anim/fc.txt","w").write(";\n".join(fc))
cmd=["ffmpeg","-v","error","-y"]+inputs+["-filter_complex_script",f"{S}/anim/fc.txt","-map","[vout]","-map","[aud]","-t","49.0","-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","160k","-movflags","+faststart",OUT]
subprocess.run(cmd,check=True)
