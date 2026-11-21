CREATE TABLE "calendar_exception" (
	"market" text NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"at" text,
	"note" text NOT NULL,
	CONSTRAINT "calendar_exception_market_date_pk" PRIMARY KEY("market","date")
);
