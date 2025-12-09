// app.js
// Main application: create canvas, polygon, ball, animation loop, and recursive updates.

(function(){
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: true });

  // responsive canvas sizing (use devicePixelRatio)
  function resize(){
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * ratio);
    canvas.height = Math.floor(canvas.clientHeight * ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  window.addEventListener('resize', resize);
  resize();

  // UI elements
  const sidesCountEl = document.getElementById('sidesCount');
  const depthSlider = document.getElementById('depth');
  const depthVal = document.getElementById('depthVal');
  const resetBtn = document.getElementById('resetBtn');

  // world polygon centered in canvas
  let worldPolygon;
  let initialSides = 6;
  let ball;
  let lastTime = null;
  let maxNestedDepth = parseInt(depthSlider.value, 10);

  function init(){
    resize();
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const centerX = W / 2;
    const centerY = H / 2;
    const polyRadius = Math.min(W, H) * 0.38;

    worldPolygon = new Polygon(centerX, centerY, polyRadius, initialSides, -Math.PI/2);
    sidesCountEl.textContent = worldPolygon.sides;

    // create main ball somewhere offset above center
    const bRadius = Math.max(24, polyRadius * 0.12);
    ball = new BallSim(centerX, centerY - polyRadius*0.35, 120, 30, {
      radius: bRadius,
      gravity: 900,
      nestedDepth: 0,
      maxNestedDepth: maxNestedDepth
    });
    lastTime = null;
  }

  // reset handler
  resetBtn.addEventListener('click', ()=>{
    init();
  });

  depthSlider.addEventListener('input', ()=>{
    maxNestedDepth = parseInt(depthSlider.value,10);
    depthVal.textContent = maxNestedDepth;
    // apply to current ball
    if(ball){
      ball.maxNestedDepth = maxNestedDepth;
      // rebuild inner state if needed
      ball.nestedDepth = 0;
      if(ball.maxNestedDepth > 0 && !ball.inner){
        ball.inner = {
          cx:0, cy:0, radius: ball.radius*0.42,
          polygonSides: Math.max(3, 4),
          ball: { x: -ball.radius*0.12, y:-ball.radius*0.14, vx:0, vy:0, radius: Math.max(6, ball.radius*0.22), gravity: ball.gravity*1.1 }
        };
      }
    }
  });

  // clamp function
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // main update function
  function update(dt){
    if(!ball || !worldPolygon) return;
    // integrate physics
    ball.applyGravity(dt);
    ball.integrate(dt);

    // handle world polygon collision
    const collided = ball.handleCollisionWithPolygon(worldPolygon);
    if(collided){
      // increase polygon sides
      worldPolygon.setSides(worldPolygon.sides + 1);
      sidesCountEl.textContent = worldPolygon.sides;
      // small nudge to ball and reduce speed a bit
      ball.vx *= 0.98;
      ball.vy *= 0.98;
      // keep polygon radius stable but update vertices
      worldPolygon.updateVertices();
    }

    // If ball drifts outside canvas (rare), re-center
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ball.x = clamp(ball.x, 0, W);
    ball.y = clamp(ball.y, 0, H);

    // update inner simulation (recursive)
    handleRecursiveUpdates(ball, dt, 0);
  }

  // recursive updates for nested mini-simulations
  function handleRecursiveUpdates(parentBall, dt, depth){
    if(!parentBall.inner) return;
    // Update the inner simulation's ball and handle collisions
    const innerHit = parentBall.updateInner(dt);
    if(innerHit){
      // if inner polygon grew, you might want to do an effect
      // nothing else needed here
    }

    // If recursion depth allows deeper simulations, we create nested data structures
    // Implementation note: For simplicity we only go two levels deep in active physics:
    // - parentBall.inner is level 1; parentBall.inner inner will be emulated via same pattern:
    if(parentBall.nestedDepth + 1 < parentBall.maxNestedDepth){
      // emulate a deeper nested inner by using small state stored in inner.extra (create if missing)
      const ip = parentBall.inner;
      if(!ip.extra){
        ip.extra = {
          polygonSides: Math.max(3, 3 + depth + 1),
          ball: {
            x: ip.ball.x * 0.35,
            y: ip.ball.y * 0.35,
            vx: (Math.random()-0.5) * 30,
            vy: (Math.random()-0.5) * 30,
            radius: Math.max(2, ip.ball.radius * 0.35),
          }
        };
      }
      // integrate extra ball
      ip.extra.ball.vy += (parentBall.gravity * 0.18) * dt;
      ip.extra.ball.x += ip.extra.ball.vx * dt;
      ip.extra.ball.y += ip.extra.ball.vy * dt;
      // check collision against a tiny polygon inside ip.ball
      const tinyPoly = new Polygon(0,0, ip.ball.radius*0.6, ip.extra.polygonSides, Math.PI/2);
      const col = tinyPoly.collideCircle(ip.extra.ball.x, ip.extra.ball.y, ip.extra.ball.radius);
      if(col.hit){
        const nx = col.normal.x, ny = col.normal.y;
        const vdotn = ip.extra.ball.vx*nx + ip.extra.ball.vy*ny;
        ip.extra.ball.vx = ip.extra.ball.vx - 2*vdotn*nx;
        ip.extra.ball.vy = ip.extra.ball.vy - 2*vdotn*ny;
        ip.extra.ball.x += nx * (col.penetration + 0.2);
        ip.extra.ball.y += ny * (col.penetration + 0.2);
        ip.extra.ball.vx *= 0.98;
        ip.extra.ball.vy *= 0.98;
        ip.extra.polygonSides = Math.min(30, ip.extra.polygonSides + 1);
      }
    }
  }

  // drawing function
  function draw(){
    // clear with slight fade
    ctx.clearRect(0,0, canvas.width, canvas.height);
    // draw world polygon and ball (note canvas transform is already set for DPR)
    worldPolygon.draw(ctx, 'rgba(200,230,255,0.9)', 3);

    // draw ball and its inner sims
    ball.draw(ctx);

    // draw HUD info
    ctx.save();
    ctx.font = '13px system-ui, Arial';
    ctx.fillStyle = 'rgba(220,240,255,0.9)';
    ctx.fillText(`Sides: ${worldPolygon.sides}`, 14, 20);
    ctx.restore();
  }

  // animation loop
  function loop(ts){
    if(!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    lastTime = ts;
    // clamp dt for stability
    dt = Math.min(0.033, dt);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // mouse control: click to give the ball an impulse
  canvas.addEventListener('pointerdown', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    const dx = x - ball.x, dy = y - ball.y;
    ball.vx += dx * 0.8;
    ball.vy += dy * 0.8;
  });

  // initialize and start
  init();
  requestAnimationFrame(loop);
})();
