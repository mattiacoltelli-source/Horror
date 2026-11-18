// Coordinates: x across the corridor, y above its floor, s along the floor.
// This module has no renderer dependency: geometry and movement share one map.
export const FOLD = Object.freeze({ width: 4, height: 2.5, length: 24,
  curveStart: 4, curveLength: 12, eye: 1.62, radius: 0.32,
  // Original tiled wall's innermost cornice is at x = +/- 1.75 m.
  walkHalfWidth: 1.30, trigger: 2.6, maxAngle: Math.PI / 2 });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth5 = (v) => { const u = clamp(v, 0, 1); return u*u*u*(10+u*(-15+6*u)); };

export class FoldPath {
  constructor(config = FOLD, samples = 480) {
    this.config = config; this.samples = samples; this.ds = config.length / samples;
    this.cy = new Float64Array(samples + 1); this.cz = new Float64Array(samples + 1);
    this.angle = -1; this.setAngle(0);
  }
  theta(s) { return this.angle * smooth5((s-this.config.curveStart)/this.config.curveLength); }
  curvature(s) {
    const u = clamp((s-this.config.curveStart)/this.config.curveLength, 0, 1);
    return this.angle * 30*u*u*(1-u)*(1-u)/this.config.curveLength;
  }
  setAngle(angle) {
    angle = clamp(angle, 0, this.config.maxAngle);
    if (angle === this.angle) return false;
    this.angle = angle; this.cy[0] = this.cz[0] = 0;
    // Simpson integration keeps arc length and tangent stable as the world bends.
    for (let i=1; i<=this.samples; i++) {
      const a=this.theta((i-1)*this.ds), b=this.theta((i-.5)*this.ds), c=this.theta(i*this.ds);
      this.cy[i] = this.cy[i-1] + this.ds*(Math.sin(a)+4*Math.sin(b)+Math.sin(c))/6;
      this.cz[i] = this.cz[i-1] - this.ds*(Math.cos(a)+4*Math.cos(b)+Math.cos(c))/6;
    }
    return true;
  }
  frame(s, out = {}) {
    s=clamp(s, 0, this.config.length);
    const f=s/this.ds, i=Math.min(this.samples-1, Math.floor(f)), u=f-i;
    out.theta=this.theta(s); out.sin=Math.sin(out.theta); out.cos=Math.cos(out.theta);
    out.y=this.cy[i]+(this.cy[i+1]-this.cy[i])*u;
    out.z=this.cz[i]+(this.cz[i+1]-this.cz[i])*u;
    out.curvature=this.curvature(s); return out;
  }
  point(x, y, s, out = {}) {
    this.frame(s,out); out.x=x; out.y+=y*out.cos; out.z+=y*out.sin; return out;
  }
}

export class FoldSequence {
  constructor(enabled=true, reduced=false) { this.enabled=enabled; this.reduced=reduced; this.reset(); }
  reset() { this.phase='idle'; this.time=0; this.progress=0; this.angle=0; this.finished=false; }
  update(dt, s) {
    if (!this.enabled) return this.angle=0;
    if (this.phase==='idle' && s>=FOLD.trigger) { this.phase='warning'; this.time=0; }
    if (this.phase==='warning') {
      this.time+=dt;
      if (this.time>=1.8) { this.time-=1.8; this.phase='folding'; this.progress=this.time/(this.reduced?24:12); }
    } else if (this.phase==='folding') {
      this.time+=dt; this.progress+=dt/(this.reduced?24:12);
    }
    if (this.phase==='folding') {
      const u=this.progress;
      this.angle=FOLD.maxAngle*smooth5(u);
      if (u>=1) { this.angle=FOLD.maxAngle; this.phase='stable'; }
    }
    if (this.phase==='stable' && s>=21.5) this.finished=true;
    return this.angle;
  }
}

export class FoldWalker {
  constructor(path, reduced=false) { this.path=path; this.reduced=reduced; this.reset(); }
  get speedLimit() { return this.reduced ? .8 : 1.45; }
  reset() {
    this.s=0.9; this.x=0; this.yaw=0; this.pitch=0; this.distance=0;
    this.followAngle=this.path.theta(this.s); this.speed=0;
    this.pose={}; this.position={}; this.updatePose(0);
  }
  update(dt, axes={x:0,y:0}, look={x:0,y:0}) {
    dt=clamp(dt,0,.05);
    this.yaw-=look.x*.0042;
    this.pitch=clamp(this.pitch-look.y*.0042,-1.10,1.10);
    // Travel in the tangent plane; yaw remains relative to the local floor.
    const side=axes.x*Math.cos(this.yaw)+axes.y*Math.sin(this.yaw);
    const along=axes.x*Math.sin(this.yaw)-axes.y*Math.cos(this.yaw);
    const speed=this.speedLimit/Math.max(1,Math.hypot(axes.x,axes.y));
    const oldX=this.x, oldS=this.s;
    this.x=clamp(this.x+side*speed*dt,-FOLD.walkHalfWidth,FOLD.walkHalfWidth);
    this.s=clamp(this.s+along*speed*dt,.6,FOLD.length-.6);
    const moved=Math.hypot(this.x-oldX,this.s-oldS);
    this.distance+=moved; this.speed=dt>0 ? moved/dt : 0;
    this.updatePose(dt); return moved;
  }
  updatePose(dt) {
    const target=this.path.theta(this.s);
    // Only smooth the transported floor frame. No scripted look direction.
    this.followAngle+=(target-this.followAngle)*(dt>0 ? 1-Math.exp(-dt/0.10) : 1);
    this.path.point(this.x,FOLD.eye,this.s,this.position);
    Object.assign(this.pose,{x:this.position.x,y:this.position.y,z:this.position.z,
      floorAngle:target,followAngle:this.followAngle,yaw:this.yaw,pitch:this.pitch});
    return this.pose;
  }
}
