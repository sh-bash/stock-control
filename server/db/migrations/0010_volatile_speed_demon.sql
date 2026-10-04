ALTER TABLE "shipment_items" ADD COLUMN "volume" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "bl_number" varchar(100);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "container_no" varchar(100);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "total_volume" numeric(18, 4);