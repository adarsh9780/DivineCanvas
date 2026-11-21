const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const moduleExports = {};
const compiled = ts.transpileModule(fs.readFileSync('src/readingAudioSession.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
let configured = [];
new Function('require', 'exports', compiled)(id => {
  assert.equal(id, 'expo-audio');
  return { setAudioModeAsync: async mode => configured.push(mode) };
}, moduleExports);
const { PassageAudioQueue, configureReadingAudio } = moduleExports;

class TestPlaylist {
  items = [];
  currentIndex = 0;
  remoteTransportPaused = false;
  playing = false;
  add(item) { this.items.push(item); }
  skipTo(index) { this.currentIndex = index; }
  play() { this.playing = true; }
  pause() { this.playing = false; }
  remove(index) { this.items.splice(index, 1); this.currentIndex--; }
  clear() { this.items = []; this.currentIndex = 0; this.pause(); }
}

const tick = () => new Promise(resolve => setImmediate(resolve));

async function main() {
  await Promise.all([configureReadingAudio(true), configureReadingAudio(true), configureReadingAudio(false)]);
  assert.deepEqual(configured.map(mode => [mode.shouldPlayInBackground, mode.interruptionMode]), [
    [true, 'doNotMix'], [false, 'mixWithOthers'],
  ]);

  const player = new TestPlaylist();
  const visited = [];
  const disposed = [];
  let finished = 0;
  const generate = position => Promise.resolve({
    uri: String(position), dispose: async () => disposed.push(position),
  });
  const queue = new PassageAudioQueue({
    player, start: 8, count: 20, generate,
    beforePlay: async () => {},
    onPosition: position => visited.push(position),
    onFinish: () => finished++,
    onError: error => { throw error; },
  });
  await queue.start();
  await tick();
  assert.equal(player.items[player.currentIndex].uri, '8');
  assert.deepEqual(player.items.map(item => Number(item.uri)), [7, 8, 9, 10, 11, 12, 13, 14]);
  player.skipTo(0);
  queue.syncPosition();
  player.skipTo(5);
  queue.syncPosition();
  await tick();
  assert.deepEqual(visited, [7, 12]);
  assert.equal(player.items[player.currentIndex].uri, '12');
  assert.deepEqual(disposed, [7, 8]);
  queue.pause();
  assert.equal(player.playing, false);
  queue.resume();
  assert.equal(player.playing, true);
  player.skipTo(player.items.length - 1);
  queue.syncPosition();
  await tick();
  player.skipTo(player.items.length - 1);
  queue.syncPosition();
  queue.finishTrack();
  assert.equal(finished, 1);
  queue.dispose();
  assert.equal(player.items.length, 0);

  const waitingPlayer = new TestPlaylist();
  let releaseNext;
  let nextDisposed = false;
  const waitingQueue = new PassageAudioQueue({
    player: waitingPlayer, start: 0, count: 2,
    generate: position => position === 0 ? generate(0) : new Promise(resolve => { releaseNext = resolve; }),
    beforePlay: async () => {},
    onPosition: position => visited.push(position),
    onFinish: () => { throw new Error('Queue ended before the next passage loaded'); },
    onError: error => { throw error; },
  });
  await waitingQueue.start();
  waitingPlayer.pause();
  waitingPlayer.remoteTransportPaused = true;
  waitingQueue.setRemotePlaying(false);
  waitingQueue.finishTrack();
  releaseNext({ uri: '1', dispose: async () => { nextDisposed = true; } });
  await tick();
  assert.equal(waitingPlayer.items[waitingPlayer.currentIndex].uri, '1');
  assert.equal(waitingPlayer.playing, false, 'A delayed file must not undo a lock-screen pause');
  waitingQueue.dispose();
  assert.equal(nextDisposed, true);
  console.log('PASS: session mode, offline queue, previous/next, bounded cleanup and paused refill.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
