const Database = require('better-sqlite3');

// Connect to SQLite Database
const db = new Database('./tsvagabot.db');

// Setup Schema & Seed Data synchronously
db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        price TEXT,
        location TEXT,
        shop TEXT
    )
`);

const count = db.prepare("SELECT COUNT(*) as count FROM products").get();

if (count.count === 0) {
    const insert = db.prepare("INSERT INTO products (title, price, location, shop) VALUES (?, ?, ?, ?)");
    insert.run("20W Fast Charger", "$10 USD", "Eastgate Market", "Stall 14, Eastgate");
    insert.run("Apple Original Block", "$15 USD", "Gulf Complex", "Shop 5, Gulf Complex");
    insert.run("100Ah Solar Battery", "$120 USD", "Mbare Musika", "Sector B, Mbare");
    console.log("Database seeded successfully.\n");
}

// Search Function
function searchTsvagaBot(userQuery) {
    console.log(`User Search: "${userQuery}"`);
    console.log('-----------------------------------');

    const query = `%${userQuery.toLowerCase()}%`;
    const rows = db.prepare(
        `SELECT * FROM products WHERE LOWER(title) LIKE ? OR LOWER(location) LIKE ?`
    ).all(query, query);

    if (!rows || rows.length === 0) {
        console.log(`Bot Response:\nTsvagaBot: No matches found for "${userQuery}". Try searching "charger", "battery", or "Eastgate".\n`);
        return;
    }

    let responseText = `Found ${rows.length} seller(s):\n\n`;
    rows.forEach((item, index) => {
        responseText += `${index + 1}. ${item.title} - ${item.price}\n   Location: ${item.shop}\n\n`;
    });

    console.log(`Bot Response:\n${responseText}`);
}

// Run Test Queries
searchTsvagaBot('charger');
searchTsvagaBot('battery');