/* A streaming terrain renderer. The original art supplies the outpost sprites;
   deterministic terrain chunks continue in every direction beyond the base. */
(() => {
  'use strict';
  const C = window.NOVACore;
  class MarsWorld {
    constructor(image) {
      this.image = image;
      this.tiles = new Map();
      this.stamps = [];
      const stamp = (x, y, w, h, points) => {
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.translate(-x, -y); ctx.imageSmoothingEnabled = false;
        ctx.beginPath();
        if (points) { points.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); }
        else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.clip(); ctx.drawImage(image, 0, 0, C.W, C.H);
        const result = { image: canvas, x, y, w, h }; this.stamps.push(result); return result;
      };
      stamp(115, 80, 315, 280, [[119,310],[128,275],[167,246],[200,241],[204,206],[214,191],[215,145],[228,116],[247,94],[269,82],[287,83],[309,99],[319,122],[325,152],[326,197],[337,201],[341,229],[360,240],[390,253],[412,276],[426,311],[421,340],[396,355],[150,355],[128,341]]);
      stamp(526, 91, 348, 242, [[532,294],[530,275],[544,253],[549,194],[570,156],[598,127],[638,106],[679,94],[724,93],[766,106],[803,132],[830,169],[846,207],[848,246],[864,266],[873,298],[847,309],[775,318],[773,332],[664,332],[663,318],[593,312],[554,304]]);
      stamp(955, 12, 363, 310, [[955,193],[956,163],[971,150],[1000,148],[1003,128],[1037,104],[1088,102],[1084,97],[1066,92],[1063,71],[1074,48],[1080,25],[1091,20],[1098,36],[1124,20],[1153,14],[1169,20],[1173,48],[1162,72],[1151,94],[1155,101],[1229,102],[1268,119],[1289,145],[1299,175],[1300,254],[1315,289],[1307,309],[1230,319],[1090,320],[1000,310],[969,299],[955,276]]);
      stamp(35, 408, 210, 111, [[36,420],[119,410],[129,418],[133,408],[209,408],[220,420],[242,479],[238,491],[218,494],[214,513],[204,516],[196,495],[137,501],[117,495],[90,498],[86,514],[74,516],[68,500],[43,504],[40,491],[45,481]]);
      stamp(110, 493, 197, 117, [[113,501],[269,493],[283,503],[303,554],[300,570],[282,575],[281,604],[267,607],[264,577],[172,586],[169,609],[153,610],[153,582],[123,582],[118,570],[120,547],[110,515]]);
      stamp(292, 461, 76, 55); stamp(310, 512, 73, 53); stamp(306, 563, 76, 64); stamp(67, 528, 67, 55);
      stamp(1335, 318, 175, 129, [[1336,367],[1349,353],[1395,353],[1410,338],[1450,334],[1462,341],[1465,353],[1472,352],[1476,327],[1482,320],[1490,322],[1493,332],[1483,359],[1488,375],[1488,393],[1505,399],[1506,423],[1496,433],[1480,433],[1470,416],[1449,423],[1444,441],[1419,446],[1407,439],[1405,426],[1375,422],[1368,435],[1343,433],[1338,416],[1343,401],[1356,395],[1355,381]]);
      this.ice = stamp(1270, 459, 230, 124, [[1274,565],[1285,550],[1304,554],[1310,531],[1327,522],[1339,526],[1346,509],[1364,505],[1373,514],[1375,490],[1401,473],[1406,461],[1418,466],[1424,483],[1442,494],[1444,530],[1457,532],[1469,548],[1487,552],[1498,566],[1484,580],[1336,581],[1319,573],[1282,578]]);
      stamp(1097, 455, 121, 150, [[1098,603],[1098,587],[1106,583],[1107,463],[1114,455],[1121,458],[1123,466],[1161,466],[1192,473],[1212,469],[1216,476],[1215,533],[1204,539],[1176,535],[1159,530],[1122,531],[1122,583],[1136,587],[1137,601]]);
      this.crater = stamp(1102, 616, 402, 177);
      this.rock = stamp(365, 638, 213, 112, [[367,733],[375,708],[394,701],[401,678],[415,665],[435,659],[441,645],[464,639],[486,641],[506,653],[517,669],[536,676],[547,693],[562,701],[573,723],[577,741],[540,749],[407,748]]);
      this.smallRock = stamp(883, 638, 106, 52);
      stamp(968, 510, 109, 68); stamp(540, 351, 102, 72); stamp(795, 317, 112, 57); stamp(801, 765, 142, 76);
      const owners = ['rocket','greenhouse','habitat','solar','solar','solar','solar','solar','solar','rover','crystals','flag'];
      this.sites = this.stamps.slice(0,owners.length).map((sprite,i) => {
        const station = C.stations.find(s => s.id === owners[i]);
        return { ...sprite, x: sprite.x + station.dx, y: sprite.y + station.dy };
      });
      const depot=document.createElement('canvas');depot.width=380;depot.height=350;
      const p=depot.getContext('2d');p.imageSmoothingEnabled=false;
      const r=(x,y,w,h,color)=>{p.fillStyle=color;p.fillRect(x,y,w,h);};
      r(34,92,281,240,'#593b38');r(26,89,274,231,'#c6b4a0');r(34,99,258,207,'#f0d9b7');
      r(49,78,232,15,'#392f35');r(42,91,244,9,'#687779');r(38,103,252,10,'#fff0cc');
      for(let x=41;x<291;x+=48){r(x,114,3,184,'#d1b69b');r(x+3,115,4,179,'#ecd2b2');}
      r(31,286,266,15,'#e0a056');r(38,302,254,10,'#998d81');r(50,313,234,8,'#3d3b3b');
      r(83,119,162,57,'#324c51');r(90,125,148,43,'#203b45');p.textAlign='center';p.font='bold 12px Consolas,monospace';p.fillStyle='#efdfae';p.fillText('NOVA SUPPLY DEPOT',164,142);p.font='8px Consolas,monospace';p.fillStyle='#9dcfc1';p.fillText('FOOD  /  WATER',164,158);
      r(136,213,76,99,'#4a4040');r(143,220,62,87,'#638b92');r(149,226,50,79,'#274e5d');r(155,231,38,69,'#77c5d0');r(172,232,4,68,'#a7e7dc');r(132,312,85,8,'#e3b980');
      for(let x=50;x<117;x+=35){r(x,196,28,32,'#394b55');r(x+4,200,20,23,'#6ea5ba');r(x+5,201,17,4,'#abd1ce');}
      r(237,197,36,34,'#394b55');r(243,202,24,22,'#7ca7b3');
      r(296,154,52,143,'#3a4b56');r(302,141,40,159,'#6aa9bd');r(308,140,28,8,'#bedbd0');r(309,151,7,132,'#a3d3d7');r(301,171,41,9,'#3e687e');r(301,260,41,8,'#3e687e');r(313,199,18,25,'#d6e2d0');r(317,203,10,15,'#6aa9bd');r(345,249,14,8,'#384d5c');r(353,252,6,39,'#7b8a84');
      for(const [x,y]of[[14,267],[52,280],[252,270]]){r(x,y,40,39,'#583a35');r(x+3,y+3,34,30,'#db9e5b');r(x+7,y+6,26,22,'#b87942');r(x+18,y+3,5,30,'#efcd8e');r(x+4,y+30,32,5,'#8d5d3c');}
      r(87,57,148,24,'#223e52');for(let x=92;x<231;x+=26){r(x,61,21,14,'#407f9b');r(x+2,63,15,2,'#9bc7d1');}r(120,49,80,8,'#a9bcb6');
      this.sites.push({image:depot,x:3320,y:3060,w:380,h:350});
    }
    tile(cx, cy) {
      const key = `${cx},${cy}`;
      if (this.tiles.has(key)) return this.tiles.get(key);
      const tile = document.createElement('canvas'); tile.width = 256; tile.height = 256;
      const p = tile.getContext('2d');
      let seed = Math.floor(C.randomFor(cx, cy, 70) * 4294967295);
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      p.fillStyle = '#df6b37'; p.fillRect(0, 0, 256, 256);
      const colors = ['#e77139','#e9753b','#d96134','#d56535','#ed7b3e','#f18543','#cf6034'];
      for (let i = 0; i < 100; i++) {
        const x = Math.floor(random() * 256), y = Math.floor(random() * 256), w = 5 + Math.floor(random() * 22), h = 2 + Math.floor(random() * 5);
        p.globalAlpha = .27; p.fillStyle = colors[Math.floor(random() * colors.length)];
        p.fillRect(x, y, w, h); p.fillRect(x + 4, y - 2, w - 6, 2);
      }
      p.globalAlpha = .7;
      for (let i = 0; i < 1600; i++) {
        const x = Math.floor(random() * 256), y = Math.floor(random() * 256), w = 1 + Math.floor(random() * 4);
        p.fillStyle = colors[Math.floor(random() * colors.length)]; p.fillRect(x, y, w, 1 + Math.floor(random() * 2));
      }
      p.globalAlpha = 1;
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(random() * 256), y = Math.floor(random() * 256);
        p.fillStyle = '#bd5433'; p.fillRect(x, y, 3, 2); p.fillStyle = '#ef8b49'; p.fillRect(x, y - 1, 2, 1);
      }
      if (this.tiles.size >= 72) this.tiles.delete(this.tiles.keys().next().value);
      this.tiles.set(key, tile); return tile;
    }
    draw(ctx, bounds) {
      const left = Math.floor((bounds.x - 160) / C.CHUNK), right = Math.floor((bounds.x + bounds.w + 160) / C.CHUNK);
      const top = Math.floor((bounds.y - 160) / C.CHUNK), bottom = Math.floor((bounds.y + bounds.h + 160) / C.CHUNK);
      for (let cy = top; cy <= bottom; cy++) for (let cx = left; cx <= right; cx++) ctx.drawImage(this.tile(cx, cy), cx * C.CHUNK, cy * C.CHUNK, C.CHUNK, C.CHUNK);
      this.drawPaths(ctx,bounds);
      for (const s of this.sites) if (s.x+s.w >= bounds.x && s.x <= bounds.x+bounds.w && s.y+s.h >= bounds.y && s.y <= bounds.y+bounds.h) ctx.drawImage(s.image,s.x,s.y);
      for (let cy = top; cy <= bottom; cy++) for (let cx = left; cx <= right; cx++) {
        for (const o of C.getChunk(cx, cy).objects) {
          const sprite = o.type === 'crater' ? this.crater : o.type === 'ice' ? this.ice : o.variant === 1 ? this.smallRock : this.rock;
          const width = o.rx * 2.5, height = width * sprite.h / sprite.w;
          ctx.drawImage(sprite.image, Math.round(o.x - width / 2), Math.round(o.y - height * .62), Math.round(width), Math.round(height));
        }
      }
    }
    drawPaths(ctx,bounds) {
      ctx.lineJoin = 'bevel'; ctx.lineCap = 'butt';
      for (const points of C.roads) {
        if (Math.max(...points.map(p=>p.x)) < bounds.x-30 || Math.min(...points.map(p=>p.x)) > bounds.x+bounds.w+30 || Math.max(...points.map(p=>p.y)) < bounds.y-30 || Math.min(...points.map(p=>p.y)) > bounds.y+bounds.h+30) continue;
        ctx.beginPath(); points.forEach(({x, y}, i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.strokeStyle = '#d98150'; ctx.lineWidth = 45; ctx.stroke();
        ctx.strokeStyle = '#f6a776'; ctx.lineWidth = 37; ctx.stroke();
        ctx.strokeStyle = '#e89669'; ctx.lineWidth = 1;
        for (let i = 1; i < points.length; i++) {
          const {x:x1,y:y1} = points[i - 1], {x:x2,y:y2} = points[i], length = Math.hypot(x2 - x1, y2 - y1);
          for (let t = 25; t < length; t += 27) {
            const x = x1 + (x2 - x1) * t / length, y = y1 + (y2 - y1) * t / length;
            if (x < bounds.x-30 || x > bounds.x+bounds.w+30 || y < bounds.y-30 || y > bounds.y+bounds.h+30) continue;
            ctx.beginPath(); if (x1 === x2) { ctx.moveTo(x - 18, y); ctx.lineTo(x + 18, y); } else { ctx.moveTo(x, y - 18); ctx.lineTo(x, y + 18); } ctx.stroke();
          }
        }
      }
    }
  }
  window.MarsWorld = MarsWorld;
})();
