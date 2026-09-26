/*
 * game-art.js — Marice & Cats: The Great Treat Heist — interior art
 *
 * Storybook-style interiors drawn with canvas primitives:
 *   - room-aware floor materials (planks, checker tile, carpet, concrete)
 *   - walls with a painted front face, cap and baseboard (3/4 top-down depth)
 *   - soft contact shadows, rugs, staircases and the laundry avalanche
 *   - furniture and prop sprites for every interior interactable
 *   - crime-scene decals (crumb trail, fur tufts) that tell the story
 *
 * Loaded after game-engine.js. The engine calls:
 *   drawInteriorBase(floor, row, col)   — static cache, pass 1
 *   drawInteriorObjects(floor)          — static cache, pass 2
 *   drawStoryDecals(floorId)            — every frame, under props
 *   ART.drawInteractable(obj, x, y)     — every frame, returns true if drawn
 */

// ======================== HELPERS ========================

var artShadeCache = {};

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. Cached.
function shade(hex, amt) {
  var key = hex + amt;
  if (artShadeCache[key]) return artShadeCache[key];
  var n = parseInt(hex.slice(1), 16);
  var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  var out = '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
  artShadeCache[key] = out;
  return out;
}

function artRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function artRoundPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function artRound(x, y, w, h, r, fill, stroke) {
  artRoundPath(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function artEllipse(cx, cy, rx, ry, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Soft contact shadow on the floor under an object.
function artShadow(cx, cy, rx, ry, alpha) {
  artEllipse(cx, cy, rx, ry, 'rgba(28,14,8,' + (alpha || 0.22) + ')');
}

// A block of furniture seen from the 3/4 top-down angle: a lit top surface
// and a darker front face, with a crisp outline.
function artBox(x, y, w, h, frontH, top, front) {
  artShadow(x + w / 2 + 1, y + h - 1, w / 2 + 1, 3, 0.2);
  artRect(x, y, w, h - frontH, top);
  artRect(x, y + h - frontH, w, frontH, front);
  artRect(x, y, w, 1, shade(top, 0.25));
  artRect(x, y + h - frontH, w, 1, shade(front, -0.25));
  ctx.strokeStyle = 'rgba(38,22,16,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function artPx(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// ======================== ROOMS ========================

const ROOM_STYLES = {
  kitchen:   { floor: 'checker',   a: '#ece2cc', b: '#c9b38c', wall: '#a8bb9f', trim: '#f4ecd9', top: '#3b2b27' },
  dining:    { floor: 'plank',     a: '#b8855a', wall: '#e2cca6', trim: '#fff3dc', top: '#3b2b27', wainscot: '#b3906a' },
  living:    { floor: 'plank',     a: '#c79866', wall: '#d4ad86', trim: '#f7e7cd', top: '#3b2b27' },
  halfbath:  { floor: 'smallTile', a: '#e2ecec', wall: '#9ecbc5', trim: '#f4fbfa', top: '#3b2b27' },
  lobby:     { floor: 'concrete',  a: '#a39e95', wall: '#a09a8e', trim: '#cdc6b8', top: '#3a3733' },
  recroom:   { floor: 'carpet',    a: '#4f5b73', wall: '#5e6c88', trim: '#cad3e4', top: '#3a3733' },
  basebath:  { floor: 'smallTile', a: '#c6cfd2', wall: '#a8bbbe', trim: '#e9efef', top: '#3a3733' },
  masterbed: { floor: 'carpet',    a: '#d6c8b5', wall: '#b9a4ca', trim: '#f3ecf7', top: '#3b2b27' },
  guestbed:  { floor: 'carpet',    a: '#dcc5bd', wall: '#d6a8aa', trim: '#fcf0f1', top: '#3b2b27' },
  office:    { floor: 'plank',     a: '#a0714a', wall: '#91a98c', trim: '#eef3ea', top: '#3b2b27' },
  bath:      { floor: 'checker',   a: '#f2f5f6', b: '#bccbd1', wall: '#a7d1d9', trim: '#f4fbfc', top: '#3b2b27' },
  hallway:   { floor: 'plank',     a: '#c3935f', wall: '#d6ba96', trim: '#f7ead2', top: '#3b2b27' }
};

// [rowStart, rowEnd, colStart, colEnd, style] — first match wins.
const ROOM_ZONES = {
  main: { zones: [[1, 4, 1, 7, 'kitchen'], [1, 4, 9, 18, 'dining'], [10, 13, 1, 4, 'halfbath']], fallback: 'living' },
  basement: { zones: [[7, 13, 1, 8, 'basebath'], [1, 13, 10, 18, 'recroom']], fallback: 'lobby' },
  upstairs: { zones: [[1, 5, 1, 8, 'masterbed'], [1, 5, 10, 18, 'guestbed'], [7, 13, 1, 4, 'office'], [7, 13, 14, 18, 'bath']], fallback: 'hallway' }
};

function roomStyleAt(floorId, row, col) {
  var def = ROOM_ZONES[floorId];
  if (!def) return ROOM_STYLES.living;
  for (var i = 0; i < def.zones.length; i++) {
    var z = def.zones[i];
    if (row >= z[0] && row <= z[1] && col >= z[2] && col <= z[3]) return ROOM_STYLES[z[4]];
  }
  return ROOM_STYLES[def.fallback];
}

const ROOM_RUGS = {
  main: [
    { r0: 6, r1: 7, c0: 4, c1: 8, base: '#8c3d3a', border: '#e2b877', motif: '#c77a57' },
    { r0: 11, r1: 12, c0: 7, c1: 11, base: '#3e5c6c', border: '#dcc39a', motif: '#6f93a3' },
    { r0: 2, r1: 4, c0: 13, c1: 17, base: '#6c5a45', border: '#d8c29a', motif: '#9c8566' }
  ],
  basement: [
    { r0: 10, r1: 12, c0: 11, c1: 14, base: '#7a4d3a', border: '#e0b98a', motif: '#a8715a' }
  ],
  upstairs: [
    { r0: 6, r1: 11, c0: 8, c1: 9, base: '#6b4a6a', border: '#e0c08a', motif: '#946a90' },
    { r0: 3, r1: 4, c0: 11, c1: 15, base: '#8d6a86', border: '#f0d6a8', motif: '#b28ca8' }
  ]
};

function gridAt(floor, row, col) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return T.WALL;
  return floor.grid[row][col];
}

// ======================== FLOOR MATERIALS ========================

function drawPlankFloor(x, y, row, col, st) {
  for (var b = 0; b < 4; b++) {
    var boardRow = row * 4 + b;
    var by = y + b * 6;
    var s = tileSeed(boardRow, col, 11);
    artRect(x, by, TILE_SIZE, 6, shade(st.a, (s - 0.5) * 0.12));
    artRect(x, by + 1, TILE_SIZE, 1, 'rgba(255,240,215,0.10)');
    artRect(x + Math.floor(s * 12), by + 3, 6 + Math.floor(s * 8), 1, 'rgba(80,45,22,0.10)');
    artRect(x, by + 5, TILE_SIZE, 1, 'rgba(62,34,18,0.32)');
    // Staggered plank ends: 48px boards with a per-row offset.
    var offset = (boardRow * 29) % 48;
    var gx = col * TILE_SIZE;
    for (var sx = offset - 48; sx < gx + TILE_SIZE; sx += 48) {
      if (sx >= gx && sx < gx + TILE_SIZE) artRect(x + (sx - gx), by, 1, 5, 'rgba(62,34,18,0.35)');
    }
  }
}

function drawCheckerFloor(x, y, row, col, st) {
  for (var i = 0; i < 2; i++) {
    for (var j = 0; j < 2; j++) {
      var light = ((col * 2 + i) + (row * 2 + j)) % 2 === 0;
      artRect(x + i * 12, y + j * 12, 12, 12, light ? st.a : st.b);
      artRect(x + i * 12, y + j * 12, 12, 1, 'rgba(255,255,255,0.12)');
    }
  }
  artRect(x, y + 11, TILE_SIZE, 1, 'rgba(0,0,0,0.07)');
  artRect(x + 11, y, 1, TILE_SIZE, 'rgba(0,0,0,0.07)');
  artRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1, 'rgba(0,0,0,0.07)');
}

function drawSmallTileFloor(x, y, row, col, st) {
  artRect(x, y, TILE_SIZE, TILE_SIZE, st.a);
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      var s = tileSeed(row * 4 + j, col * 4 + i, 5);
      if (s > 0.8) artRect(x + i * 6, y + j * 6, 6, 6, shade(st.a, -0.05));
      artRect(x + i * 6, y + j * 6, 5, 1, 'rgba(255,255,255,0.35)');
    }
  }
  ctx.fillStyle = 'rgba(40,60,70,0.14)';
  for (var k = 0; k < 4; k++) {
    ctx.fillRect(x + k * 6 + 5, y, 1, TILE_SIZE);
    ctx.fillRect(x, y + k * 6 + 5, TILE_SIZE, 1);
  }
}

function drawCarpetFloor(x, y, row, col, st) {
  artRect(x, y, TILE_SIZE, TILE_SIZE, st.a);
  for (var k = 0; k < 18; k++) {
    var sx = tileSeed(row, col, 20 + k);
    var sy = tileSeed(row, col, 60 + k);
    artRect(x + Math.floor(sx * 23), y + Math.floor(sy * 23), 1, 1,
      k % 2 ? shade(st.a, 0.12) : shade(st.a, -0.1));
  }
}

function drawConcreteFloor(x, y, row, col, st) {
  artRect(x, y, TILE_SIZE, TILE_SIZE, shade(st.a, (tileSeed(row, col, 3) - 0.5) * 0.06));
  for (var k = 0; k < 3; k++) {
    var bx = tileSeed(row, col, 30 + k), by = tileSeed(row, col, 40 + k);
    artEllipse(x + 3 + bx * 18, y + 3 + by * 18, 3 + bx * 3, 2 + by * 2, 'rgba(60,55,50,0.06)');
  }
  for (var d = 0; d < 6; d++) {
    artRect(x + Math.floor(tileSeed(row, col, 70 + d) * 23), y + Math.floor(tileSeed(row, col, 80 + d) * 23), 1, 1, 'rgba(255,255,255,0.16)');
  }
  // Expansion joints every three tiles
  if (col % 3 === 0) artRect(x, y, 1, TILE_SIZE, 'rgba(40,36,32,0.18)');
  if (row % 3 === 0) artRect(x, y, TILE_SIZE, 1, 'rgba(40,36,32,0.18)');
  if (tileSeed(row, col, 99) > 0.9) {
    ctx.strokeStyle = 'rgba(40,36,32,0.25)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 18);
    ctx.lineTo(x + 10, y + 14);
    ctx.lineTo(x + 13, y + 16);
    ctx.lineTo(x + 20, y + 9);
    ctx.stroke();
  }
}

