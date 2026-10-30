// dev 변형을 운영 번들로 띄웠을 때 앱의 [perf] 로그를 받는다. 운영 번들은 console 로그를 Metro로 보내지 않아
// 앱이 같은 줄을 이 수집기로 POST 한다(apps/mobile/src/lib/perfLog.ts). 터미널에 찍고 파일에도 붙인다.
//   npm run perf:collect [-- 파일]   (기본 파일: perf.log, 포트 8099)
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

const PORT = 8099;
const out = process.argv[2] ?? 'perf.log';

createServer((req, res) => {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    const line = `${new Date().toTimeString().slice(0, 8)} ${body}`;
    console.log(line);
    appendFileSync(out, `${line}\n`);
    res.end();
  });
}).listen(PORT, () => console.log(`perf 수집 :${PORT} → ${out}`));
