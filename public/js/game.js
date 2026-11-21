import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

export class Game {
  constructor({ socket, getPlayers, getSelfId, practice = false, onPracticeScore = () => {} }) {
    this.socket = socket; this.getPlayers = getPlayers; this.getSelfId = getSelfId;
    this.practice = practice; this.onPracticeScore = onPracticeScore; this.practiceScore = 0; this.practiceTargets = [];
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x101d35); this.scene.fog = new THREE.Fog(0x101d35, 34, 92);
    this.camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, .1, 120);
    this.camera.rotation.order = "YXZ";
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.18;
    document.getElementById("scene").appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock(); this.keys = {}; this.yaw = 0; this.pitch = 0; this.velocityY = 0; this.onGround = true;
    this.remote = new Map(); this.animated = []; this.lastMove = 0; this.lastTag = 0; this.started = false;
    this.player = { x: 0, y: 1, z: 8 };
    this.buildWorld(); this.bindControls();
    this.resize = () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); };
    addEventListener("resize", this.resize);
  }
  mat(color, roughness=.85) { return new THREE.MeshStandardMaterial({ color, roughness }); }
  box(x,y,z,w,h,d,material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); return m;
  }
  buildWorld() {
    const hemi = new THREE.HemisphereLight(0xc8eaff, 0x17233c, 1.9); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xe4f5ff, 2.6);
    sun.position.set(-12, 24, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -24; sun.shadow.camera.right = 24; sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
    this.scene.add(sun);
    const cyanGlow = new THREE.PointLight(0x27cfff, 32, 34, 2); cyanGlow.position.set(-11, 5, -7); this.scene.add(cyanGlow);
    const amberGlow = new THREE.PointLight(0xff9d55, 26, 30, 2); amberGlow.position.set(12, 4, 9); this.scene.add(amberGlow);

    const floorMat = new THREE.MeshStandardMaterial({color:0x17263d,roughness:.72,metalness:.22});
    this.box(0,-.4,0,42,.8,42,floorMat);
    const grid = new THREE.GridHelper(42,42,0x36c8ed,0x29445f); grid.position.y=.012;
    grid.material.opacity=.34; grid.material.transparent=true; this.scene.add(grid);
    const wall = this.mat(0x263c59,.72), trim = new THREE.MeshStandardMaterial({color:0x38cfff,emissive:0x087da8,emissiveIntensity:1.1,metalness:.55,roughness:.3});
    const orangeTrim = new THREE.MeshStandardMaterial({color:0xffad68,emissive:0x9d4219,emissiveIntensity:.9,metalness:.45,roughness:.35});
    const cyan = this.mat(0x267b9b,.45), orange = this.mat(0x9b593c,.48), purple = this.mat(0x514b85,.42);
    this.box(0,2,-20,42,4,.9,wall); this.box(0,2,20,42,4,.9,wall);
    this.box(-20,2,0,.9,4,42,wall); this.box(20,2,0,.9,4,42,wall);
    // Glowing perimeter rails
    this.box(0,3.86,-19.48,39,.08,.08,trim); this.box(0,3.86,19.48,39,.08,.08,orangeTrim);
    this.box(-19.48,3.86,0,.08,.08,39,trim); this.box(19.48,3.86,0,.08,.08,39,orangeTrim);

    // Arena cover and raised-looking architectural blocks
    this.box(-8,1.05,-5,5.2,2.1,2.3,cyan); this.box(8,1.05,5,5.2,2.1,2.3,orange);
    this.box(0,.9,0,3.4,1.8,3.4,purple); this.box(-12,.72,8,3.2,1.44,3.2,wall); this.box(12,.72,-8,3.2,1.44,3.2,wall);
    this.box(-8,2.15,-5,5.35,.1,2.42,trim); this.box(8,2.15,5,5.35,.1,2.42,orangeTrim);
    this.box(0,1.86,0,3.55,.1,3.55,trim);

    // Four signature pylons with animated energy rings
    for(let i=0;i<4;i++){
      const x=i%2?-15:15, z=i<2?-15:15, color=i%2?0xffad68:0x39d9ff;
      const core=new THREE.Mesh(new THREE.CylinderGeometry(.42,.62,4.8,8),this.mat(0x263b56,.38));
      core.position.set(x,2.4,z); core.castShadow=true; this.scene.add(core);
      const band=new THREE.Mesh(new THREE.TorusGeometry(.78,.09,8,28),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.35,metalness:.4,roughness:.25}));
      band.position.set(x,2.5,z); band.rotation.x=Math.PI/2; this.scene.add(band); this.animated.push({mesh:band,spin:.65});
      const cap=new THREE.Mesh(new THREE.ConeGeometry(.62,.9,8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.55}));
      cap.position.set(x,5.1,z); this.scene.add(cap);
    }
    // Smaller cover pillars and glowing floor markers
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6, x=Math.cos(a)*15.5, z=Math.sin(a)*15.5;
      this.box(x,.75,z,1.5,1.5,1.5,this.mat(i%2?0x315c78:0x4b5276,.58));
      const marker=new THREE.Mesh(new THREE.BoxGeometry(.12,.04,1.05),i%2?trim:orangeTrim);
      marker.position.set(x,.78,z); marker.rotation.y=-a; this.scene.add(marker);
    }
    // Floating rings give the arena depth without obscuring movement
    for(let i=0;i<3;i++){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(3.4+i*.65,.055,8,64),i===1?orangeTrim:trim);
      ring.position.set(i===1?0:-13,5.8+i*.55,i===1?0:13); ring.rotation.x=Math.PI/2.5; this.scene.add(ring);
      this.animated.push({mesh:ring,spin:i%2?.18:-.14});
    }
    // Distant star field
    const points=[];
    for(let i=0;i<260;i++){const a=Math.random()*Math.PI*2,r=35+Math.random()*38;points.push(Math.cos(a)*r,8+Math.random()*30,Math.sin(a)*r);}
    const starGeo=new THREE.BufferGeometry(); starGeo.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
    const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9ddfff,size:.16,transparent:true,opacity:.65}));
    this.scene.add(stars);
    const sky=new THREE.Mesh(new THREE.SphereGeometry(100,24,16),new THREE.MeshBasicMaterial({color:0x101d35,side:THREE.BackSide})); this.scene.add(sky);
    if(this.practice)this.buildPracticeTargets();
    this.camera.position.set(0,1.7,8); this.scene.add(this.camera);
  }
  buildPracticeTargets() {
    const spots = [[-9,0,-9],[9,0,-9],[-9,0,9],[9,0,9],[0,0,-13],[0,0,13]];
    spots.forEach((pos,i) => {
      const group = new THREE.Group();
      const color = i%2 ? 0xffb45e : 0x52dfff;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.65,.8,.25,12),this.mat(0x263d55));
      base.position.y=.12; group.add(base);
      const core = new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.65,roughness:.35}));
      core.position.y=1.25; group.add(core);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.78,.07,8,24),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.8}));
      ring.rotation.x=Math.PI/2; ring.position.y=.3; group.add(ring);
      group.position.set(pos[0],0,pos[2]); this.scene.add(group);
      this.practiceTargets.push({group,x:pos[0],z:pos[2],active:true});
    });
  }
  bindControls() {
    addEventListener("keydown", e => {
      this.keys[e.code]=true;
      if(["Space","ArrowUp","ArrowDown"].includes(e.code)) e.preventDefault();
      if(e.code==="KeyE" && !e.repeat) this.tag();
    });
    addEventListener("keyup", e => this.keys[e.code]=false);
    this.renderer.domElement.addEventListener("click", () => { if (!this.isMobile()) this.renderer.domElement.requestPointerLock?.(); });
    addEventListener("mousemove", e => { if (document.pointerLockElement===this.renderer.domElement) this.look(e.movementX,e.movementY); });
    addEventListener("contextmenu", e => e.preventDefault());
    document.getElementById("tag-btn").addEventListener("touchstart", e=>{e.preventDefault();this.tag();},{passive:false});
    document.getElementById("jump-btn").addEventListener("touchstart", e=>{e.preventDefault();this.jump();},{passive:false});
    const joy=document.getElementById("joystick"), knob=joy.querySelector(".joy-knob"); let joyId=null;
    joy.addEventListener("pointerdown",e=>{joyId=e.pointerId;joy.setPointerCapture(joyId);this.joy={x:0,y:0};this.updateJoy(e,joy,knob);});
    joy.addEventListener("pointermove",e=>{if(e.pointerId===joyId)this.updateJoy(e,joy,knob);});
    const endJoy=()=>{joyId=null;this.joy={x:0,y:0};knob.style.transform="translate(0,0)";};
    joy.addEventListener("pointerup",endJoy);joy.addEventListener("pointercancel",endJoy);
    const look=document.getElementById("look-pad");let lookPoint=null;
    look.addEventListener("pointerdown",e=>{lookPoint={x:e.clientX,y:e.clientY};look.setPointerCapture(e.pointerId);});
    look.addEventListener("pointermove",e=>{if(!lookPoint)return;this.look((lookPoint.x-e.clientX)*-.75,(lookPoint.y-e.clientY)*-.75);lookPoint={x:e.clientX,y:e.clientY};});
    look.addEventListener("pointerup",()=>lookPoint=null);look.addEventListener("pointercancel",()=>lookPoint=null);
    this.joy={x:0,y:0};
  }
  isMobile(){return matchMedia("(pointer:coarse)").matches || innerWidth<800;}
  updateJoy(e,joy,knob){const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),m=Math.max(1,Math.hypot(dx,dy)),scale=Math.min(1,42/m);this.joy={x:dx/m*scale,y:dy/m*scale};knob.style.transform=`translate(${this.joy.x*42}px,${this.joy.y*42}px)`;}
  look(dx,dy){this.yaw-=dx*.0022;this.pitch-=dy*.0022;this.pitch=Math.max(-1.25,Math.min(1.25,this.pitch));}
  jump(){if(this.onGround){this.velocityY=6.2;this.onGround=false;}}
  tag(){
    const now=performance.now(); if(now-this.lastTag<500)return; this.lastTag=now;
    if (!this.practice) { this.socket.emit("tag"); return; }
    let target=null, nearest=2.9;
    for (const item of this.practiceTargets) {
      if (!item.active) continue;
      const d=Math.hypot(item.x-this.player.x,item.z-this.player.z);
      if(d<nearest){nearest=d;target=item;}
    }
    if (!target) { this.showPracticeToast("Move closer to a glowing target!"); return; }
    target.active=false; target.group.visible=false; this.practiceScore++;
    this.onPracticeScore(this.practiceScore);
    this.showPracticeToast("Target tagged! Score: "+this.practiceScore);
    setTimeout(()=>{target.active=true;target.group.visible=true;},1800);
  }
  showPracticeToast(message) {
    const el=document.getElementById("toast"); if(!el)return;
    el.textContent=message;el.classList.add("show");clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(()=>el.classList.remove("show"),1600);
  }
  dispose(){this.started=false;removeEventListener("resize",this.resize);this.renderer.dispose();this.renderer.domElement.remove();}
  setSelfPosition(p){if(!p)return;this.player.x=p.x;this.player.y=p.y;this.player.z=p.z;}
  start(){if(this.started)return;this.started=true;this.animate();}
  syncPlayers(){
    const list=this.getPlayers(),self=this.getSelfId();
    for(const [id,obj] of this.remote){if(!list.has(id)){this.scene.remove(obj.group);this.remote.delete(id);}}
    for(const p of list.values()){if(p.id===self)continue;let obj=this.remote.get(p.id);if(!obj){const group=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.15,.42),this.mat(p.color));body.position.y=.95;body.castShadow=true;const head=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42),this.mat(0xe3c5a5));head.position.y=1.75;group.add(body,head);const ring=new THREE.Mesh(new THREE.TorusGeometry(.52,.045,6,20),this.mat(p.color));ring.rotation.x=Math.PI/2;ring.position.y=.12;group.add(ring);this.scene.add(group);obj={group};this.remote.set(p.id,obj);}obj.group.position.set(p.x,0,p.z);obj.group.rotation.y=p.yaw||0;}
  }
  animate=()=>{if(!this.started)return;requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.04);this.update(dt);for(const item of this.animated)item.mesh.rotation.y+=item.spin*dt;this.renderer.render(this.scene,this.camera);};
  update(dt){
    const forward=(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0)-this.joy.y;
    const side=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0)+this.joy.x;
    const speed=7*dt, sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);
    this.player.x+=(side*cos-forward*sin)*speed;this.player.z+=(-forward*cos-side*sin)*speed;
    this.player.x=THREE.MathUtils.clamp(this.player.x,-17,17);this.player.z=THREE.MathUtils.clamp(this.player.z,-17,17);
    if(this.keys.Space){this.jump();this.keys.Space=false;}
    this.velocityY-=17*dt;this.player.y+=this.velocityY*dt;if(this.player.y<=1){this.player.y=1;this.velocityY=0;this.onGround=true;}
    this.camera.position.set(this.player.x,this.player.y+.68,this.player.z);this.camera.rotation.set(this.pitch,this.yaw,0);
    const now=performance.now();if(!this.practice && now-this.lastMove>50){this.lastMove=now;this.socket.emit("move",{...this.player,yaw:this.yaw,pitch:this.pitch});}
  }
}