function drawFloorMaterial(x, y, row, col, st) {
  switch (st.floor) {
    case 'plank': drawPlankFloor(x, y, row, col, st); break;
    case 'checker': drawCheckerFloor(x, y, row, col, st); break;
    case 'smallTile': drawSmallTileFloor(x, y, row, col, st); break;
    case 'carpet': drawCarpetFloor(x, y, row, col, st); break;
    default: drawConcreteFloor(x, y, row, col, st);
  }
}

// Ambient occlusion where the floor meets walls and counters.
function drawFloorOcclusion(floor, x, y, row, col) {
  var above = gridAt(floor, row - 1, col);
  if (above === T.WALL || above === T.COUNTER) {
    var g = ctx.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, 'rgba(30,16,10,0.32)');
    g.addColorStop(1, 'rgba(30,16,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, TILE_SIZE, 8);
  }
  if (gridAt(floor, row, col - 1) === T.WALL) {
    var gl = ctx.createLinearGradient(x, 0, x + 5, 0);
    gl.addColorStop(0, 'rgba(30,16,10,0.22)');
    gl.addColorStop(1, 'rgba(30,16,10,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, 5, TILE_SIZE);
  }
  if (gridAt(floor, row, col + 1) === T.WALL) {
    artRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE, 'rgba(30,16,10,0.10)');
  }
}

// ======================== WALLS ========================

function drawWallTile(floor, floorId, x, y, row, col) {
  var belowTile = gridAt(floor, row + 1, col);
  var isFace = row + 1 < MAP_ROWS && belowTile !== T.WALL;
  var st = roomStyleAt(floorId, isFace ? row + 1 : row, col);
  var top = st.top;

  if (!isFace) {
    // Wall top seen from above: dark cap with lit edges where it meets rooms.
    artRect(x, y, TILE_SIZE, TILE_SIZE, top);
    artRect(x, y, TILE_SIZE, TILE_SIZE, 'rgba(255,255,255,0.03)');
    if (gridAt(floor, row, col - 1) !== T.WALL && col > 0) artRect(x, y, 2, TILE_SIZE, shade(top, 0.28));
    if (gridAt(floor, row, col + 1) !== T.WALL && col < MAP_COLS - 1) artRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE, shade(top, -0.3));
    if (gridAt(floor, row - 1, col) !== T.WALL && row > 0) artRect(x, y, TILE_SIZE, 2, shade(top, 0.22));
    return;
  }

  // Front face: cap, painted wall, trim and baseboard.
  artRect(x, y, TILE_SIZE, 5, top);
  artRect(x, y + 4, TILE_SIZE, 1, shade(top, 0.3));
  artRect(x, y + 5, TILE_SIZE, 19, st.wall);
  // Subtle wallpaper stripe
  for (var sx = 2; sx < TILE_SIZE; sx += 6) artRect(x + sx, y + 6, 1, 14, 'rgba(255,255,255,0.07)');
  artRect(x, y + 5, TILE_SIZE, 2, 'rgba(0,0,0,0.12)');
  if (st.wainscot) {
    artRect(x, y + 15, TILE_SIZE, 6, st.wainscot);
    artRect(x, y + 15, TILE_SIZE, 1, st.trim);
  }
  artRect(x, y + 20, TILE_SIZE, 4, st.trim);
  artRect(x, y + 20, TILE_SIZE, 1, 'rgba(0,0,0,0.12)');
  artRect(x, y + 23, TILE_SIZE, 1, 'rgba(0,0,0,0.25)');

  // Corners of a run of wall get a darker edge.
  if (gridAt(floor, row, col - 1) !== T.WALL) artRect(x, y + 5, 1, 19, 'rgba(0,0,0,0.2)');
  if (gridAt(floor, row, col + 1) !== T.WALL) artRect(x + TILE_SIZE - 1, y + 5, 1, 19, 'rgba(0,0,0,0.25)');

  drawWallDecor(floorId, x, y, row, col, st, belowTile);
}

// Windows on exterior walls, picture frames and posters inside.
function drawWallDecor(floorId, x, y, row, col, st, belowTile) {
  var s = tileSeed(row, col, 42);
  var kitchen = st === ROOM_STYLES.kitchen;

  if (kitchen && belowTile === T.COUNTER && col !== 6) {
    // Upper cabinets above the counters.
    artRect(x + 1, y + 6, 22, 11, '#8e6a48');
    artRect(x + 2, y + 7, 9, 9, '#a47c55');
    artRect(x + 13, y + 7, 9, 9, '#a47c55');
    artRect(x + 10, y + 11, 1, 2, '#f0d59a');
    artRect(x + 13, y + 11, 1, 2, '#f0d59a');
    artRect(x + 1, y + 17, 22, 1, 'rgba(0,0,0,0.3)');
    return;
  }

  if (row === 0 && floorId !== FLOOR_IDS.BASEMENT && (col % 4 === 2 || (kitchen && col === 6))) {
    // Exterior window with a sky view and curtains.
    artRect(x + 4, y + 6, 16, 12, '#e9e1d0');
    var sky = ctx.createLinearGradient(0, y + 7, 0, y + 17);
    sky.addColorStop(0, '#8fc2e8');
    sky.addColorStop(1, '#d8ecf5');
    ctx.fillStyle = sky;
    ctx.fillRect(x + 5, y + 7, 14, 10);
    artRect(x + 11, y + 7, 1, 10, '#e9e1d0');
    artRect(x + 5, y + 11, 14, 1, '#e9e1d0');
    artRect(x + 6, y + 8, 3, 2, 'rgba(255,255,255,0.6)');
    artRect(x + 2, y + 6, 3, 13, shade(st.wall, -0.25));
    artRect(x + 19, y + 6, 3, 13, shade(st.wall, -0.25));
    artRect(x + 3, y + 18, 18, 2, '#e9e1d0');
    return;
  }

  if (row === 0 && floorId === FLOOR_IDS.BASEMENT && col % 5 === 2) {
    // Little egress window high on the foundation wall.
    artRect(x + 5, y + 6, 14, 6, '#cfc8b8');
    artRect(x + 6, y + 7, 12, 4, '#9cc5dd');
    artRect(x + 11, y + 7, 1, 4, '#cfc8b8');
    return;
  }

  if (st === ROOM_STYLES.recroom && s > 0.72) {
    // Band poster
    var poster = s > 0.86 ? '#d8574f' : '#e8c15a';
    artRect(x + 6, y + 7, 12, 11, poster);
    artRect(x + 8, y + 9, 8, 5, 'rgba(0,0,0,0.25)');
    artRect(x + 8, y + 15, 8, 1, 'rgba(255,255,255,0.6)');
    return;
  }

  if (s > 0.8 && st.floor !== 'smallTile') {
    // Framed picture
    var art = ['#7fa3b8', '#c98b6a', '#8fb07c', '#b89acb'][Math.floor(s * 100) % 4];
    artRect(x + 6, y + 7, 12, 9, '#6b4a2c');
    artRect(x + 7, y + 8, 10, 7, art);
    artRect(x + 7, y + 12, 10, 3, shade(art, -0.25));
    artEllipse(x + 14, y + 10, 1.5, 1.5, 'rgba(255,245,210,0.8)');
  } else if (s < 0.05) {
    // Light switch
    artRect(x + 16, y + 11, 3, 5, '#f5efe4');
    artRect(x + 17, y + 12, 1, 2, '#bdb3a2');
  }
}

// ======================== DOORS, COUNTERS, STAIRS ========================

function drawDoorwayTile(floor, floorId, x, y, row, col) {
  drawFloorMaterial(x, y, row, col, roomStyleAt(floorId, row, col));
  var st = roomStyleAt(floorId, row + 1, col);
  var wallsLR = gridAt(floor, row, col - 1) === T.WALL && gridAt(floor, row, col + 1) === T.WALL;
  var wallsUD = gridAt(floor, row - 1, col) === T.WALL && gridAt(floor, row + 1, col) === T.WALL;
  if (wallsLR) {
    // Opening in a horizontal wall: frame posts and a threshold.
    artRect(x, y, 3, TILE_SIZE, st.trim);
    artRect(x + TILE_SIZE - 3, y, 3, TILE_SIZE, st.trim);
    artRect(x + 3, y + 10, TILE_SIZE - 6, 4, '#9b7650');
    artRect(x + 3, y + 10, TILE_SIZE - 6, 1, '#c29b6e');
    artRect(x + 3, y, TILE_SIZE - 6, 6, 'rgba(30,16,10,0.25)');
  } else if (wallsUD) {
    artRect(x, y, TILE_SIZE, 3, st.trim);
    artRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3, st.trim);
    artRect(x + 10, y + 3, 4, TILE_SIZE - 6, '#9b7650');
    artRect(x + 10, y + 3, 1, TILE_SIZE - 6, '#c29b6e');
  } else {
    artRect(x + 2, y + 18, TILE_SIZE - 4, 4, '#9b7650');
  }
}

function drawCounterTile(floor, x, y, row, col) {
  var frontVisible = gridAt(floor, row + 1, col) !== T.COUNTER;
  var topH = frontVisible ? 14 : TILE_SIZE;
  // Stone countertop with soft veins
  artRect(x, y, TILE_SIZE, topH, '#e7e2d8');
  artRect(x + Math.floor(tileSeed(row, col, 5) * 12), y + 3, 9, 1, 'rgba(150,140,125,0.35)');
  artRect(x + 4, y + 8 + Math.floor(tileSeed(row, col, 6) * 4), 12, 1, 'rgba(150,140,125,0.25)');
  artRect(x, y, TILE_SIZE, 1, 'rgba(255,255,255,0.6)');
  if (gridAt(floor, row - 1, col) === T.WALL) {
    artRect(x, y, TILE_SIZE, 3, 'rgba(60,40,30,0.18)');
  }
  if (frontVisible) {
    artRect(x, y + 14, TILE_SIZE, 1, '#b9b0a0');
    artRect(x, y + 15, TILE_SIZE, 9, '#8a6546');
    artRect(x + 1, y + 16, 10, 7, '#9c7552');
    artRect(x + 13, y + 16, 10, 7, '#9c7552');
    artRect(x + 9, y + 18, 1, 3, '#f0d59a');
    artRect(x + 14, y + 18, 1, 3, '#f0d59a');
    artRect(x, y + 23, TILE_SIZE, 1, 'rgba(0,0,0,0.35)');
  }
  if (gridAt(floor, row, col - 1) !== T.COUNTER) artRect(x, y, 1, TILE_SIZE, 'rgba(0,0,0,0.25)');
  if (gridAt(floor, row, col + 1) !== T.COUNTER) artRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE, 'rgba(0,0,0,0.3)');
}

