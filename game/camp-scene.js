/*
 * Static low-poly camp backdrop.
 *
 * This is deliberately a small native WebGL renderer rather than a baked
 * image. The camera never moves and there is no render loop, but the scene
 * is rebuilt when the camp's wood stage changes. That keeps the backdrop
 * cheap while making each upgrade feel like a real addition to the world.
 */
(function () {
  'use strict';

  const sceneRoot = document.querySelector('#campScene');
  const canvas = document.querySelector('#campCanvas');
  if (!sceneRoot || !canvas) return;

  const TAU = Math.PI * 2;
  const LIGHT_PALETTE = {
    skyTop: '#6f9fd0',
    skyHorizon: '#d7e2df',
    fog: '#a7bdc1',
    sun: '#f6d79d',
    mountainFar: '#708e9a',
    mountainNear: '#4e7075',
    mountainFacet: '#8ca7aa',
    ground: '#4d864c',
    groundLight: '#68a45b',
    groundDark: '#356b3d',
    path: '#806344',
    pathLight: '#9a7952',
    tree: '#367a3c',
    treeLight: '#579c4e',
    treeDark: '#22572f',
    trunk: '#714825',
    trunkLight: '#98683a',
    rock: '#727970',
    rockLight: '#9a9d89',
    rockDark: '#4e5c55',
    roof: '#3b2819',
    roofLight: '#604125',
    roofDark: '#291b13',
    wall: '#90643b',
    wallLight: '#b17b45',
    wallDark: '#684326',
    door: '#40291b',
    window: '#a7d2c6',
    metal: '#c18b43',
    fire: '#ee8739',
    fireLight: '#ffd45f',
    shadow: '#3a5740'
  };

  const DARK_PALETTE = {
    ...LIGHT_PALETTE,
    skyTop: '#172a44',
    skyHorizon: '#4a5d6b',
    fog: '#334b55',
    sun: '#d2aa66',
    mountainFar: '#2f4955',
    mountainNear: '#263f43',
    mountainFacet: '#49656a',
    ground: '#2d5b39',
    groundLight: '#3f7544',
    groundDark: '#1d432d',
    path: '#5b432b',
    pathLight: '#765839',
    tree: '#24552f',
    treeLight: '#367542',
    treeDark: '#163b28',
    trunk: '#4c301d',
    trunkLight: '#70472a',
    rock: '#59665e',
    rockLight: '#758077',
    rockDark: '#374840',
    roof: '#211711',
    roofLight: '#3e2a1b',
    roofDark: '#130e0b',
    wall: '#68472d',
    wallLight: '#895e37',
    wallDark: '#472e20',
    door: '#241810',
    window: '#6d9b9a',
    metal: '#a77837',
    fire: '#c75e2d',
    fireLight: '#f1b84b',
    shadow: '#1e392c'
  };

  const VERTEX_SHADER = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec3 a_color;
    uniform mat4 u_viewProjection;
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec3 v_color;

    void main() {
      v_position = a_position;
      v_normal = a_normal;
      v_color = a_color;
      gl_Position = u_viewProjection * vec4(a_position, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    precision mediump float;
    uniform vec3 u_sunDirection;
    uniform vec3 u_fogColor;
    uniform vec3 u_cameraPosition;
    uniform float u_fogNear;
    uniform float u_fogFar;
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec3 v_color;

    void main() {
      vec3 normal = normalize(v_normal);
      float sun = max(dot(normal, normalize(u_sunDirection)), 0.0);
      float light = 0.56 + sun * 0.58;
      vec3 litColor = v_color * light;
      float fog = smoothstep(u_fogNear, u_fogFar, distance(v_position, u_cameraPosition));
      gl_FragColor = vec4(mix(litColor, u_fogColor, fog), 1.0);
    }
  `;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function color(value) {
    const number = Number.parseInt(value.slice(1), 16);
    return [
      ((number >> 16) & 255) / 255,
      ((number >> 8) & 255) / 255,
      (number & 255) / 255
    ];
  }

  function shade(value, amount) {
    return value.map(component => clamp(component * amount, 0, 1));
  }

  function paletteForTheme() {
    const source = document.documentElement.getAttribute('data-theme') === 'dark'
      ? DARK_PALETTE
      : LIGHT_PALETTE;
    return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, color(value)]));
  }

  function subtract(first, second) {
    return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
  }

  function cross(first, second) {
    return [
      first[1] * second[2] - first[2] * second[1],
      first[2] * second[0] - first[0] * second[2],
      first[0] * second[1] - first[1] * second[0]
    ];
  }

  function dot(first, second) {
    return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
  }

  function normalize(value) {
    const length = Math.hypot(value[0], value[1], value[2]) || 1;
    return [value[0] / length, value[1] / length, value[2] / length];
  }

  function createBuilder(palette) {
    const positions = [];
    const normals = [];
    const colors = [];

    function addTriangle(first, second, third, faceColor) {
      const normal = normalize(cross(subtract(second, first), subtract(third, first)));
      [first, second, third].forEach(point => {
        positions.push(point[0], point[1], point[2]);
        normals.push(normal[0], normal[1], normal[2]);
        colors.push(faceColor[0], faceColor[1], faceColor[2]);
      });
    }

    function addQuad(first, second, third, fourth, faceColor) {
      addTriangle(first, second, third, faceColor);
      addTriangle(first, third, fourth, shade(faceColor, 0.94));
    }

    function addBox(x, y, z, width, height, depth, faceColors) {
      const x0 = x - width / 2;
      const x1 = x + width / 2;
      const y0 = y;
      const y1 = y + height;
      const z0 = z - depth / 2;
      const z1 = z + depth / 2;
      const hasFacePalette = Array.isArray(faceColors[0]);
      const front = hasFacePalette ? faceColors[0] : faceColors;
      const side = hasFacePalette ? (faceColors[1] || front) : faceColors;
      const top = hasFacePalette ? (faceColors[2] || front) : faceColors;
      const back = hasFacePalette ? (faceColors[3] || side) : faceColors;

      addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front);
      addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], back);
      addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side);
      addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], shade(side, 0.82));
      addQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
      addQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], shade(top, 0.72));
    }

    function addCylinder(x, y, z, radius, height, sides, faceColor) {
      const bottom = [x, y, z];
      const top = [x, y + height, z];
      for (let index = 0; index < sides; index += 1) {
        const firstAngle = (index / sides) * TAU;
        const secondAngle = ((index + 1) / sides) * TAU;
        const first = [x + Math.cos(firstAngle) * radius, y, z + Math.sin(firstAngle) * radius];
        const second = [x + Math.cos(secondAngle) * radius, y, z + Math.sin(secondAngle) * radius];
        const firstTop = [first[0], y + height, first[2]];
        const secondTop = [second[0], y + height, second[2]];
        const sideColor = index % 2 ? shade(faceColor, 0.9) : faceColor;
        addQuad(first, second, secondTop, firstTop, sideColor);
        addTriangle(top, firstTop, secondTop, shade(sideColor, 1.05));
        addTriangle(bottom, second, first, shade(sideColor, 0.72));
      }
    }

    function addCone(x, y, z, radius, height, sides, faceColor, lightColor) {
      const apex = [x, y + height, z];
      const bottom = [x, y, z];
      for (let index = 0; index < sides; index += 1) {
        const firstAngle = (index / sides) * TAU;
        const secondAngle = ((index + 1) / sides) * TAU;
        const first = [x + Math.cos(firstAngle) * radius, y, z + Math.sin(firstAngle) * radius];
        const second = [x + Math.cos(secondAngle) * radius, y, z + Math.sin(secondAngle) * radius];
        const sideColor = index % 2 && lightColor ? lightColor : faceColor;
        addTriangle(apex, second, first, sideColor);
        addTriangle(bottom, first, second, shade(faceColor, 0.72));
      }
    }

    function addSphere(x, y, z, radiusX, radiusY, radiusZ, faceColor, rings, sides) {
      for (let ring = 0; ring < rings; ring += 1) {
        const firstPhi = -Math.PI / 2 + (ring / rings) * Math.PI;
        const secondPhi = -Math.PI / 2 + ((ring + 1) / rings) * Math.PI;
        for (let side = 0; side < sides; side += 1) {
          const firstTheta = (side / sides) * TAU;
          const secondTheta = ((side + 1) / sides) * TAU;
          const point = (phi, theta) => [
            x + Math.cos(phi) * Math.cos(theta) * radiusX,
            y + Math.sin(phi) * radiusY,
            z + Math.cos(phi) * Math.sin(theta) * radiusZ
          ];
          const first = point(firstPhi, firstTheta);
          const second = point(firstPhi, secondTheta);
          const third = point(secondPhi, secondTheta);
          const fourth = point(secondPhi, firstTheta);
          addQuad(first, second, third, fourth, side % 2 ? shade(faceColor, 0.9) : faceColor);
        }
      }
    }

    function addEllipse(x, y, z, radiusX, radiusZ, faceColor, sides = 12) {
      const centre = [x, y, z];
      for (let index = 0; index < sides; index += 1) {
        const firstAngle = (index / sides) * TAU;
        const secondAngle = ((index + 1) / sides) * TAU;
        const first = [x + Math.cos(firstAngle) * radiusX, y, z + Math.sin(firstAngle) * radiusZ];
        const second = [x + Math.cos(secondAngle) * radiusX, y, z + Math.sin(secondAngle) * radiusZ];
        addTriangle(centre, first, second, index % 2 ? shade(faceColor, 0.9) : faceColor);
      }
    }

    function addMountain(x, z, width, height, frontColor, sideColor, snow = false) {
      const frontZ = z + 0.8;
      const backZ = z - 0.8;
      const left = [x - width / 2, -0.05, frontZ];
      const right = [x + width / 2, -0.05, frontZ];
      const backRight = [x + width / 2, -0.05, backZ];
      const backLeft = [x - width / 2, -0.05, backZ];
      const peak = [x, height, z - 0.35];
      addTriangle(left, right, peak, frontColor);
      addTriangle(right, backRight, peak, sideColor);
      addTriangle(backRight, backLeft, peak, shade(sideColor, 0.78));
      addTriangle(backLeft, left, peak, shade(frontColor, 0.82));
      if (snow) {
        const snowWidth = width * 0.18;
        const snowBase = [x - snowWidth, height * 0.48, z - 0.1];
        const snowRight = [x + snowWidth, height * 0.48, z - 0.1];
        addTriangle(snowBase, snowRight, peak, palette.mountainFacet);
      }
    }

    function addPine(x, z, scale, variant = 0) {
      addEllipse(x, 0.035, z, 0.82 * scale, 0.56 * scale, palette.shadow);
      addCylinder(x, 0, z, 0.15 * scale, 1.35 * scale, 6, palette.trunk);
      addCone(x, 0.85 * scale, z, 1.08 * scale, 1.8 * scale, 7, palette.tree, palette.treeLight);
      addCone(x, 1.95 * scale, z, 0.86 * scale, 1.55 * scale, 7, variant ? palette.treeLight : palette.tree, palette.treeLight);
      addCone(x, 2.9 * scale, z, 0.58 * scale, 1.25 * scale, 7, palette.treeDark, palette.tree);
    }

    function addShrub(x, z, scale) {
      addEllipse(x, 0.025, z, 0.5 * scale, 0.32 * scale, palette.shadow);
      addCone(x, 0, z, 0.58 * scale, 0.82 * scale, 6, palette.treeDark, palette.treeLight);
      addSphere(x - 0.25 * scale, 0.25 * scale, z + 0.08 * scale, 0.38 * scale, 0.3 * scale, 0.32 * scale, palette.tree, 3, 6);
    }

    function addPath() {
      const points = [
        { z: 14, width: 4.8, x: 0.2 },
        { z: 8, width: 3.7, x: 0.35 },
        { z: 3, width: 2.6, x: 0.55 },
        { z: -2, width: 1.8, x: 0.85 },
        { z: -7, width: 1.2, x: 1.2 }
      ];
      for (let index = 0; index < points.length - 1; index += 1) {
        const first = points[index];
        const second = points[index + 1];
        const firstLeft = [first.x - first.width / 2, 0.07, first.z];
        const firstRight = [first.x + first.width / 2, 0.07, first.z];
        const secondRight = [second.x + second.width / 2, 0.07, second.z];
        const secondLeft = [second.x - second.width / 2, 0.07, second.z];
        addQuad(firstLeft, firstRight, secondRight, secondLeft, index % 2 ? palette.path : palette.pathLight);
      }
    }

    function addCampfire(x, z) {
      addEllipse(x, 0.08, z, 1.15, 0.82, palette.shadow);
      addBox(x - 0.22, 0.12, z, 1.05, 0.18, 0.2, [palette.trunkLight, palette.trunk, palette.trunkLight]);
      addBox(x + 0.22, 0.18, z + 0.06, 1.05, 0.18, 0.2, [palette.trunk, palette.trunkLight, palette.trunk]);
      for (let index = 0; index < 7; index += 1) {
        const angle = (index / 7) * TAU;
        addSphere(x + Math.cos(angle) * 0.72, 0.1, z + Math.sin(angle) * 0.52, 0.27, 0.19, 0.2, index % 2 ? palette.rockDark : palette.rock, 2, 6);
      }
      addCone(x, 0.32, z, 0.58, 1.24, 7, palette.fire, palette.fireLight);
      addCone(x, 0.48, z + 0.03, 0.3, 0.8, 6, palette.fireLight, palette.fireLight);
    }

    function addLeanTo(x, z) {
      const width = 4.5;
      const depth = 3.0;
      const frontZ = z + depth / 2;
      const backZ = z - depth / 2;
      addEllipse(x, 0.035, z, 2.8, 2.0, palette.shadow);
      addBox(x, 0.08, backZ, width, 2.3, 0.18, [palette.wallDark, palette.wall, palette.wallDark]);
      addBox(x - width / 2 + 0.18, 0, frontZ - 0.12, 0.16, 1.55, 0.16, palette.trunk);
      addBox(x + width / 2 - 0.18, 0, frontZ - 0.12, 0.16, 1.55, 0.16, palette.trunk);
      const roofFrontLeft = [x - width / 2, 1.0, frontZ + 0.18];
      const roofFrontRight = [x + width / 2, 1.0, frontZ + 0.18];
      const roofBackRight = [x + width / 2, 2.9, backZ - 0.18];
      const roofBackLeft = [x - width / 2, 2.9, backZ - 0.18];
      addQuad(roofFrontLeft, roofFrontRight, roofBackRight, roofBackLeft, palette.roofLight);
      addQuad(roofBackLeft, roofBackRight, roofFrontRight, roofFrontLeft, palette.roof);
      addBox(x, 0.08, z + 0.1, 2.1, 0.12, 1.15, [palette.wallLight, palette.wall, palette.wallLight]);
      addBox(x, 0.18, frontZ + 0.05, 2.3, 0.12, 0.12, palette.trunkLight);
    }

    function addGableRoof(x, y, z, width, depth, height) {
      const frontZ = z + depth / 2;
      const backZ = z - depth / 2;
      const frontLeft = [x - width / 2, y, frontZ + 0.04];
      const frontRight = [x + width / 2, y, frontZ + 0.04];
      const frontPeak = [x, y + height, frontZ + 0.04];
      const backLeft = [x - width / 2, y, backZ];
      const backRight = [x + width / 2, y, backZ];
      const backPeak = [x, y + height, backZ];
      addTriangle(frontLeft, frontRight, frontPeak, palette.roofLight);
      addTriangle(backRight, backLeft, backPeak, palette.roofDark);
      addQuad(frontLeft, frontPeak, backPeak, backLeft, palette.roof);
      addQuad(frontPeak, frontRight, backRight, backPeak, palette.roofDark);
      addTriangle(frontLeft, frontRight, frontPeak, palette.wallDark);
      addTriangle(backRight, backLeft, backPeak, palette.wallDark);
    }

    function addWindow(x, y, z, width, height) {
      addBox(x, y, z, width, height, 0.08, [palette.window, palette.window, palette.metal]);
      addBox(x, y, z + 0.055, 0.07, height + 0.04, 0.035, palette.wallDark);
      addBox(x, y, z + 0.06, width + 0.04, 0.07, 0.035, palette.wallDark);
    }

    function addHut(x, z) {
      const width = 4.4;
      const depth = 3.4;
      const frontZ = z + depth / 2 + 0.02;
      addEllipse(x, 0.04, z, 2.9, 2.1, palette.shadow);
      addBox(x, 0, z, width, 2.35, depth, [palette.wallLight, palette.wall, palette.wallDark]);
      addGableRoof(x, 2.2, z, width + 0.55, depth + 0.45, 1.55);
      addBox(x, 0, frontZ, width + 0.08, 0.12, 0.12, palette.wallDark);
      addBox(x, 0, frontZ, 0.12, 2.35, 0.12, palette.wallDark);
      addBox(x - 1.35, 0.05, frontZ + 0.05, 0.76, 1.35, 0.08, palette.door);
      addWindow(x + 1.15, 1.05, frontZ + 0.06, 0.7, 0.62);
      addBox(x - 1.35, 1.37, frontZ + 0.08, 0.9, 0.08, 0.08, palette.wallLight);
      addBox(x + 1.15, 1.37, frontZ + 0.08, 0.9, 0.08, 0.08, palette.wallLight);
      addBox(x + 1.45, 2.65, z - 0.65, 0.48, 1.45, 0.48, [palette.rockDark, palette.rock, palette.rockDark]);
      addBox(x + 1.45, 4.08, z - 0.65, 0.66, 0.12, 0.66, palette.rockDark);
      addBox(x - 2.9, 0.08, z - 0.3, 0.9, 0.16, 0.9, [palette.wallDark, palette.wall, palette.wallDark]);
      addBox(x - 2.9, 0.24, z - 0.3, 0.9, 0.16, 0.9, [palette.wall, palette.wallLight, palette.wallDark]);
    }

    function addCabin(x, z) {
      const width = 5.4;
      const depth = 4.2;
      const frontZ = z + depth / 2 + 0.03;
      addEllipse(x, 0.05, z, 3.6, 2.8, palette.shadow);
      addBox(x, 0, z, width, 3.05, depth, [palette.wallLight, palette.wall, palette.wallDark]);
      addGableRoof(x, 2.82, z, width + 0.7, depth + 0.55, 1.95);
      for (let beam = 0; beam < 3; beam += 1) {
        addBox(x, 0.55 + beam * 0.8, frontZ + 0.08, width + 0.12, 0.1, 0.1, palette.wallDark);
      }
      addBox(x - 0.1, 0.04, frontZ + 0.08, 0.96, 1.85, 0.1, palette.door);
      addBox(x - 0.1, 1.48, frontZ + 0.14, 0.12, 0.12, 0.08, palette.metal);
      addWindow(x - 1.8, 1.42, frontZ + 0.1, 0.82, 0.74);
      addWindow(x + 1.72, 1.42, frontZ + 0.1, 0.82, 0.74);
      addBox(x, 0, frontZ + 0.78, 2.0, 0.17, 1.55, [palette.wallDark, palette.wall, palette.wallDark]);
      addBox(x - 0.82, 0.17, frontZ + 1.42, 0.14, 0.82, 0.14, palette.wallDark);
      addBox(x + 0.82, 0.17, frontZ + 1.42, 0.14, 0.82, 0.14, palette.wallDark);
      addBox(x + 1.9, 3.1, z - 0.85, 0.55, 1.72, 0.55, [palette.rockDark, palette.rock, palette.rockDark]);
      addBox(x + 1.9, 4.78, z - 0.85, 0.76, 0.14, 0.76, palette.rockDark);
      addSphere(x + 1.9, 5.05, z - 0.85, 0.28, 0.35, 0.28, palette.fog, 3, 6);
      addSphere(x + 1.55, 5.52, z - 0.9, 0.38, 0.42, 0.38, palette.fog, 3, 6);
    }

    function addWoodpile(x, z) {
      addEllipse(x, 0.03, z, 1.15, 0.7, palette.shadow);
      for (let index = 0; index < 3; index += 1) {
        addBox(x + (index % 2) * 0.08, 0.12 + Math.floor(index / 2) * 0.22, z + (index - 1) * 0.18, 1.55, 0.2, 0.22, [palette.trunkLight, palette.trunk, palette.trunkLight]);
      }
    }

    function addWorkbench(x, z) {
      addBox(x, 0.72, z, 1.5, 0.18, 0.62, [palette.wallLight, palette.wall, palette.wallLight]);
      addBox(x - 0.55, 0, z, 0.15, 0.76, 0.15, palette.trunk);
      addBox(x + 0.55, 0, z, 0.15, 0.76, 0.15, palette.trunk);
      addBox(x, 0.94, z, 0.5, 0.16, 0.12, palette.metal);
    }

    function addFence(x, z) {
      const posts = [-2.8, -1.4, 0, 1.4, 2.8];
      posts.forEach(offset => addBox(x + offset, 0, z + 2.9, 0.14, 1.05, 0.14, palette.trunk));
      addBox(x, 0.34, z + 2.9, 5.9, 0.12, 0.12, palette.trunkLight);
      addBox(x, 0.72, z + 2.9, 5.9, 0.12, 0.12, palette.trunk);
    }

    function addGround() {
      const columns = 9;
      const rows = 10;
      const width = 38;
      const depth = 42;
      const cellWidth = width / columns;
      const cellDepth = depth / rows;
      const heightAt = (x, z) => Math.sin(x * 0.38 + z * 0.11) * 0.05 + Math.cos(z * 0.31) * 0.04;
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
          const x0 = -width / 2 + column * cellWidth;
          const x1 = x0 + cellWidth;
          const z0 = -depth / 2 + row * cellDepth;
          const z1 = z0 + cellDepth;
          const a = [x0, heightAt(x0, z0), z0];
          const b = [x1, heightAt(x1, z0), z0];
          const c = [x1, heightAt(x1, z1), z1];
          const d = [x0, heightAt(x0, z1), z1];
          const variant = (column + row) % 4;
          const groundColor = variant === 0 ? palette.groundLight : variant === 3 ? palette.groundDark : palette.ground;
          addQuad(a, b, c, d, groundColor);
        }
      }
    }

    function build(stage) {
      addGround();
      addPath();
      addMountain(-10, -19, 13, 6.8, palette.mountainFar, palette.mountainFacet, false);
      addMountain(1, -23, 17, 9.5, palette.mountainFar, palette.mountainFacet, true);
      addMountain(12, -20, 14, 7.5, palette.mountainNear, palette.mountainFacet, false);

      [
        [-12, -11, 1.55, 0], [-8, -14, 2.0, 1], [-2.6, -17, 1.8, 0],
        [5.9, -15, 2.0, 1], [12.2, -12, 1.7, 0], [14, -6, 1.9, 1],
        [-12, -3, 1.85, 0], [12, 1, 1.8, 1], [-10.8, 4, 1.5, 0],
        [11.2, 6, 1.45, 1]
      ].forEach(tree => addPine(tree[0], tree[1], tree[2], tree[3]));

      [
        [-5.4, -7.3, 1.15], [8.1, -8.2, 1.2], [-6.7, 1.9, 1.15],
        [6.5, 3.2, 1.05], [-3.3, 5.8, 0.9], [4.8, 6.2, 0.85]
      ].forEach(shrub => addShrub(shrub[0], shrub[1], shrub[2]));

      addCampfire(0.8, -1.4);
      addWoodpile(-2.4, -2.4);

      if (stage === 1) {
        addLeanTo(2.7, -5.1);
      } else if (stage === 2) {
        addHut(2.7, -5.1);
        addWorkbench(-0.3, -3.1);
        addWoodpile(5.4, -2.4);
      } else if (stage >= 3) {
        addCabin(2.7, -5.1);
        addFence(2.7, -5.1);
        addWorkbench(-0.3, -3.1);
        addWoodpile(5.8, -1.7);
        addSphere(0.4, 1.18, -2.05, 0.14, 0.14, 0.14, palette.fireLight, 3, 6);
      }

      return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        colors: new Float32Array(colors),
        vertexCount: positions.length / 3
      };
    }

    return { build };
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  function perspective(fov, aspect, near, far) {
    const scale = 1 / Math.tan(fov / 2);
    const range = near - far;
    return new Float32Array([
      scale / aspect, 0, 0, 0,
      0, scale, 0, 0,
      0, 0, (far + near) / range, -1,
      0, 0, (2 * far * near) / range, 0
    ]);
  }

  function lookAt(eye, target, up) {
    const zAxis = normalize(subtract(eye, target));
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);
    return new Float32Array([
      xAxis[0], yAxis[0], zAxis[0], 0,
      xAxis[1], yAxis[1], zAxis[1], 0,
      xAxis[2], yAxis[2], zAxis[2], 0,
      -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1
    ]);
  }

  function multiply(first, second) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        result[row + column * 4] =
          first[row] * second[column * 4] +
          first[row + 4] * second[column * 4 + 1] +
          first[row + 8] * second[column * 4 + 2] +
          first[row + 12] * second[column * 4 + 3];
      }
    }
    return result;
  }

  function stageFromDom() {
    const value = Number.parseInt(sceneRoot.dataset.woodStage || '0', 10);
    return Number.isFinite(value) ? clamp(value, 0, 3) : 0;
  }

  let gl = null;
  let program = null;
  let buffers = null;
  let attributes = null;
  let uniforms = null;
  let renderCount = 0;

  function markFallback(stage) {
    canvas.dataset.renderer = 'fallback';
    canvas.dataset.stageRendered = String(stage);
  }

  function render(stage = stageFromDom()) {
    if (!gl || !program || !buffers || !attributes || !uniforms) {
      markFallback(stage);
      return;
    }

    const palette = paletteForTheme();
    const mesh = createBuilder(palette).build(stage);
    const rect = sceneRoot.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width * pixelRatio));
    const height = Math.max(1, Math.floor(rect.height * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const aspect = width / Math.max(height, 1);
    const eye = aspect < 0.72 ? [9.2, 8.8, 16.5] : [8.8, 7.5, 14.2];
    const target = aspect < 0.72 ? [1.1, 1.8, -3.0] : [0.9, 1.7, -3.2];
    const viewProjection = multiply(
      perspective((aspect < 0.72 ? 52 : 46) * Math.PI / 180, aspect, 0.1, 80),
      lookAt(eye, target, [0, 1, 0])
    );

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);

    const upload = (buffer, attribute, values) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);
    };
    upload(buffers.positions, attributes.position, mesh.positions);
    upload(buffers.normals, attributes.normal, mesh.normals);
    upload(buffers.colors, attributes.color, mesh.colors);

    gl.uniformMatrix4fv(uniforms.viewProjection, false, viewProjection);
    gl.uniform3f(uniforms.sunDirection, 0.42, 0.82, 0.48);
    gl.uniform3fv(uniforms.fogColor, palette.fog);
    gl.uniform3fv(uniforms.cameraPosition, eye);
    gl.uniform1f(uniforms.fogNear, 17);
    gl.uniform1f(uniforms.fogFar, 39);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);

    renderCount += 1;
    canvas.dataset.renderer = 'webgl';
    canvas.dataset.stageRendered = String(stage);
    canvas.dataset.renderCount = String(renderCount);
  }

  function initialise() {
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        powerPreference: 'low-power'
      });
    } catch {
      gl = null;
    }

    if (!gl) {
      markFallback(stageFromDom());
      return;
    }

    program = createProgram(gl);
    if (!program) {
      markFallback(stageFromDom());
      return;
    }

    attributes = {
      position: gl.getAttribLocation(program, 'a_position'),
      normal: gl.getAttribLocation(program, 'a_normal'),
      color: gl.getAttribLocation(program, 'a_color')
    };
    uniforms = {
      viewProjection: gl.getUniformLocation(program, 'u_viewProjection'),
      sunDirection: gl.getUniformLocation(program, 'u_sunDirection'),
      fogColor: gl.getUniformLocation(program, 'u_fogColor'),
      cameraPosition: gl.getUniformLocation(program, 'u_cameraPosition'),
      fogNear: gl.getUniformLocation(program, 'u_fogNear'),
      fogFar: gl.getUniformLocation(program, 'u_fogFar')
    };
    buffers = {
      positions: gl.createBuffer(),
      normals: gl.createBuffer(),
      colors: gl.createBuffer()
    };

    if (!buffers.positions || !buffers.normals || !buffers.colors) {
      markFallback(stageFromDom());
      return;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    render();
  }

  const stageObserver = new MutationObserver(() => render(stageFromDom()));
  stageObserver.observe(sceneRoot, { attributes: true, attributeFilter: ['data-wood-stage'] });

  const themeObserver = new MutationObserver(() => render(stageFromDom()));
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.addEventListener('resize', () => render(stageFromDom()));
  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => render(stageFromDom()));
    resizeObserver.observe(sceneRoot);
  }

  initialise();
}());
