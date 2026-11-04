-- D-120: 기존 기록은 어느 기기 것인지 알 수 없어 지운다(0006에서 기기 행도 지웠다).
DELETE FROM "alert_record";--> statement-breakpoint
ALTER TABLE "alert_record" DROP CONSTRAINT "alert_record_dedup_key";--> statement-breakpoint
ALTER TABLE "alert_record" ADD COLUMN "device_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_record" ADD CONSTRAINT "alert_record_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_record" ADD CONSTRAINT "alert_record_dedup_key" UNIQUE("device_id","commodity_code","basis","ma_period","window","direction","rare_level","trade_date");