-- 원자재 4종(product.md 대상 원자재, data-model.md commodity)
INSERT INTO "commodity" ("code", "name_ko", "name_en", "exchange", "price_decimals", "sort_order", "uses_active_months") VALUES
  ('GC', '금', 'Gold', 'COMEX', 1, 1, true),
  ('SI', '은', 'Silver', 'COMEX', 3, 2, true),
  ('CL', 'WTI 원유', 'WTI Crude Oil', 'NYMEX', 2, 3, false),
  ('NG', '천연가스', 'Natural Gas', 'NYMEX', 3, 4, false)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 금속 활성 월물(research/cme-calendar.md). 일봉 적재 시작(2010-06, D-020) 전부터 같은 관행이다.
INSERT INTO "active_month_rule" ("commodity_code", "valid_from", "valid_to", "months") VALUES
  ('GC', '2010-01-01', NULL, '{2,4,6,8,10,12}'),
  ('SI', '2010-01-01', NULL, '{3,5,7,9,12}')
ON CONFLICT DO NOTHING;
