/*
 * dialogue.js — Dialogue scripts for Marice & Cats House Adventure
 *
 * Each dialogue is an array of message objects:
 *   { speaker: "Marice"|"Alice"|"Olive"|"Beatrice", text: "..." }
 *
 * The portrait displayed is always the cat's portrait (not Marice's).
 * Speaker names are shown as tags above the text.
 *
 * Each dialogue sequence is exactly 3 messages.
 */

const DIALOGUE = {

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
    { speaker: 'Marice', text: "The backyard looks so peaceful. But I need to find my cats first!" }
  ],

  futon: [
    { speaker: 'Marice', text: "A comfy futon. I can see cat claw marks all over it. Classic." }
  ]
};
