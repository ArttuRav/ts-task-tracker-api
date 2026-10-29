import Database from "better-sqlite3";

export function createDatabase(
    filename: string
): Database.Database {
    const db: Database.Database = new Database(filename);

    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0
        )
    `);

    return db;
}

// The database used by the normal application
const databasePath = process.env.DATABASE_PATH || "tasks.db";
const db: Database.Database = createDatabase(databasePath);

export default db;