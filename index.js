// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import {registerWindow, SVG} from '@svgdotjs/svg.js'
import {FontAssetType, generateFonts, OtherAssetType} from 'fantasticon';
import fs from 'fs';
import ProgressBar from 'progress';
import {createSVGWindow} from 'svgdom'
import {optimize} from 'svgo';
import * as url from 'url';

// Get the directory of this script.
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * Recursively create a directory if it does not exist.
 *
 * @param {string} relativePath The path to create.
 */
function createDir(relativePath) {
  const path = `${__dirname}/${relativePath}`;

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, {recursive: true});
  }
}

/**
 * Load an SVG file from the file system.
 *
 * @param {string} relativePath The path to the SVG file.
 * @returns {SVG} The SVG.js instance.
 */
function loadSVG(relativePath) {
  const path = `${__dirname}/${relativePath}`;

  // Create headless DOM and SVG.js instance.
  const window = createSVGWindow();
  const document = window.document;
  registerWindow(window, document)

  // Parse SVG string into a DOM.
  let iconSVG = SVG(document.documentElement);
  iconSVG.svg(fs.readFileSync(path, 'utf8'));

  return iconSVG.findOne('svg');
}

function extractIcons(svg, outDirectory, metaFile) {
  // Load icon aliases.
  const iconAliases = JSON.parse(fs.readFileSync('src/icons.json', 'utf8'));

  const allIcons = {};

  const iconNodes = svg.find('title');
  const bar = new ProgressBar(':percent :bar', {total: iconNodes.length});

  // Iterate over all icons, and create a cropped version of the SVG.
  iconNodes.forEach(function(title) {
    bar.tick();

    const iconName = title.node.childNodes[0].nodeValue;

    // Skip icons that are not meant to be included in the icon set.
    if (iconName.search(' ') > 0) {
      return;
    }

    // Set the viewBox to the bounding box of the icon.
    const container = title.parent();

    // This should be a <g> element.
    if (container.type !== 'g') {
      return;
    }

    const bbox = container.bbox();

    // Create a new SVG element.
    const croppedSVG = svg.clone();
    croppedSVG.clear();
    croppedSVG.viewbox(bbox);

    // Copy the icon to the new SVG.
    container.children().forEach(function(child) {
      // Do not copy the invisible fill:none background box.
      if (child.attr('fill') === 'none') {
        return;
      }

      croppedSVG.add(child.clone());
    });

    // Write the cropped SVG to a file.
    fs.writeFileSync(`${outDirectory}/${iconName}.svg`, croppedSVG.svg());

    // Store the icon and its aliases.
    allIcons[iconName] = iconAliases[iconName] || [];
  });

  // Write the complete icon list to a file.
  fs.writeFileSync(metaFile, JSON.stringify(allIcons, null, 2));
}

/**
 * Optimize all SVG files in a directory by removing unnecessary elements,
 * attributes, and styles.
 *
 * @param {string} directory The directory containing the SVG files.
 */
function optimizeSVGs(directory) {
  const files = fs.readdirSync(directory);

  const bar = new ProgressBar(':percent :bar', {total: files.length});

  files.forEach(function(file) {
    bar.tick();

    const svg = loadSVG(`${directory}/${file}`);

    // Optimize the SVG.
    const optimized = optimize(svg.svg());

    // Write the optimized SVG back to the file.
    fs.writeFileSync(`${directory}/${file}`, optimized.data);
  });
}

/**
 * Generate a font from a directory of SVG files.
 *
 * @param {string} iconDirectory The directory containing the SVG files.
 * @param {string} fontDirectory The directory to write the font to.
 * @param {string} fontName The name of the font.
 */
function generateFont(iconDirectory, fontDirectory, fontName) {
  generateFonts({
    inputDir: iconDirectory,
    outputDir: fontDirectory,
    name: fontName,
    fontTypes: [FontAssetType.TTF, FontAssetType.WOFF2, FontAssetType.WOFF],
    assetTypes: [OtherAssetType.CSS],
    fontHeight: 100,
    tag: 'i',
    normalize: true,
    prefix: fontName,
  }).then(results => console.log(results));
}


createDir('build/icons');
createDir('dist');

const svg = loadSVG('src/src/icons.svg');
extractIcons(svg, 'build/icons', 'dist/gnome-icons.json');
optimizeSVGs('build/icons');
generateFont('build/icons', 'dist', 'gnome-icons');