import {SVG} from '@svgdotjs/svg.js'
import fs from 'fs';

// load src/src/icons.svg and import it using SVG.js
const document = SVG(fs.readFileSync('src/src/icons.svg', 'utf8'));

fs.readFile('src/icons.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading icons.json:', err);
    return;
  }

  try {
    const icons = JSON.parse(data);
    console.log('List of icons:');

    for (const icon in icons) {
      console.log(icon, icons[icon]);
    }

  } catch (err) {
    console.error('Error parsing icons.json:', err);
  }
});