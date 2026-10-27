-- app_settings 단일 행(id=1). 값은 모두 컬럼 기본값(product.md 전역 설정)
INSERT INTO "app_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
