/*
 * maps.js — Map data for Marice & Cats House Adventure
 *
 * Each floor is a 2D tile grid.
 * Tile legend:
 *   0 = floor (walkable)
 *   1 = wall
 *   2 = furniture / blocked object
 *   3 = door / transition tile
 *   4 = interactable object (check interactables array for details)
 *   5 = stairs
 *   6 = half-wall / counter top (blocked)
 *
 * Maps are 20 columns x 15 rows (each tile is 24x24 on a 480x360 canvas).
 * Interactables reference (row, col) positions.
 */

const TILE_SIZE = 24;
const MAP_COLS = 20;
const MAP_ROWS = 15;

// Tile type constants
const T = {
  FLOOR: 0,
  WALL: 1,
  FURNITURE: 2,
  DOOR: 3,
  INTERACT: 4,
  STAIRS: 5,
  COUNTER: 6
};

// Color palette for rendering tiles
const TILE_COLORS = {
  // Main floor
  main: {
    [T.FLOOR]: '#d4b896',    // warm wood floor
    [T.WALL]: '#6b4226',     // dark wood wall
    [T.FURNITURE]: '#8B6914', // furniture brown
    [T.DOOR]: '#4a7c59',     // green door
    [T.INTERACT]: '#d4b896', // same as floor (object drawn on top)
    [T.STAIRS]: '#a0522d',   // stair brown
    [T.COUNTER]: '#7a5c3a'   // countertop
  },
  // Basement
  basement: {
    [T.FLOOR]: '#9e9e9e',    // concrete gray
    [T.WALL]: '#5d4e37',     // dark wall
    [T.FURNITURE]: '#6d6d6d', // dark furniture
    [T.DOOR]: '#4a7c59',
    [T.INTERACT]: '#9e9e9e',
    [T.STAIRS]: '#a0522d',
    [T.COUNTER]: '#7a7a7a'
  },
  // Upstairs
  upstairs: {
    [T.FLOOR]: '#c9a87c',    // lighter wood
    [T.WALL]: '#6b4226',
    [T.FURNITURE]: '#8B6914',
    [T.DOOR]: '#4a7c59',
    [T.INTERACT]: '#c9a87c',
    [T.STAIRS]: '#a0522d',
    [T.COUNTER]: '#7a5c3a'
  },
  // Outside / front entry
  outside: {
    [T.FLOOR]: '#9a9a9a',    // concrete walkway
    [T.WALL]: '#5b4636',     // house facade
    [T.FURNITURE]: '#6f6f6f', // porch fixtures
    [T.DOOR]: '#4a7c59',     // front door
    [T.INTERACT]: '#9a9a9a',
    [T.STAIRS]: '#a0522d',
    [T.COUNTER]: '#74b66a'
  }
};

// ============================================================
// OUTSIDE MAP (20x15)
// Front entry only, focused on Marice's house access
// ============================================================
const outsideGrid = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,3,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,4,0,0,0,4,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,4,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const outsideInteractables = [
  { row: 2, col: 9, type: 'front_door', label: 'Front Door', sprite: 'door_locked' },
  { row: 4, col: 9, type: 'riddle_board', label: 'House Rules Plaque', sprite: 'board' },
  { row: 3, col: 7, type: 'welcome_mat', label: 'Welcome Mat', sprite: 'generic' },
  { row: 3, col: 11, type: 'porch_light', label: 'Porch Light', sprite: 'generic' },
];

const outsideStart = { row: 12, col: 9 };

