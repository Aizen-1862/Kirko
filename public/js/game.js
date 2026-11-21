import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

export class Game {
  constructor({ socket, getPlayers, getSelfId }) {
    this.socket = socket; this.getPlayers = getPlayers; this.getSelfId = getSelfId;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x91b9d0); this.scene.fog = new THREE.Fog(0x91b9d0, 28, 75);
    this.camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, .1, 120);
    this.camera.rotation.order = "YXZ";
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById("scene").appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock(); this.keys = {}; this.yaw = 0; this.pitch = 0; this.velocityY = 0; this.onGround = true;
    this.remote = new Map(); this.orbs = []; this.lastMove = 0; this.lastFire = 0; this.started = false;
    this.player = { x: 0, y: 1, z: 8 };
    this.buildWorld(); this.bindControls(); this.resize = () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); };
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
    this.camera.position.set(0,1.7,8);
    this.weapon = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(.18,.2,.62), this.mat(0x18293a)); body.position.set(.34,-.28,-.58); this.weapon.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.42,8), this.mat(0x52dfff)); barrel.rotation.x=Math.PI/2; barrel.position.set(.34,-.24,-.98); this.weapon.add(barrel);
    this.camera.add(this.weapon); this.scene.add(this.camera);
  }
  bindControls() {
    addEventListener("keydown", e => { this.keys[e.code]=true; if(["Space","ArrowUp","ArrowDown"].includes(e.code)) e.preventDefault(); });
    addEventListener("keyup", e => this.keys[e.code]=false);
    this.renderer.domElement.addEventListener("click", () => { if (!this.isMobile()) this.renderer.domElement.requestPointerLock?.(); });
    addEventListener("mousemove", e => { if (document.pointerLockElement===this.renderer.domElement) this.look(e.movementX,e.movementY); });
    this.renderer.domElement.addEventListener("mousedown", e => { if(e.button===0 && document.pointerLockElement===this.renderer.domElement) this.fire(); });
    addEventListener("contextmenu", e => e.preventDefault());
    document.getElementById("fire-btn").addEventListener("touchstart", e=>{e.preventDefault();this.fire();},{passive:false});
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
  fire(){const now=performance.now();if(now-this.lastFire<280)return;this.lastFire=now;const direction=new THREE.Vector3(0,0,-1).applyEuler(this.camera.rotation).normalize();const origin=this.camera.position.clone();this.socket.emit("fire",{origin:{x:origin.x,y:origin.y,z:origin.z},direction:{x:direction.x,y:direction.y,z:direction.z}});}
  start(){if(this.started)return;this.started=true;this.animate();}
  syncPlayers(){
    const list=this.getPlayers(),self=this.getSelfId();
    for(const [id,obj] of this.remote){if(!list.has(id)){this.scene.remove(obj.group);this.remote.delete(id);}}
    for(const p of list.values()){if(p.id===self)continue;let obj=this.remote.get(p.id);if(!obj){const group=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.15,.42),this.mat(p.color));body.position.y=.95;body.castShadow=true;const head=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42),this.mat(0xe3c5a5));head.position.y=1.75;group.add(body,head);const ring=new THREE.Mesh(new THREE.TorusGeometry(.52,.045,6,20),this.mat(p.color));ring.rotation.x=Math.PI/2;ring.position.y=.12;group.add(ring);this.scene.add(group);obj={group};this.remote.set(p.id,obj);}obj.group.position.set(p.x,0,p.z);obj.group.rotation.y=p.yaw||0;}
  }
  addOrb(data){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.12,8,8),new THREE.MeshBasicMaterial({color:data.color}));mesh.position.set(data.origin.x,data.origin.y,data.origin.z);this.scene.add(mesh);const dir=new THREE.Vector3(data.direction.x,data.direction.y,data.direction.z).normalize();this.orbs.push({mesh,dir,life:1.2});}
  animate=()=>{if(!this.started)return;requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.04);this.update(dt);this.renderer.render(this.scene,this.camera);};
  update(dt){
    const forward=(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0)-this.joy.y;
    const side=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0)+this.joy.x;
    const speed=7*dt, sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);
    this.player.x+= (side*cos-forward*sin)*speed;this.player.z+=(-forward*cos-side*sin)*speed;
    this.player.x=THREE.MathUtils.clamp(this.player.x,-17,17);this.player.z=THREE.MathUtils.clamp(this.player.z,-17,17);
    if(this.keys.Space){this.jump();this.keys.Space=false;}
    this.velocityY-=17*dt;this.player.y+=this.velocityY*dt;if(this.player.y<=1){this.player.y=1;this.velocityY=0;this.onGround=true;}
    this.camera.position.set(this.player.x,this.player.y+.68,this.player.z);this.camera.rotation.set(this.pitch,this.yaw,0);
    const now=performance.now();if(now-this.lastMove>50){this.lastMove=now;this.socket.emit("move",{...this.player,yaw:this.yaw,pitch:this.pitch});}
    for(let i=this.orbs.length-1;i>=0;i--){const o=this.orbs[i];o.mesh.position.addScaledVector(o.dir,dt*24);o.life-=dt;if(o.life<=0){this.scene.remove(o.mesh);this.orbs.splice(i,1);}}
  }
}
