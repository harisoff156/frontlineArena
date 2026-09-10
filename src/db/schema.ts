import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const leaderboard = pgTable(
  "leaderboard",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    mode: text("mode").notNull(),
    map: text("map").notNull(),
    kills: integer("kills").notNull(),
    score: integer("score").notNull(),
    rating: integer("rating").notNull().default(1000),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("leaderboard_score_idx").on(t.score)]
);
