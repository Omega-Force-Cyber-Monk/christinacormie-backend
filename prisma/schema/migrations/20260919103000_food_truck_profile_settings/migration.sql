ALTER TABLE "food_trucks"
  ADD COLUMN "handle" VARCHAR(80);

CREATE UNIQUE INDEX "food_trucks_handle_key" ON "food_trucks"("handle");
