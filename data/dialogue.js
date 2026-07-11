/*
 * dialogue.js — Dialogue scripts for Marice & Cats: The Great Treat Heist
 *
 * THE PREMISE:
 *   Marice popped out for twenty minutes. She came home to a crime scene:
 *   the treat jar is on its side, empty, with a trail of crumbs — and all
 *   three cats have mysteriously vanished to different corners of the house,
 *   each one acting VERY innocent. Detective Marice is on the case.
 *
 *   Alice     — the Witness. Saw everything. Bills by the Purrpop.
 *   Olive     — the Muscle. Found at the scene of the crumbs.
 *   Beatrice  — the Mastermind. Currently disguised as a blanket.
 *
 * Each dialogue is an array of message objects:
 *   { speaker: "Marice"|"Alice"|"Olive"|"Beatrice", text: "..." }
 *
 * Cat dialogues show the cat and Marice portraits together.
 * Speaker names are shown as tags above the text.
 */

const DIALOGUE = {

  // ============================
  // TUTORIAL / INTRO
  // ============================
  intro: [
    { speaker: 'Marice', text: "I was gone for TWENTY MINUTES. And my phone just buzzed: 'PET CAM ALERT — MOTION DETECTED: KITCHEN.'" },
    { speaker: 'Marice', text: "The photo shows the treat jar... on its side... EMPTY. And now the girls aren't even at the window. Suspicious. Extremely suspicious." },
    { speaker: 'Marice', text: "Alright. Deep breath. Detective Marice is on the case. First: get inside. The house plaque by the door should remind me of my own door code..." }
  ],

  // ============================
  // ALICE — the Witness. Dining room, cat tree.
  // ============================

  // A) First interaction, before receiving Purrpops
  alice_before: [
    { speaker: 'Alice', text: "Ah. The detective arrives. Yes, I saw the whole thing from up here. Best vantage point in the house — I see EVERYTHING." },
    { speaker: 'Marice', text: "Alice! Perfect. You're my star witness. Who emptied the treat jar? Tell me everything." },
    { speaker: 'Alice', text: "Mmm, my memory is a delicate thing. It works best when fed. My consulting fee is one serving of Purrpops. Crunchy ones. Non-negotiable." }
  ],

  // Alice — wrong item offered (Shrimp & Salmon Feast)
  alice_wrong_item: [
    { speaker: 'Marice', text: "Would the witness accept payment in Shrimp & Salmon Feast?" },
    { speaker: 'Alice', text: "The witness would NOT. Wet food? Do I look like I testify for slop? My rates are posted: Purrpops." },
    { speaker: 'Alice', text: "Kitchen. Cupboards. The culprits couldn't reach the emergency stash. Unlike SOME cats, I don't do crime — I do commentary." }
  ],

  // B) After giving Purrpops
  alice_after: [
    { speaker: 'Marice', text: "One consulting fee, paid in full. Now spill it, Alice." },
    { speaker: 'Alice', text: "*crunch crunch* ...Very well. At approximately snack o'clock, a low, fast, GRAY-ISH shadow dragged the treat jar toward the basement door. I said nothing. I was on break." },
    { speaker: 'Alice', text: "One more thing, detective. The basement key was 'hidden' under the sofa blanket last week. By whom? I've already said too much. *grooms paw*" }
  ],

  // Alice — already helped
  alice_done: [
    { speaker: 'Alice', text: "*yawn* My testimony stands. Shadow. Basement. Key under the sofa blanket. Case practically solves itself." },
    { speaker: 'Marice', text: "You know, for a witness, you knew an awful lot of specifics, Alice." },
    { speaker: 'Alice', text: "...This interview is over. I have a nap at three." }
  ],

  // ============================
  // OLIVE — the Muscle. Basement rec room, under treadmill.
  // ============================

  // C) First interaction, before receiving Purrpops
  olive_before: [
    { speaker: 'Marice', text: "Olive. Fancy finding you under the treadmill... surrounded by what appear to be TREAT CRUMBS." },
    { speaker: 'Olive', text: "*freezes mid-lick* Crumbs? What crumbs? These were here when I got here. I've been doing zoomies ALL day. Ask anyone. Ask the wall." },
    { speaker: 'Olive', text: "Look, I know how this works. I get interrogation snacks, THEN I talk. Purrpops. It's standard procedure. I watch cop shows with you." }
  ],

  // Olive — wrong item offered (Shrimp & Salmon Feast)
  olive_wrong_item: [
    { speaker: 'Marice', text: "Will the suspect talk for a Shrimp & Salmon Feast?" },
    { speaker: 'Olive', text: "*sniff sniff* Objection! That's BEATRICE food. You can't flip me with the boss's snack. I'm a Purrpops girl, everyone knows this." },
    { speaker: 'Olive', text: "...Wait. Forget I said 'boss.' There is no boss. Zoomies! I was doing zoomies! *tail swish*" }
  ],

  // D) After giving Purrpops
  olive_after: [
    { speaker: 'Olive', text: "*ZOOM* GIMME GIMME— *cronch cronch* ...Okay. OKAY. I'll talk. But I want it on the record that I'm adorable." },
    { speaker: 'Olive', text: "I carried the jar. But I'm just the muscle! The PLAN came from upstairs. From... The Blanket. That's all I can say. She hears everything." },
    { speaker: 'Olive', text: "She triggered the laundry avalanche on the stairs to cover the escape route. Take this basket — you'll never make it up there without it. Good luck, detective. You never saw me." }
  ],

  // Olive — already helped
  olive_done: [
    { speaker: 'Olive', text: "*rolling on floor* I said too much, didn't I. I'm gonna be demoted from muscle to lookout." },
    { speaker: 'Marice', text: "Olive, you were caught lying in a pile of crumbs. There was nothing left to confess." },
    { speaker: 'Olive', text: "The crumbs framed me! ...Okay it was me. Go get The Blanket. Upstairs. Be brave." }
  ],

  // ============================
  // BEATRICE — the Mastermind. Upstairs guest bedroom, under blanket.
  // ============================

  // E) First interaction, before receiving food
  beatrice_before: [
    { speaker: 'Marice', text: "So. 'The Blanket.' The mastermind behind the Great Treat Heist. Anything to say for yourself, Beatrice?" },
    { speaker: 'Beatrice', text: "*muffled* I am a blanket. Blankets cannot mastermind heists. Blankets cannot even hold pencils. Your case has fallen apart." },
    { speaker: 'Beatrice', text: "...However. Were someone to deliver a Shrimp & Salmon Feast — on a plate, like a civilized meal — this blanket might produce a full confession. Final offer." }
  ],

  // Beatrice — wrong item offered (Purrpops)
  beatrice_wrong_item: [
    { speaker: 'Marice', text: "I have Purrpops, Beatrice. Talk, and they're yours." },
    { speaker: 'Beatrice', text: "*disgusted blanket noises* You dare offer the mastermind dry little pebbles? That is FOOT SOLDIER food. That is what I pay OLIVE with." },
    { speaker: 'Beatrice', text: "...I said nothing. The blanket said nothing. Shrimp & Salmon Feast, detective, or this cocoon takes its secrets to nap." }
  ],

  // Beatrice — already fed (game complete)
  beatrice_done: [
    { speaker: 'Beatrice', text: "*purring loudly* Yes, yes, guilty as charged. Greatest heist this house has ever seen. I regret nothing." },
    { speaker: 'Marice', text: "You're lucky the sentencing judge finds you adorable, Beatrice." },
    { speaker: 'Beatrice', text: "The judge is soft. Now come to bed — the whole gang serves our sentence together." }
  ],

  // Generic wrong item (e.g. key, laundry basket) when offering to a cat
  cat_wrong_item_generic: [
    { speaker: 'Marice', text: "I don't think that's going to loosen any whiskered lips." }
  ],

  // F) After receiving Shrimp & Salmon Feast — THE CONFESSION
  beatrice_after: [
    { speaker: 'Marice', text: "One Shrimp & Salmon Feast, as demanded. Now — the confession. All of it." },
    { speaker: 'Beatrice', text: "*emerges majestically* Very well. It was a three-cat job. Alice ran lookout from her tower — 'witness,' HA. Olive hauled the jar. I planned it all from this very blanket. Motive? Dinner was SEVEN MINUTES LATE on Tuesday. We do not forgive." },
    { speaker: 'Beatrice', text: "*purring intensely* ...The verdict, detective? Make it quick. This blanket is warm, and frankly, you look like you need a snuggle more than justice." }
  ],

  // ============================
  // OBJECT INTERACTIONS — KITCHEN (the crime scene)
  // ============================

  fridge: [
    { speaker: 'Marice', text: "The fridge is untouched. Of course — no thumbs. That narrows the suspect pool to exactly my three cats." }
  ],

  stove: [
    { speaker: 'Marice', text: "The stovetop is still warm from breakfast. The heist went down in broad daylight. Bold." }
  ],

  kitchen_sink: [
    { speaker: 'Marice', text: "A single treat crumb in the sink. Someone tried to destroy the evidence. Amateurs." }
  ],

  coffee_station: [
    { speaker: 'Marice', text: "Every detective needs coffee. Mine comes with a side of cat hair. It's fine. It's fine." }
  ],

  dining_table: [
    { speaker: 'Marice', text: "Paw prints ON the table. Table privileges were revoked YEARS ago. This gang has gone completely lawless." }
  ],

  cupboard_empty: [
    { speaker: 'Marice', text: "Old mugs, cat hair, and no clues. Even detectives hit dead ends." }
  ],

  cupboard_purrpops: [
    { speaker: 'Marice', text: "The emergency Purrpops stash — top shelf, untouched! The one place tiny criminal paws couldn't reach. Perfect witness-bribing material." }
  ],

  cupboard_feast: [
    { speaker: 'Marice', text: "A can of Shrimp & Salmon Feast — the good stuff I save for special occasions. If the rumors are true, this is exactly what a certain mastermind charges for a confession. Let me plate it properly." }
  ],

  sofa_blanket: [
    { speaker: 'Marice', text: "Under the sofa blanket... the basement key! Exactly where Alice said. 'Hidden last week,' she said. This heist was PREMEDITATED." }
  ],

  sofa_blanket_empty: [
    { speaker: 'Marice', text: "Just a rumpled blanket. Smells faintly of cat and conspiracy." }
  ],

  basement_door_locked: [
    { speaker: 'Marice', text: "Locked. The culprit dragged the jar down THERE and locked the door behind them? These cats are more organized than my taxes." }
  ],

  basement_door_unlock: [
    { speaker: 'Marice', text: "The key fits! *click* Alright, treat thief. Detective Marice is coming downstairs." }
  ],

  laundry_pile_blocked: [
    { speaker: 'Marice', text: "A laundry AVALANCHE, blocking the entire staircase. This was no accident — this was staged to slow down the investigation. I need something to haul it all away..." }
  ],

  laundry_pile_clear: [
    { speaker: 'Marice', text: "Scoop... scoop... there! Avalanche cleared, evidence bagged (and by evidence I mean socks). The trail leads up!" }
  ],

  sliding_door: [
    { speaker: 'Marice', text: "The backyard can wait. No garden strolls until this case is closed." }
  ],

  // Played once, the first time the sliding door opens after the ending
  sliding_door_open: [
    { speaker: 'Marice', text: "Case closed, sentence served, and three convicted treat thieves purring at my heels. You know what? It's a beautiful evening." },
    { speaker: 'Marice', text: "*click* The sliding door glides open. Fresh air at last!" },
    { speaker: 'Marice', text: "Come on, gang — supervised outdoor time in the garden. And NOBODY case the bird feeder. I'm watching you." }
  ],

  tv: [
    { speaker: 'Marice', text: "Paused on bird videos. So this is what the lookout was 'watching' during the heist. Airtight alibi, Alice." }
  ],

  floor_lamp: [
    { speaker: 'Marice', text: "The lamp is slightly crooked. Evidence of a getaway route, or just Tuesday? In this house, both." }
  ],

  coffee_table: [
    { speaker: 'Marice', text: "Fresh paw prints in the dust, heading kitchen-ward. The forensics practically do themselves." }
  ],

  bookshelf: [
    { speaker: 'Marice', text: "A whole shelf of cat behavior books. Not ONE chapter on organized crime. Useless." }
  ],

  futon: [
    { speaker: 'Marice', text: "Claw marks on the futon. Old evidence from previous, unprosecuted crimes." }
  ],

  // ============================
  // FLAVOR INTERACTABLES - MAIN FLOOR
  // ============================

  microwave: [
    { speaker: 'Marice', text: "The microwave clock blinks 12:00. It knows what happened. It'll never talk." }
  ],

  trash_can: [
    { speaker: 'Marice', text: "I checked the trash for the missing treats. Nothing. They didn't dump the loot — they ATE it. Cold-blooded." }
  ],

  spice_rack: [
    { speaker: 'Marice', text: "Spices alphabetized, untouched. The perps had one target and stayed disciplined. Professionals." }
  ],

  china_cabinet: [
    { speaker: 'Marice', text: "Fancy dishes, all intact. A clean job. No collateral damage. Almost... respectable." }
  ],

  plant: [
    { speaker: 'Marice', text: "The potted plant survived the heist. Statistically, it should not have. They must have been in a hurry." }
  ],

  game_console: [
    { speaker: 'Marice', text: "My cozy game console. In THOSE games, the mysteries have fewer suspects sitting on the evidence." }
  ],

  side_table: [
    { speaker: 'Marice', text: "Side table, reading lamp, no clues. Not every lead pans out, detective." }
  ],

  reading_chair: [
    { speaker: 'Marice', text: "Alice's daytime throne. Warm. Recently occupied. So she DID leave her 'post' at some point..." }
  ],

  bathroom_mirror: [
    { speaker: 'Marice', text: "Look at yourself, Marice. Interrogating cats. ...And WINNING. Carry on." }
  ],

  towel_rack: [
    { speaker: 'Marice', text: "Fresh towels, undisturbed. The crime spree was strictly snack-related." }
  ],

  rug: [
    { speaker: 'Marice', text: "The rug is rumpled in a suspicious zigzag. Classic high-speed treat-jar drag pattern." }
  ],

  wall_art: [
    { speaker: 'Marice', text: "Tastefully abstract art. If you squint, it looks like three cats plotting. Everything does, today." }
  ],

  coat_rack: [
    { speaker: 'Marice', text: "My detective coat! ...It's a regular coat. But TODAY, it's a detective coat." }
  ],

  // ============================
  // FLAVOR INTERACTABLES - BASEMENT
  // ============================

  weights: [
    { speaker: 'Marice', text: "Free weights. So this is where the 'muscle' of the operation trains. It's mostly naps. It's all naps." }
  ],

  exercise_bike: [
    { speaker: 'Marice', text: "The exercise bike. Olive sits on it and judges me. Today, the judging goes the other direction." }
  ],

  yoga_mat: [
    { speaker: 'Marice', text: "My yoga mat. Inner peace can resume after sentencing." }
  ],

  storage_box: [
    { speaker: 'Marice', text: "Storage boxes, recently disturbed. Somebody used these as a staging area. This operation had LOGISTICS." }
  ],

  washer: [
    { speaker: 'Marice', text: "The washing machine. Currently the only clean thing about this whole affair." }
  ],

  dryer: [
    { speaker: 'Marice', text: "The dryer is warm. A known cat gathering spot. Is this where the plot was hatched?" }
  ],

  laundry_basket_storage: [
    { speaker: 'Marice', text: "A spare laundry basket. In a house of avalanche-staging criminals, you can never have too many." }
  ],

  cleaning_supplies: [
    { speaker: 'Marice', text: "Cleaning supplies at the ready. There's a crumb trail with my name on it once this case wraps." }
  ],

  pool_table: [
    { speaker: 'Marice', text: "Pool balls scattered mid-game. Either the heist crew celebrated down here, or physics happened. Suspicious either way." }
  ],

  mini_fridge: [
    { speaker: 'Marice', text: "Mini fridge: drinks, and my BACKUP treat stash — untouched! They don't know about this one. Detective's privilege." }
  ],

  gaming_setup: [
    { speaker: 'Marice', text: "The gaming PC's RGB lights are still cycling. Olive's favorite show. Even criminals have hobbies." }
  ],

  bath_mat: [
    { speaker: 'Marice', text: "Fluffy bath mat, zero clues. Moving on." }
  ],

  bathroom_cabinet: [
    { speaker: 'Marice', text: "Towels and toiletries, all accounted for. The perps had no interest in hygiene. Checks out." }
  ],

  tool_bench: [
    { speaker: 'Marice', text: "The tool bench. Good news: the heist crew can't use tools. Yet." }
  ],

  water_heater: [
    { speaker: 'Marice', text: "The water heater hums, keeping its secrets warm." }
  ],

  bookshelf_basement: [
    { speaker: 'Marice', text: "Old paperbacks. Half of these are detective novels. So THAT'S where they learned it. From me. It's from me." }
  ],

  // ============================
  // FLAVOR INTERACTABLES - UPSTAIRS
  // ============================

  nightstand: [
    { speaker: 'Marice', text: "My nightstand. My half-read mystery novel. The irony is not lost on me." }
  ],

  dresser: [
    { speaker: 'Marice', text: "Cat-shaped dent on top of the dresser. Somebody surveilled this floor from up here." }
  ],

  jewelry_box: [
    { speaker: 'Marice', text: "Jewelry, all present. They could've gone for the diamonds. They wanted the TREATS. Respect the focus, honestly." }
  ],

  wardrobe: [
    { speaker: 'Marice', text: "I checked the wardrobe for hiding suspects. Just clothes. And a little cat hair. Everything is a little cat hair." }
  ],

  bedside_lamp: [
    { speaker: 'Marice', text: "Soft lamp light. Great for reading. Terrible for interrogations. I'll allow it." }
  ],

  guest_dresser: [
    { speaker: 'Marice', text: "The guest dresser — Beatrice's throne. From up here she can see the whole room. Command center confirmed." }
  ],

  reading_nook: [
    { speaker: 'Marice', text: "The window nook. Prime surveillance real estate. This house has more lookout posts than a lighthouse." }
  ],

  filing_cabinet: [
    { speaker: 'Marice', text: "The filing cabinet. After today, it gets a new folder: 'TREAT HEIST — CLOSED (SUSPECTS TOO CUTE).'" }
  ],

  office_chair: [
    { speaker: 'Marice', text: "The office chair is still spinning slightly. Someone left in a hurry. Or Olive discovered spinning again." }
  ],

  printer: [
    { speaker: 'Marice', text: "The printer. If the cats ever learn to print ransom notes, I'm done for." }
  ],

  bookcase: [
    { speaker: 'Marice', text: "My bookcase. Every mystery I own, and not one prepared me for an inside job." }
  ],

  bathroom_scale: [
    { speaker: 'Marice', text: "The scale. After a whole jar of treats, SOMEONE'S weigh-in is going to be very incriminating." }
  ],

  medicine_cabinet: [
    { speaker: 'Marice', text: "First aid supplies. This case has been blessedly injury-free. Crumb-related casualties only." }
  ],

  towel_warmer: [
    { speaker: 'Marice', text: "The heated towel rack. Suspiciously luxurious. The mastermind lives WELL." }
  ],

  hallway_table: [
    { speaker: 'Marice', text: "The key bowl. My keys are here. THEIR key was under a sofa blanket. Everyone in this house has a system." }
  ],

  plant_hallway: [
    { speaker: 'Marice', text: "Another potted plant, also miraculously unharmed. Today's crimes were precise." }
  ],

  family_photos: [
    { speaker: 'Marice', text: "Family photos. Me and my three girls through the years. Exhibit A: I love these little criminals." }
  ],

  coat_hooks: [
    { speaker: 'Marice', text: "Coat hooks, bags, no clues. Even detectives appreciate good storage." }
  ],

  ceiling_fan: [
    { speaker: 'Marice', text: "The ceiling fan spins slowly, like my thoughts. Who taught a cat the word 'avalanche'?" }
  ],

  linen_closet: [
    { speaker: 'Marice', text: "Spare blankets! Don't tell Beatrice — she'll recruit them." }
  ],

  // ============================
  // OUTSIDE / ENTRY
  // ============================

  outside_riddle_board: [
    { speaker: 'Marice', text: "The house plaque — I hid my door code reminder in a riddle, in case I ever locked myself out. Past me was clever:" },
    { speaker: 'Marice', text: "\"There are three cats and one of you. Find the three cats then there'll be four of you.\"" }
  ],

  front_door_locked: [
    { speaker: 'Marice', text: "Locked, and my keys are... inside. On the key bowl. Where I proudly keep them. Great work, detective." },
    { speaker: 'Marice', text: "Fine — the keypad it is. Four digits, and the reminder is on the plaque: three cats and one of you; find the three cats then there'll be four of you." },
    { speaker: 'Marice', text: "The code is hiding in the riddle. Crack it, then crack the case." }
  ],

  // ============================
  // OUTSIDE INTERACTABLES
  // ============================
  welcome_mat: [
    { speaker: 'Marice', text: "'Home is where the cats are.' Today it should say 'Crime scene: do not cross.'" }
  ],

  porch_light: [
    { speaker: 'Marice', text: "The porch light's on. Good. Detectives should always be able to read their own keypad." }
  ],

  flower_bed: [
    { speaker: 'Marice', text: "The flowers are undisturbed. The crime was strictly an inside job." }
  ],

  bird_bath: [
    { speaker: 'Marice', text: "The bird bath. The girls log hundreds of surveillance hours on this thing from the window. Trained observers, all three." }
  ],

  mailbox: [
    { speaker: 'Marice', text: "Bills and a cat food catalog. The catalog has suspicious teeth marks on the treats page. Noted." }
  ],

  garden_gnome: [
    { speaker: 'Marice', text: "The garden gnome saw nothing. The garden gnome ALWAYS sees nothing. Useless little man." }
  ],

  garden_bench: [
    { speaker: 'Marice', text: "The bench where I put my shoes on. Twenty minutes, gone at the store. That's all it took them." }
  ],

  // ============================
  // BACKYARD GARDEN INTERACTABLES
  // ============================
  patio_table: [
    { speaker: 'Marice', text: "The patio table. Perfect for morning coffee while three reformed criminals patrol the lawn." }
  ],

  compost_bin: [
    { speaker: 'Marice', text: "The compost bin. The one thing in this yard the cats have never tried to steal. Standards." }
  ],

  bird_feeder: [
    { speaker: 'Marice', text: "The bird feeder is busy today. Three parole violations are being plotted in real time. I can feel it." }
  ],

  vegetable_patch: [
    { speaker: 'Marice', text: "Tomatoes, lettuce, and a row of catnip. The catnip keeps getting 'harvested' by unauthorized paws. Some crimes never stop." }
  ],

  catio: [
    { speaker: 'Marice', text: "The catio! A screened porch just for cats. Sunbeams in, birds out of reach. Technically, it's the nicest holding cell ever built." }
  ],

  garden_shed: [
    { speaker: 'Marice', text: "The garden shed. Trowels, flower pots, and the toy mice I confiscated last spring. Evidence locker, basically." }
  ],

  // ============================
  // CAT TOY COLLECTIBLES — the heist crew's stashed loot
  // ============================
  cat_toy_jingle_ball: [
    { speaker: 'Marice', text: "A jingle ball, deliberately stashed under here! This is loot from a PREVIOUS heist — I confiscated this thing weeks ago." },
    { speaker: 'Marice', text: "Olive's favorite. She used to chase it up and down the hallway at 3 AM. So the muscle keeps a stash down here... noted." }
  ],

  cat_toy_feather_wand: [
    { speaker: 'Marice', text: "The feather wand, hidden behind the boxes! It's been 'missing' for weeks. MISSING. I searched everywhere!" },
    { speaker: 'Marice', text: "This is Alice's favorite — she does actual backflips for it. The 'innocent witness' has a secret loot stash too. The plot thickens." }
  ],

  cat_toy_laser_pointer: [
    { speaker: 'Marice', text: "The laser pointer! Stashed in the drawer... which means someone OPENED a drawer. These cats have skills I'm not prepared for." },
    { speaker: 'Marice', text: "Beatrice pretends she's too dignified to chase the dot. The evidence in this drawer says otherwise, your honor." }
  ],

  cat_toy_found: [
    { speaker: 'Marice', text: "Already swept this stash spot. The recovered loot goes back into circulation after sentencing." }
  ],

  // ============================
  // DIARY PAGE COLLECTIBLES (lore)
  // ============================
  diary_page_home: [
    { speaker: 'Marice', text: "A crumpled page from my old diary! It must have blown out here ages ago." },
    { speaker: 'Marice', text: "*reading* 'Moving day! The house is too big and too quiet. The lady at the shelter says she has just the fix for that...'" },
    { speaker: 'Marice', text: "I remember writing this. Little did I know I'd end up with THREE fixes. And a crime syndicate." }
  ],

  diary_page_alice: [
    { speaker: 'Marice', text: "A diary page, tucked away in the half-bath of all places." },
    { speaker: 'Marice', text: "*reading* 'Met a tiny orange kitten today. She inspected the whole house, then sat on the highest shelf like a queen claiming her castle.'" },
    { speaker: 'Marice', text: "Alice hasn't changed one bit. Queen of the house — and apparently, its most unreliable witness." }
  ],

  diary_page_olive: [
    { speaker: 'Marice', text: "Another diary page! How did this end up down in the rec room?" },
    { speaker: 'Marice', text: "*reading* 'The new kitten Olive discovered the basement today. She zoomed up and down the stairs 14 times. I counted.'" },
    { speaker: 'Marice', text: "Fourteen zoomies. Years later, she'd use those exact stairs for a getaway. It was all training." }
  ],

  diary_page_beatrice: [
    { speaker: 'Marice', text: "A diary page under the pillow. So THAT'S where it went." },
    { speaker: 'Marice', text: "*reading* 'Beatrice spent her first week hiding under the guest bed. Tonight she finally crept out... and fell asleep on my chest.'" },
    { speaker: 'Marice', text: "From shy little shadow to heist mastermind. They grow up so fast. *sniff*" }
  ],

  diary_page_found: [
    { speaker: 'Marice', text: "I already tucked that diary page safely in my pocket." }
  ]
};