// Stairs: 4 treads per tile, rails on the outer edges of the stairwell.
// Treads get lighter toward the top of the flight on floors where the
// stairs lead up, darker where they lead down.
function drawStairTile(floor, floorId, x, y, row, col) {
  var goesDown = floorId === FLOOR_IDS.UPSTAIRS;
  var topRow = row;
  while (gridAt(floor, topRow - 1, col) === T.STAIRS) topRow--;
  for (var i = 0; i < 4; i++) {
    var idx = (row - topRow) * 4 + i;
    var base = goesDown ? shade('#b07a4a', -idx * 0.07) : shade('#8a5a34', idx * 0.05);
    artRect(x, y + i * 6, TILE_SIZE, 6, base);
    artRect(x, y + i * 6, TILE_SIZE, 1, 'rgba(255,235,205,0.28)');
    artRect(x, y + i * 6 + 5, TILE_SIZE, 1, 'rgba(0,0,0,0.25)');
  }
  // Carpet runner down the middle of the stairwell
  var leftStair = gridAt(floor, row, col - 1) === T.STAIRS;
  var rightStair = gridAt(floor, row, col + 1) === T.STAIRS;
  var runX = (!leftStair && rightStair) ? 12 : (leftStair && !rightStair) ? 0 : 6;
  artRect(x + runX, y, 12, TILE_SIZE, 'rgba(128,48,58,0.45)');
  for (var t = 0; t < 4; t++) artRect(x + runX, y + t * 6 + 4, 12, 1, 'rgba(230,190,120,0.5)');
  if (gridAt(floor, row, col - 1) !== T.STAIRS) {
    artRect(x, y, 4, TILE_SIZE, '#5a3418');
    artRect(x + 1, y, 1, TILE_SIZE, '#8a5a34');
  }
  if (gridAt(floor, row, col + 1) !== T.STAIRS) {
    artRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE, '#5a3418');
    artRect(x + TILE_SIZE - 2, y, 1, TILE_SIZE, '#8a5a34');
  }
}

// ======================== STATIC PASS 1: BASE ========================

function drawInteriorBase(floor, row, col) {
  var floorId = gameState.currentFloor;
  var tile = floor.grid[row][col];
  var x = col * TILE_SIZE;
  var y = row * TILE_SIZE;

  if (tile === T.WALL) { drawWallTile(floor, floorId, x, y, row, col); return; }
  if (tile === T.DOOR) { drawDoorwayTile(floor, floorId, x, y, row, col); return; }
  if (tile === T.STAIRS) { drawStairTile(floor, floorId, x, y, row, col); return; }
  if (tile === T.COUNTER) { drawCounterTile(floor, x, y, row, col); return; }

  drawFloorMaterial(x, y, row, col, roomStyleAt(floorId, row, col));
  drawFloorOcclusion(floor, x, y, row, col);
}

function drawRug(rug) {
  var x = rug.c0 * TILE_SIZE + 4;
  var y = rug.r0 * TILE_SIZE + 4;
  var w = (rug.c1 - rug.c0 + 1) * TILE_SIZE - 8;
  var h = (rug.r1 - rug.r0 + 1) * TILE_SIZE - 8;
  artRound(x + 1, y + 2, w, h, 3, 'rgba(30,16,10,0.2)');
  artRound(x, y, w, h, 3, rug.border);
  artRect(x + 3, y + 3, w - 6, h - 6, rug.base);
  ctx.strokeStyle = rug.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
  // Diamond motif down the middle
  ctx.fillStyle = rug.motif;
  var horizontal = w >= h;
  var count = Math.max(1, Math.floor((horizontal ? w : h) / 22));
  for (var i = 0; i < count; i++) {
    var cx = horizontal ? x + (i + 0.5) * (w / count) : x + w / 2;
    var cy = horizontal ? y + h / 2 : y + (i + 0.5) * (h / count);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx - 6, cy);
    ctx.closePath();
    ctx.fill();
  }
  // Fringe
  ctx.fillStyle = shade(rug.border, 0.2);
  if (horizontal) {
    for (var fy = y + 3; fy < y + h - 2; fy += 3) {
      ctx.fillRect(x - 2, fy, 2, 1);
      ctx.fillRect(x + w, fy, 2, 1);
    }
  } else {
    for (var fx = x + 3; fx < x + w - 2; fx += 3) {
      ctx.fillRect(fx, y - 2, 1, 2);
      ctx.fillRect(fx, y + h, 1, 2);
    }
  }
}

// ======================== STATIC PASS 2: OBJECTS ========================

// Furniture tiles (T.FURNITURE) by position. Multi-tile pieces are drawn from
// their top-left anchor; covered tiles and tiles an interactable draws over
// are listed as 'skip'.
const FURNITURE_LAYOUT = {
  main: {
    '3,9': 'diningTable', '3,10': 'skip', '4,9': 'skip', '4,10': 'skip',
    '6,3': 'armchairRight', '7,3': 'armchairRight',
    '8,3': 'skip', '8,4': 'skip', '8,16': 'skip',
    '10,1': 'toilet', '11,1': 'vanity',
    '10,12': 'piano', '10,13': 'skip'
  },
  basement: {
    '3,16': 'weightBench', '7,16': 'dumbbellRack',
    '7,1': 'shelfUnit', '9,3': 'toilet', '9,6': 'vanity', '11,1': 'showerStall', '11,7': 'towelShelf',
    '9,13': 'skip', '9,14': 'couch', '9,15': 'skip', '11,15': 'beanbag'
  },
  upstairs: {
    '2,2': 'doubleBed', '2,3': 'skip', '2,16': 'skip', '3,17': 'skip',
    '3,7': 'catBed', '8,3': 'desk', '9,3': 'skip',
    '8,17': 'toilet', '10,14': 'vanity', '11,16': 'bathtub'
  }
};

function drawInteriorObjects(floor) {
  var floorId = gameState.currentFloor;
  var rugs = ROOM_RUGS[floorId] || [];
  for (var i = 0; i < rugs.length; i++) drawRug(rugs[i]);

  var layout = FURNITURE_LAYOUT[floorId] || {};
  for (var r = 0; r < MAP_ROWS; r++) {
    for (var c = 0; c < MAP_COLS; c++) {
      if (floor.grid[r][c] !== T.FURNITURE) continue;
      var piece = layout[r + ',' + c] || 'cabinet';
      if (piece === 'skip') continue;
      var fn = FURNITURE_ART[piece] || FURNITURE_ART.cabinet;
      fn(c * TILE_SIZE, r * TILE_SIZE);
    }
  }
}

