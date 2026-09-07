const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Dynamic In-Memory Product Database
const mockProducts = [
  { id: 1, name: '20W Fast iPhone Charger', price: 10.00, location: 'Harare CBD', phone: '+263 77 123 4567', stock: 'In Stock', category: 'charger electronics phone iphone apple' },
  { id: 2, name: 'Samsung Fast Type-C Charger', price: 12.00, location: 'Harare CBD', phone: '+263 78 987 6543', stock: 'In Stock', category: 'charger electronics phone samsung' },
  { id: 3, name: '100Ah Gel Solar Battery', price: 120.00, location: 'Mbare Musika', phone: '+263 71 555 8888', stock: '5 left', category: 'solar hardware battery' },
  { id: 4, name: '550W Monocrystalline Solar Panel', price: 110.00, location: 'Magaba', phone: '+263 73 222 1111', stock: '12 available', category: 'solar hardware panel' }
];

// Dynamic Brand & Item Synonym Mapping
const brandSynonyms = {
  'samsung': ['samsung', 'samsang', 'samson', 'samsumg'],
  'iphone': ['iphone', 'apple', 'iphne', 'ipone'],
  'charger': ['charger', 'chager', 'chargr', 'adapter']
};

function normalizeWord(word) {
  for (const [key, variants] of Object.entries(brandSynonyms)) {
    if (variants.includes(word)) return key;
  }
  return word;
}

function searchLocalProducts(query) {
  const text = query.toLowerCase().trim();
  
  // Clean conversational intent and filler words
  const stopWords = [
    'i', 'want', 'need', 'a', 'buy', 'for', 'the', 'looking', 'tsvaga', 
    'ndinoda', 'me', 'show', 'get', 'is', 'there', 'to', 'can', 'please',
    'give', 'find', 'search', 'whats', "what's", 'what', 'phone', 'number', 'contact'
  ];
  
  const rawWords = text.replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => !stopWords.includes(w) && w.length > 1);
  const words = rawWords.map(normalizeWord);

  if (words.length === 0) return [];

  return mockProducts.filter(product => {
    const itemData = `${product.name} ${product.category}`.toLowerCase();
    return words.every(word => itemData.includes(word));
  });
}

// Fallback Google Custom Search API
async function searchGoogle(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) return null;

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
    const response = await axios.get(url);
    const items = response.data.items;

    if (items && items.length > 0) {
      let resultText = `🌐 Web search results for "${query}":\n\n`;
      items.slice(0, 3).forEach((item, index) => {
        resultText += `${index + 1}. ${item.title}\n${item.snippet}\n🔗 ${item.link}\n\n`;
      });
      return resultText.trim();
    }
  } catch (error) {
    console.error('Google Search API Error:', error.message);
  }
  return null;
}

// Centralized Processing Function for Web UI & WhatsApp Webhook
async function processSearchQuery(query, userName = 'there', userLocation = 'Harare CBD') {
  const cleanQuery = query.toLowerCase().trim();

  // 1. Handle Greetings
  const greetings = ['hi', 'hello', 'hey', 'start', 'greetings', 'mhoro', 'salibonani'];
  if (greetings.includes(cleanQuery)) {
    return `Hello ${userName}! 👋 How can I assist you today? You can say *"I want a samsung charger"* or search for any item available in ${userLocation}.`;
  }

  // 2. Handle Contact Details Request
  if (cleanQuery.includes('phone') || cleanQuery.includes('number') || cleanQuery.includes('contact')) {
    return `📞 Seller contact numbers are displayed directly under search results. Try searching for a specific product like *"samsung charger"*.`;
  }

  // 3. Match Local Database
  const localResults = searchLocalProducts(query);
  if (localResults.length > 0) {
    let responseText = `I found ${localResults.length} match(es) near *${userLocation}*:\n\n`;
    localResults.forEach((item, index) => {
      responseText += `${index + 1}. *${item.name}* - $${item.price.toFixed(2)} USD\n📍 Location: ${item.location}\n📞 Contact: ${item.phone}\n📦 Stock: ${item.stock}\n\n`;
    });
    return responseText.trim();
  }

  // 4. Fallback Web Search
  const googleResults = await searchGoogle(query);
  if (googleResults) {
    return googleResults;
  }

  return `I searched local listings near ${userLocation} and the web, but couldn't find matches for "${query}". Try searching with different keywords!`;
}

// =================================================================
// WEB APP API ROUTES (Simulator Frontend)
// =================================================================

app.post('/api/search', async (req, res) => {
  const { query, userLocation, userName } = req.body;
  if (!query) return res.status(400).json({ reply: 'Please enter a search query.' });

  const reply = await processSearchQuery(query, userName, userLocation);
  return res.json({ reply });
});

app.post('/api/add-product', (req, res) => {
  const { name, price, location, phone, stock, category } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price are required.' });

  const newProduct = {
    id: mockProducts.length + 1,
    name,
    price: parseFloat(price),
    location: location || 'Harare CBD',
    phone: phone || '+263 77 000 0000',
    stock: stock || 'In Stock',
    category: (category || name).toLowerCase()
  };

  mockProducts.push(newProduct);
  return res.json({ success: true, message: `Listing published! "${newProduct.name}" is live.`, product: newProduct });
});

// =================================================================
// WHATSAPP META CLOUD API WEBHOOK ROUTES
// =================================================================

// Webhook Verification Endpoint (Meta GET request)
app.get('/webhook', (req, res) => {
  const verifyToken = process.env.VERIFY_TOKEN || 'my_verify_token_123';

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook successfully verified with Meta.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Webhook Receiver Endpoint (Meta POST request for incoming messages)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    res.status(200).send('EVENT_RECEIVED'); // Always acknowledge Meta within 3 seconds

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const recipientPhone = message.from;
      const incomingText = message.text.body;

      // Process message with the central AI engine
      const botReply = await processSearchQuery(incomingText);

      // Send the result back to WhatsApp user
      await sendWhatsAppMessage(recipientPhone, botReply);
    }
  } else {
    res.sendStatus(404);
  }
});

// Send Message Outbound Request to WhatsApp Cloud API
async function sendWhatsAppMessage(toPhone, messageText) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('Missing WhatsApp API Credentials in Environment Variables.');
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: messageText }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
  }
}

// Serve Frontend Simulator
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`TsvagaBot server actively running on port ${PORT}`);
});