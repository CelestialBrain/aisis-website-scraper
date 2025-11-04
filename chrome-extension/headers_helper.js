// Common headers helper for all AISIS requests

function getCommonHeaders(referer = null) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin'
  };
  
  if (referer) {
    headers['Referer'] = referer;
    headers['Origin'] = 'https://aisis.ateneo.edu';
  }
  
  return headers;
}

function getPostHeaders(referer) {
  return {
    ...getCommonHeaders(referer),
    'Content-Type': 'application/x-www-form-urlencoded'
  };
}
