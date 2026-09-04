const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// EXPANDED PRODUCT DATABASE (Diverse Categories)
// ==========================================
const mockProducts = [
  // Electronics & Accessories
  { id: 1, name: '20W Fast iPhone Charger', price: 10.00, location: 'Stall 14, Eastgate Market', stock: 'In Stock Today', category: 'charger electronics phone' },
  { id: 2, name: 'Apple Original Charging Block', price: 15.00, location: 'Shop 5, Gulf Complex', stock: 'In Stock', category: 'charger electronics phone' },
  { id: 3, name: 'Bluetooth Earbuds Pro', price: 25.00, location: 'Harare CBD Mall', stock: '8 left', category: 'audio electronics' },
  { id: 4, name: 'HP Laptop i5 8GB RAM', price: 280.00, location: 'Eastgate Mall Shop 12', stock: '3 available', category: 'computer electronics laptop' },

  // Solar & Hardware
  { id: 5, name: '100Ah Gel Solar Battery', price: 120.00, location: 'Mbare Musika, Sector B', stock: '5 left', category: 'solar hardware battery' },
  { id: 6, name: '550W Monocrystalline Solar Panel', price: 110.00, location: 'Magaba Hardware Yard', stock: '12 in stock', category: 'solar hardware panel' },
  { id: 7, name: '3KW Hybrid Inverter', price: 230.00, location: 'Harare Street Hardware', stock: '2 in stock', category: 'solar hardware inverter' },

  // Groceries & Provisions
  { id: 8, name: '10kg Mealies Meal (Roller Meal)', price: 6.50, location: 'Mbare Musika Wholesale', stock: '50+ in stock', category: 'groceries food mealie' },
  { id: 9, name: '2L Cooking Oil', price: 3.80, location: 'Eastgate Supermarket', stock: 'In Stock', category: 'groceries food oil' },
  { id: 10, name: '2kg Refined Sugar', price: 2.60, location: 'Gulf Complex Mart', stock: 'In Stock', category: 'groceries food sugar' },

  // Apparel & Footwear
  { id: 11, name: 'Men Leather Formal Shoes', price: 35.00, location: 'Gulf Complex Shop 22', stock: 'Various sizes', category: 'clothes apparel shoes' },
  { id: 12, name: 'Unisex Denim Jacket', price: 20.00, location: 'Eastgate Stall 8', stock: 'M, L, XL', category: 'clothes apparel jacket' }
];

// Smart Search Logic: Ignores English/Shona stop words and matches categories
function searchProducts(query) {
  const text = query.toLowerCase().trim();

  // 1. Handle Greetings
  const greetings = ['hi', 'hello', 'hey', 'start', 'help', 'menu'];
  if (greetings.includes(text)) {
    return { type: 'greeting' };
  }

  // 2. Filter out English and Shona filler/search phrases
  const stopWords = [
    'ndinotsvaga', 'tsvaga', 'natsvaga', 'muri', 'kutsvaga', 'neiphi', 'pedyo', 'pane', 'ndinoda',
    'i', 'im', "i'm", 'looking', 'for', 'a', 'an', 'the', 'want', 'need', 'to', 'buy', 'get', 'show', 'me', 'any', 'some', 'near', 'at'
  ];
  
  const words = text
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter(word => !stopWords.includes(word) && word.length > 1);

  if (words.length === 0) {
    return { type: 'results', items: [] };
  }

  // 3. Search product name, location, and category tags
  const results = mockProducts.filter(product => {
    return words.some(word => 
      product.name.toLowerCase().includes(word) || 
      product.category.toLowerCase().includes(word) ||
      product.location.toLowerCase().includes(word)
    );
  });

  return { type: 'results', items: results };
}

// ==========================================
// 1. WEB DEMO ENDPOINT (for Browser Simulator)
// ==========================================
app.post('/api/search', (req, res) => {
  const userQuery = req.body.query;

  if (!userQuery) {
    return res.status(400).json({ reply: 'Please provide a search term.' });
  }

  const searchResult = searchProducts(userQuery);

  if (searchResult.type === 'greeting') {
    let helpMsg = `👋 *Hi there! Welcome to TsvagaBot AI.* \n\nYou can search across local merchants for:\n• *Chargers & Laptops*\n• *Solar Batteries & Panels*\n• *Groceries & Cooking Oil*\n• *Clothes & Shoes*\n\nTry searching something like: *"Ndinotsvaga solar battery near Mbare"*`;
    return res.json({ reply: helpMsg });
  }

  const results = searchResult.items;
  if (results && results.length > 0) {
    let responseText = `Found ${results.length} seller(s):\n\n`;
    results.forEach((item, index) => {
      responseText += `${index + 1}. *${item.name}* - $${item.price.toFixed(2)} USD\n📍 ${item.location}\n📦 ${item.stock}\n\n`;
    });
    return res.json({ reply: responseText.trim() });
  } else {
    return res.json({ 
      reply: `Sorry, no products found matching "${userQuery}". Try searching for items like "solar", "charger", "sugar", or "shoes".` 
    });
  }
});

// ==========================================
// 2. WHATSAPP WEBHOOK VERIFICATION (Meta)
// ==========================================
app.get('/webhook', (req, res) => {
  const verifyToken = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully!');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
});

// ==========================================
// 3. WHATSAPP INBOUND MESSAGE WEBHOOK
// ==========================================
app.post('/webhook', async (req, res) => {
  const body = req.body;

  res.status(200).send('OK');

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from;
      const text = message.text.body;

      console.log(`Received WhatsApp message from ${from}: "${text}"`);

      const searchResult = searchProducts(text);
      let replyText = '';

      if (searchResult.type === 'greeting') {
        replyText = `👋 Hi there! Welcome to TsvagaBot AI.\n\nYou can search for:\n• Solar Batteries & Panels\n• Groceries & Food\n• Laptops & Chargers\n• Clothing & Shoes\n\nWhat are you looking for today?`;
      } else if (searchResult.items && searchResult.items.length > 0) {
        replyText = `Found ${searchResult.items.length} seller(s):\n\n`;
        searchResult.items.forEach((item, index) => {
          replyText += `${index + 1}. ${item.name} - $${item.price.toFixed(2)} USD\n📍 ${item.location}\n📦 ${item.stock}\n\n`;
        });
      } else {
        replyText = `Sorry, no products found matching "${text}". Try searching for "solar", "charger", "sugar", or "shoes".`;
      }

      try {
        const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: from,
            type: 'text',
            text: { body: replyText }
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log(`Successfully sent reply to ${from}`);
      } catch (apiError) {
        console.error('Failed to send WhatsApp message:', apiError.response?.data || apiError.message);
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
});

// ==========================================
// 4. SERVE INDEX.HTML AT ROOT ROUTE (Fixes Render 404)
// ==========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`TsvagaBot MVP Server running on port ${PORT}`);
  console.log(`=================================`);
});