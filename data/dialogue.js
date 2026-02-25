/*
 * dialogue.js — Dialogue scripts for Marice & Cats House Adventure
 *
 * Each dialogue is an array of message objects:
 *   { speaker: "Marice"|"Alice"|"Olive"|"Beatrice", text: "..." }
 *
 * Cat dialogues now show the cat and Marice portraits together.
 * Speaker names are shown as tags above the text.
 *
 * Each dialogue sequence is exactly 3 messages.
 */

const DIALOGUE = {

  // ============================
  // TUTORIAL / INTRO
  // ============================
  intro: [
    { speaker: 'Marice', text: "My three girls are hiding again... I better find them before dinner gets cold!" },
    { speaker: 'Marice', text: "Alice, Olive, Beatrice — where are you? Let me check the house." },
    { speaker: 'Marice', text: "I should check the front entry first. That house rules plaque might have something useful..." }
  ],

  // ============================
  // ALICE — Dining room, cat tree
  // ============================

  // A) First interaction, before receiving Purrpops
  alice_before: [
    { speaker: 'Alice', text: "Oh, it's you. I was having the most wonderful nap on my tree, and you just HAD to come bother me." },
    { speaker: 'Marice', text: "Alice, sweetie, I just want to say hi! Can you help me find the others? I know Olive and Beatrice are hiding somewhere..." },
    { speaker: 'Alice', text: "Hmm. I don't work for free, Marice. Bring me some Purrpops treats and MAYBE I'll remember something useful." }
  ],

  // Alice — wrong item offered (Shrimp & Salmon Feast)
  alice_wrong_item: [
    { speaker: 'Marice', text: "Here, Alice! I brought you something yummy — a plate of Shrimp & Salmon Feast!" },
    { speaker: 'Alice', text: "Excuse me? Do I LOOK like a wet food cat? That slimy stuff is beneath me." },
    { speaker: 'Alice', text: "I said PURRPOPS. The crunchy ones. Don't come back without them." }
  ],

  // B) After giving Purrpops
  alice_after: [
    { speaker: 'Marice', text: "Here you go, Alice — fresh Purrpops, just for you!" },
    { speaker: 'Alice', text: "*crunch crunch* ...Acceptable. Fine, I'll tell you a secret since you've been adequate." },
    { speaker: 'Alice', text: "Check under the blanket on the sofa in the living room. There's a key there. You'll need it for the basement." }
  ],

  // Alice — already helped
  alice_done: [
    { speaker: 'Alice', text: "*yawn* I already told you about the key. Under the blanket. On the sofa." },
    { speaker: 'Marice', text: "Thanks, Alice. You're the best!" },
    { speaker: 'Alice', text: "Obviously. Now let me nap." }
  ],

  // ============================
  // OLIVE — Basement rec room, under treadmill
  // ============================

  // C) First interaction, before receiving Purrpops
  olive_before: [
    { speaker: 'Marice', text: "Olive?! Is that you under the treadmill? What are you doing down here, you little gremlin?" },
    { speaker: 'Olive', text: "*peeking out* Shh! I'm hiding. This is my secret lair. Nobody can find me here... except you apparently." },
    { speaker: 'Olive', text: "Look, if you want me to come out, you gotta bring me the good stuff. PURRPOPS. The crunchy ones. Go!" }
  ],

  // Olive — wrong item offered (Shrimp & Salmon Feast)
  olive_wrong_item: [
    { speaker: 'Marice', text: "Olive, I brought you a Shrimp & Salmon Feast! Doesn't that sound fancy?" },
    { speaker: 'Olive', text: "*sniff sniff* ...Nope. Nuh-uh. That's BEATRICE food. I'm a Purrpops girl." },
    { speaker: 'Olive', text: "Go back to the kitchen and get the RIGHT treats. I'll wait. I'm very patient. *tail swish*" }
  ],

  // D) After giving Purrpops
  olive_after: [
    { speaker: 'Marice', text: "Purrpops delivery for the gremlin under the treadmill!" },
    { speaker: 'Olive', text: "*ZOOM* GIMME GIMME GIMME! *cronch cronch* Oh these are SO good. You're my favorite human today." },
    { speaker: 'Olive', text: "Here, take this laundry basket I found. There's a big pile of laundry blocking the stairs — this should help you clear it!" }
  ],

  // Olive — already helped
  olive_done: [
    { speaker: 'Olive', text: "*rolling on floor* Those Purrpops hit different down here in the basement." },
    { speaker: 'Marice', text: "You're ridiculous, Olive." },
    { speaker: 'Olive', text: "Ridiculously CUTE, you mean. Now go find Beatrice! She's upstairs being dramatic as usual." }
  ],

  // ============================
  // BEATRICE — Upstairs guest bedroom, under blanket on bed
  // ============================

  // E) First interaction, before receiving food
  beatrice_before: [
    { speaker: 'Marice', text: "Beatrice? Is that a lump under the blanket, or is that you, sweet girl?" },
    { speaker: 'Beatrice', text: "*muffled* Go away. I'm a blanket now. Blankets don't need to socialize." },
    { speaker: 'Beatrice', text: "...Unless you bring me a plate of Shrimp & Salmon Feast. Then MAYBE this blanket will consider emerging." }
  ],

  // Beatrice — wrong item offered (Purrpops)
  beatrice_wrong_item: [
    { speaker: 'Marice', text: "Beatrice, I have Purrpops! Want some treats?" },
    { speaker: 'Beatrice', text: "*disgusted blanket noises* Purrpops?! Those dry little pebbles? I am a cat of REFINED taste." },
    { speaker: 'Beatrice', text: "Shrimp & Salmon Feast. On a plate. Like a civilized meal. That is my price for emerging from this cocoon." }
  ],

  // F) After receiving Shrimp & Salmon Feast
  beatrice_after: [
    { speaker: 'Marice', text: "One plate of Shrimp & Salmon Feast, served with love for my most dramatic princess!" },
    { speaker: 'Beatrice', text: "*emerges majestically* ...It smells divine. You may watch me eat, but do not speak." },
    { speaker: 'Beatrice', text: "*purring intensely* ...Fine. Come here. You've earned a snuggle. But tell no one about this moment of weakness." }
  ],

  // ============================
  // OBJECT INTERACTIONS
  // ============================

  fridge: [
    { speaker: 'Marice', text: "The fridge is stocked — tuna cans, cream, and a questionable number of Purrpops." }
  ],

  stove: [
    { speaker: 'Marice', text: "The stovetop is still warm. Salmon night was a hit." }
  ],

  kitchen_sink: [
    { speaker: 'Marice', text: "Dishes soaking. Cat bowls get priority in this house." }
  ],

  coffee_station: [
    { speaker: 'Marice', text: "Fresh brew on standby. Herding three cats requires caffeine." }
  ],

  dining_table: [
    { speaker: 'Marice', text: "Table's set and ready — just keep the cats off the centerpiece." }
  ],

  cupboard_empty: [
    { speaker: 'Marice', text: "Nothing in here but some old mugs and a suspicious amount of cat hair." }
  ],

  cupboard_purrpops: [
    { speaker: 'Marice', text: "Purrpops! The cats go absolutely feral for these crunchy little treats." }
  ],

  cupboard_feast: [
    { speaker: 'Marice', text: "A can of Shrimp & Salmon Feast wet food! Fancy stuff. Let me plate this up nicely." }
  ],

  sofa_blanket: [
    { speaker: 'Marice', text: "There's something lumpy under this blanket... Oh! It's a key! Must be the Basement Key." }
  ],

  sofa_blanket_empty: [
    { speaker: 'Marice', text: "Just a cozy sofa with a rumpled blanket. Smells faintly of cat." }
  ],

  basement_door_locked: [
    { speaker: 'Marice', text: "The basement door is locked. I need a key to open it." }
  ],

  basement_door_unlock: [
    { speaker: 'Marice', text: "The Basement Key fits! *click* The door swings open. Time to explore downstairs." }
  ],

  laundry_pile_blocked: [
    { speaker: 'Marice', text: "There's a massive pile of laundry blocking the stairs. I need something to carry all this in..." }
  ],

  laundry_pile_clear: [
    { speaker: 'Marice', text: "Let me scoop all this laundry into the basket... There! The way upstairs is clear now!" }
  ],

  sliding_door: [
    { speaker: 'Marice', text: "The sliding door is shut tight for now. The girls stay indoors where it's safe." }
  ],

  tv: [
    { speaker: 'Marice', text: "Paused on a loop of bird videos. Quality enrichment programming." }
  ],

  floor_lamp: [
    { speaker: 'Marice', text: "Soft light, cozy vibe. Perfect for an evening of cat cuddles." }
  ],

  coffee_table: [
    { speaker: 'Marice', text: "Tiny paw prints in the dust. Evidence of unauthorized zoomies." }
  ],

  bookshelf: [
    { speaker: 'Marice', text: "A whole shelf of cat behavior books. The girls clearly haven't read them." }
  ],

  futon: [
    { speaker: 'Marice', text: "A comfy futon. I can see cat claw marks all over it. Classic." }
  ],

  // ============================
  // NEW INTERACTABLES - MAIN FLOOR
  // ============================

  microwave: [
    { speaker: 'Marice', text: "Microwave leftovers for speed or stove for quality? The eternal struggle." }
  ],

  trash_can: [
    { speaker: 'Marice', text: "Taking out the trash. The cats are NOT helping with this chore." }
  ],

  spice_rack: [
    { speaker: 'Marice', text: "Organized alphabetically. Gotta keep the kitchen game strong." }
  ],

  china_cabinet: [
    { speaker: 'Marice', text: "Fancy dishes behind glass. The cats are banned from this area." }
  ],

  plant: [
    { speaker: 'Marice', text: "A nice potted plant. So far the cats haven't knocked it over. So far." }
  ],

  game_console: [
    { speaker: 'Marice', text: "Game console with all the cozy indie titles. Perfect for cat time." }
  ],

  side_table: [
    { speaker: 'Marice', text: "Side table with a reading lamp. Good vibes only." }
  ],

  reading_chair: [
    { speaker: 'Marice', text: "A cozy reading chair. Alice claims it during the day." }
  ],

  bathroom_mirror: [
    { speaker: 'Marice', text: "Mirror's a bit foggy. Someone took a steamy shower recently." }
  ],

  towel_rack: [
    { speaker: 'Marice', text: "Fresh towels hanging neatly. Cat-approved softness." }
  ],

  rug: [
    { speaker: 'Marice', text: "Soft area rug. Perfect for cats to zoom across at 3 AM." }
  ],

  wall_art: [
    { speaker: 'Marice', text: "Art on the wall. It's tastefully abstract." }
  ],

  coat_rack: [
    { speaker: 'Marice', text: "Coats and scarves hanging here. Ready for any weather." }
  ],

  // ============================
  // NEW INTERACTABLES - BASEMENT
  // ============================

  weights: [
    { speaker: 'Marice', text: "Free weights. I should use these more... after finding all the cats." }
  ],

  exercise_bike: [
    { speaker: 'Marice', text: "Stationary bike. Olive uses this area as her fortress of solitude." }
  ],

  yoga_mat: [
    { speaker: 'Marice', text: "Yoga mat rolled up neatly. Namaste, but first, cat snuggles." }
  ],

  storage_box: [
    { speaker: 'Marice', text: "Storage boxes full of seasonal decorations and memories." }
  ],

  washer: [
    { speaker: 'Marice', text: "Washing machine. Always running in a house with three cats." }
  ],

  dryer: [
    { speaker: 'Marice', text: "The dryer. Warm clothes = instant cat magnet." }
  ],

  laundry_basket_storage: [
    { speaker: 'Marice', text: "Empty laundry basket. Already used the other one for the stairs." }
  ],

  cleaning_supplies: [
    { speaker: 'Marice', text: "Cleaning supplies. Cat hair removal is a full-time job." }
  ],

  pool_table: [
    { speaker: 'Marice', text: "Pool table for game nights. The cats think the balls are toys." }
  ],

  mini_fridge: [
    { speaker: 'Marice', text: "Mini fridge stocked with drinks and extra cat treats. Priorities." }
  ],

  gaming_setup: [
    { speaker: 'Marice', text: "Gaming PC setup. RGB lights everywhere. Olive loves watching the colors." }
  ],

  bath_mat: [
    { speaker: 'Marice', text: "Fluffy bath mat. Non-slip and cat-approved." }
  ],

  bathroom_cabinet: [
    { speaker: 'Marice', text: "Bathroom cabinet with towels and toiletries. All organized." }
  ],

  tool_bench: [
    { speaker: 'Marice', text: "Tool bench with various DIY supplies. For those home improvement days." }
  ],

  water_heater: [
    { speaker: 'Marice', text: "Water heater humming quietly. Keeping things warm and cozy." }
  ],

  bookshelf_basement: [
    { speaker: 'Marice', text: "Bookshelf with old paperbacks and magazines. Basement reading material." }
  ],

  // ============================
  // NEW INTERACTABLES - UPSTAIRS
  // ============================

  nightstand: [
    { speaker: 'Marice', text: "Nightstand with a lamp and some reading material. Bedtime essentials." }
  ],

  dresser: [
    { speaker: 'Marice', text: "Dresser with neatly folded clothes. Cats love napping on top of this." }
  ],

  jewelry_box: [
    { speaker: 'Marice', text: "Jewelry box with treasured pieces. Kept secure from curious paws." }
  ],

  wardrobe: [
    { speaker: 'Marice', text: "Large wardrobe. Sometimes a cat sneaks in and takes a nap." }
  ],

  bedside_lamp: [
    { speaker: 'Marice', text: "Bedside lamp with soft lighting. Perfect for reading before sleep." }
  ],

  guest_dresser: [
    { speaker: 'Marice', text: "Guest room dresser. Beatrice has claimed the top as her throne." }
  ],

  reading_nook: [
    { speaker: 'Marice', text: "A cozy reading nook by the window. Best spot in the house." }
  ],

  filing_cabinet: [
    { speaker: 'Marice', text: "Filing cabinet full of important documents. Organized and secure." }
  ],

  office_chair: [
    { speaker: 'Marice', text: "Ergonomic office chair. Olive steals this when I'm not looking." }
  ],

  printer: [
    { speaker: 'Marice', text: "Printer ready for action. Paper jam? Not today!" }
  ],

  bookcase: [
    { speaker: 'Marice', text: "Bookcase filled with favorites. Every book tells a story." }
  ],

  bathroom_scale: [
    { speaker: 'Marice', text: "Bathroom scale. The cats weigh themselves sometimes. It's adorable." }
  ],

  medicine_cabinet: [
    { speaker: 'Marice', text: "Medicine cabinet with first aid supplies. Safety first!" }
  ],

  towel_warmer: [
    { speaker: 'Marice', text: "Heated towel rack. Luxury living with warm towels after a shower." }
  ],

  hallway_table: [
    { speaker: 'Marice', text: "Console table with a decorative bowl for keys. Everything in its place." }
  ],

  plant_hallway: [
    { speaker: 'Marice', text: "Another potted plant. This house is basically a greenhouse now." }
  ],

  family_photos: [
    { speaker: 'Marice', text: "Family photos on the wall. Me and my three girls through the years." }
  ],

  coat_hooks: [
    { speaker: 'Marice', text: "Coat hooks for jackets and bags. Simple and functional." }
  ],

  ceiling_fan: [
    { speaker: 'Marice', text: "Ceiling fan spinning slowly. Keeps the air circulating nicely." }
  ],

  linen_closet: [
    { speaker: 'Marice', text: "Linen closet with extra sheets and blankets. Always prepared for guests." }
  ],

  // ============================
  // OUTSIDE / ENTRY
  // ============================

  outside_riddle_board: [
    { speaker: 'Marice', text: "A plaque by the door reads:" },
    { speaker: 'Marice', text: "\"There are three cats and one of you. Find the three cats then there'll be four of you.\"" }
  ],

  front_door_locked: [
    { speaker: 'Marice', text: "The front door is locked with a number pad." },
    { speaker: 'Marice', text: "It wants a four-digit code — there are three cats and one of you; find the three cats then there'll be four of you." },
    { speaker: 'Marice', text: "Hint to self: the code is hidden in the riddle." }
  ],

  // ============================
  // OUTSIDE INTERACTABLES
  // ============================
  welcome_mat: [
    { speaker: 'Marice', text: "A cozy welcome mat that says 'Home is where the cats are.' Ain't that the truth." }
  ],

  porch_light: [
    { speaker: 'Marice', text: "The porch light is on. At least I can see the keypad clearly." }
  ],

  flower_bed: [
    { speaker: 'Marice', text: "Pretty flowers. They brighten the doorway without getting in the cats' way." }
  ],

  bird_bath: [
    { speaker: 'Marice', text: "A stone bird bath. The cats would sit by the window and watch the birds for hours." }
  ],

  mailbox: [
    { speaker: 'Marice', text: "Just bills and a cat food catalog. At least the priorities are right." }
  ],

  garden_gnome: [
    { speaker: 'Marice', text: "A cheerful garden gnome. Olive knocked it over twice last week." }
  ],

  garden_bench: [
    { speaker: 'Marice', text: "A sturdy bench for taking off shoes before heading inside." }
  ],

  // ============================
  // CAT TOY COLLECTIBLES
  // ============================
  cat_toy_jingle_ball: [
    { speaker: 'Marice', text: "Oh! A jingle ball hidden under here! The cats must have batted it around everywhere." },
    { speaker: 'Marice', text: "This was Olive's favorite toy. She used to chase it up and down the hallway at 3 AM." }
  ],

  cat_toy_feather_wand: [
    { speaker: 'Marice', text: "A feather wand toy tucked behind the boxes! This one's been missing for weeks." },
    { speaker: 'Marice', text: "Alice goes absolutely wild for this thing. She'll do backflips trying to catch it." }
  ],

  cat_toy_laser_pointer: [
    { speaker: 'Marice', text: "The laser pointer! It was in the drawer this whole time!" },
    { speaker: 'Marice', text: "Beatrice pretends she's too dignified to chase the dot... but she always does." }
  ],

  cat_toy_found: [
    { speaker: 'Marice', text: "I already found a toy here. The cats will be so happy later!" }
  ]
};
