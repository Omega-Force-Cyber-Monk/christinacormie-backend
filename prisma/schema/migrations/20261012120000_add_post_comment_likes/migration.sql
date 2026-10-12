-- CreateTable
CREATE TABLE IF NOT EXISTS "post_comment_likes" (
    "id" UUID NOT NULL,
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "post_comment_likes_comment_id_user_id_key" ON "post_comment_likes"("comment_id", "user_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'post_comment_likes_comment_id_fkey'
    ) THEN
        ALTER TABLE "post_comment_likes"
        ADD CONSTRAINT "post_comment_likes_comment_id_fkey"
        FOREIGN KEY ("comment_id") REFERENCES "post_comments"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'post_comment_likes_user_id_fkey'
    ) THEN
        ALTER TABLE "post_comment_likes"
        ADD CONSTRAINT "post_comment_likes_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
