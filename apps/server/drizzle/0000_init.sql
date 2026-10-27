CREATE TABLE "active_month_rule" (
	"commodity_code" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"months" integer[] NOT NULL,
	CONSTRAINT "active_month_rule_commodity_code_valid_from_pk" PRIMARY KEY("commodity_code","valid_from")
);
--> statement-breakpoint
CREATE TABLE "alert_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commodity_code" text NOT NULL,
	"basis" text NOT NULL,
	"ma_period" integer NOT NULL,
	"window" text NOT NULL,
	"direction" text NOT NULL,
	"rare_level" numeric(3, 1) NOT NULL,
	"trade_date" date NOT NULL,
	"status" text NOT NULL,
	"disparity" numeric NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "alert_record_dedup_key" UNIQUE("commodity_code","basis","ma_period","window","direction","rare_level","trade_date")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"locale" text DEFAULT 'ko' NOT NULL,
	"timezone" text DEFAULT 'Asia/Seoul' NOT NULL,
	"basis" text DEFAULT 'FRONT' NOT NULL,
	"ma_period" integer DEFAULT 100 NOT NULL,
	"window" text DEFAULT 'Y10' NOT NULL,
	"rare_levels" numeric(3, 1)[] DEFAULT '{5,10,15,20,25}' NOT NULL,
	"alert_commodity" text,
	"quiet_start_min" integer,
	"quiet_end_min" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_single_row" CHECK ("app_settings"."id" = 1),
	CONSTRAINT "app_settings_quiet_time" CHECK (("app_settings"."quiet_start_min" IS NULL AND "app_settings"."quiet_end_min" IS NULL) OR (
        "app_settings"."quiet_start_min" BETWEEN 0 AND 1410 AND "app_settings"."quiet_start_min" % 30 = 0
        AND "app_settings"."quiet_end_min" BETWEEN 0 AND 1410 AND "app_settings"."quiet_end_min" % 30 = 0
        AND "app_settings"."quiet_start_min" <> "app_settings"."quiet_end_min"))
);
--> statement-breakpoint
CREATE TABLE "batch_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"trade_date" date,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"error" text,
	"ops_notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commodity" (
	"code" text PRIMARY KEY NOT NULL,
	"name_ko" text NOT NULL,
	"name_en" text NOT NULL,
	"exchange" text NOT NULL,
	"price_decimals" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"uses_active_months" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"symbol" text PRIMARY KEY NOT NULL,
	"commodity_code" text NOT NULL,
	"contract_month" text NOT NULL,
	"first_trade_date" date,
	"last_trade_date" date NOT NULL,
	"is_target" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_bar" (
	"contract_symbol" text NOT NULL,
	"trade_date" date NOT NULL,
	"open" numeric,
	"high" numeric,
	"low" numeric,
	"settle" numeric NOT NULL,
	"volume" bigint NOT NULL,
	"source" text NOT NULL,
	"collected_at" timestamp with time zone NOT NULL,
	"revised_at" timestamp with time zone,
	CONSTRAINT "daily_bar_contract_symbol_trade_date_pk" PRIMARY KEY("contract_symbol","trade_date")
);
--> statement-breakpoint
CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"push_token" text NOT NULL,
	"app_version" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_pushToken_unique" UNIQUE("push_token")
);
--> statement-breakpoint
CREATE TABLE "disparity" (
	"commodity_code" text NOT NULL,
	"basis" text NOT NULL,
	"ma_period" integer NOT NULL,
	"trade_date" date NOT NULL,
	"ma" numeric,
	"disparity" numeric,
	CONSTRAINT "disparity_commodity_code_basis_ma_period_trade_date_pk" PRIMARY KEY("commodity_code","basis","ma_period","trade_date")
);
--> statement-breakpoint
CREATE TABLE "disparity_distribution" (
	"commodity_code" text NOT NULL,
	"basis" text NOT NULL,
	"ma_period" integer NOT NULL,
	"window" text NOT NULL,
	"as_of_trade_date" date NOT NULL,
	"actual_start_date" date NOT NULL,
	"sample_count" integer NOT NULL,
	"sorted_values" double precision[] NOT NULL,
	CONSTRAINT "disparity_distribution_commodity_code_basis_ma_period_window_pk" PRIMARY KEY("commodity_code","basis","ma_period","window")
);
--> statement-breakpoint
CREATE TABLE "index_bar" (
	"commodity_code" text NOT NULL,
	"basis" text NOT NULL,
	"trade_date" date NOT NULL,
	"open" numeric,
	"high" numeric,
	"low" numeric,
	"close" numeric,
	"blended_price" numeric NOT NULL,
	"is_valid" boolean NOT NULL,
	"in_roll_period" boolean NOT NULL,
	CONSTRAINT "index_bar_commodity_code_basis_trade_date_pk" PRIMARY KEY("commodity_code","basis","trade_date")
);
--> statement-breakpoint
CREATE TABLE "index_scale" (
	"commodity_code" text NOT NULL,
	"basis" text NOT NULL,
	"ratio" numeric NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "index_scale_commodity_code_basis_pk" PRIMARY KEY("commodity_code","basis")
);
--> statement-breakpoint
CREATE TABLE "index_snapshot" (
	"commodity_code" text NOT NULL,
	"basis" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"trade_date" date NOT NULL,
	"open" numeric,
	"high" numeric,
	"low" numeric,
	"last" numeric,
	"disparity_by_ma" jsonb NOT NULL,
	CONSTRAINT "index_snapshot_commodity_code_basis_captured_at_pk" PRIMARY KEY("commodity_code","basis","captured_at")
);
--> statement-breakpoint
CREATE TABLE "intraday_snapshot" (
	"contract_symbol" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"trade_date" date NOT NULL,
	"last" numeric NOT NULL,
	"day_open" numeric,
	"day_high" numeric,
	"day_low" numeric,
	"volume" bigint,
	"source_time" timestamp with time zone,
	CONSTRAINT "intraday_snapshot_contract_symbol_captured_at_pk" PRIMARY KEY("contract_symbol","captured_at")
);
--> statement-breakpoint
CREATE TABLE "roll_rule" (
	"commodity_code" text NOT NULL,
	"basis" text NOT NULL,
	"rule_id" text NOT NULL,
	"params" jsonb NOT NULL,
	"adopted_from" text,
	"majority_rule_id" text,
	"majority_checked_at" timestamp with time zone,
	CONSTRAINT "roll_rule_commodity_code_basis_pk" PRIMARY KEY("commodity_code","basis")
);
--> statement-breakpoint
CREATE TABLE "roll_weight" (
	"commodity_code" text NOT NULL,
	"basis" text NOT NULL,
	"trade_date" date NOT NULL,
	"contract_symbol" text NOT NULL,
	"weight" numeric NOT NULL,
	CONSTRAINT "roll_weight_commodity_code_basis_trade_date_contract_symbol_pk" PRIMARY KEY("commodity_code","basis","trade_date","contract_symbol")
);
--> statement-breakpoint
CREATE TABLE "trading_day" (
	"trade_date" date PRIMARY KEY NOT NULL,
	"session_open_at" timestamp with time zone,
	"session_close_at" timestamp with time zone,
	"halt_start_at" timestamp with time zone,
	"halt_end_at" timestamp with time zone,
	"is_early_close" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "active_month_rule" ADD CONSTRAINT "active_month_rule_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_record" ADD CONSTRAINT "alert_record_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_alert_commodity_commodity_code_fk" FOREIGN KEY ("alert_commodity") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_bar" ADD CONSTRAINT "daily_bar_contract_symbol_contract_symbol_fk" FOREIGN KEY ("contract_symbol") REFERENCES "public"."contract"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disparity" ADD CONSTRAINT "disparity_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disparity_distribution" ADD CONSTRAINT "disparity_distribution_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_bar" ADD CONSTRAINT "index_bar_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_scale" ADD CONSTRAINT "index_scale_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_snapshot" ADD CONSTRAINT "index_snapshot_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intraday_snapshot" ADD CONSTRAINT "intraday_snapshot_contract_symbol_contract_symbol_fk" FOREIGN KEY ("contract_symbol") REFERENCES "public"."contract"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_rule" ADD CONSTRAINT "roll_rule_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_weight" ADD CONSTRAINT "roll_weight_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roll_weight" ADD CONSTRAINT "roll_weight_contract_symbol_contract_symbol_fk" FOREIGN KEY ("contract_symbol") REFERENCES "public"."contract"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_record_status_index" ON "alert_record" USING btree ("status");--> statement-breakpoint
CREATE INDEX "batch_run_job_started_at_index" ON "batch_run" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "contract_commodity_code_last_trade_date_index" ON "contract" USING btree ("commodity_code","last_trade_date");--> statement-breakpoint
CREATE INDEX "daily_bar_trade_date_index" ON "daily_bar" USING btree ("trade_date");--> statement-breakpoint
CREATE INDEX "index_snapshot_captured_at_index" ON "index_snapshot" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "intraday_snapshot_captured_at_index" ON "intraday_snapshot" USING btree ("captured_at");