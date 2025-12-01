// Prototype de jeu conforme à la demande (en français dans les commentaires)
// - Maison avec 5 pièces (sans étages, sans portes), murs infranchissables
// - 6 PNJ (forme humaine blanche), joueur même forme mais rouge
// - Déplacements W/A/S/D
// - Si le joueur touche un PNJ => le PNJ "meurt", disparaît et laisse une tache rouge (non-obstacle)
// - Quand tous les PNJ sont tués => flèche pour recommencer apparaît

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  // Maison (rectangle) centré
  const house = {
    x: 80,
    y: 80,
    w: WIDTH - 160,
    h: HEIGHT - 160
  };

  // Diviser la maison en 5 pièces verticales égales (sans portes)
  const ROOM_COUNT = 5;
  const roomWidth = Math.floor(house.w / ROOM_COUNT);

  // Mur épaisseur
  const WALL_THICKNESS = 8;

  // Murs (rectangles) : bordure + cloisons verticales entre pièces
  const walls = [];

  // bordures extérieures
  walls.push({ x: house.x - WALL_THICKNESS, y: house.y - WALL_THICKNESS, w: house.w + WALL_THICKNESS*2, h: WALL_THICKNESS }); // top
  walls.push({ x: house.x - WALL_THICKNESS, y: house.y + house.h, w: house.w + WALL_THICKNESS*2, h: WALL_THICKNESS }); // bottom
  walls.push({ x: house.x - WALL_THICKNESS, y: house.y, w: WALL_THICKNESS, h: house.h }); // left
  walls.push({ x: house.x + house.w, y: house.y, w: WALL_THICKNESS, h: house.h }); // right

  // cloisons verticales séparant les pièces (sans portes)
  for (let i = 1; i < ROOM_COUNT; i++) {
    const cx = house.x + i * roomWidth - Math.floor(WALL_THICKNESS/2);
    walls.push({ x: cx, y: house.y, w: WALL_THICKNESS, h: house.h });
  }

  // Represente une forme humaine simplifiée (pour dessin) ; collision utilise rayon
  class Human {
    constructor(x, y, color = 'white') {
      this.x = x;
      this.y = y;
      this.radius = 14; // collision radius
      this.color = color;
      this.alive = true;
    }

    draw(ctx) {
      if (!this.alive) return;
      // corps
      ctx.fillStyle = this.color;
      // tête
      ctx.beginPath();
      ctx.arc(this.x, this.y - 10, 6, 0, Math.PI * 2);
      ctx.fill();
      // corps rectangle
      ctx.fillRect(this.x - 6, this.y - 4, 12, 18);
      // bras (simple)
      ctx.fillRect(this.x - 12, this.y + 2, 24, 4);
      // jambes
      ctx.fillRect(this.x - 6, this.y + 14, 4, 10);
      ctx.fillRect(this.x + 2, this.y + 14, 4, 10);
    }
  }

  // Tache rouge statique (non-obstacle)
  class Stain {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 12;
    }
    draw(ctx) {
      ctx.fillStyle = '#a61b1b';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 2, this.radius + 2, this.radius - 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Joueur (déplacement avec collisions)
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 14;
      this.color = 'red';
      this.speed = 160; // px/s
      this.vx = 0;
      this.vy = 0;
    }

    update(dt, input, obstacles) {
      // compute intended velocity
      let vx = 0, vy = 0;
      if (input.up) vy -= 1;
      if (input.down) vy += 1;
      if (input.left) vx -= 1;
      if (input.right) vx += 1;

      // normalize diagonal
      if (vx !== 0 && vy !== 0) {
        const inv = 1 / Math.sqrt(2);
        vx *= inv;
        vy *= inv;
      }

      vx *= this.speed;
      vy *= this.speed;

      // move with separate axis collision resolution
      // X axis
      let newX = this.x + vx * dt;
      if (!collidesCircleWithWalls(newX, this.y, this.radius, obstacles)) {
        this.x = newX;
      } else {
        // attempt small step correction to slide along walls
        // nothing: blocked on X
      }

      // Y axis
      let newY = this.y + vy * dt;
      if (!collidesCircleWithWalls(this.x, newY, this.radius, obstacles)) {
        this.y = newY;
      } else {
        // blocked on Y
      }
    }

    draw(ctx) {
      // draw red human
      ctx.fillStyle = this.color;
      // tête
      ctx.beginPath();
      ctx.arc(this.x, this.y - 10, 6, 0, Math.PI * 2);
      ctx.fill();
      // corps
      ctx.fillRect(this.x - 6, this.y - 4, 12, 18);
      ctx.fillRect(this.x - 12, this.y + 2, 24, 4);
      ctx.fillRect(this.x - 6, this.y + 14, 4, 10);
      ctx.fillRect(this.x + 2, this.y + 14, 4, 10);
    }
  }

  // utilitaires collisions
  function rectsOverlap(r1, r2) {
    return !(r2.x > r1.x + r1.w || 
             r2.x + r2.w < r1.x || 
             r2.y > r1.y + r1.h ||
             r2.y + r2.h < r1.y);
  }

  // check if circle at x,y with radius collides wall list (rectangles)
  function collidesCircleWithWalls(x, y, r, wallRects) {
    for (const w of wallRects) {
      // expand wall rect by circle radius and check if point inside
      const expanded = { x: w.x - r, y: w.y - r, w: w.w + r * 2, h: w.h + r * 2 };
      if (x >= expanded.x && x <= expanded.x + expanded.w &&
          y >= expanded.y && y <= expanded.y + expanded.h) {
        return true;
      }
    }
    return false;
  }

  // crée les pièces (utiles pour positionnement initial)
  const rooms = [];
  for (let i = 0; i < ROOM_COUNT; i++) {
    const rx = house.x + i * roomWidth;
    const ry = house.y;
    const rw = (i === ROOM_COUNT - 1) ? (house.x + house.w - rx) : roomWidth;
    const rh = house.h;
    rooms.push({ x: rx + WALL_THICKNESS, y: ry + WALL_THICKNESS, w: rw - WALL_THICKNESS*2, h: rh - WALL_THICKNESS*2 });
  }

  // Input handling WASD
  const input = { up: false, down: false, left: false, right: false };

  window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'w': input.up = true; break;
      case 's': input.down = true; break;
      case 'a': input.left = true; break;
      case 'd': input.right = true; break;
      case 'r': if (game && game.allDead()) game.restart(); break;
      case 'enter': if (game && game.allDead()) game.restart(); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
      case 'w': input.up = false; break;
      case 's': input.down = false; break;
      case 'a': input.left = false; break;
      case 'd': input.right = false; break;
    }
  });

  // Game management
  class Game {
    constructor() {
      // spawn player in room 0 (garanti accessible)
      const pr = rooms[0];
      this.player = new Player(pr.x + pr.w / 2, pr.y + pr.h / 2);

      // Create 6 PNJ (white), ensure at least one in player's room
      this.npcs = [];
      this.stains = [];

      // place one guaranteed in player's room
      this.npcs.push(this.randomNPCInRoom(0));
      // place remaining 5 randomly in any room (0..4)
      for (let i = 0; i < 5; i++) {
        const roomIdx = Math.floor(Math.random() * ROOM_COUNT);
        this.npcs.push(this.randomNPCInRoom(roomIdx));
      }

      // timer
      this.lastTs = performance.now();
      this.running = true;

      // click to restart arrow
      canvas.addEventListener('click', (e) => {
        if (this.allDead()) {
          const rect = canvas.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          if (this.isPointInArrow(cx, cy)) this.restart();
        }
      });
    }

    randomNPCInRoom(roomIdx) {
      const r = rooms[roomIdx];
      // pick position inside room avoiding walls and edges
      const margin = 28;
      const x = r.x + margin + Math.random() * (Math.max(0, r.w - margin*2));
      const y = r.y + margin + Math.random() * (Math.max(0, r.h - margin*2));
      return new Human(x, y, 'white');
    }

    update(dt) {
      if (!this.running) return;
      this.player.update(dt, input, walls);

      // check collision with NPCs
      for (const npc of this.npcs) {
        if (!npc.alive) continue;
        const dx = npc.x - this.player.x;
        const dy = npc.y - this.player.y;
        const dist2 = dx*dx + dy*dy;
        const minDist = npc.radius + this.player.radius;
        if (dist2 <= minDist * minDist) {
          // NPC is killed
          npc.alive = false;
          // create stain at npc location
          this.stains.push(new Stain(npc.x, npc.y));
        }
      }

      // stop running when all killed
      if (this.allDead()) {
        this.running = false;
      }
    }

    draw(ctx) {
      // background is already green (canvas style) but redraw to be safe
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(0,0,WIDTH,HEIGHT);

      // draw house interior background (slightly darker green)
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(house.x, house.y, house.w, house.h);

      // draw rooms outlines (thin lines) - optional
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      for (const r of rooms) {
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }

      // draw walls (as solid darker brown)
      ctx.fillStyle = '#5d4037';
      for (const w of walls) {
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }

      // draw stains (derrière humains pour effet)
      for (const s of this.stains) s.draw(ctx);

      // draw NPCs
      for (const npc of this.npcs) {
        // skip dead ones (they left stain)
        if (npc.alive) npc.draw(ctx);
      }

      // draw player on top
      this.player.draw(ctx);

      // Draw HUD: remaining NPCs
      const aliveCount = this.npcs.filter(n => n.alive).length;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(10, 10, 160, 28);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('PNJ restants: ' + aliveCount, 18, 30);

      // If all dead -> show arrow
      if (this.allDead()) {
        this.drawRestartArrow(ctx);
      }
    }

    allDead() {
      return this.npcs.every(n => !n.alive);
    }

    drawRestartArrow(ctx) {
      // draw a white arrow near top center with a subtle shadow
      const ax = WIDTH / 2;
      const ay = 40;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(ax+6, ay+6);
      ctx.lineTo(ax - 18 + 6, ay + 40 + 6);
      ctx.lineTo(ax + 18 + 6, ay + 40 + 6);
      ctx.closePath();
      ctx.fill();

      // arrow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 18, ay + 40);
      ctx.lineTo(ax + 18, ay + 40);
      ctx.closePath();
      ctx.fill();

      // text
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tous les PNJ sont morts — Cliquer sur la flèche ou appuyer sur R pour recommencer', WIDTH/2, ay + 64);
      ctx.textAlign = 'start';
    }

    isPointInArrow(px, py) {
      const ax = WIDTH / 2;
      const ay = 40;
      // simple triangle test
      const x1 = ax, y1 = ay;
      const x2 = ax - 18, y2 = ay + 40;
      const x3 = ax + 18, y3 = ay + 40;
      // barycentric technique
      const denom = (y2 - y3)*(x1 - x3) + (x3 - x2)*(y1 - y3);
      const a = ((y2 - y3)*(px - x3) + (x3 - x2)*(py - y3)) / denom;
      const b = ((y3 - y1)*(px - x3) + (x1 - x3)*(py - y3)) / denom;
      const c = 1 - a - b;
      return a >= 0 && b >= 0 && c >= 0;
    }

    restart() {
      // simple restart -> re-create game state
      const g = new Game();
      window.game = g;
    }
  }

  // main loop
  let game = new Game();
  window.game = game;

  function loop(ts) {
    const dt = Math.min(0.033, (ts - game.lastTs) / 1000); // clamp dt
    game.lastTs = ts;
    game.update(dt);
    game.draw(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // expose some helpers to console for debugging
  window._walls = walls;
  window._rooms = rooms;
  window._house = house;

})();