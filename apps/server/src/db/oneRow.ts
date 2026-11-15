// insert·upsert `returning()`처럼 한 행이 반드시 돌아와야 하는 결과에서 그 행을 꺼낸다.
// 행이 없으면 undefined로 흘려보내지 않고 바로 던진다(D-127).
export function oneRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('Expected one returned row, got none');
  return row;
}