const FURNITURE_ART = {
  cabinet: function (x, y) {
    artBox(x + 2, y + 3, 20, 19, 8, '#a57b53', '#7d5a3a');
    artRect(x + 11, y + 16, 2, 3, '#f0d59a');
  },

  diningTable: function (x, y) {
    // 2x2 table with four chairs
    var chair = function (cx, cy) {
      artShadow(cx + 5, cy + 9, 6, 2, 0.18);
      artRound(cx, cy, 10, 10, 2, '#7a5236');
      artRound(cx + 1, cy + 1, 8, 7, 2, '#c58d5e');
    };
    chair(x + 8, y + 1); chair(x + 30, y + 1);
    chair(x + 8, y + 37); chair(x + 30, y + 37);
    artShadow(x + 25, y + 38, 20, 4, 0.25);
    artRound(x + 3, y + 8, 42, 30, 3, '#6d4526');
    artRound(x + 3, y + 7, 42, 27, 3, '#9a6a3e');
    artRect(x + 5, y + 9, 38, 2, 'rgba(255,230,200,0.25)');
    // Table runner, placemats, a fruit bowl
    artRect(x + 20, y + 8, 8, 26, '#e7d8b8');
    artRound(x + 7, y + 12, 9, 7, 2, '#d8c29a');
    artRound(x + 32, y + 22, 9, 7, 2, '#d8c29a');
    artEllipse(x + 24, y + 20, 6, 4, '#e9e3d6');
    artEllipse(x + 22, y + 19, 2, 2, '#e0593b');
    artEllipse(x + 26, y + 19, 2, 2, '#f1b64a');
    artEllipse(x + 24, y + 21, 2, 2, '#8fbf4a');
    // Muddy paw prints on the tabletop — "table privileges were revoked YEARS ago"
    ctx.fillStyle = 'rgba(70,45,30,0.45)';
    [[10, 26], [14, 30], [36, 13]].forEach(function (p) {
      ctx.fillRect(x + p[0], y + p[1], 2, 2);
      ctx.fillRect(x + p[0] - 1, y + p[1] - 2, 1, 1);
      ctx.fillRect(x + p[0] + 1, y + p[1] - 2, 1, 1);
      ctx.fillRect(x + p[0] + 3, y + p[1] - 1, 1, 1);
    });
  },

  armchairRight: function (x, y) {
    artShadow(x + 13, y + 21, 10, 3, 0.2);
    artRound(x + 3, y + 3, 18, 19, 4, '#5e7c6c');
    artRound(x + 3, y + 3, 6, 19, 3, '#476251');
    artRound(x + 9, y + 3, 12, 5, 2, '#476251');
    artRound(x + 9, y + 17, 12, 5, 2, '#476251');
    artRound(x + 9, y + 8, 11, 9, 2, '#7c9c89');
    artRect(x + 10, y + 9, 9, 1, 'rgba(255,255,255,0.25)');
  },

  toilet: function (x, y) {
    artShadow(x + 12, y + 20, 7, 2, 0.2);
    artRound(x + 6, y + 2, 12, 7, 2, '#f4f6f6', 'rgba(60,70,80,0.4)');
    artEllipse(x + 12, y + 14, 6, 7, '#f7f9f9');
    ctx.strokeStyle = 'rgba(60,70,80,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x + 12, y + 14, 6, 7, 0, 0, Math.PI * 2); ctx.stroke();
    artEllipse(x + 12, y + 15, 3.5, 4.5, '#cfe3ea');
    artRect(x + 15, y + 4, 2, 1, '#aab4ba');
  },

  vanity: function (x, y) {
    artBox(x + 2, y + 3, 20, 19, 7, '#f1ede6', '#a98a6b');
    artEllipse(x + 12, y + 9, 6, 4, '#cfe3ea');
    ctx.strokeStyle = 'rgba(90,100,110,0.5)';
    ctx.beginPath(); ctx.ellipse(x + 12, y + 9, 6, 4, 0, 0, Math.PI * 2); ctx.stroke();
    artRect(x + 11, y + 3, 2, 4, '#b9c2c8');
    artRect(x + 6, y + 17, 12, 1, '#e6c98f');
  },

  piano: function (x, y) {
    artShadow(x + 24, y + 22, 22, 3, 0.25);
    artRect(x + 2, y + 2, 44, 12, '#2a2226');
    artRect(x + 2, y + 2, 44, 2, '#4a3e44');
    artRect(x + 4, y + 13, 40, 6, '#f5f1e8');
    for (var k = 0; k < 13; k++) artRect(x + 4 + k * 3 + 2, y + 13, 1, 6, 'rgba(0,0,0,0.25)');
    for (var b = 0; b < 12; b++) if (b % 7 !== 2 && b % 7 !== 6) artRect(x + 5 + b * 3 + 1, y + 13, 2, 3, '#1e181b');
    artRect(x + 2, y + 19, 44, 3, '#2a2226');
    // Sheet music and a sleeping-cat-shaped dent on the lid
    artRect(x + 18, y + 4, 10, 7, '#f4eddc');
    artRect(x + 19, y + 6, 8, 1, '#9a8a70');
    artRect(x + 19, y + 8, 6, 1, '#9a8a70');
    artEllipse(x + 38, y + 7, 5, 2.5, 'rgba(255,255,255,0.1)');
  },

  weightBench: function (x, y) {
    artShadow(x + 12, y + 21, 10, 2, 0.25);
    artRect(x + 3, y + 5, 18, 2, '#9aa3ad');
    artEllipse(x + 3, y + 6, 2.5, 4, '#2c2f33');
    artEllipse(x + 21, y + 6, 2.5, 4, '#2c2f33');
    artRound(x + 8, y + 7, 8, 14, 2, '#8b2e33');
    artRect(x + 9, y + 8, 6, 1, 'rgba(255,255,255,0.25)');
  },

  dumbbellRack: function (x, y) {
    artBox(x + 2, y + 6, 20, 15, 5, '#3c4148', '#2a2e33');
    for (var i = 0; i < 3; i++) {
      artRect(x + 5 + i * 5, y + 9, 3, 1, '#9aa3ad');
      artRect(x + 4 + i * 5, y + 8, 2, 3, ['#d9534f', '#f0ad4e', '#5bc0de'][i]);
      artRect(x + 8 + i * 5, y + 8, 2, 3, ['#d9534f', '#f0ad4e', '#5bc0de'][i]);
    }
  },

  shelfUnit: function (x, y) {
    artBox(x + 2, y + 2, 20, 20, 6, '#8f8a82', '#6c6862');
    artRect(x + 4, y + 4, 7, 5, '#c89b64');
    artRect(x + 13, y + 4, 7, 5, '#7fa7c0');
    artRect(x + 4, y + 10, 16, 1, 'rgba(0,0,0,0.25)');
  },

  showerStall: function (x, y) {
    artRect(x + 1, y + 1, 22, 22, '#dfe8ea');
    ctx.fillStyle = 'rgba(40,60,70,0.12)';
    for (var k = 0; k < 4; k++) { ctx.fillRect(x + 1 + k * 6, y + 1, 1, 22); ctx.fillRect(x + 1, y + 1 + k * 6, 22, 1); }
    artEllipse(x + 12, y + 12, 2, 2, '#8a979d');
    artRect(x + 1, y + 1, 22, 22, 'rgba(160,210,230,0.25)');
    ctx.strokeStyle = 'rgba(80,110,125,0.6)';
    ctx.strokeRect(x + 1.5, y + 1.5, 21, 21);
    artRect(x + 3, y + 3, 1, 12, 'rgba(255,255,255,0.7)');
  },

  towelShelf: function (x, y) {
    artBox(x + 3, y + 5, 18, 16, 6, '#b99873', '#8e7053');
    artRound(x + 5, y + 7, 6, 5, 1, '#e9a1a8');
    artRound(x + 12, y + 7, 6, 5, 1, '#9ec9d4');
  },

  couch: function (x, y) {
    // Two-seat couch facing up toward the gaming setup
    artShadow(x + 24, y + 22, 22, 3, 0.25);
    artRound(x + 2, y + 4, 44, 19, 4, '#3f4c63');
    artRound(x + 2, y + 16, 44, 7, 3, '#2f3a4e');
    artRound(x + 2, y + 4, 5, 16, 2, '#2f3a4e');
    artRound(x + 41, y + 4, 5, 16, 2, '#2f3a4e');
    artRound(x + 8, y + 5, 15, 11, 2, '#566580');
    artRound(x + 25, y + 5, 15, 11, 2, '#566580');
    artRect(x + 9, y + 6, 13, 1, 'rgba(255,255,255,0.2)');
    artRect(x + 26, y + 6, 13, 1, 'rgba(255,255,255,0.2)');
    // A game controller left on the cushion
    artRound(x + 29, y + 9, 7, 4, 2, '#1d1f24');
  },

  beanbag: function (x, y) {
    artShadow(x + 12, y + 19, 10, 3, 0.25);
    artEllipse(x + 12, y + 13, 10, 8, '#d68a3c');
    artEllipse(x + 11, y + 12, 6, 4, '#e8a45a');
    artEllipse(x + 9, y + 10, 2, 1, 'rgba(255,255,255,0.35)');
  },

  doubleBed: function (x, y) {
    // Marice's bed spans cols 2-3
    artShadow(x + 24, y + 23, 23, 3, 0.25);
    artRect(x + 1, y - 2, 46, 5, '#6b4526');
    artRect(x + 1, y - 2, 46, 1, '#94663d');
    artRound(x + 2, y + 2, 44, 21, 2, '#f5efe4');
    artRound(x + 5, y + 3, 17, 6, 2, '#ffffff', 'rgba(150,140,130,0.5)');
    artRound(x + 26, y + 3, 17, 6, 2, '#ffffff', 'rgba(150,140,130,0.5)');
    artRound(x + 2, y + 11, 44, 12, 2, '#7d6bb5');
    artRect(x + 2, y + 11, 44, 2, '#9b8bd0');
    for (var q = 6; q < 46; q += 8) artRect(x + q, y + 14, 1, 8, 'rgba(0,0,0,0.12)');
  },

  catBed: function (x, y) {
    artShadow(x + 12, y + 18, 10, 3, 0.2);
    artEllipse(x + 12, y + 13, 10, 8, '#b85c62');
    artEllipse(x + 12, y + 13, 7, 5, '#f1d9c9');
    artEllipse(x + 10, y + 12, 2, 1.5, 'rgba(255,255,255,0.5)');
    // A single shed black hair — Beatrice was here
    ctx.strokeStyle = 'rgba(20,20,20,0.7)';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x + 11, y + 14); ctx.quadraticCurveTo(x + 14, y + 12, x + 16, y + 15); ctx.stroke();
  },

  desk: function (x, y) {
    // 1x2 desk spanning rows 8-9
    artShadow(x + 12, y + 46, 11, 3, 0.25);
    artRect(x + 2, y + 2, 20, 44, '#8a5f3b');
    artRect(x + 2, y + 2, 20, 40, '#a8774b');
    artRect(x + 2, y + 2, 20, 1, 'rgba(255,235,205,0.35)');
    ctx.strokeStyle = 'rgba(38,22,16,0.55)';
    ctx.strokeRect(x + 2.5, y + 2.5, 19, 43);
    // Monitor, keyboard, mug, "WANTED" sticky note
    artRect(x + 4, y + 6, 16, 11, '#1f2329');
    artRect(x + 5, y + 7, 14, 8, '#6fa6d6');
    artRect(x + 6, y + 8, 6, 2, 'rgba(255,255,255,0.5)');
    artRect(x + 10, y + 17, 4, 2, '#1f2329');
    artRect(x + 5, y + 22, 14, 5, '#d9d4cc');
    for (var k = 0; k < 4; k++) artRect(x + 6 + k * 3, y + 23, 2, 1, '#9a948a');
    artEllipse(x + 8, y + 34, 3, 3, '#f2f0ea');
    artEllipse(x + 8, y + 34, 2, 2, '#7a4b2c');
    artRect(x + 13, y + 31, 6, 6, '#f7e27a');
    artRect(x + 14, y + 33, 4, 1, '#b5541f');
  },

  bathtub: function (x, y) {
    artShadow(x + 12, y + 22, 11, 2, 0.2);
    artRound(x + 1, y + 1, 22, 22, 6, '#f6f8f8', 'rgba(80,100,110,0.5)');
    artRound(x + 4, y + 4, 16, 16, 5, '#bfe0ea');
    artEllipse(x + 9, y + 9, 3, 2, 'rgba(255,255,255,0.8)');
    artEllipse(x + 15, y + 14, 2, 1.5, 'rgba(255,255,255,0.8)');
    // Rubber duck
    artEllipse(x + 14, y + 8, 2.5, 2, '#f4c430');
    artRect(x + 16, y + 7, 1, 1, '#e87a2e');
  }
};

// ======================== STORY DECALS (per frame) ========================

// The crumb trail: from the tipped treat jar on the kitchen island, across the
// living room and straight to the basement door. The crumbs stay until the
// case is closed and Marice finally gets to vacuum.
const CRUMB_TRAILS = {
  main: [[5, 5], [5, 6], [5, 7], [5, 8], [5, 9], [5, 10], [5, 11], [5, 12], [5, 13], [5, 14], [5, 15], [5, 16], [5, 17], [6, 17], [7, 17]],
  basement: [[3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], [4, 11], [5, 11], [5, 12], [6, 11], [6, 13]]
};

// Wisps of long black fur leading from the stairs to the guest bedroom —
// the mastermind's only mistake.
const FUR_TRAIL_UPSTAIRS = [[11, 9], [10, 10], [9, 10], [8, 11], [7, 11], [6, 11], [5, 12], [4, 13], [3, 14]];

function drawStoryDecals(floorId) {
  var flags = gameState.flags;
  var trail = CRUMB_TRAILS[floorId];
  if (trail && !flags.game_complete && !(floorId === FLOOR_IDS.BASEMENT && flags.olive_fed)) {
    for (var i = 0; i < trail.length; i++) {
      var r = trail[i][0], c = trail[i][1];
      var x = c * TILE_SIZE, y = r * TILE_SIZE;
      var n = 2 + Math.floor(tileSeed(r, c, 199) * 2);
      for (var k = 0; k < n; k++) {
        var sx = tileSeed(r, c, 200 + k), sy = tileSeed(r, c, 300 + k);
        var px = x + 4 + Math.floor(sx * 16), py = y + 7 + Math.floor(sy * 10);
        artRect(px, py, 1.5, 1.5, '#8a5428');
        artRect(px, py, 0.8, 0.8, '#d9a060');
      }
    }
  }
  if (floorId === FLOOR_IDS.UPSTAIRS && !flags.beatrice_fed) {
    ctx.strokeStyle = 'rgba(18,18,20,0.75)';
    ctx.lineWidth = 0.8;
    for (var j = 0; j < FUR_TRAIL_UPSTAIRS.length; j++) {
      var fr = FUR_TRAIL_UPSTAIRS[j][0], fc = FUR_TRAIL_UPSTAIRS[j][1];
      var fx = fc * TILE_SIZE + 6 + tileSeed(fr, fc, 7) * 10;
      var fy = fr * TILE_SIZE + 8 + tileSeed(fr, fc, 8) * 8;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + 3, fy - 3, fx + 6, fy);
      ctx.moveTo(fx + 1, fy + 2);
      ctx.quadraticCurveTo(fx + 4, fy, fx + 7, fy + 3);
      ctx.stroke();
    }
  }
}

// ======================== PROP SPRITES (per frame) ========================

