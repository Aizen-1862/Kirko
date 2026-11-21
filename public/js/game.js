import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

export class Game {
  constructor({ socket, getPlayers, getSelfId, practice = false, onPracticeScore = () => {} }) {
    this.socket = socket; this.getPlayers = getPlayers; this.getSelfId = getSelfId;
    this.practice = practice; this.onPracticeScore = onPracticeScore; this.practiceScore = 0; this.practiceTargets = [];
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x91b9d0); this.scene.fog = new THREE.Fog(0x91b9d0, 28, 75);
    this.camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, .1, 120);
    this.camera.rotation.order = "YXZ";
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById("scene").appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock(); this.keys = {}; this.yaw = 0; this.pitch = 0; this.velocityY = 0; this.onGround = true;
    this.remote = new Map(); this.lastMove = 0; this.lastTag = 0; this.started = false;
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
    this.scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x42536d, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-10,22,12); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); this.scene.add(sun);
    this.box(0,-.35,0,38,.7,38,this.mat(0x25374b));
    const grid = new THREE.GridHelper(38,38,0x4f829b,0x3b566c); grid.position.y=.012; this.scene.add(grid);
    const wall = this.mat(0x354e68), cyan = this.mat(0x2bb8d2), orange = this.mat(0xe58b55), purple = this.mat(0x7762b0);
    this.box(0,2,-19,38,4,.8,wall); this.box(0,2,19,38,4,.8,wall); this.box(-19,2,0,.8,4,38,wall); this.box(19,2,0,.8,4,38,wall);
    this.box(-8,1.1,-5,5,2,2,cyan); this.box(8,1.1,5,5,2,2,orange);
    this.box(0,.8,0,3,1.6,3,purple); this.box(-12,.7,8,3,1.4,3,wall); this.box(12,.7,-8,3,1.4,3,wall);
    for (let i=0;i<12;i++) {
      const a=i*Math.PI/6, x=Math.cos(a)*15, z=Math.sin(a)*15;
      this.box(x,.7,z,1.5,1.4,1.5,this.mat(i%2?0x3b718b:0x59647e));
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(.35,2,.35), this.mat(i%2?0x4de1ff:0xffb45e));
      beacon.position.set(x,2.5,z); this.scene.add(beacon);
    }
    const sky = new THREE.Mesh(new THREE.SphereGeometry(70,24,16), new THREE.MeshBasicMaterial({color:0x91b9d0,side:THREE.BackSide})); this.scene.add(sky);
    if (this.practice) this.buildPracticeTargets();
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
  animate=()=>{if(!this.started)return;requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.04);this.update(dt);this.renderer.render(this.scene,this.camera);};
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
