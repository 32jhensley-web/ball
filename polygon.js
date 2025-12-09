// polygon.js
// A small helper class that represents a regular polygon and recomputes vertices when needed.

class Polygon {
  constructor(cx, cy, radius, sides = 6, rotation = 0) {
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
    this.sides = Math.max(3, Math.floor(sides));
    this.rotation = rotation;
    this.updateVertices();
  }

  setSides(n){
    this.sides = Math.max(3, Math.floor(n));
    this.updateVertices();
  }

  setRadius(r){
    this.radius = r;
    this.updateVertices();
  }

  setCenter(x,y){
    this.cx = x; this.cy = y;
    this.updateVertices();
  }

  updateVertices(){
    const verts = [];
    const twoPI = Math.PI * 2;
    for(let i=0;i<this.sides;i++){
      const ang = this.rotation + (i / this.sides) * twoPI;
      const x = this.cx + Math.cos(ang) * this.radius;
      const y = this.cy + Math.sin(ang) * this.radius;
      verts.push({x,y});
    }
    this.vertices = verts;
  }

  // draw polygon onto ctx
  draw(ctx, strokeStyle = 'rgba(200,220,255,0.9)', lineWidth = 2){
    ctx.save();
    ctx.beginPath();
    this.vertices.forEach((v,i)=>{
      if(i===0) ctx.moveTo(v.x,v.y);
      else ctx.lineTo(v.x,v.y);
    });
    ctx.closePath();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
    ctx.restore();
  }

  // compute closest point on segment AB to point P
  static closestPointOnSegment(px,py, ax,ay, bx,by){
    const vx = bx-ax, vy = by-ay;
    const wx = px-ax, wy = py-ay;
    const c1 = vx*wx + vy*wy;
    const c2 = vx*vx + vy*vy;
    let t = c1 / c2;
    if(t<0) t = 0;
    if(t>1) t = 1;
    return {x: ax + vx*t, y: ay + vy*t};
  }

  // check collision between circle (cx,cy,r) and polygon edges.
  // returns {hit: bool, edgeIndex: i, pt, normal}
  collideCircle(cx,cy, r){
    let hit = false;
    let best = {dist: Infinity};
    const n = this.vertices.length;
    for(let i=0;i<n;i++){
      const a = this.vertices[i];
      const b = this.vertices[(i+1)%n];
      const cp = Polygon.closestPointOnSegment(cx,cy, a.x,a.y, b.x,b.y);
      const dx = cx - cp.x, dy = cy - cp.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if(dist < best.dist){
        best = {dist, cp, i, a, b};
      }
    }
    if(best.dist <= r + 0.0001){
      // compute outward normal for edge a->b
      const ax = best.a.x, ay = best.a.y;
      const bx = best.b.x, by = best.b.y;
      const ex = bx-ax, ey = by-ay;
      // normal (perp)
      let nx = -ey, ny = ex;
      // normalize
      const nl = Math.hypot(nx,ny) || 1;
      nx /= nl; ny /= nl;
      // ensure normal is pointing outward (from polygon center to cp dot normal > 0)
      const tx = best.cp.x - this.cx, ty = best.cp.y - this.cy;
      if( (tx*nx + ty*ny) < 0 ){ nx = -nx; ny = -ny; }
      return {hit: true, edgeIndex: best.i, pt: best.cp, normal: {x:nx,y:ny}, penetration: r - best.dist};
    }
    return {hit: false};
  }
}
