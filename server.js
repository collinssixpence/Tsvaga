const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// In-Memory Database
const mockProducts = [
  { id: 1, name: '20W Fast iPhone Charger', price: 10.00, location: 'Harare CBD', stock: 'In Stock', category: 'charger electronics phone iphone' },
  { id: 2, name: 'Samsung Fast Type-C Charger', price: 12.00, location: 'Harare CBD', stock: 'In Stock', category: 'charger electronics phone samsung' },
  { id: 3, name: '100Ah Gel Solar Battery', price: 120.00, location: 'Mbare Musika', stock: '5 left', category: 'solar hardware battery' }
];

// In-Memory Sessions
const userSessions = {}; 

// Fuzzy match & synonym dictionary
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

function searchLocalProducts(query, userLocation) {
  const text = query.toLowerCase().trim();
  const stopWords = ['i', 'need', 'a', 'want', 'buy', 'for', 'the', 'looking', 'tsvaga', 'ndinoda'];
  
  const rawWords = text.replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => !stopWords.includes(w) && w.length > 1);
  const words = rawWords.map(normalizeWord);

  if (words.length === 0) return [];

  return mockProducts.filter(product => {
    const itemData = `${product.name} ${product.category}`.toLowerCase();
    const matchesKeywords = words.every(word => itemData.includes(word));
    
    // Optional: Filter or prioritize by user location
    const matchesLocation = userLocation ? product.location.toLowerCase().includes(userLocation.toLowerCase()) : true;
    
    return matchesKeywords && matchesLocation;
  });
}

async function searchGoogle(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) return null;

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
    const response = await axios.get(url);
    const items = response.data.items;

    if (items && items.length > 0) {
      let resultText = `🌐 *Google Web Results for "${query}":*\n\n`;
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

// Search API Endpoint
app.post('/api/search', async (req, res) => {
  const { query, userLocation, userName } = req.body;
  if (!query) return res.status(400).json({ reply: 'Please enter a search query.' });

  const localResults = searchLocalProducts(query, userLocation);
  
  if (localResults.length > 0) {
    let responseText = `Hi ${userName || 'there'}, found ${localResults.length} seller(s) in/near *${userLocation || 'Harare'}*:\n\n`;
    localResults.forEach((item, index) => {
      responseText += `${index + 1}. *${item.name}* - $${item.price.toFixed(2)} USD\n📍 ${item.location}\n📦 ${item.stock}\n\n`;
    });
    return res.json({ reply: responseText.trim() });
  }

  const googleResults = await searchGoogle(query);
  if (googleResults) {
    return res.json({ reply: googleResults });
  }

  return res.json({ reply: `Sorry ${userName || ''}, no local stock in ${userLocation || 'your area'} or web search results found for "${query}".` });
});

// Add Product Endpoint
app.post('/api/add-product', (req, res) => {
  const { name, price, location, stock, category } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price are required.' });

  const newProduct = {
    id: mockProducts.length + 1,
    name,
    price: parseFloat(price),
    location: location || 'Harare CBD',
    stock: stock || 'In Stock',
    category: (category || name).toLowerCase()
  };

  mockProducts.push(newProduct);
  return res.json({ success: true, message: `Listing published for ${newProduct.name}`, product: newProduct });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});