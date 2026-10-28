CREATE TABLE "etp_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commodity_code" text,
	"market" text NOT NULL,
	"type" text,
	"leverage" numeric,
	"fx_hedge" text NOT NULL,
	"name" text NOT NULL,
	"name_lang" text NOT NULL,
	"issuer" text,
	"underlying_index" text,
	"expense_ratio" numeric,
	"issuer_url" text,
	"aum" numeric,
	"avg_trading_value" numeric,
	"grouping_key" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_notified_at" timestamp with time zone,
	"roll_rule_ref" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" text NOT NULL,
	"collected_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etp_series" (
	"ticker" text PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"series_code" text,
	"listed_date" date,
	"maturity_date" date,
	"delisted_date" date
);
--> statement-breakpoint
ALTER TABLE "etp_product" ADD CONSTRAINT "etp_product_commodity_code_commodity_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodity"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etp_series" ADD CONSTRAINT "etp_series_product_id_etp_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."etp_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "etp_product_commodity_code_index" ON "etp_product" USING btree ("commodity_code");--> statement-breakpoint
CREATE INDEX "etp_product_grouping_key_index" ON "etp_product" USING btree ("grouping_key");--> statement-breakpoint
CREATE INDEX "etp_series_product_id_index" ON "etp_series" USING btree ("product_id");