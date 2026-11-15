/* Original user-supplied SVG artwork, prepared as transparent, aligned frames. */
(() => {
  'use strict';
  class AstronautSprites {
    constructor(assetPath = 'assets/astronaut/frames') {
      this.assetPath = assetPath;
      this.frames = { down: [], left: [], right: [], up: [] };
      this.idle = null;
      this.ready = null;
    }
    load() {
      if (this.ready) return this.ready;
      const load = name => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load character frame ${name}. Check ${this.assetPath}, then reload.`));
        image.src = `${this.assetPath}/${name}.svg`;
      });
      const jobs = [];
      for (const direction of Object.keys(this.frames)) {
        for (let i = 0; i < 4; i++) jobs.push(load(`${direction}-${i}`).then(image => { this.frames[direction][i] = image; }));
      }
      jobs.push(load('idle').then(image => { this.idle = image; }));
      this.ready = Promise.all(jobs);
      return this.ready;
    }
    imageFor(direction, step) {
      if (direction === 'down' && step < 0) return this.idle;
      return this.frames[direction]?.[step < 0 ? 0 : step % 4];
    }
    draw(ctx, direction, step, x, y) {
      const image = this.imageFor(direction, step);
      if (image) ctx.drawImage(image, Math.round(x - 50), Math.round(y - 125), 100, 125);
    }
  }
  window.AstronautSprites = AstronautSprites;
})();
