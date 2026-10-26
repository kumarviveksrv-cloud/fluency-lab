/* ============================================
   FLUENCY LAB — STAGE CONTENT
   Topic bank (four genres, always mixed), twists, host lines,
   and analysis helpers. No external services needed.
   ============================================ */

const STAGE = {

  GENRES: {
    pro: 'Professional',
    story: 'Personal story',
    abstract: 'Abstract',
    society: 'Big ideas',
  },

  TOPICS: {
    pro: [
      'The hardest piece of feedback I ever had to give',
      'Why most meetings should be an email',
      'What a great manager does in the first 90 days',
      'Hiring for attitude versus hiring for skill',
      'How to disagree with your boss and keep your job',
      'The case for a four day work week',
      'What I wish I knew before my first leadership role',
      'Why good employees quit good companies',
      'Building trust on a remote team',
      'The real cost of a bad hire',
      'Saying no without burning bridges',
      'What makes a performance review actually useful',
      'Handling a high performer who is hurting the team',
      'Why change management fails',
      'Selling an idea nobody wants to hear',
      'The skill that quietly decides careers',
      'How to run a meeting people want to attend',
      'Delegating without losing control',
      'What company culture really is',
      'Lessons from a project that failed',
      'How to onboard someone so they stay',
      'Making decisions with incomplete information',
      'Why recognition beats raises',
      'Managing someone older and more experienced than you',
      'The first five minutes of any presentation',
    ],
    story: [
      'A moment I was completely out of my depth',
      'The best advice I ignored',
      'A small kindness I never forgot',
      'The day I changed my mind about something big',
      'A mistake that taught me more than any success',
      'The teacher who shaped how I think',
      'A time I was afraid and did it anyway',
      'The most unexpected place I found a lesson',
      'A family tradition and why it matters',
      'The worst job I ever had and what it gave me',
      'A decision I almost did not make',
      'The moment I realised I had grown up',
      'A journey that went wrong in the best way',
      'Someone who believed in me before I did',
      'A habit that quietly changed my life',
      'What my first failure felt like',
      'A conversation I wish I could redo',
      'The night before something big',
      'A place that feels like home and why',
      'Something I thought I hated until I tried it',
      'A time I had to speak up and my voice shook',
      'The smallest thing that made the biggest difference',
      'A stranger who changed my day',
      'The best meal of my life and the story behind it',
      'A promise I kept when it was hard',
    ],
    abstract: [
      'Is silence a skill?',
      'Why do we remember embarrassment so clearly?',
      'If you could delete one word from the dictionary, which and why?',
      'Is a good question worth more than a good answer?',
      'The case for being bored',
      'Should everyone learn to lose gracefully?',
      'What makes something funny?',
      'If time were a currency, who is rich?',
      'Why do we love lists?',
      'The most underrated invention',
      'A world where nobody lies for a day',
      'Is it better to be liked or respected?',
      'Why does the last five minutes of a meeting matter most?',
      'What would a city designed for introverts look like?',
      'The colour that best describes your year',
      'If your voice were an instrument, which one?',
      'Why do we say sorry so much?',
      'Is luck a skill?',
      'The difference between speed and hurry',
      'What does a perfect Sunday sound like?',
      'Is it ever right to break a rule?',
      'A day in the life of an everyday object',
      'Why do first impressions stick?',
      'Convince us that mornings are overrated',
      'What is the opposite of courage?',
    ],
    society: [
      'Should schools teach public speaking from age ten?',
      'Will AI make us think less or think better?',
      'Is remote work good for cities?',
      'What does a good education actually look like?',
      'Should money be taught as a school subject?',
      'Is social media making us lonelier or more connected?',
      'The ethics of attention: who owns yours?',
      'Does hustle culture deserve its reputation?',
      'What do we owe the next generation?',
      'Is privacy becoming a luxury?',
      'Should we celebrate failure more?',
      'The future of work in twenty years',
      'Why are we so uncomfortable with silence in public?',
      'Can a company be both ethical and ruthless?',
      'Should voting be mandatory?',
      'What makes a city liveable?',
      'Is it time to rethink retirement?',
      'Does speaking more than one language change how we think?',
      'Is tradition a gift or a weight?',
      'Who is responsible for a team\'s mental health?',
      'Is competition good for children?',
      'Do rankings help or harm?',
      'What should every adult know how to do?',
      'Is technology making us less patient?',
      'Should everyone take a gap year?',
    ],
  },

  TWISTS: [
    'Open with a question.',
    'Include exactly one personal story.',
    'Argue the opposite of what you believe.',
    'Explain it as if to a ten year old.',
    'Structure it in three clear points.',
    'Use one analogy from sport.',
    'Use one analogy from food.',
    'Name the strongest counterargument and answer it.',
    'End with a single call to action.',
    'Begin with a surprising fact or number.',
    'Speak as if this is your last chance to say it.',
    'Include one deliberate moment of silence.',
    'Make the room laugh once.',
    'Use the line "here is what changed my mind".',
    'Give one concrete example before you give the principle.',
  ],

  DURATIONS: [1, 2, 3, 5, 10, 15, 20, 30],

  MOODS: ['supportive', 'neutral', 'neutral', 'tough'],

  FALLBACK_QUESTIONS: [
    'What is the one thing you want us to remember from your talk?',
    'Can you give us a concrete example of that?',
    'What would you say to someone who strongly disagrees with you?',
    'If you had to start again, what would you change?',
  ],

  // ─── Host lines ────────────────────────────
  introLine(topic, mood) {
    const lines = [
      `Ladies and gentlemen, please settle down. Our next speaker will talk about: ${topic}. Please welcome them to the stage.`,
      `Good evening everyone. Please take your seats. Today's topic is: ${topic}. Let's give a warm welcome to our speaker.`,
      `Thank you all for being here. Our next talk is called: ${topic}. Please put your hands together.`,
      `Alright, let's begin. The question on the table: ${topic}. Over to you.`,
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  },
  closeLine() {
    const lines = [
      'And that is time. Thank you. Let us hear it once more.',
      'Thank you very much. That is the end of the session. A big round of applause please.',
      'That brings us to time. Thank you for that. Please, a warm round of applause.',
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  },
  qaIntro: 'We have a little time left for questions from the floor.',
  qaOutro: 'Thank you. That is all we have time for. One more round of applause.',

  // ─── Topic picking ─────────────────────────
  // Mixed genres, no repeats until the bank cycles. Optionally includes AI-generated topics.
  pickTopic() {
    const seen = new Set(STORE.get('stageSeen', []));
    const fresh = STORE.get('stageFresh', []);
    const genres = Object.keys(STAGE.TOPICS);
    const lastGenre = STORE.get('stageLastGenre', null);

    // 1 in 4 draws uses a freshly generated topic when available
    if (fresh.length && Math.random() < 0.25) {
      const f = fresh.shift();
      STORE.set('stageFresh', fresh);
      return STAGE._compose(f.t, f.g in STAGE.GENRES ? f.g : 'abstract');
    }

    let pool = [];
    genres.filter(g => g !== lastGenre).forEach(g =>
      STAGE.TOPICS[g].forEach(t => { if (!seen.has(t)) pool.push({ t, g }); }));
    if (!pool.length) {            // bank exhausted: reset history
      STORE.set('stageSeen', []);
      genres.forEach(g => STAGE.TOPICS[g].forEach(t => pool.push({ t, g })));
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    seen.add(pick.t);
    STORE.set('stageSeen', [...seen].slice(-90));
    STORE.set('stageLastGenre', pick.g);
    return STAGE._compose(pick.t, pick.g);
  },

  _compose(topic, genre) {
    const twist = Math.random() < 0.65 ? STAGE.TWISTS[Math.floor(Math.random() * STAGE.TWISTS.length)] : '';
    return { topic, genre, genreLabel: STAGE.GENRES[genre] || 'Mixed', twist };
  },

  randomDuration() {
    const d = [1, 2, 3, 5, 5, 10, 10, 15];
    return d[Math.floor(Math.random() * d.length)];
  },

  // ─── Delivery analysis (runs on the transcript) ──
  STRICT_FILLERS: /\b(um+|uh+|erm|er|ah|hmm+|you know|i mean|basically|literally|sort of|kind of)\b/gi,

  countFillers(text) {
    const found = {};
    const bump = (k) => { k = k.toLowerCase().trim(); found[k] = (found[k] || 0) + 1; };
    (text.match(STAGE.STRICT_FILLERS) || []).forEach(bump);
    // "like" only counts as a filler when it is set off by commas
    (text.match(/,\s*like[,.]/gi) || []).forEach(() => bump('like'));
    const total = Object.values(found).reduce((a, b) => a + b, 0);
    const top = Object.entries(found).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, top };
  },

  // Repeated words and restarts: "the the", "I I", "we we"
  stumbles(text) {
    const out = [];
    const re = /\b(\w+)\s+\1\b/gi;
    let m;
    while ((m = re.exec(text)) && out.length < 8) {
      if (/^(that|had|very|so)$/i.test(m[1])) continue;
      const a = Math.max(0, m.index - 25), b = Math.min(text.length, m.index + m[0].length + 25);
      out.push('...' + text.slice(a, b).replace(/\s+/g, ' ') + '...');
    }
    return out;
  },

  // Long words a speaker may have wrestled with (for the My Words list)
  longWords(text) {
    const counts = {};
    (text.toLowerCase().match(/[a-z']{10,}/g) || []).forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => b.length - a.length).slice(0, 10);
  },
};

window.STAGE = STAGE;
