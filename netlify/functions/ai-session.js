// Netlify function: /.netlify/functions/ai-session
// Proxies requests to Anthropic API server-side (avoids CORS + hides API key)

exports.handler = async function(event) {
  if(event.httpMethod === 'OPTIONS'){
    return {
      statusCode:200,
      headers:{
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Headers':'Content-Type',
        'Access-Control-Allow-Methods':'POST,OPTIONS'
      },
      body:''
    };
  }

  if(event.httpMethod !== 'POST'){
    return {statusCode:405, body:'Method not allowed'};
  }

  try {
    const {prompt} = JSON.parse(event.body);
    if(!prompt) return {statusCode:400, body:'Missing prompt'};

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: 'You are an expert UEFA football coaching assistant. Respond with a complete structured session plan including SESSION TITLE, DURATION, PLAYERS, AGE GROUP, FOCUS, WARM UP (10-15 min), TECHNICAL PHASE (15-20 min), GAME SCENARIO (20-25 min), COACHING POINTS (5 bullet points starting with -), COOL DOWN, KEY QUESTIONS FOR PLAYERS. Be specific and immediately usable by coaches.',
        messages: [{role:'user', content:prompt}]
      })
    });

    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: {'Access-Control-Allow-Origin':'*'},
      body: JSON.stringify({error: e.message})
    };
  }
};
