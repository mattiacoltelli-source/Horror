// node labs/space-fold/check-math.cjs
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const {FOLD,FoldPath,FoldWalker,FoldSequence}=await import(pathToFileURL(path.join(__dirname,'path.js')));
  const {readFlags}=await import(pathToFileURL(path.join(__dirname,'config.js')));
  const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
  assert.equal(readFlags('').enabled,false);assert.equal(readFlags('?spaceFold=0').enabled,false);
  assert.equal(readFlags('?spaceFold=1').enabled,true);
  assert.equal(readFlags('?spaceFold=1',true).reduced,true);
  assert.equal(readFlags('?reducedMotion=0',true).reduced,false);
  const track=new FoldPath();
  // Continuous tangent, non-degenerate inner ceiling and eye offsets at all stages.
  for(const angle of [0,.01,.3,.8,Math.PI/2]) {
    track.setAngle(angle);
    let previous=track.point(0,0,0,{}),length=0;
    for(let s=.01;s<=FOLD.length;s+=.01) {
      const f=track.frame(s),p=track.point(0,0,s),eye=track.point(0,FOLD.eye,s);
      near(Math.hypot(f.cos,f.sin),1);
      assert.ok(1-FOLD.height*f.curvature>.38,'ceiling must not fold into itself');
      near(Math.hypot(eye.y-p.y,eye.z-p.z),FOLD.eye);
      near((eye.y-p.y)*f.cos+(eye.z-p.z)*f.sin,FOLD.eye);
      assert.ok(p.y>=previous.y-1e-8&&p.z<=previous.z+1e-8,'path never doubles back');
      length+=Math.hypot(p.y-previous.y,p.z-previous.z);previous=p;
    }
    near(length,FOLD.length-.01,.02);
    for(const s of [FOLD.curveStart,FOLD.curveStart+FOLD.curveLength])near(track.theta(s-1e-5),track.theta(s+1e-5),1e-8);
  }
  track.setAngle(Math.PI/2);near(track.theta(26),Math.PI/2);near(track.frame(26).cos,0);
  // Forward, diagonal, backwards, boundaries and turn-relative movement.
  const walker=new FoldWalker(track),start={...walker.pose},startS=walker.s;
  for(let i=0;i<500;i++)walker.update(.016,{x:0,y:-1});
  assert.ok(walker.s>12);
  for(let i=0;i<500;i++)walker.update(.016,{x:0,y:1});
  near(walker.s,startS);walker.updatePose(0);near(walker.pose.y,start.y);near(walker.pose.z,start.z);
  for(let i=0;i<2000;i++)walker.update(.016,{x:1,y:-1});
  near(walker.s,FOLD.length-.6);near(walker.x,FOLD.walkHalfWidth);
  const stopS=walker.s,stopX=walker.x;
  for(let i=0;i<100;i++)walker.update(.016,{x:0,y:0});
  near(walker.s,stopS);near(walker.x,stopX);
  for(let i=0;i<3000;i++)walker.update(.016,{x:-1,y:1});
  near(walker.s,.6);near(walker.x,-FOLD.walkHalfWidth);
  walker.reset();walker.yaw=Math.PI;
  for(let i=0;i<100;i++)walker.update(.016,{x:0,y:1});
  assert.ok(walker.s>3,'backwards while facing entrance advances along path');
  walker.reset();const before=walker.s;walker.update(.05,{x:1,y:-1});
  near(Math.hypot(walker.s-before,walker.x),1.45*.05);
  // A parked player is transported continuously by the deforming surface.
  const seq=new FoldSequence(),w=new FoldWalker(track);w.s=16;track.setAngle(0);w.updatePose(0);
  let prev={...w.pose},maxAngleDelta=0,maxPositionDelta=0;
  for(let i=0;i<1700;i++) {
    if(i===350)seq.reduced=true; // changing accessibility mid-fold cannot reverse it.
    const last=seq.angle;track.setAngle(seq.update(.016,w.s));w.update(.016,{x:0,y:0});
    assert.ok(seq.angle>=last-1e-10);
    near(w.s,16);maxAngleDelta=Math.max(maxAngleDelta,Math.abs(w.pose.followAngle-prev.followAngle));
    maxPositionDelta=Math.max(maxPositionDelta,Math.hypot(w.pose.y-prev.y,w.pose.z-prev.z));prev={...w.pose};
  }
  assert.equal(seq.phase,'stable');near(seq.angle,Math.PI/2);
  assert.ok(maxAngleDelta<.01&&maxPositionDelta<.04,'no camera snap for parked player');
  const off=new FoldSequence(false);for(let i=0;i<4000;i++)off.update(.016,23);
  near(off.angle,0);assert.equal(off.phase,'idle');
  // Rotazione sull'asse: la sezione ruota attorno al suo centro (0,1.25); il pavimento a roll=PI e' a 2,5 m dall'asse del pavimento originale.
  { const rp=new FoldPath();rp.setAngle(Math.PI/2);rp.setRoll(Math.PI);const f=rp.frame(FOLD.length),q=rp.point(0,0,FOLD.length);
    near(q.x,0,1e-6);near(Math.hypot(q.y-f.y,q.z-f.z),FOLD.height,1e-6);
    near(rp.rho(FOLD.rollStart-1),0);near(rp.rho(FOLD.length),Math.PI);
    const eye=rp.point(0,FOLD.eye,FOLD.length);near(Math.hypot(eye.y-q.y,eye.z-q.z),FOLD.eye,1e-6);
    const rs=new FoldSequence();const rw=new FoldWalker(new FoldPath());
    for(let i=0;i<4000;i++)rs.update(.016,25);near(rs.roll,Math.PI);assert.equal(rs.rollPhase,'done');
    const rn=new FoldSequence(true,false,false);for(let i=0;i<4000;i++)rn.update(.016,25);near(rn.roll,0); }
  const normal=new FoldSequence(),reduced=new FoldSequence(true,true);
  for(let i=0;i<1100;i++){normal.update(.016,9);reduced.update(.016,9);}
  assert.equal(normal.phase,'stable');assert.equal(reduced.phase,'folding');
  reduced.reset();assert.equal(reduced.phase,'idle');near(reduced.angle,0);
  for(const reducedMotion of [false,true]) {
    const p=new FoldPath(),w=new FoldWalker(p,reducedMotion),q=new FoldSequence(true,reducedMotion);
    for(let i=0;i<2400&&w.s<FOLD.length-.6001;i++) {
      p.setAngle(q.update(.016,w.s));w.update(.016,{x:0,y:-1});
    }
    assert.equal(q.phase,'stable','walking continuously must reach a stable landing before the endpoint');
  }
  console.log(JSON.stringify({result:'PASS',checks:['flags','arc length','continuous frame','ceiling Jacobian','eye clearance','forward/back/turn/diagonal','wall/end bounds','stop during fold','reduced-motion toggle','disabled sequence'],maxParkedAngleDeltaDeg:maxAngleDelta*180/Math.PI,maxParkedPositionDeltaM:maxPositionDelta}));
})().catch(e=>{console.error(e);process.exitCode=1;});
