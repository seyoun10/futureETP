-- 롤 규칙 초기 행(D-013, D-065). src/calc/rollWeight.ts ROLL_RULE_SEEDS에서 생성했다.
-- 이후 규칙 변경은 이 행을 직접 고친다(D-024).
INSERT INTO "roll_rule" ("commodity_code", "basis", "rule_id", "params") VALUES
  ('GC', 'KR', 'GSCI', '{"calendar":"NYSE","rollDays":[5,6,7,8,9],"oldShares":[0.8,0.6,0.4,0.2,0],"rebalance":null,"legs":[{"weight":1,"hold":["G","J","J","M","M","Q","Q","Z","Z","Z","Z","G+1"]}]}'),
  ('GC', 'US', 'BCOM', '{"calendar":"BCOM","rollDays":[5,6,7,8,9],"oldShares":[0.8,0.6,0.4,0.2,0],"rebalance":null,"legs":[{"weight":1,"hold":["G","J","J","M","M","Q","Q","Z","Z","Z","Z","G+1"]}]}'),
  ('SI', 'KR', 'GSCI', '{"calendar":"NYSE","rollDays":[5,6,7,8,9],"oldShares":[0.8,0.6,0.4,0.2,0],"rebalance":null,"legs":[{"weight":1,"hold":["H","H","K","K","N","N","U","U","Z","Z","Z","H+1"]}]}'),
  ('SI', 'US', 'BCOM', '{"calendar":"BCOM","rollDays":[5,6,7,8,9],"oldShares":[0.8,0.6,0.4,0.2,0],"rebalance":null,"legs":[{"weight":1,"hold":["H","H","K","K","N","N","U","U","Z","Z","Z","H+1"]}]}'),
  ('CL', 'KR', 'GSCI', '{"calendar":"NYSE","rollDays":[5,6,7,8,9],"oldShares":[0.8,0.6,0.4,0.2,0],"rebalance":null,"legs":[{"weight":1,"hold":["G","H","J","K","M","N","Q","U","V","X","Z","F+1"]}]}'),
  ('CL', 'US', 'BCBCLI', '{"calendar":"NYMEX","rollDays":[2,3],"oldShares":[0.5,0],"rebalance":{"months":[3,9],"businessDay":1},"legs":[{"weight":0.3333333333333333,"hold":["H","J","K","M","N","Q","U","V","X","Z","F+1","G+1"]},{"weight":0.3333333333333333,"hold":["M","M","M","M+1","M+1","M+1","M+1","M+1","M+1","M+1","M+1","M+1"]},{"weight":0.3333333333333333,"hold":["Z","Z","Z","Z","Z","Z","Z","Z","Z","Z+1","Z+1","Z+1"]}]}'),
  ('NG', 'KR', 'GSCI', '{"calendar":"NYSE","rollDays":[5,6,7,8,9],"oldShares":[0.8,0.6,0.4,0.2,0],"rebalance":null,"legs":[{"weight":1,"hold":["G","H","J","K","M","N","Q","U","V","X","Z","F+1"]}]}'),
  ('NG', 'US', 'BCOM', '{"calendar":"BCOM","rollDays":[5,6,7,8,9],"oldShares":[0.8,0.6,0.4,0.2,0],"rebalance":null,"legs":[{"weight":1,"hold":["H","H","K","K","N","N","U","U","X","X","F+1","F+1"]}]}')
ON CONFLICT DO NOTHING;
