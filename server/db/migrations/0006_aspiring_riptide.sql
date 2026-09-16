CREATE TABLE IF NOT EXISTS "movement_classification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"classification" varchar(10) NOT NULL,
	"calculated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "movement_classification_product_warehouse_unique" UNIQUE("product_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_movement_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"avg_daily_out_qty_30d" numeric(18, 4),
	"avg_daily_out_qty_90d" numeric(18, 4),
	"last_movement_date" date,
	"days_since_last_movement" integer,
	"calculated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_movement_stats_product_warehouse_unique" UNIQUE("product_id","warehouse_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movement_classification" ADD CONSTRAINT "movement_classification_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movement_classification" ADD CONSTRAINT "movement_classification_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_movement_stats" ADD CONSTRAINT "product_movement_stats_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_movement_stats" ADD CONSTRAINT "product_movement_stats_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
