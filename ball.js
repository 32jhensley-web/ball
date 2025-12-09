// ball.js
// Ball class that handles physics (position, velocity, gravity) and drawing.
// Also contains logic to host an inner mini-simulation (recursive).

class BallSim {
  // state: position/velocity relative to world coords.
  // options: {radius, color, gravity, friction, nestedDepth, maxNestedDepth}
  constructor(x,y, vx,vy, options = {}){
    this.x = x; this.y = y;
    this.vx = vx || 0;
    this.vy = vy || 0;
    this.radius = options.radius || 36;
    this.color = options.color || 'rgba(80,160,255,0.95)';
    this.gravity = options.gravity ?? 800; // px/s^2
    this.friction = options.friction ?? 0.995;
    this.nestedDepth = options.nestedDepth || 0;
    this.maxNestedDepth = options.maxNestedDepth ?? 3;
    // inner simulation state (if any)
    if(this.nestedDepth < this.maxNestedDepth){
      // create inner polygon and ball with scaled down sizes
      const scale = 0.42; // scaling factor for inner simulation size
      this.inner = {
        // center inside this ball's center; it will be drawn relative
        cx: 0,
        cy: 0,
        radius: this.radius * scale,
        polygonSides: Math.max(3, 4 + this.nestedDepth), // initial sides vary with depth
        ball: {
          // inner ball starts offset inside parent ball
          x: -this.radius*0.12,
          y: -this.radius*0.14,
          vx: (Math.random()-0.5) * 40,
          vy: (Math.random()-0.5) * 40,
          radius: Math.max(6, this.radius * 0.22),
          gravity: this.gravity * 1.1
        }
      };
    } else {
      this.inner = null;
    }
  }

  applyGravity(dt){
    this.vy += this.gravity * dt;
  }

  integrate(dt){
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // small air resistance
    this.vx *= Math.pow(this.friction, dt*60);
    this.vy *= Math.pow(this.friction, dt*60);
  }

  draw(ctx){
    // draw ball
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
    // nice glossy fill
    const g = ctx.createRadialGradient(this.x - this.radius*0.3, this.y - this.radius*0.4, this.radius*0.05, this.x, this.y, this.radius);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.2, this.color);
    g.addColorStop(1, 'rgba(10,40,70,0.9)');
    ctx.fillStyle = g;
    ctx.fill();
    // rim
    ctx.lineWidth = Math.max(1, this.radius*0.06);
    ctx.strokeStyle = 'rgba(180,210,255,0.6)';
    ctx.stroke();
    ctx.restore();

    // draw inner simulation inside ball
    if(this.inner){
      ctx.save();
      // translate to ball center
      ctx.translate(this.x, this.y);
      this.drawInner(ctx);
      ctx.restore();
    }
  }

  // draw inner polygon + inner ball (one recursion step)
  drawInner(ctx){
    // inner polygon center at (0,0) relative to ball center
    const ip = this.inner;
    const innerPoly = new Polygon( ip.cx, ip.cy, ip.radius, ip.polygonSides, Math.PI/2 );
    // Draw polygon (smaller strokes)
    innerPoly.draw(ctx, 'rgba(230,240,255,0.95)', Math.max(1, this.radius*0.035));

    // draw inner ball
    const b = ip.ball;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(200,230,255,0.9)';
    ctx.stroke();

    // if deeper recursion is enabled, draw nested inside the inner ball
    if(this.nestedDepth + 1 < this.maxNestedDepth){
      // create a temporary mini BallSim to render deeper recursion and update it separately
      // But we won't create full physics objects here; the deeper update runs in updateInner()
      // For visuals, we can draw a tiny inner polygon in the inner ball representing recursion.
      // (The update function handles the deeper physics.)
      // draw a tiny dot/shine
      ctx.beginPath();
      ctx.arc(b.x - b.radius*0.3, b.y - b.radius*0.35, Math.max(1, b.radius*0.18), 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    }
  }

  // handle collision with a polygon (world polygon). polygon: instance of Polygon
  // returns true if collision happened (for adding a side)
  handleCollisionWithPolygon(polygon){
    const col = polygon.collideCircle(this.x, this.y, this.radius);
    if(col.hit){
      // reflect velocity along the edge normal
      const nx = col.normal.x, ny = col.normal.y;
      const vdotn = this.vx*nx + this.vy*ny;
      // reflect component along normal, keep tangential
      this.vx = this.vx - 2 * vdotn * nx;
      this.vy = this.vy - 2 * vdotn * ny;
      // push ball slightly out of the wall to avoid sticking
      this.x += col.normal.x * (col.penetration + 0.5);
      this.y += col.normal.y * (col.penetration + 0.5);
      // dampen a little to simulate energy loss
      this.vx *= 0.98;
      this.vy *= 0.98;
      return true;
    }
    return false;
  }

  // update inner mini-simulation (one nested level)
  updateInner(dt){
    if(!this.inner) return false;
    const ip = this.inner;
    // simulate gravity toward +y (world gravity is same direction)
    // basic integration for inner ball (positions relative to parent ball center)
    ip.ball.vy += (this.gravity * 0.5) * dt; // scaled gravity
    ip.ball.x += ip.ball.vx * dt;
    ip.ball.y += ip.ball.vy * dt;
    // small drag
    ip.ball.vx *= 0.999;
    ip.ball.vy *= 0.999;

    // collision with inner polygon edges
    const innerPoly = new Polygon(ip.cx, ip.cy, ip.radius, ip.polygonSides, Math.PI/2);
    const col = innerPoly.collideCircle(ip.ball.x, ip.ball.y, ip.ball.radius);
    if(col.hit){
      // reflect inner ball
      const nx = col.normal.x, ny = col.normal.y;
      const vdotn = ip.ball.vx*nx + ip.ball.vy*ny;
      ip.ball.vx = ip.ball.vx - 2*vdotn*nx;
      ip.ball.vy = ip.ball.vy - 2*vdotn*ny;
      // push out
      ip.ball.x += nx * (col.penetration + 0.5);
      ip.ball.y += ny * (col.penetration + 0.5);
      ip.ball.vx *= 0.98;
      ip.ball.vy *= 0.98;
      ip.polygonSides = Math.min(20, ip.polygonSides + 1); // grow inner polygon
      return true;
    }
    return false;
  }
}
