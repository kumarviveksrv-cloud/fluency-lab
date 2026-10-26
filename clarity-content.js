/* ============================================
   FLUENCY LAB — CLARITY CONTENT
   Read-aloud material for the cork / pencil-in-teeth drill.
   Passages are written so the lips, tongue tip and jaw have to work.
   "track: true" sets are English, so Whisper can score accuracy.
   Hindi sets are played back and self-rated (the transcription
   worker is locked to English).
   ============================================ */

const CLARITY = {

  safety: [
    'Use a clean wine cork, or a pencil by the eraser end. Never a sharpened tip.',
    'Rest it lightly between your front teeth. Lips stay free to move. No clenching.',
    'Open the mouth bigger than feels polite. Over-shape every sound.',
    'Keep each pass under about 90 seconds. Stop if your jaw aches.',
  ],

  sets: [
    {
      id: 'tongue',
      name: 'Tongue Tip: TH, L, R',
      lang: 'en',
      track: true,
      blurb: 'Tongue-tip sounds that go soft when you rush',
      tips: [
        'TH: tongue tip lightly touches the back of the top teeth, then pulls away.',
        'L: tongue tip taps just behind the top teeth and stays there for a beat.',
        'R: tongue pulls back and curls, never touching the roof of the mouth.',
      ],
      text:
`Rory thoroughly relished the really rural road through the lush, rolling hills.
Three thin leaders threaded through the thick mist, then rushed toward the little river.
"Rather than wait, let's reach the lower valley," Laura said, rapidly tracing her route.
The brilliant light slowly lifted, and everything along the rim glittered.
Truly, the relationship between rhythm and clear speech is practice, practice, practice.`,
      quick: `Rory thoroughly relished the really rural road through the lush, rolling hills.
Three thin leaders threaded through the thick mist, then rushed toward the little river.`,
    },
    {
      id: 'taps',
      name: 'Lips & Taps: P B T D K G',
      lang: 'en',
      track: true,
      blurb: 'Hard consonants that blur when you speed up',
      tips: [
        'P and B: build a little pressure behind closed lips, then release crisply.',
        'T and D: tongue tip taps the ridge behind the top teeth, quick and clean.',
        'K and G: back of the tongue lifts to the soft palate and snaps away.',
      ],
      text:
`Peter Piper's plan was practical: pick the best spot, bring the big bag, and put the plates down quickly.
Daniel decided to take the tough, dusty track to the dark creek, but Kate grabbed the keys and kept the group together.
"Don't dither, don't drop the gear, and don't give up," the guide barked.
By dusk, bold campers had pitched tents, cooked dinner, and toasted to the great, quiet countryside.`,
      quick: `Peter Piper's plan was practical: pick the best spot, bring the big bag, and put the plates down quickly.
"Don't dither, don't drop the gear, and don't give up," the guide barked.`,
    },
    {
      id: 'sibilants',
      name: 'Sibilants: S Z SH',
      lang: 'en',
      track: true,
      blurb: 'Clean S, Z and SH without the slush',
      tips: [
        'S: teeth nearly together, tongue tip down behind the bottom teeth, thin stream of air.',
        'SH: lips slightly rounded and pushed forward, tongue pulled back a little.',
        'With the cork in, feel where the air splits. Keep that same placement with it out.',
      ],
      text:
`She sells seashells, but Sam's sister surely sees six zebras sleeping beside the sunny sea shore.
Sharon's shy students wished to share the special shows, so she sang softly, then spoke with steady, sure sounds.
Success is simply a series of small, sincere sessions.
Sixty seconds of slow, sharp practice raises zest and sense in every sentence.`,
      quick: `She sells seashells, but Sam's sister surely sees six zebras sleeping beside the sunny sea shore.
Success is simply a series of small, sincere sessions.`,
    },
    {
      id: 'longwords',
      name: 'Long Words',
      lang: 'en',
      track: true,
      blurb: 'Multi-syllable words where syllables blur together',
      tips: [
        'Say each syllable as its own beat first, then slide them together.',
        'Land the stressed syllable harder (shown in CAPS), keep the rest light but complete.',
        'Never swallow the ending. Finish every word before starting the next.',
      ],
      words: [
        ['relationship', 're-LAY-shun-ship'],
        ['responsibility', 're-spon-si-BIL-i-ty'],
        ['accountability', 'ac-count-a-BIL-i-ty'],
        ['comprehensive', 'com-pre-HEN-sive'],
        ['organizational', 'or-gan-i-ZAY-shun-al'],
        ['communication', 'com-mu-ni-CAY-shun'],
        ['particularly', 'par-TIC-u-lar-ly'],
        ['unambiguous', 'un-am-BIG-u-ous'],
        ['deliberate', 'de-LIB-er-ate'],
        ['entrepreneurial', 'en-tre-pre-NUR-i-al'],
        ['infrastructure', 'IN-fra-struc-ture'],
        ['differentiate', 'dif-fer-EN-shi-ate'],
      ],
      text:
`Responsibility and accountability shape every relationship at work.
A comprehensive understanding of organizational expectations, especially in a diverse environment, requires extraordinary communication.
Our international colleagues appreciate unambiguous, deliberate articulation, particularly when explaining sophisticated, interdisciplinary recommendations.`,
      quick: `Responsibility and accountability shape every relationship at work.
Our international colleagues appreciate unambiguous, deliberate articulation.`,
    },
    {
      id: 'tha',
      name: 'Hindi: Finish the "tha"',
      lang: 'hi',
      track: false,
      blurb: 'Karta tha, dekhta tha, peeta tha: land the last word',
      tips: [
        'The verb is not the finish line. "tha" is: give it the same energy as the word before it.',
        '"th" in "tha" is a soft T with the tongue tip touching the back of the top teeth, then a long "aa".',
        'Back-chain it: say only "tha", then "karta tha", then the whole sentence. Never rush the last beat.',
        'Cork in: you cannot swallow the ending, because your mouth has to complete the shape.',
      ],
      words: [
        ['karta tha', 'kar-TA THAA'],
        ['dekhta tha', 'dekh-TA THAA'],
        ['peeta tha', 'pee-TA THAA'],
        ['koodta tha', 'kood-TA THAA'],
        ['chalta tha', 'chal-TA THAA'],
        ['bolta tha', 'bol-TA THAA'],
        ['sochta tha', 'soch-TA THAA'],
      ],
      text:
`Woh har roz mehnat se kaam karta tha.
Main bachpan mein cartoon dekhta tha.
Raju subah garam chai peeta tha.
Bandar ek daal se doosri daal par koodta tha.
Hamare gaon ka budhaa roz nadi tak chalta tha.
Woh dheere dheere, saaf saaf bolta tha.
Main sochta tha ki sab theek ho jayega.
Hum shaam ko saath mein khelte the.
Woh gaana gaati thi aur sab sunte the.`,
      quick: `Woh har roz mehnat se kaam karta tha.
Main bachpan mein cartoon dekhta tha.
Raju subah garam chai peeta tha.`,
    },
  ],
};

window.CLARITY = CLARITY;
