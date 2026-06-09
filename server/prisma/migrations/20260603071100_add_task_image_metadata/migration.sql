-- AlterTable
ALTER TABLE "tasks"
    ADD COLUMN "image_key" TEXT,
    ADD COLUMN "image_url" TEXT,
    ADD COLUMN "image_content_type" TEXT,
    ADD COLUMN "image_size" INTEGER;
