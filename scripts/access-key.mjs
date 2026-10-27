// 서버 접근 키를 만들고 앱 B-b가 읽을 QR을 터미널에 띄운다(D-044).
//   새 키:       npm run access-key
//   기존 키 QR:  npm run access-key -- --show < 키 파일   (키는 stdin으로만 받아 셸 기록에 남기지 않는다)
import { randomBytes } from 'node:crypto';
import { text } from 'node:stream/consumers';
import { toQR } from 'toqr';

const QR_PREFIX = 'futureetp-key:v1:';
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// 2행을 한 글자로 합친 half-block 출력(Expo CLI와 같은 방식). 밝은 모듈을 글자색 블록으로 칠하므로 어두운 배경 터미널 기준이고,
// 가장자리에 2모듈 여백(quiet zone)을 둔다.
function renderQr(content) {
  const modules = toQR(content);
  const size = Math.sqrt(modules.length);
  const margin = 2;
  const dark = (row, col) =>
    row >= 0 && row < size && col >= 0 && col < size && modules[row * size + col] === 1;
  const lines = [];
  for (let row = -margin; row < size + margin; row += 2) {
    let line = '';
    for (let col = -margin; col < size + margin; col++) {
      const top = dark(row, col);
      const bottom = dark(row + 1, col);
      line += top && bottom ? ' ' : top ? '▄' : bottom ? '▀' : '█';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

async function readKey() {
  if (!process.argv.includes('--show')) return randomBytes(32).toString('base64url');
  const key = (await text(process.stdin)).trim();
  if (!KEY_PATTERN.test(key)) {
    console.error('키 형식이 아닙니다(base64url 43자).');
    process.exit(1);
  }
  return key;
}

const key = await readKey();
console.log(renderQr(`${QR_PREFIX}${key}`));
console.log(`\nAPI_TOKEN=${key}`);
console.log(
  '\n앱 B-b에서 [QR 읽기]로 읽거나 위 키를 붙여넣는다. 서버에는 infra/.env의 API_TOKEN으로 넣는다.',
);