function drawToyGlow(x, y, found) {
  if (found) {
    ctx.fillStyle = 'rgba(255,105,180,0.18)';
    ctx.fillRect(x + 9, y + 12, 6, 5);
    return;
  }
  var pulse = (Math.sin(animTimer * 0.1) + 1) / 2;
  var g = ctx.createRadialGradient(x + 12, y + 12, 1, x + 12, y + 12, 12);
  g.addColorStop(0, 'rgba(255,140,200,' + (0.45 + pulse * 0.25) + ')');
  g.addColorStop(1, 'rgba(255,140,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // Paw print
  artEllipse(x + 12, y + 15, 4, 3, '#ff5fa8');
  artEllipse(x + 7, y + 10, 1.8, 2, '#ff5fa8');
  artEllipse(x + 10.5, y + 8, 1.8, 2, '#ff5fa8');
  artEllipse(x + 14, y + 8, 1.8, 2, '#ff5fa8');
  artEllipse(x + 17, y + 10, 1.8, 2, '#ff5fa8');
  // Sparkle
  var sp = Math.floor(animTimer / 8) % 4;
  artRect(x + 19 - sp, y + 3 + sp, 1, 3, 'rgba(255,255,255,0.9)');
  artRect(x + 18 - sp, y + 4 + sp, 3, 1, 'rgba(255,255,255,0.9)');
}

function drawDiaryPage(x, y, found) {
  if (found) {
    artRect(x + 7, y + 6, 10, 13, 'rgba(253,246,227,0.18)');
    return;
  }
  var pulse = (Math.sin(animTimer * 0.08) + 1) / 2;
  var g = ctx.createRadialGradient(x + 12, y + 12, 1, x + 12, y + 12, 13);
  g.addColorStop(0, 'rgba(255,226,130,' + (0.4 + pulse * 0.25) + ')');
  g.addColorStop(1, 'rgba(255,226,130,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 1, y - 1, TILE_SIZE + 2, TILE_SIZE + 2);
  var bob = Math.sin(animTimer * 0.06) * 1;
  ctx.save();
  ctx.translate(x + 12, y + 12 + bob);
  ctx.rotate(-0.12);
  artShadow(1, 9, 6, 1.5, 0.2);
  artRect(-6, -8, 12, 15, '#fdf6e3');
  artRect(-6, -8, 12, 1, '#fffdf6');
  artRect(-6, 6, 12, 1, '#d8c7a4');
  ctx.fillStyle = '#9a7c55';
  ctx.fillRect(-4, -5, 8, 1);
  ctx.fillRect(-4, -2, 8, 1);
  ctx.fillRect(-4, 1, 6, 1);
  ctx.fillStyle = '#d65f7a';
  ctx.fillRect(2, 3, 2, 2);
  ctx.restore();
}

const ART = {
  // Returns true when this interactable was drawn here.
  drawInteractable: function (obj, x, y) {
    var fn = ART.props[obj.type];
    if (!fn) return false;
    fn(x, y, obj);
    return true;
  },

  props: {
    // ---------- Kitchen ----------
    fridge: function (x, y) {
      artShadow(x + 12, y + 23, 10, 2, 0.25);
      artRound(x + 2, y + 0, 20, 23, 2, '#e3ebf1', 'rgba(60,80,95,0.55)');
      artRect(x + 2, y + 9, 20, 1, 'rgba(60,80,95,0.45)');
      artRect(x + 17, y + 3, 2, 5, '#9aa8b4');
      artRect(x + 17, y + 12, 2, 8, '#9aa8b4');
      artRect(x + 4, y + 2, 1, 6, 'rgba(255,255,255,0.8)');
      // Magnets and a cat drawing
      artRect(x + 6, y + 12, 7, 6, '#fffdf4');
      artEllipse(x + 9.5, y + 15, 2, 1.5, '#e07a3a');
      artRect(x + 7, y + 4, 2, 2, '#e05a5a');
      artRect(x + 11, y + 5, 2, 2, '#5aa0e0');
    },
    stove: function (x, y) {
      artShadow(x + 12, y + 23, 10, 2, 0.25);
      artRect(x + 1, y + 1, 22, 22, '#3d3f44');
      artRect(x + 1, y + 1, 22, 3, '#55585e');
      artRect(x + 2, y + 5, 20, 10, '#1f2024');
      [[6, 8], [16, 8], [6, 12], [16, 12]].forEach(function (b) {
        ctx.strokeStyle = '#6b6e75';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + b[0] + 0.5, y + b[1] + 0.5, 2.5, 0, Math.PI * 2); ctx.stroke();
      });
      // Oven door with a warm glow — "still warm from breakfast"
      artRect(x + 3, y + 16, 18, 6, '#2a2c30');
      artRect(x + 5, y + 17, 14, 3, 'rgba(255,160,70,' + (0.35 + Math.sin(animTimer * 0.05) * 0.08) + ')');
      artRect(x + 4, y + 15, 16, 1, '#9aa0a8');
      for (var k = 0; k < 4; k++) artEllipse(x + 5 + k * 5, y + 3, 1, 1, '#c9ccd1');
    },
    kitchen_sink: function (x, y) {
      artShadow(x + 12, y + 23, 10, 2, 0.2);
      artRect(x + 1, y + 1, 22, 14, '#e7e2d8');
      artRect(x + 1, y + 15, 22, 8, '#8a6546');
      artRect(x + 2, y + 16, 9, 6, '#9c7552');
      artRect(x + 13, y + 16, 9, 6, '#9c7552');
      artRound(x + 4, y + 4, 16, 9, 2, '#b9c6cc');
      artRound(x + 5, y + 5, 14, 7, 2, '#d8e6ec');
      artRect(x + 11, y + 1, 2, 5, '#8c969c');
      artRect(x + 9, y + 1, 6, 1, '#8c969c');
      // The single incriminating crumb
      artRect(x + 14, y + 9, 2, 2, '#7a4a22');
    },
    coffee_station: function (x, y) {
      artShadow(x + 12, y + 22, 9, 2, 0.2);
      artRound(x + 4, y + 3, 11, 17, 2, '#2d2a2c');
      artRect(x + 5, y + 4, 9, 3, '#4a4648');
      artRect(x + 6, y + 11, 7, 7, '#1b191a');
      artRect(x + 7, y + 14, 5, 4, '#f3efe6');
      artRect(x + 7, y + 14, 5, 1, '#6b4128');
      artEllipse(x + 12, y + 5, 1, 1, '#6cd46c');
      // Mug with steam
      artRound(x + 16, y + 13, 5, 6, 1, '#d65f5f');
      artRect(x + 21, y + 14, 1, 3, '#d65f5f');
      var st = (animTimer % 60) / 60;
      artRect(x + 18, y + 11 - Math.floor(st * 5), 1, 2, 'rgba(255,255,255,' + (0.6 - st * 0.6) + ')');
    },
    microwave: function (x, y) {
      artShadow(x + 12, y + 20, 10, 2, 0.2);
      artRound(x + 2, y + 6, 20, 13, 2, '#e4e6e8', 'rgba(60,70,80,0.5)');
      artRect(x + 4, y + 8, 12, 9, '#2c3134');
      artRect(x + 5, y + 9, 5, 2, 'rgba(255,255,255,0.25)');
      // Blinking 12:00
      if (Math.floor(animTimer / 30) % 2 === 0) artRect(x + 17, y + 9, 4, 2, '#58e07a');
      artRect(x + 18, y + 13, 2, 3, '#9aa4ab');
    },
    trash_can: function (x, y) {
      artShadow(x + 12, y + 22, 7, 2, 0.25);
      artRound(x + 6, y + 6, 12, 16, 2, '#9aa4ab', 'rgba(40,50,55,0.6)');
      artRect(x + 8, y + 8, 1, 12, 'rgba(255,255,255,0.4)');
      artRound(x + 5, y + 4, 14, 4, 2, '#7c868d');
      artRect(x + 10, y + 3, 4, 1, '#5c656b');
    },
    cupboard_empty: function (x, y) { drawPantry(x, y, null); },
    cupboard_purrpops: function (x, y) { drawPantry(x, y, 'treat'); },
    cupboard_feast: function (x, y) { drawPantry(x, y, 'feast'); },

    treat_jar: function (x, y) {
      var done = gameState.flags.game_complete;
      if (done) {
        // Upright, refilled, and weighed down with a brick.
        artShadow(x + 12, y + 12, 6, 2, 0.25);
        artRound(x + 7, y + 1, 10, 11, 3, 'rgba(210,235,245,0.75)', 'rgba(90,120,135,0.8)');
        artRect(x + 8, y + 5, 8, 6, '#c9853f');
        artRect(x + 6, y - 1, 12, 3, '#b0513e');
        artRect(x + 6, y - 1, 12, 1, '#d2715d');
        return;
      }
      // Tipped on its side, lid rolled away, crumbs spilling out.
      artShadow(x + 12, y + 12, 9, 2, 0.28);
      ctx.save();
      ctx.translate(x + 11, y + 7);
      ctx.rotate(-0.2);
      artRound(-8, -4, 15, 9, 3, 'rgba(210,235,245,0.7)', 'rgba(90,120,135,0.85)');
      artRect(-7, 1, 13, 3, 'rgba(201,133,63,0.55)');
      artRect(-6, -3, 9, 1, 'rgba(255,255,255,0.8)');
      artRect(7, -3, 2, 7, '#8fa3ad');
      ctx.restore();
      artEllipse(x + 4, y + 11, 3, 1.5, '#b0513e');
      artRect(x + 2, y + 10, 4, 1, '#d2715d');
      for (var k = 0; k < 6; k++) {
        artRect(x + 15 + (k * 3) % 8, y + 8 + (k * 5) % 6, 2, 2, k % 2 ? '#7a4a22' : '#c98a4a');
      }
      // Evidence marker tent
      artRect(x + 19, y + 1, 4, 5, '#f2c43a');
      artRect(x + 20, y + 2, 2, 3, '#1c1c1c');
    },

    // ---------- Dining ----------
    dining_table: function (x, y) {
      // A chair pulled out from the table, facing it.
      artShadow(x + 12, y + 18, 8, 3, 0.2);
      artRound(x + 4, y + 6, 14, 13, 2, '#7a5236');
      artRound(x + 4, y + 6, 14, 11, 2, '#c58d5e');
      artRect(x + 18, y + 5, 3, 15, '#7a5236');
      artRect(x + 5, y + 7, 12, 1, 'rgba(255,235,205,0.35)');
      // Muddy prints on the seat — a launch pad onto the table.
      ctx.fillStyle = 'rgba(70,45,30,0.5)';
      ctx.fillRect(x + 8, y + 10, 2, 2);
      ctx.fillRect(x + 12, y + 12, 2, 2);
    },
    pet_cam: function (x, y) {
      // Sideboard with the pet cam, rotated to face the wall.
      artBox(x + 1, y + 6, 22, 16, 7, '#8b6341', '#6b4a30');
      artRect(x + 11, y + 16, 2, 2, '#f0d59a');
      var fixed = gameState.flags.game_complete;
      ctx.save();
      ctx.translate(x + 11, y + 8);
      ctx.rotate(fixed ? 0 : -2.6);
      artRound(-4, -4, 8, 8, 3, '#f3f3f0', 'rgba(40,40,45,0.7)');
      artEllipse(0, 1, 2.3, 2.3, '#1e2a33');
      artEllipse(-0.6, 0.4, 0.8, 0.8, '#6fb6e8');
      ctx.restore();
      var on = Math.floor(animTimer / 25) % 2 === 0;
      artRect(x + 16, y + 7, 2, 2, fixed ? '#58e07a' : (on ? '#ff4040' : '#5a1a1a'));
    },
    china_cabinet: function (x, y) {
      artShadow(x + 12, y + 23, 11, 2, 0.25);
      artRect(x + 1, y + 0, 22, 23, '#6d4a2e');
      artRect(x + 3, y + 2, 18, 11, '#cfe0e6');
      artRect(x + 11, y + 2, 1, 11, '#6d4a2e');
      artRect(x + 3, y + 7, 18, 1, '#6d4a2e');
      artEllipse(x + 6, y + 5, 2, 1.5, '#ffffff');
      artEllipse(x + 16, y + 5, 2, 1.5, '#ffffff');
      artEllipse(x + 7, y + 11, 2.5, 1.2, '#e8c47a');
      artRect(x + 14, y + 9, 5, 3, '#a8d4e6');
      artRect(x + 3, y + 14, 18, 8, '#855c39');
      artRect(x + 11, y + 17, 2, 2, '#f0d59a');
      artRect(x + 3, y + 2, 1, 10, 'rgba(255,255,255,0.7)');
    },
    plant: function (x, y) { drawPottedPlant(x, y); },
    plant_hallway: function (x, y) { drawPottedPlant(x, y); },
    cat_alice: function (x, y) {
      // Tall sisal cat tree — Alice's "vantage point"
      artShadow(x + 12, y + 22, 10, 3, 0.28);
      artRound(x + 3, y + 17, 18, 6, 2, '#9c8266');
      artRect(x + 10, y - 6, 5, 24, '#c9b48a');
      for (var k = -5; k < 17; k += 3) artRect(x + 10, y + k, 5, 1, 'rgba(120,95,60,0.45)');
      artRound(x + 2, y + 6, 12, 5, 2, '#8a7057');
      artRound(x + 2, y + 5, 12, 4, 2, '#b39878');
      artRound(x + 4, y - 9, 16, 6, 3, '#8a7057');
      artRound(x + 4, y - 10, 16, 5, 3, '#b39878');
      // Dangling pom-pom
      var sw = Math.sin(animTimer * 0.07) * 2;
      artRect(x + 4 + sw * 0.3, y + 9, 1, 5, '#e8e0d0');
      artEllipse(x + 4 + sw, y + 15, 2, 2, '#ff8fb8');
      if (!gameState.flags.alice_fed) {
        SPRITES.cat(x, y - 18, CAT_COLORS.alice[0], CAT_COLORS.alice[1], 'alice');
      }
    },

    // ---------- Living room ----------
    floor_lamp: function (x, y) {
      artShadow(x + 12, y + 22, 5, 1.5, 0.3);
      artEllipse(x + 12, y + 21, 4, 1.5, '#3b2a21');
      artRect(x + 11, y + 6, 2, 15, '#6b5140');
      var g = ctx.createRadialGradient(x + 12, y + 4, 1, x + 12, y + 4, 10);
      g.addColorStop(0, 'rgba(255,230,160,0.55)');
      g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y - 6, 24, 20);
      ctx.fillStyle = '#f2dfb3';
      ctx.beginPath();
      ctx.moveTo(x + 7, y + 7); ctx.lineTo(x + 17, y + 7); ctx.lineTo(x + 15, y - 1); ctx.lineTo(x + 9, y - 1);
      ctx.closePath(); ctx.fill();
      artRect(x + 7, y + 6, 10, 1, '#d8bf8a');
    },
    coffee_table: function (x, y) {
      artShadow(x + 12, y + 20, 11, 3, 0.25);
      artRound(x + 1, y + 7, 22, 12, 3, '#5d3d26');
      artRound(x + 1, y + 6, 22, 10, 3, '#8b6041');
      artRect(x + 3, y + 7, 18, 1, 'rgba(255,235,205,0.3)');
      // Books + a mug ring + paw prints in the dust
      artRect(x + 4, y + 8, 7, 5, '#b8574f');
      artRect(x + 5, y + 9, 5, 3, '#d4776e');
      artEllipse(x + 16, y + 11, 2.5, 2, 'rgba(60,35,20,0.4)');
      ctx.fillStyle = 'rgba(245,235,215,0.45)';
      ctx.fillRect(x + 13, y + 7, 2, 2);
      ctx.fillRect(x + 18, y + 9, 2, 2);
    },
    tv: function (x, y) {
      artShadow(x + 12, y + 23, 11, 2, 0.25);
      artRect(x + 1, y + 15, 22, 8, '#5d4331');
      artRect(x + 1, y + 15, 22, 1, '#7f5e45');
      artRect(x + 3, y + 18, 8, 4, '#4a3526');
      artRect(x + 13, y + 18, 8, 4, '#4a3526');
      artRect(x + 2, y + 1, 20, 13, '#111317');
      var flick = 0.8 + Math.sin(animTimer * 0.35) * 0.1 + (Math.random() > 0.97 ? 0.2 : 0);
      ctx.fillStyle = 'rgba(120,190,255,' + flick + ')';
      ctx.fillRect(x + 3, y + 2, 18, 11);
      // Bird video: a little bird hopping across the screen
      var bx = x + 5 + ((animTimer >> 2) % 14);
      artRect(bx, y + 7, 3, 2, '#d64a3a');
      artRect(bx + 2, y + 6, 1, 1, '#d64a3a');
      artRect(x + 3, y + 10, 18, 3, 'rgba(90,160,90,0.8)');
    },
    bookshelf: function (x, y) { drawBookshelf(x, y, '#7a4f2e'); },
    bookshelf_basement: function (x, y) { drawBookshelf(x, y, '#6b6259'); },
    bookcase: function (x, y) { drawBookshelf(x, y, '#5a3c26'); },
    reading_chair: function (x, y) {
      artShadow(x + 12, y + 21, 10, 3, 0.22);
      artRound(x + 2, y + 3, 20, 19, 5, '#9c5a4a');
      artRound(x + 2, y + 3, 20, 7, 4, '#7d4436');
      artRound(x + 2, y + 6, 4, 15, 2, '#7d4436');
      artRound(x + 18, y + 6, 4, 15, 2, '#7d4436');
      artRound(x + 6, y + 10, 12, 10, 3, '#bb7362');
      artRect(x + 7, y + 11, 10, 1, 'rgba(255,255,255,0.25)');
      // Still-warm dent from Alice's nap
      artEllipse(x + 12, y + 15, 4, 2.5, 'rgba(90,40,30,0.25)');
      // Folded throw
      artRect(x + 3, y + 4, 8, 4, '#e8d7a8');
    },
    sofa_blanket: function (x, y) {
      var sx = x - 2 * TILE_SIZE;
      artShadow(sx + 36, y + 22, 34, 3, 0.25);
      artRound(sx + 1, y + 3, 70, 20, 5, '#6d4c7a');
      artRound(sx + 1, y + 3, 70, 7, 4, '#573b63');
      artRound(sx + 1, y + 6, 6, 16, 3, '#573b63');
      artRound(sx + 65, y + 6, 6, 16, 3, '#573b63');
      for (var i = 0; i < 3; i++) {
        artRound(sx + 8 + i * 19, y + 9, 18, 12, 3, '#8a669a');
        artRect(sx + 9 + i * 19, y + 10, 16, 1, 'rgba(255,255,255,0.2)');
      }
      // Throw pillows
      artRound(sx + 9, y + 5, 8, 6, 2, '#e8b04a');
      artRound(sx + 47, y + 5, 8, 6, 2, '#6fb0a0');
      if (!gameState.flags.sofa_searched) {
        // Rumpled blanket over the right cushion — hiding the basement key
        ctx.fillStyle = '#e9c35a';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 9);
        ctx.quadraticCurveTo(x + 10, y + 5, x + 21, y + 8);
        ctx.lineTo(x + 22, y + 21);
        ctx.quadraticCurveTo(x + 12, y + 23, x + 3, y + 20);
        ctx.closePath();
        ctx.fill();
        artRect(x + 5, y + 12, 14, 1, 'rgba(160,110,30,0.5)');
        artRect(x + 6, y + 16, 12, 1, 'rgba(160,110,30,0.5)');
        if (gameState.flags.alice_fed) {
          var glint = (Math.sin(animTimer * 0.15) + 1) / 2;
          artRect(x + 15, y + 19, 4, 2, 'rgba(255,225,90,' + (0.5 + glint * 0.5) + ')');
          artRect(x + 16, y + 17, 1, 5, 'rgba(255,255,255,' + glint * 0.8 + ')');
        }
      } else {
        artRound(x + 5, y + 16, 15, 5, 2, '#e9c35a');
      }
    },
    basement_door: function (x, y) {
      var locked = !gameState.flags.basement_unlocked;
      artRect(x + 1, y + 0, 22, 24, '#efe5d2');
      artRect(x + 3, y + 2, 18, 22, locked ? '#7a5234' : '#2a1d16');
      if (locked) {
        artRect(x + 5, y + 4, 14, 7, '#8c6040');
        artRect(x + 5, y + 13, 14, 9, '#8c6040');
        artEllipse(x + 17, y + 13, 1.5, 1.5, '#f0d59a');
        // Padlock
        artRound(x + 9, y + 11, 6, 5, 1, '#d4a73a');
        ctx.strokeStyle = '#d4a73a';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x + 12, y + 11, 2, Math.PI, 0); ctx.stroke();
      } else {
        // Open doorway with stairs descending into the dark
        for (var s = 0; s < 4; s++) artRect(x + 4, y + 4 + s * 5, 16, 3, shade('#6b4a30', -s * 0.18));
        artRect(x + 3, y + 2, 3, 22, '#8c6040');
      }
    },

    // ---------- Basement ----------
    cat_olive: function (x, y) {
      // Treadmill with Olive lounging in a pile of crumbs
      artShadow(x + 12, y + 21, 11, 3, 0.3);
      artRound(x + 1, y + 9, 22, 13, 3, '#2d3035');
      artRect(x + 3, y + 11, 18, 9, '#3c4046');
      for (var k = 0; k < 6; k++) artRect(x + 3, y + 12 + k * 1.5, 18, 0.6, 'rgba(255,255,255,0.08)');
      artRect(x + 3, y + 1, 2, 10, '#5a5f66');
      artRect(x + 19, y + 1, 2, 10, '#5a5f66');
      artRound(x + 3, y + 0, 18, 4, 1, '#5a5f66');
      artRect(x + 8, y + 1, 8, 2, '#1c2a33');
      if (!gameState.flags.olive_fed) {
        for (var c = 0; c < 8; c++) {
          artRect(x + 2 + (c * 7) % 20, y + 19 + (c * 3) % 5, 2, 2, c % 2 ? '#7a4a22' : '#c98a4a');
        }
        SPRITES.cat(x, y - 2, CAT_COLORS.olive[0], CAT_COLORS.olive[1], 'olive');
      }
    },
    futon: function (x, y) {
      artShadow(x + 12, y + 21, 11, 3, 0.25);
      artRound(x + 1, y + 4, 22, 18, 3, '#4d6b46');
      artRound(x + 1, y + 4, 22, 6, 3, '#3c5637');
      artRound(x + 3, y + 10, 18, 10, 2, '#618a58');
      // Claw marks
      ctx.strokeStyle = 'rgba(230,220,190,0.6)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (var k = 0; k < 3; k++) { ctx.moveTo(x + 5 + k * 2, y + 12); ctx.lineTo(x + 6 + k * 2, y + 18); }
      ctx.stroke();
    },
    storage_box: function (x, y) {
      artShadow(x + 12, y + 22, 10, 2, 0.25);
      artBox(x + 2, y + 10, 14, 12, 5, '#d0a26a', '#a87b48');
      artBox(x + 9, y + 2, 13, 11, 4, '#c8995f', '#a07443');
      artRect(x + 15, y + 2, 1, 7, 'rgba(120,80,40,0.6)');
      artRect(x + 4, y + 12, 6, 2, '#f4ecd8');
      artRect(x + 11, y + 4, 5, 2, '#f4ecd8');
    },
    laundry_basket_storage: function (x, y) {
      artShadow(x + 12, y + 21, 9, 2, 0.25);
      artRound(x + 3, y + 7, 18, 14, 3, '#e8d8b5', 'rgba(120,95,60,0.7)');
      ctx.strokeStyle = 'rgba(150,120,80,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (var k = 0; k < 5; k++) { ctx.moveTo(x + 5 + k * 3.5, y + 9); ctx.lineTo(x + 5 + k * 3.5, y + 19); }
      ctx.stroke();
      artRect(x + 7, y + 7, 4, 2, 'rgba(0,0,0,0.3)');
      artRect(x + 13, y + 7, 4, 2, 'rgba(0,0,0,0.3)');
    },
    mini_fridge: function (x, y) {
      artShadow(x + 12, y + 22, 8, 2, 0.25);
      artRound(x + 4, y + 6, 16, 16, 2, '#dfe3e6', 'rgba(50,60,70,0.6)');
      artRect(x + 16, y + 9, 2, 8, '#8d979e');
      artRect(x + 6, y + 8, 1, 10, 'rgba(255,255,255,0.8)');
      // Sticky note: "NOT FOR CATS"
      artRect(x + 8, y + 10, 6, 5, '#ffe36e');
      artRect(x + 9, y + 12, 4, 1, '#c0392b');
    },
    bathroom_cabinet: function (x, y) {
      artBox(x + 3, y + 5, 18, 17, 8, '#f3f0ea', '#cfc8bc');
      artRect(x + 11, y + 14, 1, 7, 'rgba(0,0,0,0.2)');
      artRect(x + 9, y + 16, 1, 2, '#9aa4ab');
      artRect(x + 13, y + 16, 1, 2, '#9aa4ab');
      artRound(x + 6, y + 7, 4, 5, 1, '#f5a8b8');
      artRound(x + 13, y + 6, 4, 6, 1, '#9fd3e0');
    },
    tool_bench: function (x, y) {
      artBox(x + 1, y + 7, 22, 15, 6, '#8a6a4a', '#5e4630');
      artRect(x + 3, y + 1, 18, 7, '#b9a27f');
      for (var k = 0; k < 5; k++) artEllipse(x + 5 + k * 3.5, y + 3, 0.7, 0.7, '#6a5a44');
      artRect(x + 5, y + 4, 1, 4, '#5c5f66');
      artRect(x + 4, y + 3, 3, 1, '#5c5f66');
      artRect(x + 12, y + 3, 5, 2, '#d24b3c');
      artRect(x + 14, y + 5, 1, 3, '#7a5a3a');
      artRect(x + 6, y + 10, 8, 2, '#c7c9cc');
    },
    water_heater: function (x, y) {
      artShadow(x + 12, y + 22, 8, 2, 0.3);
      artRound(x + 5, y + 2, 14, 20, 5, '#d4d8da', 'rgba(60,70,75,0.6)');
      artRect(x + 7, y + 4, 2, 15, 'rgba(255,255,255,0.7)');
      artRect(x + 10, y + 0, 2, 3, '#b87333');
      artRect(x + 14, y + 0, 2, 3, '#4a7fb5');
      artRound(x + 9, y + 14, 6, 4, 1, '#3a3f44');
      artRect(x + 10, y + 15, 2, 2, 'rgba(255,120,40,' + (0.5 + Math.sin(animTimer * 0.2) * 0.3) + ')');
    },

    // ---------- Upstairs ----------
    cat_beatrice: function (x, y) {
      // Guest bed spanning cols 15-16
      artShadow(x + 24, y + 23, 23, 3, 0.25);
      artRect(x + 1, y - 3, 46, 5, '#5a3a4a');
      artRect(x + 1, y - 3, 46, 1, '#7e5668');
      artRound(x + 2, y + 1, 44, 22, 2, '#f7f1ea');
      artRound(x + 5, y + 2, 17, 6, 2, '#ffffff', 'rgba(150,140,130,0.5)');
      artRound(x + 26, y + 2, 17, 6, 2, '#ffffff', 'rgba(150,140,130,0.5)');
      if (gameState.flags.beatrice_fed) {
        // Blanket smoothed out, the crime scene vacated
        artRound(x + 2, y + 10, 44, 13, 2, '#8a4f6d');
        artRect(x + 2, y + 10, 44, 2, '#a86a8a');
        return;
      }
      // The mastermind, disguised as a blanket: a suspicious lump with ears.
      artRound(x + 2, y + 10, 44, 13, 2, '#8a4f6d');
      var breathe = Math.sin(animTimer * 0.05) * 0.8;
      ctx.fillStyle = '#9d5d7e';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 22);
      ctx.quadraticCurveTo(x + 8, y + 3 - breathe, x + 20, y + 5 - breathe);
      ctx.quadraticCurveTo(x + 32, y + 6, x + 34, y + 22);
      ctx.closePath();
      ctx.fill();
      // Ears poking up through the blanket
      ctx.beginPath();
      ctx.moveTo(x + 11, y + 7 - breathe); ctx.lineTo(x + 13, y + 1 - breathe); ctx.lineTo(x + 16, y + 6 - breathe);
      ctx.moveTo(x + 20, y + 5 - breathe); ctx.lineTo(x + 23, y + 0 - breathe); ctx.lineTo(x + 25, y + 6 - breathe);
      ctx.fill();
      artRect(x + 8, y + 12, 22, 1, 'rgba(255,255,255,0.12)');
      artRect(x + 10, y + 16, 18, 1, 'rgba(0,0,0,0.12)');
      // A gap in the blanket with two watching eyes
      artEllipse(x + 18, y + 11 - breathe, 7, 3, '#15121a');
      var blink = (animTimer % 200) > 190;
      if (!blink) {
        artEllipse(x + 15, y + 11 - breathe, 1.4, 1.2, '#e8d34a');
        artEllipse(x + 21, y + 11 - breathe, 1.4, 1.2, '#e8d34a');
        artRect(x + 15, y + 10 - breathe, 0.6, 2, '#15121a');
        artRect(x + 21, y + 10 - breathe, 0.6, 2, '#15121a');
      }
      // Tail tip sticking out the side
      var tw = Math.sin(animTimer * 0.09) * 2;
      artRound(x + 34 + tw, y + 16, 6, 3, 1.5, '#1b1b1d');
    },
    nightstand: function (x, y) {
      artBox(x + 3, y + 6, 18, 16, 7, '#9a6b45', '#74502f');
      artRect(x + 11, y + 17, 2, 2, '#f0d59a');
      // Mystery novel + alarm clock
      artRect(x + 5, y + 7, 7, 5, '#3d5a80');
      artRect(x + 6, y + 8, 5, 1, '#e0c070');
      artRound(x + 14, y + 7, 5, 4, 1, '#e8e3d8');
      artRect(x + 15, y + 8, 3, 1, '#d9534f');
    },
    dresser: function (x, y) { drawDresser(x, y, '#8b5a3a'); },
    guest_dresser: function (x, y) { drawDresser(x, y, '#a07353'); },
    jewelry_box: function (x, y) {
      artShadow(x + 12, y + 17, 7, 2, 0.25);
      artRound(x + 5, y + 8, 14, 9, 2, '#6b2d4a');
      artRound(x + 5, y + 6, 14, 5, 2, '#8a3a60');
      artRect(x + 11, y + 11, 2, 2, '#f0c850');
      var tw = (Math.sin(animTimer * 0.2) + 1) / 2;
      artRect(x + 15, y + 5, 1, 3, 'rgba(255,255,255,' + tw + ')');
      artRect(x + 14, y + 6, 3, 1, 'rgba(255,255,255,' + tw + ')');
    },
    wardrobe: function (x, y) {
      artShadow(x + 12, y + 23, 11, 2, 0.3);
      artRect(x + 1, y - 4, 22, 27, '#6b4428');
      artRect(x + 1, y - 4, 22, 2, '#8c5c38');
      artRect(x + 3, y - 1, 8, 22, '#7d5232');
      artRect(x + 13, y - 1, 8, 22, '#7d5232');
      artRect(x + 10, y + 8, 1, 4, '#f0d59a');
      artRect(x + 13, y + 8, 1, 4, '#f0d59a');
      artRect(x + 4, y, 1, 18, 'rgba(255,235,205,0.2)');
      // Sleeve caught in the door
      artRect(x + 11, y + 14, 2, 5, '#6fa0c8');
    },
    bedside_lamp: function (x, y) {
      artBox(x + 4, y + 10, 16, 12, 5, '#9a6b45', '#74502f');
      var g = ctx.createRadialGradient(x + 12, y + 5, 1, x + 12, y + 5, 11);
      g.addColorStop(0, 'rgba(255,225,150,0.6)');
      g.addColorStop(1, 'rgba(255,225,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y - 6, 24, 22);
      artRect(x + 11, y + 6, 2, 5, '#c8b28a');
      ctx.fillStyle = '#f4d8b8';
      ctx.beginPath();
      ctx.moveTo(x + 7, y + 7); ctx.lineTo(x + 17, y + 7); ctx.lineTo(x + 15, y + 1); ctx.lineTo(x + 9, y + 1);
      ctx.closePath(); ctx.fill();
    },
    filing_cabinet: function (x, y) {
      artShadow(x + 12, y + 22, 9, 2, 0.25);
      artRect(x + 3, y + 1, 18, 21, '#7c8a96');
      artRect(x + 3, y + 1, 18, 1, '#a5b3be');
      for (var k = 0; k < 3; k++) {
        artRect(x + 5, y + 3 + k * 6, 14, 5, '#8e9ca8');
        artRect(x + 10, y + 5 + k * 6, 4, 1, '#3c454d');
      }
      // Drawer ajar with a folder labelled TREAT HEIST
      artRect(x + 5, y + 3, 14, 2, '#e9d9a8');
    },
    office_chair: function (x, y) {
      var spin = Math.sin(animTimer * 0.03) * 0.25;
      artShadow(x + 12, y + 20, 8, 3, 0.25);
      ctx.save();
      ctx.translate(x + 12, y + 13);
      ctx.rotate(spin);
      for (var k = 0; k < 5; k++) {
        var a = k * Math.PI * 2 / 5;
        artRect(Math.cos(a) * 7 - 1, Math.sin(a) * 7 - 1, 2, 2, '#26282c');
      }
      artRound(-7, -7, 14, 13, 4, '#2f3440');
      artRound(-6, -9, 12, 5, 2, '#3b4252');
      artRect(-5, -4, 10, 1, 'rgba(255,255,255,0.15)');
      ctx.restore();
    },
    printer: function (x, y) {
      artBox(x + 3, y + 8, 18, 13, 5, '#e6e8ea', '#b9bec3');
      artRect(x + 7, y + 4, 10, 6, '#ffffff');
      artRect(x + 8, y + 6, 8, 1, '#aaa');
      artRect(x + 17, y + 11, 2, 1, '#58e07a');
    },
    medicine_cabinet: function (x, y) {
      artBox(x + 2, y + 4, 20, 18, 7, '#f4f2ee', '#d6d0c6');
      artRect(x + 4, y + 5, 16, 9, '#cfe3ea');
      artRect(x + 5, y + 6, 3, 7, 'rgba(255,255,255,0.7)');
      artRect(x + 10, y + 17, 4, 1, '#9aa4ab');
      artRect(x + 15, y + 8, 3, 2, '#e05a5a');
      artRect(x + 16, y + 7, 1, 4, '#e05a5a');
    },
    hallway_table: function (x, y) {
      artBox(x + 2, y + 8, 20, 13, 5, '#9a6b45', '#74502f');
      artEllipse(x + 8, y + 11, 4, 2, '#d9cfc0');
      artRect(x + 6, y + 10, 3, 1, '#e0c070');
      artRect(x + 9, y + 11, 2, 1, '#9aa4ab');
      // Framed family photo
      artRect(x + 14, y + 4, 6, 7, '#6b4a2c');
      artRect(x + 15, y + 5, 4, 5, '#e8c9a8');
      artEllipse(x + 17, y + 7, 1, 1, '#5a3a2a');
    },
    linen_closet: function (x, y) {
      artShadow(x + 12, y + 22, 10, 2, 0.25);
      artRect(x + 2, y + 2, 20, 20, '#efe8da');
      artRect(x + 2, y + 2, 20, 1, '#ffffff');
      for (var k = 0; k < 3; k++) {
        artRound(x + 4, y + 4 + k * 6, 16, 5, 1, ['#c9a0d8', '#a8d0e0', '#f0c0a0'][k]);
        artRect(x + 4, y + 6 + k * 6, 16, 1, 'rgba(0,0,0,0.12)');
      }
      ctx.strokeStyle = 'rgba(90,80,70,0.5)';
      ctx.strokeRect(x + 2.5, y + 2.5, 19, 19);
    },

    // ---------- Collectibles ----------
    cat_toy_jingle_ball: function (x, y, obj) { drawToyGlow(x, y, toyFound(obj)); },
    cat_toy_feather_wand: function (x, y, obj) { drawToyGlow(x, y, toyFound(obj)); },
    cat_toy_laser_pointer: function (x, y, obj) { drawToyGlow(x, y, toyFound(obj)); },
    diary_page_home: function (x, y, obj) { drawDiaryPage(x, y, pageFound(obj)); },
    diary_page_alice: function (x, y, obj) { drawDiaryPage(x, y, pageFound(obj)); },
    diary_page_olive: function (x, y, obj) { drawDiaryPage(x, y, pageFound(obj)); },
    diary_page_beatrice: function (x, y, obj) { drawDiaryPage(x, y, pageFound(obj)); }
  }
};

