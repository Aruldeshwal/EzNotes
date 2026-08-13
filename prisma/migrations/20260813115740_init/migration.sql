-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('PUBLIC', 'PASSWORD', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "ShareType" AS ENUM ('READ_ONLY', 'COLLABORATIVE');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateTable
CREATE TABLE "user_settings" (
    "clerk_user_id" TEXT NOT NULL,
    "default_theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "default_access" "AccessType" NOT NULL DEFAULT 'PUBLIC',
    "default_expiry_hours" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("clerk_user_id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "share_type" "ShareType" NOT NULL DEFAULT 'READ_ONLY',
    "access_type" "AccessType" NOT NULL DEFAULT 'PUBLIC',
    "expiry_date" TIMESTAMP(3),
    "password_hash" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "consumed_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_view_aggregates" (
    "id" TEXT NOT NULL,
    "note_token" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_view_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notes_token_key" ON "notes"("token");

-- CreateIndex
CREATE INDEX "notes_clerk_user_id_idx" ON "notes"("clerk_user_id");

-- CreateIndex
CREATE INDEX "notes_expiry_date_idx" ON "notes"("expiry_date");

-- CreateIndex
CREATE INDEX "note_view_aggregates_note_token_idx" ON "note_view_aggregates"("note_token");

-- CreateIndex
CREATE UNIQUE INDEX "note_view_aggregates_note_token_date_key" ON "note_view_aggregates"("note_token", "date");
