/* Renders the 12 chess pieces as real 3D meshes (three.js) once, and returns them as PNG sprites.
   Pieces are lathe solids (pawn, rook, bishop, queen, king) plus an extruded head (knight), lit with
   three lights. Style "smooth" = round, "poly" = 9 facets with flat shading.
   Usage: CTG3D.build("poly").then(map => ...) where map["P"] is the white pawn data URL, map["p"] the black one. */
(function(){
  const W = 256, H = 320, EL = 28 * Math.PI / 180;
  const BASE = [[0,0],[.35,0],[.385,.012],[.405,.035],[.40,.05],[.37,.075],[.33,.10],[.31,.13]];
  const PROF = {
    P: BASE.concat([[.21,.24],[.14,.36],[.13,.40],[.22,.43],[.22,.46],[.14,.49],[.17,.55],[.21,.62],[.21,.69],[.17,.75],[.09,.78],[0,.79]]),
    R: BASE.concat([[.24,.22],[.21,.50],[.22,.68],[.31,.72],[.31,.78],[.34,.80],[.34,.90],[0,.90]]),
    B: BASE.concat([[.22,.22],[.15,.42],[.14,.48],[.22,.51],[.22,.54],[.14,.57],[.16,.66],[.20,.80],[.19,.92],[.13,1.03],[.05,1.08],[0,1.09]]),
    Q: BASE.concat([[.24,.22],[.17,.45],[.16,.55],[.25,.59],[.25,.63],[.16,.66],[.18,.78],[.24,.95],[.30,1.06],[.32,1.10],[.28,1.14],[0,1.14]]),
    K: BASE.concat([[.24,.22],[.17,.45],[.16,.58],[.25,.62],[.25,.66],[.16,.69],[.19,.85],[.25,1.02],[.27,1.14],[.20,1.19],[.10,1.20],[0,1.20]]),
    N: [[0,0],[.40,0],[.41,.04],[.38,.07],[.33,.10],[.31,.13],[.30,.16],[0,.16]]
  };
  const HORSE = [[.27,.16],[.26,.38],[.2,.58],[.18,.76],[.12,.9],[.08,1.0],[0,.93],[-.08,.88],[-.2,.8],[-.34,.66],[-.36,.58],[-.28,.54],[-.2,.6],[-.14,.62],[-.08,.5],[-.14,.36],[-.27,.16]];

  function loadScript(src){
    return new Promise((res, rej) => {
      if (window.THREE) return res();
      const s = document.createElement("script"); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("three.js failed to load"));
      document.head.appendChild(s);
    });
  }

  function build(style, base){
    return loadScript((base || "js/") + "three.min.js").then(() => {
      const T = window.THREE, poly = style === "poly", toy = style === "toy", seg = poly ? 9 : 44;
      const cw = toy ? 360 : W, ch = toy ? 396 : H, el = toy ? 30 * Math.PI / 180 : EL;
      const canvas = document.createElement("canvas"); canvas.width = cw; canvas.height = ch;
      const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:true, preserveDrawingBuffer:true});
      renderer.setSize(cw, ch, false); renderer.setClearColor(0x000000, 0);
      const cam = toy ? new T.OrthographicCamera(-1, 1, 1.8, -.4, .1, 20) : new T.OrthographicCamera(-.64, .64, 1.41, -.19, .1, 20);
      cam.position.set(0, 5 * Math.sin(el), 5 * Math.cos(el)); cam.lookAt(0, 0, 0);
      const scene = new T.Scene();
      let key, gnd;
      if (toy){
        scene.add(new T.HemisphereLight(0xffffff, 0xa89878, .66));
        key = new T.DirectionalLight(0xfff2dc, .85); key.position.set(-2.2, 4.2, 1.8);
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5; key.shadow.bias = -.0006; key.shadow.normalBias = .02;
        const sc = key.shadow.camera; sc.left = -2; sc.right = 2; sc.top = 2; sc.bottom = -2; sc.near = .5; sc.far = 12;
        scene.add(key);
        gnd = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({opacity:.3})); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);
        const fl = new T.DirectionalLight(0xbfd4ff, .22); fl.position.set(3, 1, 3); scene.add(fl);
      } else {
        scene.add(new T.AmbientLight(0xffffff, poly ? .36 : .34));
        key = new T.DirectionalLight(0xfff4e0, poly ? .78 : .74); key.position.set(-2, 4, 3); scene.add(key);
        const fill = new T.DirectionalLight(0x9fb8ff, .35); fill.position.set(3, 1, 2); scene.add(fill);
        const rim = new T.DirectionalLight(0xffe2b0, .45); rim.position.set(1, 2, -3); scene.add(rim);
      }

      const mats = toy ? {
        w: new T.MeshStandardMaterial({color:0xeadcc3, roughness:.8, metalness:0}),
        b: new T.MeshStandardMaterial({color:0x242c3b, roughness:.7, metalness:.05}),
        gold: new T.MeshStandardMaterial({color:0xe2b350, roughness:.45, metalness:.35}),
        blue: new T.MeshStandardMaterial({color:0x5aa8ea, roughness:.45, metalness:.2}),
        dark: new T.MeshStandardMaterial({color:0x10151f, roughness:.6}),
        felt: new T.MeshStandardMaterial({color:0x6b5a46, roughness:.95})
      } : {
        w: new T.MeshPhongMaterial({color:0xd6c49a, shininess:poly ? 12 : 40, specular:0x2c2820, flatShading:poly}),
        b: new T.MeshPhongMaterial({color:0x1a2e4f, shininess:poly ? 16 : 45, specular:0x34507a, flatShading:poly}),
        gold: new T.MeshPhongMaterial({color:0xd9a93f, shininess:90, specular:0xffe9a8, flatShading:poly}),
        dark: new T.MeshPhongMaterial({color:0x10151f, shininess:10})
      };
      const out = {}, geos = [];
      const mk = (g, m) => { geos.push(g); return new T.Mesh(g, m); };
      const lathe = (pts, m) => { const me = mk(new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg), m); me.rotation.y = Math.PI / seg; return me; };

      function piece(kind, colour){
        const g = new T.Group(), body = mats[colour], acc = toy ? (colour === "w" ? mats.gold : mats.blue) : mats.gold;
        g.add(lathe(PROF[kind], body));
        const ring = mk(new T.TorusGeometry(.335, toy ? .036 : .022, 10, seg), acc); ring.rotation.x = Math.PI / 2; ring.position.y = .105; g.add(ring);
        if (toy){ const nr = {P:[.45,.225],R:[.76,.315],B:[.52,.225],Q:[.61,.255],K:[.64,.255]}[kind]; if (nr){ const n2 = mk(new T.TorusGeometry(nr[1], .03, 10, seg), acc); n2.rotation.x = Math.PI / 2; n2.position.y = nr[0]; g.add(n2); } }
        if (kind === "R"){
          for (let i = 0; i < 4; i++){
            const a = i * Math.PI / 2 + Math.PI / 4, m = mk(new T.BoxGeometry(.15, .13, .15), body);
            m.position.set(Math.cos(a) * .24, .96, Math.sin(a) * .24); m.rotation.y = -a; g.add(m);
          }
        } else if (kind === "B"){
          const ball = mk(new T.SphereGeometry(.075, poly ? 7 : 20, poly ? 5 : 14), body); ball.position.y = 1.14; g.add(ball);
          const slit = mk(new T.BoxGeometry(.03, .26, .30), mats.dark); slit.position.set(.06, .93, .02); slit.rotation.z = -.5; slit.scale.set(1, 1, .7); g.add(slit);
        } else if (kind === "Q"){
          for (let i = 0; i < 8; i++){
            const a = i * Math.PI / 4, sp = mk(new T.ConeGeometry(.045, .2, 6), body);
            sp.position.set(Math.cos(a) * .25, 1.2, Math.sin(a) * .25); g.add(sp);
            const bl = mk(new T.SphereGeometry(.04, 8, 6), acc); bl.position.set(Math.cos(a) * .25, 1.32, Math.sin(a) * .25); g.add(bl);
          }
          const top = mk(new T.SphereGeometry(.07, 10, 8), acc); top.position.y = 1.2; g.add(top);
        } else if (kind === "K"){
          const v = mk(new T.BoxGeometry(.075, .32, .075), acc); v.position.y = 1.36; g.add(v);
          const h = mk(new T.BoxGeometry(.24, .075, .075), acc); h.position.y = 1.43; g.add(h);
        } else if (kind === "N"){
          const sh = new T.Shape(); HORSE.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
          const eg = new T.ExtrudeGeometry(sh, {depth:.2, bevelEnabled:true, bevelSize:.04, bevelThickness:.05, bevelSegments:poly ? 1 : 3, curveSegments:poly ? 3 : 10});
          eg.translate(0, 0, -.1);
          const head = mk(eg, body); g.add(head);
          [-1, 1].forEach(sd => { const ey = mk(new T.SphereGeometry(.03, 8, 6), mats.dark); ey.position.set(-.17, .78, sd * .125); g.add(ey); });
          g.rotation.y = colour === "w" ? .45 : Math.PI - .45;
        }
        if (toy){
          g.scale.set(1.04, 1.16, 1.04); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        }
        return g;
      }

      "PRNBQK".split("").forEach(k => ["w", "b"].forEach(c => {
        const p = piece(k, c); scene.add(p); renderer.render(scene, cam);
        const id = c === "w" ? k : k.toLowerCase();
        out[id] = canvas.toDataURL("image/png");
        if (toy){ gnd.visible = false; renderer.render(scene, cam); out["~" + id] = canvas.toDataURL("image/png"); gnd.visible = true; }
        scene.remove(p);
      }));
      geos.forEach(g => g.dispose()); renderer.dispose();
      out.__box = toy ? [-22.5, -60, 145, 159.5] : [0, -25, 100, 125];
      return out;
    });
  }
  window.CTG3D = {build, W, H};
})();
