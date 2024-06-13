// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import {registerWindow, SVG} from '@svgdotjs/svg.js'
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

  let iconNodes = svg.find('title');

  const bar =
      new ProgressBar('Extracting :percent [:bar]', {total: iconNodes.length});

  // Iterate over all icons, and create a cropped version of the SVG.
  iconNodes.forEach(function(title) {
    bar.tick();

    const iconName = title.node.childNodes[0].nodeValue;

    // Skip icons that are not meant to be included in the icon set.
    if (iconName.search(' ') > 0) {
      return;
    }

    // There are icons which contain their title as a child element a second
    // time. We want to skip these.
    if (allIcons[iconName]) {
      return;
    }

    // Set the viewBox to the bounding box of the icon.
    const container = title.parent();
    const bbox = container.bbox();

    // Create a new SVG element.
    const croppedSVG = svg.clone();
    croppedSVG.clear();
    croppedSVG.attr('viewBox', `0 0 ${bbox.width} ${bbox.height}`);
    croppedSVG.width(bbox.width);
    croppedSVG.height(bbox.height);

    // Add a top-level group element and translate it to the bounding box.
    const group = croppedSVG.group();
    group.translate(-bbox.x, -bbox.y);

    // Copy the icon to the new SVG.
    container.children().forEach(function(child) {
      group.add(child.clone());

      // Make sure to copy any linked objects (via xlink:href).
      if (child.attr('xlink:href')) {
        const href = child.attr('xlink:href');
        const linked = svg.findOne(href);
        group.add(linked.clone());
      }
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
function optimizeSVGs(srcDirectory, dstDirectory) {
  const files = fs.readdirSync(srcDirectory);

  const bar =
      new ProgressBar('Optimizing :percent [:bar]', {total: files.length});

  files.forEach(function(file) {
    bar.tick();

    const svg = loadSVG(`${srcDirectory}/${file}`);

    // Remove the shape-rendering attribute.
    svg.attr('shape-rendering', null);

    // Optimize the SVG using SVGO.
    const optimized = optimize(svg.svg());

    // Write the optimized SVG back to the file.
    fs.writeFileSync(`${dstDirectory}/${file}`, optimized.data);
  });
}

function flattenSVGs(srcDirectory, dstDirectory) {
  const files = fs.readdirSync(srcDirectory);

  const bar =
      new ProgressBar('Flattening :percent [:bar]', {total: files.length});

  files.forEach(function(file) {
    bar.tick();

    const svg = loadSVG(`${srcDirectory}/${file}`);

    svg.flatten();

    // Write the optimized SVG back to the file.
    fs.writeFileSync(`${dstDirectory}/${file}`, svg.svg());
  });
}

createDir('build/icons');
createDir('dist/icons');

const svg = loadSVG('src/src/icons.svg');
extractIcons(svg, 'build/icons', 'dist/gnome-icons.json');
optimizeSVGs('build/icons', 'dist/icons');
flattenSVGs('dist/icons', 'dist/icons');