function toyFound(obj) {
  var list = gameState.flags.cat_toys_found;
  return Array.isArray(list) && list.includes(obj.type.replace('cat_toy_', ''));
}

function pageFound(obj) {
  var list = gameState.flags.diary_pages_found;
  return Array.isArray(list) && list.includes(obj.type.replace('diary_page_', ''));
}

// Tall pantry cupboard; the stocked ones have a telltale label.
function drawPantry(x, y, variant) {
  artShadow(x + 12, y + 23, 10, 2, 0.25);
  artRect(x + 1, y + 0, 22, 23, '#7d5a3a');
  artRect(x + 2, y + 1, 9, 21, '#9c7552');
  artRect(x + 13, y + 1, 9, 21, '#9c7552');
  artRect(x + 3, y + 3, 7, 7, 'rgba(255,235,205,0.12)');
  artRect(x + 14, y + 3, 7, 7, 'rgba(255,235,205,0.12)');
  artRect(x + 10, y + 9, 1, 4, '#f0d59a');
  artRect(x + 13, y + 9, 1, 4, '#f0d59a');
  artRect(x + 1, y + 0, 22, 1, 'rgba(255,235,205,0.3)');
  if (variant) {
    var empty = variant === 'treat'
      ? (gameState.flags.alice_fed && gameState.flags.olive_fed)
      : gameState.flags.beatrice_fed;
    if (!empty) {
      // A little tag hanging from the handle
      artRect(x + 6, y + 14, 6, 5, variant === 'treat' ? '#8ee08e' : '#ff9ecf');
      artRect(x + 7, y + 16, 4, 1, 'rgba(0,0,0,0.35)');
      artRect(x + 9, y + 12, 1, 2, '#f0d59a');
    }
  }
}

