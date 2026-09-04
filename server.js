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
// IN-MEMORY LOCAL MERCHANT DATABASE
// ==========================================
const mockProducts = [
  // Electronics & Accessories
  { id: 1, name: '20W Fast iPhone Charger', price: 10.00, location: 'Stall 14, Eastgate Market', stock: 'In Stock Today', category: 'charger electronics phone iphone' },
  { id: 2, name: 'Apple Original Charging Block', price: 15.00, location: 'Shop 5, Gulf Complex', stock: 'In Stock', category: 'charger electronics phone apple' },
  { id: 3, name: 'Bluetooth Earbuds Pro', price: 25.00, location: 'Harare CBD Mall', stock: '8 left', category: 'audio electronics bluetooth' },
  { id: 4, name: 'HP Laptop i5 8GB RAM', price: 280.00, location: 'Eastgate Mall Shop 12', stock: '3 available', category: 'computer electronics laptop hp' },

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

// Helper: Local DB Search (Strict Term Matching)
function searchLocalProducts(query) {
  const text = query.toLowerCase().trim();

  const stopWords = [
    'ndinotsvaga', 'tsvaga', 'natsvaga', 'muri', 'kutsvaga', 'neiphi', 'pedyo', 'pane', 'ndinoda',
    'i', 'im', "i'm", 'looking', 'for', 'a', 'an', 'the', 'want', 'need', 'to', 'buy', 'get', 'show', 'me', 'any', 'some', 'near', 'at'
  ];
  
  const words = text
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter(word => !stopWords.includes(word) && word.length > 1);

  if (words.length === 0) return [];

  // Strict match: ALL search keywords must be present in the item data
  return mockProducts.filter(product => {
    const itemData = `${product.name} ${product.category} ${product.location}`.toLowerCase();
    return words.every(word => itemData.includes(word));
  });
}

// Helper: Google Custom Search API Fallback
async function searchGoogle(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    return null;
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
    const response = await axios.get(url);
    const items = response.data.items;

    if (items && items.length > 0) {
      let resultText = `🌐 *Google Search Results for "${query}":*\n\n`;
      items.slice(0, 3).forEach((item, index) => {
        resultText += `${index + 1}. *${item.title}*\n${item.snippet}\n🔗 ${item.link}\n\n`;
      });
      return resultText.trim();
    }
  } catch (error) {
    console.error('Google Search API Error:', error.message);
  }
  return null;
}

// Core Search Logic Engine
async function processSearch(userQuery) {
  const text = userQuery.toLowerCase().trim();

  // Greetings check
  const greetings = ['hi', 'hello', 'hey', 'start', 'help', 'menu'];
  if (greetings.includes(text)) {
    return `👋 *Hi there! Welcome to TsvagaBot AI.* \n\nYou can search for local stock or general interests:\n• *Local Products:* Chargers, Solar, Groceries\n• *Web Searches:* Any general product or topic!`;
  }

  // 1. Check local merchant inventory first
  const localResults = searchLocalProducts(userQuery);
  if (localResults.length > 0) {
    let responseText = `Found ${localResults.length} local seller(s):\n\n`;
    localResults.forEach((item, index) => {
      responseText += `${index + 1}. *${item.name}* - $${item.price.toFixed(2)} USD\n📍 ${item.location}\n📦 ${item.stock}\n\n`;
    });
    return responseText.trim();
  }

  // 2. Fallback to Google Search if local inventory yields no match
  const googleResults = await searchGoogle(userQuery);
  if (googleResults) {
    return googleResults;
  }

  return `Sorry, no local listings or web search results found for "${userQuery}". Try refining your query!`;
}

// ==========================================
// 1. WEB SIMULATOR ENDPOINTS
// ==========================================
app.post('/api/search', async (req, res) => {
  const userQuery = req.body.query;
  if (!userQuery) {
    return res.status(400).json({ reply: 'Please provide a search term.' });
  }

  const reply = await processSearch(userQuery);
  return res.json({ reply });
});

// Dynamic merchant listing addition
app.post('/api/add-product', (req, res) => {
  const { name, price, location, stock, category } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }

  const newProduct = {
    id: mockProducts.length + 1,
    name,
    price: parseFloat(price),
    location: location || 'Harare CBD',
    stock: stock || 'In Stock',
    category: category || name.toLowerCase()
  };

  mockProducts.push(newProduct);

  return res.json({ 
    success: true, 
    message: `🎉 *Listing Published!* "${newProduct.name}" is now live in search.`,
    product: newProduct
  });
});

// ==========================================
// 2. WHATSAPP WEBHOOK VERIFICATION & RECEIVER
// ==========================================
app.get('/webhook', (req, res) => {
  const verifyToken = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.status(200).send('OK');

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from;
      const text = message.text.body;

      const replyText = await processSearch(text);

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
    }
  } catch (err) {
    console.error('Webhook Error:', err.message);
  }
});

// Serve frontend UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Application Server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`TsvagaBot MVP Server running on port ${PORT}`);
  console.log(`=================================`);
});