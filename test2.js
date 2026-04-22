const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'dist/assets');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  // Look for assignments to fetch like global.fetch = or window.fetch =
  const regex = /.{0,30}fetch\s*=[^;]+/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    console.log(match[0]);
  }
}