function drawPottedPlant(x, y) {
  artShadow(x + 12, y + 22, 6, 2, 0.25);
  artRound(x + 7, y + 14, 10, 8, 2, '#c0673f');
  artRect(x + 7, y + 14, 10, 2, '#d8805a');
  var sway = Math.sin(animTimer * 0.03) * 0.8;
  var leaves = [[-6, -3], [6, -4], [-3, -9], [3, -10], [0, -6], [-7, -8], [7, -9]];
  for (var i = 0; i < leaves.length; i++) {
    artEllipse(x + 12 + leaves[i][0] + sway * (i % 2 ? 1 : -1), y + 13 + leaves[i][1], 3.2, 2, i % 2 ? '#4f9a4a' : '#3d7f3a');
  }
  artEllipse(x + 10, y + 5, 1.5, 1, 'rgba(255,255,255,0.3)');
}

function drawBookshelf(x, y, wood) {
  artShadow(x + 12, y + 23, 11, 2, 0.3);
  artRect(x + 1, y - 3, 22, 26, wood);
  artRect(x + 1, y - 3, 22, 2, shade(wood, 0.25));
  var colors = ['#c0504d', '#4f81bd', '#e0b84a', '#8064a2', '#4bacc6', '#9bbb59', '#f79646'];
  for (var shelf = 0; shelf < 3; shelf++) {
    var sy = y + shelf * 8 - 1;
    artRect(x + 3, sy, 18, 7, shade(wood, -0.35));
    var bx = x + 3;
    var n = 0;
    while (bx < x + 20) {
      var w = 2 + Math.floor(tileSeed(shelf, n, Math.floor(x + y)) * 2);
      var h = 5 + Math.floor(tileSeed(n, shelf, Math.floor(x)) * 2);
      artRect(bx, sy + 7 - h, w, h, colors[(n + shelf * 3) % colors.length]);
      bx += w + (n % 4 === 3 ? 2 : 0);
      n++;
    }
    artRect(x + 2, sy + 7, 20, 1, shade(wood, 0.15));
  }
}

