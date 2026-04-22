const http = require('http');

http.get('http://hq.sinajs.cn/list=sz159501', { headers: { 'Referer': 'http://finance.sina.com.cn' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
