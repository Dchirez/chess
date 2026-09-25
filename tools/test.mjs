// Tests du moteur : node tools/test.mjs
// Le moteur est extrait tel quel du <script id="engine"> de index.html.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = /<script id="engine">([\s\S]*?)<\/script>/.exec(html)[1];
new Function(src)();
const { Position, perft, think, uci, LEVELS, BOOK } = globalThis.Chess;

let failed = 0;
function test(name, fn) {
  const t0 = Date.now();
  try { fn(); console.log(`ok   ${name} (${Date.now() - t0} ms)`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

// Nombres de positions de référence (chessprogramming.org/Perft_Results)
const PERFT = [
  ['position initiale', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281, 4865609]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
  ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, 3894594]],
];
for (const [name, fen, counts] of PERFT) {
  test(`perft ${name}`, () => {
    const pos = new Position(fen);
    const h1 = pos.h1, h2 = pos.h2;
    counts.forEach((n, i) => assert.equal(perft(pos, i + 1), n, `profondeur ${i + 1}`));
    assert.equal(pos.fen(), new Position(fen).fen(), 'position restaurée');
    assert.ok(pos.h1 === h1 && pos.h2 === h2, 'hachage restauré');
  });
}

test('hachage incrémental = hachage recalculé', () => {
  const pos = new Position();
  for (let i = 0; i < 400; i++) {
    const moves = pos.legalMoves();
    if (!moves.length || pos.half >= 100) break;
    pos.make(moves[(i * 7919) % moves.length]);
    const { h1, h2 } = pos;
    pos.computeHash();
    assert.ok(pos.h1 === h1 && pos.h2 === h2, `coup ${i}`);
  }
});

test('répertoire d\'ouvertures légal', () => {
  for (const line of BOOK) {
    const pos = new Position();
    for (const u of line) { const m = pos.moveFromUci(u); assert.ok(m, `${u} dans ${line.join(' ')}`); pos.make(m); }
  }
});

test('notation SAN', () => {
  let pos = new Position();
  assert.equal(pos.san(pos.moveFromUci('g1f3')), 'Nf3');
  pos = new Position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(pos.san(pos.moveFromUci('e1g1')), 'O-O');
  assert.equal(pos.san(pos.moveFromUci('e1c1')), 'O-O-O');
  assert.equal(pos.san(pos.moveFromUci('a1a8')), 'Rxa8+');
  pos = new Position('7k/8/8/8/8/8/8/R3R2K w - - 0 1');
  assert.equal(pos.san(pos.moveFromUci('a1c1')), 'Rac1');
  pos = new Position('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  assert.equal(pos.san(pos.moveFromUci('a1a8')), 'Ra8#');
  pos = new Position('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(pos.san(pos.moveFromUci('a7a8q')), 'a8=Q');
  pos = new Position('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3');
  assert.equal(pos.san(pos.moveFromUci('d4e3')), 'dxe3');
});

test('fins de partie', () => {
  assert.equal(new Position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status().reason, 'stalemate');
  assert.equal(new Position('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1').status().reason, 'checkmate');
  assert.equal(new Position('8/8/4k3/8/8/2B5/4K3/8 w - - 0 1').status().reason, 'insufficient');
  assert.equal(new Position('8/8/4k3/8/8/2BB4/4K3/8 w - - 0 1').status().over, false);
  assert.equal(new Position('8/8/4k3/8/8/4K3/8/7R w - - 100 80').status().reason, 'fifty');
  const pos = new Position();
  for (const u of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) pos.make(pos.moveFromUci(u));
  assert.equal(pos.status().reason, 'repetition');
});

test('en passant et roque interdits', () => {
  // prise en passant qui découvrirait le roi : illégale
  let pos = new Position('8/8/8/K2pP2r/8/8/8/7k w - d6 0 1');
  assert.equal(pos.moveFromUci('e5d6'), 0);
  // roque à travers une case attaquée
  pos = new Position('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
  assert.equal(pos.moveFromUci('e1g1'), 0);
  assert.ok(pos.moveFromUci('e1c1'));
});

test('IA : mat en un trouvé à tous les niveaux', () => {
  for (let lv = 2; lv <= 6; lv++) {
    for (let k = 0; k < 3; k++) {
      const pos = new Position('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
      const opts = Object.assign({}, LEVELS[lv], { blunder: 0, time: Math.min(LEVELS[lv].time || 0, 300) || undefined });
      const r = think(pos, opts, null);
      assert.equal(uci(r.move), 'a1a8', `niveau ${lv}`);
    }
  }
});

test('IA : ne donne pas sa dame (niveau 4)', () => {
  const pos = new Position('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 3');
  const r = think(pos, LEVELS[4], null);
  pos.make(r.move);
  assert.ok(uci(r.move).startsWith('h4'), `la dame doit fuir, joué ${uci(r.move)}`);
});

test('IA : finale roi + dame contre roi gagnée', () => {
  const pos = new Position('8/8/8/4k3/8/8/8/3QK3 w - - 0 1');
  let plies = 0;
  while (plies < 120) {
    const st = pos.status();
    if (st.over) break;
    const r = pos.turn === 0 ? think(pos, { time: 150 }, null) : { move: st.moves[Math.floor(Math.random() * st.moves.length)] };
    pos.make(r.move);
    plies++;
  }
  assert.equal(pos.status().reason, 'checkmate', `après ${plies} demi-coups : ${pos.fen()}`);
});

test('IA : vitesse de recherche', () => {
  const pos = new Position('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
  const r = think(pos, { time: 1000 }, null);
  console.log(`     profondeur ${r.depth}, ${r.nodes} nœuds, coup ${uci(r.move)}`);
  assert.ok(r.depth >= 5, `profondeur ${r.depth}`);
});

test('partie complète IA contre IA sans erreur', () => {
  const pos = new Position();
  const hist = [];
  for (let i = 0; i < 300; i++) {
    const st = pos.status();
    if (st.over) break;
    const r = think(pos, i % 2 ? LEVELS[2] : { time: 40, book: true }, hist);
    assert.ok(st.moves.includes(r.move), 'coup légal');
    hist.push(uci(r.move));
    pos.make(r.move);
  }
});

console.log(failed ? `\n${failed} test(s) en échec` : '\nTous les tests passent');
process.exit(failed ? 1 : 0);