function drawDresser(x, y, wood) {
  artBox(x + 2, y + 5, 20, 17, 11, shade(wood, 0.15), wood);
  artRect(x + 3, y + 12, 18, 4, shade(wood, 0.08));
  artRect(x + 3, y + 17, 18, 4, shade(wood, 0.08));
  artRect(x + 10, y + 13, 4, 1, '#f0d59a');
  artRect(x + 10, y + 18, 4, 1, '#f0d59a');
  // Perfume + a cat-shaped dent
  artRound(x + 4, y + 4, 3, 5, 1, '#e8a0c0');
  artEllipse(x + 15, y + 8, 5, 2, 'rgba(60,35,20,0.2)');
}

// The staged laundry avalanche burying the main-floor staircase (2x2 tiles).
function drawLaundryAvalanche() {
  var s = FLOORS.main.stairs.toUpstairs;
  var x = s.cols[0] * TILE_SIZE;
  var y = s.rows[0] * TILE_SIZE;
  artShadow(x + 24, y + 44, 24, 5, 0.3);
  var blobs = [
    [6, 30, 14, 10, '#e8e4dc'], [24, 34, 16, 10, '#7fa6c9'], [40, 28, 10, 12, '#d98c8c'],
    [14, 18, 14, 11, '#f1d27a'], [32, 16, 14, 11, '#9fc79a'], [22, 6, 13, 10, '#c9a3d8'],
    [8, 8, 10, 8, '#f4f1ea'], [38, 4, 9, 8, '#e9b089'], [24, 22, 12, 9, '#f4f1ea']
  ];
  for (var i = 0; i < blobs.length; i++) {
    var b = blobs[i];
    artEllipse(x + b[0], y + b[1], b[2] / 1.4, b[3] / 1.6, shade(b[4], -0.25));
    artEllipse(x + b[0], y + b[1] - 1, b[2] / 1.5, b[3] / 1.8, b[4]);
    artRect(x + b[0] - 3, y + b[1] - 2, 5, 1, 'rgba(255,255,255,0.35)');
  }
  // Stripes on a shirt, a dangling sock, a pair of undies — it's a crime scene
  for (var k = 0; k < 3; k++) artRect(x + 18 + k * 4, y + 31, 2, 7, 'rgba(255,255,255,0.45)');
  artRound(x + 42, y + 36, 4, 10, 2, '#e05a5a');
  artRect(x + 42, y + 36, 4, 2, '#ffffff');
  artRound(x + 3, y + 38, 8, 5, 2, '#6fc0d9');
  // Tiny paw print on top: the avalanche was signed
  artEllipse(x + 26, y + 20, 2, 1.5, 'rgba(30,30,30,0.5)');
  artEllipse(x + 24, y + 18, 0.8, 0.8, 'rgba(30,30,30,0.5)');
  artEllipse(x + 26, y + 17.5, 0.8, 0.8, 'rgba(30,30,30,0.5)');
  artEllipse(x + 28, y + 18, 0.8, 0.8, 'rgba(30,30,30,0.5)');
}