// ============================================================
// MAIN FLOOR MAP (20x15)
// Layout:
//   Top: Kitchen (left) | Dining Room (right, has sliding door)
//   Middle: Half-bath (left) | Living Room (center) | Basement door (right of kitchen)
//   Stairs in center area
// ============================================================
const mainFloorGrid = [
  // Row 0: top wall
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1: kitchen top wall + dining room top wall
  [1,6,6,6,6,6,6,6,1,0,0,0,0,0,0,0,0,0,0,1],
  // Row 2: kitchen cupboard wall
  [1,4,4,4,4,6,6,4,1,0,0,0,4,0,0,0,0,0,0,1],
  // Row 3: kitchen floor + dining room
  [1,4,0,0,0,4,4,0,1,2,2,0,0,0,4,0,0,0,0,1],
  // Row 4: kitchen floor + dining passage
  [1,0,0,0,0,6,6,6,1,2,2,0,0,0,0,0,0,0,0,1],
  // Row 5: kitchen/living divider wall with opening
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,1],
  // Row 6: living room area + basement door
  [1,0,0,2,0,0,4,0,0,0,5,5,0,0,0,4,0,0,1,1],
  // Row 7: living room - sofa area
  [1,0,0,2,0,0,4,0,0,0,5,5,0,0,0,0,0,0,4,1],
  // Row 8: living room
  [1,0,4,0,0,4,0,0,0,0,0,0,0,0,0,0,2,0,1,1],
  // Row 9: living room / half-bath divider (door moved to east wall)
  [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 10: half-bath
  [1,2,0,0,0,1,0,0,0,0,0,0,2,2,0,0,0,0,0,1],
  // Row 11: half-bath (door on east wall)
  [1,2,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 12: half-bath bottom + living room
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 13: bottom area
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 14: bottom wall
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const mainFloorInteractables = [
  // Kitchen appliances
  { row: 3, col: 1, type: 'fridge', label: 'Fridge', sprite: 'fridge' },
  // Kitchen cupboards (row 2, cols 1-4)
  { row: 2, col: 1, type: 'cupboard_empty', label: 'Cupboard', sprite: 'cupboard' },
  { row: 2, col: 2, type: 'cupboard_purrpops', label: 'Cupboard', sprite: 'cupboard_treat' },
  { row: 2, col: 3, type: 'cupboard_empty', label: 'Cupboard', sprite: 'cupboard' },
  { row: 2, col: 4, type: 'cupboard_feast', label: 'Cupboard', sprite: 'cupboard_food' },
  { row: 3, col: 5, type: 'stove', label: 'Stove', sprite: 'stove' },
  { row: 3, col: 6, type: 'kitchen_sink', label: 'Sink', sprite: 'sink' },
  { row: 2, col: 7, type: 'coffee_station', label: 'Coffee Station', sprite: 'coffee' },

  // Additional kitchen items
  { row: 4, col: 1, type: 'microwave', label: 'Microwave', sprite: 'microwave' },
  { row: 4, col: 3, type: 'trash_can', label: 'Trash Can', sprite: 'trash' },

  // Alice on cat tree in dining room (near sliding door)
  { row: 3, col: 14, type: 'cat_alice', label: 'Alice', sprite: 'cat_alice' },

  // Dining room table and chairs
  { row: 2, col: 12, type: 'dining_table', label: 'Dining Table', sprite: 'dining' },
  { row: 4, col: 14, type: 'china_cabinet', label: 'China Cabinet', sprite: 'cabinet' },
  { row: 4, col: 16, type: 'plant', label: 'Potted Plant', sprite: 'plant' },

  // Sliding door (decorative, right side of dining room)
  { row: 5, col: 18, type: 'sliding_door', label: 'Sliding Door', sprite: 'sliding_door' },

  // Living room decor - more detailed
  { row: 6, col: 6, type: 'floor_lamp', label: 'Floor Lamp', sprite: 'lamp' },
  { row: 7, col: 6, type: 'coffee_table', label: 'Coffee Table', sprite: 'coffee_table' },
  { row: 6, col: 15, type: 'tv', label: 'TV Console', sprite: 'tv' },
  { row: 8, col: 2, type: 'bookshelf', label: 'Bookshelf', sprite: 'bookshelf' },
  { row: 8, col: 16, type: 'reading_chair', label: 'Reading Chair', sprite: 'chair' },

  // Sofa with blanket (living room) - hides basement key
  { row: 8, col: 5, type: 'sofa_blanket', label: 'Sofa', sprite: 'sofa' },

  // Basement door (right side, off kitchen area)
  { row: 7, col: 18, type: 'basement_door', label: 'Basement Door', sprite: 'door_locked' },

  // Half-bath additional items
];

// Stairs position for main floor
const mainFloorStairs = {
  // Going down to basement - the basement door interactable
  toBasement: { row: 7, col: 18, requires: 'basement_key' },
  // Going up - stair tiles, blocked by laundry
  toUpstairs: { rows: [6,7], cols: [10,11], requires: 'laundry_cleared' }
};

// Player start position on main floor
const mainFloorStart = { row: 8, col: 9 };


// ============================================================
// BASEMENT MAP (20x15)
// Layout:
//   Stairs at top-left
//   Lobby area
//   Recreation room (right side, has treadmill with Olive)
//   Washroom (bottom-left)
// ============================================================
const basementGrid = [
  // Row 0
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1: stairs landing + lobby
  [1,5,5,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 2
  [1,5,5,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 3: lobby (col 14 = futon, interactable)
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,2,0,0,1],
  // Row 4
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 5: lobby / rec room divider
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 6: washroom area + rec room
  [1,1,1,1,3,1,1,1,1,1,0,0,4,0,0,0,0,0,0,1],
  // Row 7: washroom
  [1,2,0,0,0,0,0,0,0,1,0,0,0,0,0,0,2,0,0,1],
  // Row 8
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 9: washroom with fixtures
  [1,0,0,2,0,0,2,0,0,1,0,0,0,2,2,2,0,0,0,1],
  // Row 10
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 11
  [1,2,0,0,0,0,0,2,0,1,0,0,0,0,0,2,0,0,0,1],
  // Row 12
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 13
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 14
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const basementInteractables = [
  // Olive under treadmill in rec room
  { row: 6, col: 12, type: 'cat_olive', label: 'Olive', sprite: 'cat_olive' },
  // Futon in rec room (decorative)
  { row: 3, col: 14, type: 'futon', label: 'Futon', sprite: 'futon' },

  // Gym equipment in rec room
  { row: 4, col: 12, type: 'exercise_bike', label: 'Exercise Bike', sprite: 'bike' },

  // Storage/Laundry area
  { row: 3, col: 3, type: 'storage_box', label: 'Storage Box', sprite: 'box' },
  { row: 4, col: 5, type: 'washer', label: 'Washing Machine', sprite: 'washer' },
  { row: 4, col: 6, type: 'dryer', label: 'Dryer', sprite: 'dryer' },
  { row: 5, col: 3, type: 'laundry_basket_storage', label: 'Laundry Basket', sprite: 'basket' },

  // Rec room entertainment
  { row: 7, col: 12, type: 'pool_table', label: 'Pool Table', sprite: 'pool' },
  { row: 8, col: 16, type: 'mini_fridge', label: 'Mini Fridge', sprite: 'mini_fridge' },
  { row: 9, col: 13, type: 'gaming_setup', label: 'Gaming Setup', sprite: 'gaming' },

  // Washroom items
  { row: 10, col: 3, type: 'bathroom_cabinet', label: 'Bathroom Cabinet', sprite: 'cabinet' },

  // Misc basement items
  { row: 12, col: 4, type: 'tool_bench', label: 'Tool Bench', sprite: 'tools' },
  { row: 13, col: 7, type: 'water_heater', label: 'Water Heater', sprite: 'heater' },
  { row: 10, col: 15, type: 'bookshelf_basement', label: 'Bookshelf', sprite: 'bookshelf' },
];

const basementStairs = {
  toMain: { rows: [1,2], cols: [1,2] }
};

const basementStart = { row: 3, col: 2 };


// ============================================================
// UPSTAIRS MAP (20x15)
// Layout:
//   Stairs at bottom-center
//   Main bedroom (top-left)
//   Guest bedroom (top-right, Beatrice here)
//   Office (bottom-left)
//   Full washroom (bottom-right)
// ============================================================
const upstairsGrid = [
  // Row 0
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1: main bedroom + guest bedroom
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 2: beds
  [1,0,2,2,0,0,0,0,0,1,0,0,0,0,0,4,2,0,0,1],
  // Row 3
  [1,0,0,0,0,0,0,2,0,1,0,0,0,0,0,0,0,2,0,1],
  // Row 4
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  // Row 5: divider walls with doors
  [1,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,1],
  // Row 6: hallway
  [1,1,1,3,1,1,0,0,0,1,0,0,0,1,1,3,1,1,1,1],
  // Row 7: office + hallway + washroom
  [1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  // Row 8: office with desk
  [1,0,0,2,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,1],
  // Row 9
  [1,0,0,2,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  // Row 10: office
  [1,0,0,0,0,1,0,0,0,0,0,0,0,1,2,0,0,0,0,1],
  // Row 11
  [1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,2,0,0,1],
  // Row 12: stairs
  [1,0,0,0,0,1,0,0,5,5,0,0,0,1,0,0,0,0,0,1],
  // Row 13: stairs
  [1,0,0,0,0,1,0,0,5,5,0,0,0,1,0,0,0,0,0,1],
  // Row 14
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const upstairsInteractables = [
  // Beatrice on bed in guest bedroom
  { row: 2, col: 15, type: 'cat_beatrice', label: 'Beatrice', sprite: 'cat_beatrice' },

  // Main bedroom items
  { row: 3, col: 2, type: 'nightstand', label: 'Nightstand', sprite: 'nightstand' },
  { row: 3, col: 4, type: 'dresser', label: 'Dresser', sprite: 'dresser' },
  { row: 4, col: 3, type: 'jewelry_box', label: 'Jewelry Box', sprite: 'jewelry' },
  { row: 1, col: 6, type: 'wardrobe', label: 'Wardrobe', sprite: 'wardrobe' },

  // Guest bedroom items
  { row: 1, col: 14, type: 'bedside_lamp', label: 'Bedside Lamp', sprite: 'lamp' },
  { row: 3, col: 17, type: 'guest_dresser', label: 'Dresser', sprite: 'dresser' },

  // Office items
  { row: 7, col: 2, type: 'filing_cabinet', label: 'Filing Cabinet', sprite: 'files' },
  { row: 10, col: 2, type: 'office_chair', label: 'Office Chair', sprite: 'chair' },
  { row: 7, col: 4, type: 'printer', label: 'Printer', sprite: 'printer' },
  { row: 11, col: 3, type: 'bookcase', label: 'Bookcase', sprite: 'bookcase' },

  // Washroom items
  { row: 9, col: 17, type: 'medicine_cabinet', label: 'Medicine Cabinet', sprite: 'medicine' },

  // Hallway items
  { row: 7, col: 7, type: 'hallway_table', label: 'Console Table', sprite: 'table' },
  { row: 7, col: 10, type: 'plant_hallway', label: 'Potted Plant', sprite: 'plant' },
  { row: 4, col: 11, type: 'linen_closet', label: 'Linen Closet', sprite: 'closet' },
];

const upstairsStairs = {
  toMain: { rows: [12,13], cols: [8,9] }
};

const upstairsStart = { row: 11, col: 8 };


// ============================================================
// Floor data export
// ============================================================
const FLOORS = {
  outside: {
    grid: outsideGrid,
    interactables: outsideInteractables,
    stairs: {},
    start: outsideStart,
    palette: TILE_COLORS.outside,
    name: 'Front Entry'
  },
  main: {
    grid: mainFloorGrid,
    interactables: mainFloorInteractables,
    stairs: mainFloorStairs,
    start: mainFloorStart,
    palette: TILE_COLORS.main,
    name: 'Main Floor'
  },
  basement: {
    grid: basementGrid,
    interactables: basementInteractables,
    stairs: basementStairs,
    start: basementStart,
    palette: TILE_COLORS.basement,
    name: 'Basement'
  },
  upstairs: {
    grid: upstairsGrid,
    interactables: upstairsInteractables,
    stairs: upstairsStairs,
    start: upstairsStart,
    palette: TILE_COLORS.upstairs,
    name: 'Upstairs'
  }
};

// Room label data for rendering room names on the map
const ROOM_LABELS = {
  main: [
    { text: 'Kitchen', row: 2, col: 2 },
    { text: 'Dining Room', row: 2, col: 12 },
    { text: 'Living Room', row: 8, col: 10 },
    { text: 'Half-Bath', row: 10, col: 2 },
  ],
  basement: [
    { text: 'Lobby', row: 2, col: 4 },
    { text: 'Rec Room', row: 4, col: 14 },
    { text: 'Washroom', row: 8, col: 3 },
  ],
  upstairs: [
    { text: 'Main Bedroom', row: 1, col: 2 },
    { text: 'Guest Bedroom', row: 1, col: 13 },
    { text: "Marice's Office", row: 8, col: 1 },
    { text: 'Washroom', row: 8, col: 15 },
  ],
  outside: [
    { text: 'Front Entry', row: 11, col: 8 },
    { text: 'Porch', row: 3, col: 8 },
  ]
};
