-- D-120: 기존 기기 행은 서버가 만든 id라 옮기지 않고 지운다. 새 앱이 X-Device-Id로 다시 등록한다.
DELETE FROM "device";--> statement-breakpoint
ALTER TABLE "app_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "app_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "device" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "device" ALTER COLUMN "platform" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ALTER COLUMN "push_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "locale" text DEFAULT 'ko' NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "timezone" text DEFAULT 'Asia/Seoul' NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "basis" text DEFAULT 'FRONT' NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "ma_period" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "window" text DEFAULT 'Y10' NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "rare_levels" numeric(3, 1)[] DEFAULT '{1,2,4,8,16}' NOT NULL;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "alert_commodity" text;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "quiet_start_min" integer;--> statement-breakpoint
ALTER TABLE "device" ADD COLUMN "quiet_end_min" integer;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_alert_commodity_commodity_code_fk" FOREIGN KEY ("alert_commodity") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_push_platform" CHECK ("device"."push_token" IS NULL OR "device"."platform" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_quiet_time" CHECK (("device"."quiet_start_min" IS NULL AND "device"."quiet_end_min" IS NULL) OR (
        "device"."quiet_start_min" BETWEEN 0 AND 1410 AND "device"."quiet_start_min" % 30 = 0
        AND "device"."quiet_end_min" BETWEEN 0 AND 1410 AND "device"."quiet_end_min" % 30 = 0
        AND "device"."quiet_start_min" <> "device"."quiet_end_min"));