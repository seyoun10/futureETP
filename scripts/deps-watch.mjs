// 조건이 걸려 미뤄 둔 의존성 업그레이드(D-xxx)가 이제 가능한지 npm 레지스트리로 확인한다(D-130).
//   npm run deps:watch               결과만 출력(항상 exit 0)
//   npm run deps:watch -- --strict   충족(READY)·확인 불가(UNKNOWN)가 있으면 exit 1 (CI 주간 job)
// 항목을 풀었거나 조건이 바뀌면 WATCHES와 해당 D-xxx를 함께 고친다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STABLE_MAJOR_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function npmView(spec, field) {
  const out = execFileSync('npm', ['view', spec, field, '--json'], { encoding: 'utf8' }).trim();
  return out === '' ? undefined : JSON.parse(out);
}

const majorOf = (version) => Number(/^\D*(\d+)/.exec(version)?.[1]);

// semver 범위가 major M을 받는지 대략 판정한다. `||`로 나눈 각 항목의 하한·상한 major만 본다.
function rangeAcceptsMajor(range, major) {
  return range.split('||').some((part) => {
    const tokens = part.trim().split(/\s+/);
    let low = 0;
    let high = Infinity;
    for (const token of tokens) {
      const m = /^(\^|~|>=|>|<=|<|=)?v?(\d+)(?:\.(\d+|x|\*))?/.exec(token);
      if (!m) continue;
      const op = m[1] ?? '';
      const v = Number(m[2]);
      const minorZero = m[3] === undefined || m[3] === '0' || m[3] === 'x' || m[3] === '*';
      if (op === '' || op === '=' || op === '^' || op === '~') {
        low = Math.max(low, v);
        high = Math.min(high, v);
      } else if (op === '>=' || op === '>') low = Math.max(low, v);
      else if (op === '<') high = Math.min(high, minorZero ? v - 1 : v);
      else if (op === '<=') high = Math.min(high, v);
    }
    return low <= major && major <= high;
  });
}

const WATCHES = [
  {
    id: 'ESLint 10',
    decision: 'D-054',
    check() {
      const pending = ['eslint-plugin-react', 'eslint-plugin-import'].filter(
        (name) => !rangeAcceptsMajor(npmView(name, 'peerDependencies.eslint') ?? '', 10),
      );
      return pending.length === 0
        ? { status: 'READY', detail: '두 플러그인 최신판이 peer로 ESLint 10을 받는다' }
        : { status: 'WAIT', detail: `ESLint 10 미지원: ${pending.join(', ')}` };
    },
  },
  {
    id: 'victory-native 차트 제스처 hook API 이전',
    decision: 'D-128',
    check() {
      const version = npmView('victory-native', 'version');
      const dir = mkdtempSync(join(tmpdir(), 'deps-watch-'));
      try {
        const file = execFileSync(
          'npm',
          ['pack', `victory-native@${version}`, '--pack-destination', dir, '--silent'],
          { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        ).trim();
        execFileSync('tar', ['xzf', file], { cwd: dir });
        const source = readFileSync(join(dir, 'package/src/cartesian/CartesianChart.tsx'), 'utf8');
        return /customGestures\s*\?\?\s*Gesture\.Race\(/.test(source)
          ? {
              status: 'WAIT',
              detail: `${version}: customGestures를 아직 legacy Gesture.Race로 합친다`,
            }
          : {
              status: 'READY',
              detail: `${version}: legacy Gesture.Race 합성이 사라짐(peer·Skia 패키지도 확인)`,
            };
      } catch (error) {
        return {
          status: 'UNKNOWN',
          detail: `${version}: 소스 확인 실패(${error.message.split('\n')[0]})`,
        };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  {
    id: 'TypeScript 7',
    decision: 'D-051',
    check() {
      const range = npmView('expo-template-default@latest', 'devDependencies.typescript');
      return majorOf(range) >= 7
        ? { status: 'READY', detail: `Expo 최신 템플릿 typescript ${range}` }
        : { status: 'WAIT', detail: `Expo 최신 템플릿 typescript ${range}` };
    },
  },
  {
    id: 'croner 11',
    decision: 'D-060',
    check() {
      const time = npmView('croner', 'time');
      const first = Object.keys(time)
        .filter((v) => /^11\.\d+\.\d+$/.test(v))
        .sort((a, b) => Date.parse(time[a]) - Date.parse(time[b]))[0];
      if (!first) return { status: 'WAIT', detail: '11.x 없음' };
      const days = Math.floor((Date.now() - Date.parse(time[first])) / DAY_MS);
      return days >= STABLE_MAJOR_DAYS
        ? { status: 'READY', detail: `${first} 출시 ${days}일 경과(기준 ${STABLE_MAJOR_DAYS}일)` }
        : { status: 'WAIT', detail: `${first} 출시 ${days}일 경과(기준 ${STABLE_MAJOR_DAYS}일)` };
    },
  },
  {
    id: 'drizzle 1.0 정식판',
    decision: 'D-053',
    check() {
      const latest = npmView('drizzle-orm', 'dist-tags.latest');
      return majorOf(latest) >= 1
        ? { status: 'READY', detail: `latest ${latest}: 마이그레이션 폴더 구조 변경 확인 필요` }
        : { status: 'WAIT', detail: `latest ${latest}` };
    },
  },
];

const strict = process.argv.includes('--strict');
let flagged = 0;
for (const watch of WATCHES) {
  let result;
  try {
    result = watch.check();
  } catch (error) {
    result = { status: 'UNKNOWN', detail: error.message.split('\n')[0] };
  }
  if (result.status !== 'WAIT') flagged++;
  console.log(`${result.status.padEnd(7)} ${watch.id} (${watch.decision}): ${result.detail}`);
}
if (strict && flagged > 0) {
  console.error(`\n${flagged}건이 대기 상태가 아니다. 해당 결정을 다시 보고 WATCHES를 고친다.`);
  process.exit(1);
}
