export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, provider, apiKey, model } = req.body;

  if (!messages || !provider || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let response;
    
    switch (provider) {
      case 'openai':
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
          })
        });
        break;

      case 'anthropic':
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');
        
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model || 'claude-3-sonnet-20240229',
            max_tokens: 500,
            messages: conversationMessages,
            ...(systemMessage && { system: systemMessage.content })
          })
        });
        break;

      case 'google':
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-pro'}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: messages.map(m => ({ text: `${m.role}: ${m.content}` }))
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500
            }
          })
        });
        break;

      default:
        return res.status(400).json({ error: 'Unsupported provider' });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: `API request failed: ${response.status} - ${errorText}` 
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Backend error:', error);
    res.status(500).json({ error: error.message });
  }
}
