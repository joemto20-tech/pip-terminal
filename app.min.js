(function () {
  const APP_ID = "HAM";
  const CODE = "4769";
  const DATA_FILE = "HOLO/HAM/HAM_DATA.JSON";
  const STATE_FILE = "SETTINGS/HAM_STATE.JSON";
  const W = h.getWidth();
  const H = h.getHeight();
  const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-_/':\"()[]";

  let removed = false;
  let redrawInterval;
  let leftWheelPressWatch;
  let accelInterval;

  let screen = "lock";
  let menu = 0;
  let selected = 0;
  let scroll = 0;
  let page = 0;
  let code = [0,0,0,0];
  let codePos = 0;
  let denied = false;
  let loading = 0;
  let lastAccel = [0,0,0];

  let editText = "";
  let editCursor = 0;
  let editChar = 0;
  let editingExisting = -1;

  let data = {
    meta: { version: "1.4.0", notice: "Verify live ownership at nv-mp.com/radd/captures.", msg: "Everybody has a name." },
    briefing: ["Check Pip before patrol, interview, raid, faction meeting, or broadcast."],
    raddSummary: [],
    factionProfiles: [],
    broadcasts: ["Ask who they are, what land they claim, and what they want known."],
    reports: ["Faction dossiers loaded from HAM_DATA.JSON."],
    updates: ["For live ownership, consult nv-mp.com/radd/captures"],
    checklist: ["Check RADD captures page","Screenshot answers","Post answered questions"]
  };

  let state = { notes: ["FIRST FIELD NOTE"], done: {} };

  const MENUS = ["BRIEFING","RADD FEED","FACTIONS","BROADCAST","REPORTS","UPDATES","NOTES","CHECKLIST","EXIT"];

  function readJSON(path) {
    try { if (require("fs").statSync(path)) return JSON.parse(require("fs").readFileSync(path)); } catch(e) {}
    return null;
  }

  function writeJSON(path, value) {
    try { require("fs").writeFileSync(path, JSON.stringify(value)); } catch(e) {}
  }

  function loadData() {
    let d = readJSON(DATA_FILE);
    if (d) for (let k in d) data[k] = d[k];
    let s = readJSON(STATE_FILE);
    if (s) for (let k in s) state[k] = s[k];
    if (!state.notes || !state.notes.length) state.notes = ["FIRST FIELD NOTE"];
    if (!state.done) state.done = {};
  }

  function saveState() { writeJSON(STATE_FILE, state); }

  function play(name) { try { if (Pip.playSound) Pip.playSound(name || "TAB"); } catch(e) {} }

  function shade(x1,y1,x2,y2) {
    try { Pip.shadeBox(x1,y1,x2,y2); }
    catch(e) { h.setColor(1).fillRect(x1,y1,x2,y2); h.setColor(3).drawRect(x1,y1,x2,y2); }
  }

  function seal(x,y) {
    h.setColor(2).drawCircle(x,y,28).drawCircle(x,y,34);
    h.setColor(3).setFontMonofonto23().setFontAlign(0,0).drawString("HAM",x,y-3);
    h.setFontMonofonto14().setColor(2).drawString("NVMP",x,y+22);
  }

  function frame(title) {
    h.clear(1);
    h.setColor(3).drawRect(8,8,W-8,H-8);
    h.setColor(2).drawRect(12,12,W-12,H-12).drawLine(18,58,W-18,58);
    h.setColor(3).setFontMonofonto18().setFontAlign(0,0).drawString(title,W/2,24);
    h.setColor(2).setFontMonofonto14().drawString("HAMCo FIELD NETWORK v"+(data.meta.version||""),W/2,44);
  }

  function footer(text) {
    h.setColor(2).drawLine(18,H-36,W-18,H-36);
    h.setFontMonofonto14().setFontAlign(0,0).drawString(text || "LEFT NAV  RIGHT SECTION  PRESS OPEN", W/2, H-18);
  }

  function wrap(txt, width) {
    try { return h.wrapString(String(txt), width || (W-50)); }
    catch(e) {
      let out=[], words=String(txt).split(" "), line="";
      for (let i=0;i<words.length;i++) {
        if ((line+words[i]).length > 34) { out.push(line); line = words[i]+" "; }
        else line += words[i]+" ";
      }
      if (line) out.push(line);
      return out;
    }
  }

  function drawLock() {
    h.clear(1);
    seal(W/2,68);
    h.setColor(3).setFontMonofonto18().setFontAlign(0,0).drawString("HAMCo SECURITY TERMINAL",W/2,126);
    h.setColor(2).setFontMonofonto14().drawString("ENTER DISCORD ACCESS CODE",W/2,152);
    h.setFontMonofonto23();
    for (let i=0;i<4;i++) {
      let x = 174 + i*44;
      if (i === codePos) shade(x-17,181,x+17,221);
      h.setColor(i===codePos ? 3 : 2).drawString(""+code[i],x,202);
    }
    if (denied) {
      h.setColor(1).setFontMonofonto16().drawString("ACCESS DENIED",W/2,244);
      h.setColor(2).setFontMonofonto14().drawString("CHECK DISCORD // TRY AGAIN",W/2,266);
    } else {
      h.setColor(2).setFontMonofonto14().drawString("LEFT DIGIT  RIGHT SLOT  PRESS SUBMIT",W/2,246);
    }
    h.flip();
    Pip.lastFlip = getTime();
  }

  function drawLoading() {
    h.clear(1);
    seal(W/2,76);
    h.setColor(3).setFontMonofonto18().setFontAlign(0,0).drawString("ACCESS GRANTED",W/2,140);
    h.setColor(2).setFontMonofonto14().drawString("LOADING HAMCo DATABASE",W/2,168);
    h.setColor(3).drawRect(126,205,354,217);
    h.fillRect(129,208,129+Math.min(222,loading*22),214);
    h.setColor(2).drawString("NVMP // HAM",W/2,242);
    h.flip();
    Pip.lastFlip = getTime();
  }

  function drawMenu() {
    frame("HAM FIELD TERMINAL");
    seal(W/2,82);
    h.setColor(2).setFontMonofonto14().setFontAlign(0,0).drawString("HUMANS ACCEPTING MUTATION",W/2,124);
    h.setColor(3).drawString(data.meta.msg || "",W/2,144);
    for (let i=0;i<MENUS.length;i++) {
      let c=i%3, r=(i/3)|0, x=28+c*145, y=168+r*27, w=126, g=20;
      if (i===menu) shade(x-4,y-3,x+w+4,y+g+3);
      h.setColor(i===menu?3:2).drawRect(x,y,x+w,y+g);
      h.setFontMonofonto14().setFontAlign(0,0).drawString(MENUS[i],x+w/2,y+10);
    }
    h.setColor(2).drawRect(34,250,446,262);
    h.setColor(3).drawString("RADD LIVE: nv-mp.com/radd/captures",W/2,256);
    footer("LEFT NAV  RIGHT SECTION  PRESS OPEN");
    h.flip();
    Pip.lastFlip = getTime();
  }

  function drawList(title, items, sel) {
    frame(title);
    h.setFontMonofonto16().setFontAlign(-1,0);
    for (let i=0;i<items.length && i<8;i++) {
      let y=72+i*23;
      if (i===sel) { shade(28,y-10,452,y+10); h.setColor(3); }
      else h.setColor(2);
      h.drawString((i===sel?"> ":"  ")+items[i],42,y);
    }
    footer("LEFT NAV  RIGHT SECTION  PRESS OPEN");
    h.flip();
    Pip.lastFlip = getTime();
  }

  function drawText(title, arr) {
    frame(title);
    let lines=[];
    for (let i=0;i<arr.length;i++) {
      let w=wrap(arr[i],430);
      for (let j=0;j<w.length;j++) lines.push(w[j]);
      lines.push("");
    }
    h.setColor(3).setFontMonofonto14().setFontAlign(-1,-1);
    let y=68;
    for (let i=scroll;i<lines.length && y<252;i++,y+=17) h.drawString(lines[i],24,y);
    footer("LEFT SCROLL  RIGHT SECTION  SHAKE BACK");
    h.flip();
    Pip.lastFlip = getTime();
  }

  function drawRaddSummary() {
    let items = [], r = data.raddSummary || [];
    for (let i=0;i<r.length;i++) items.push(r[i].owner+" - "+r[i].count);
    drawList("RADD TACTICAL FEED", items, selected);
  }

  function drawRaddOwner() {
    let r = data.raddSummary[selected];
    let list = ["OWNER: "+r.owner,"HQ: "+(r.hq || "UNKNOWN"),"CONFIRMED HOLDINGS: "+r.count,"","STATUS: CONFIRMED","SOURCE: RADD Capture Network","","TACTICAL NOTICE","This holotape contains the most recent downloaded intelligence.","For live territory ownership, consult the RADD Capture Network:","nv-mp.com/radd/captures","",r.note || ""];
    drawText(r.owner, list);
  }

  function profileLines(f) {
    let lines=[], total=4;
    if (page===0) {
      lines.push("CLASSIFICATION: PUBLIC INTEL","","STATUS: "+(f.status||"UNKNOWN"),"LEADER: "+(f.leader||"UNKNOWN"),"HOLDINGS: "+(f.holdings||"UNKNOWN"),"HQ: "+(f.hq||"UNKNOWN"));
    } else if (page===1) {
      lines.push("RELATIONS","");
      let a=f.relations||["UNKNOWN"];
      for (let i=0;i<a.length;i++) lines.push("- "+a[i]);
    } else if (page===2) {
      lines.push("OFFICERS / COMMAND","");
      let a=f.officers||[];
      if (!a.length) lines.push("NO OFFICERS CONFIRMED");
      for (let i=0;i<a.length;i++) lines.push("- "+a[i]);
    } else {
      lines.push("MEMBERS / NOTES","");
      let m=f.members||[];
      for (let i=0;i<m.length;i++) lines.push("- "+m[i]);
      if (f.description) { lines.push(""); lines.push(f.description); }
      if (!m.length && !f.description) lines.push("NO ADDITIONAL NOTES");
    }
    lines.push("","PAGE "+(page+1)+"/"+total);
    return lines;
  }

  function drawFactionProfile() {
    let f = data.factionProfiles[selected];
    drawText(f.name, profileLines(f));
  }

  function noteTitle(n) {
    if (!n) return "EMPTY NOTE";
    let s = String(n).replace(/\n/g," ");
    return s.length>26 ? s.substring(0,26) : s;
  }

  function drawNotes() {
    let arr=[];
    for (let i=0;i<state.notes.length;i++) arr.push(noteTitle(state.notes[i]));
    arr.push("+ NEW NOTE");
    drawList("FIELD NOTES", arr, selected);
  }

  function drawEditor() {
    frame(editingExisting>=0 ? "EDIT FIELD NOTE" : "NEW FIELD NOTE");
    let display = editText;
    let lines = wrap(display, 430);
    h.setColor(3).setFontMonofonto14().setFontAlign(-1,-1);
    let y=70;
    for (let i=0;i<lines.length && y<190;i++,y+=17) h.drawString(lines[i],24,y);

    h.setColor(2).drawRect(24,205,456,235);
    h.setColor(3).setFontMonofonto23().setFontAlign(0,0).drawString(CHARS[editChar],240,220);

    h.setColor(2).setFontMonofonto14().setFontAlign(0,0);
    h.drawString("CURSOR "+editCursor+"/"+editText.length,240,250);
    footer("LEFT CHAR  RIGHT CURSOR  PRESS INSERT  SHAKE SAVE");
    h.flip();
    Pip.lastFlip = getTime();
  }

  function drawChecklist() {
    let out=[];
    for (let i=0;i<data.checklist.length;i++) out.push((state.done[i] ? "[X] " : "[ ] ") + data.checklist[i]);
    drawList("CHECKLIST", out, selected);
  }

  function draw() {
    if (removed) return;
    if (screen === "lock") return drawLock();
    if (screen === "loading") return drawLoading();
    if (screen === "menu") return drawMenu();
    if (screen === "briefing") return drawText("DAILY BRIEFING", data.briefing || data.brief || []);
    if (screen === "radd") return drawRaddSummary();
    if (screen === "raddOwner") return drawRaddOwner();
    if (screen === "factions") return drawList("FACTION DATABASE", data.factionProfiles.map(function(f){return f.name;}), selected);
    if (screen === "faction") return drawFactionProfile();
    if (screen === "broadcast") return drawText("BROADCAST", data.broadcasts || []);
    if (screen === "reports") return drawText("REPORTS", data.reports || []);
    if (screen === "updates") return drawText("UPDATES", [data.meta.notice || ""].concat(data.updates || []));
    if (screen === "notes") return drawNotes();
    if (screen === "note") return drawText("FIELD NOTE", [state.notes[selected] || ""]);
    if (screen === "editor") return drawEditor();
    if (screen === "checklist") return drawChecklist();
  }

  function openMenu() {
    scroll = 0; selected = 0; page = 0;
    if (menu === 0) screen = "briefing";
    else if (menu === 1) screen = "radd";
    else if (menu === 2) screen = "factions";
    else if (menu === 3) screen = "broadcast";
    else if (menu === 4) screen = "reports";
    else if (menu === 5) screen = "updates";
    else if (menu === 6) screen = "notes";
    else if (menu === 7) screen = "checklist";
    else if (menu === 8) return remove();
    draw();
  }

  function saveEditor() {
    if (editText.length === 0) editText = "EMPTY FIELD NOTE";
    if (editingExisting >= 0) state.notes[editingExisting] = editText;
    else state.notes.push(editText);
    saveState();
    selected = editingExisting >= 0 ? editingExisting : state.notes.length - 1;
    screen = "notes";
    editingExisting = -1;
    draw();
  }

  function goBack() {
    if (screen === "lock" || screen === "menu") return;
    if (screen === "editor") return saveEditor();
    if (screen === "faction") screen = "factions";
    else if (screen === "raddOwner") screen = "radd";
    else if (screen === "note") screen = "notes";
    else screen = "menu";
    scroll = 0;
    page = 0;
    draw();
  }

  function authSuccess() {
    screen = "loading"; loading = 0; draw();
    let t = setInterval(function(){
      loading++;
      draw();
      if (loading >= 10) { clearInterval(t); screen = "menu"; draw(); }
    }, 85);
  }

  function submitCode() {
    if (code.join("") === CODE) { denied = false; play("TAB"); authSuccess(); }
    else { denied = true; play("TAB"); draw(); }
  }

  function onLeftWheel(dir) {
    if (screen === "lock") { code[codePos] = (code[codePos] + dir + 10) % 10; denied = false; }
    else if (screen === "editor") { editChar = (editChar + dir + CHARS.length) % CHARS.length; }
    else if (screen === "menu") menu = (menu + dir + MENUS.length) % MENUS.length;
    else if (screen === "radd") selected = (selected + dir + (data.raddSummary||[]).length) % (data.raddSummary||[]).length;
    else if (screen === "factions") selected = (selected + dir + data.factionProfiles.length) % data.factionProfiles.length;
    else if (screen === "notes") selected = Math.max(0, Math.min(state.notes.length, selected + dir));
    else if (screen === "checklist") selected = (selected + dir + data.checklist.length) % data.checklist.length;
    else scroll = Math.max(0, scroll + dir);
    play("SCROLL");
    draw();
  }

  function onRightWheel(dir) {
    if (screen === "lock") { codePos = (codePos + dir + 4) % 4; denied = false; play("SCROLL"); draw(); return; }
    if (screen === "editor") { editCursor = Math.max(0, Math.min(editText.length, editCursor + dir)); play("SCROLL"); draw(); return; }
    if (screen === "faction") { page = (page + dir + 4) % 4; scroll = 0; play("SCROLL"); draw(); return; }
    if (screen !== "loading") { menu = (menu + dir + MENUS.length) % MENUS.length; screen = "menu"; scroll = 0; selected = 0; page = 0; play("SCROLL"); draw(); }
  }

  function insertChar() {
    let ch = CHARS[editChar];
    editText = editText.substring(0,editCursor) + ch + editText.substring(editCursor);
    editCursor++;
  }

  function onLeftWheelPress() {
    play("TAB");
    if (screen === "lock") return submitCode();
    if (screen === "editor") { insertChar(); return draw(); }
    if (screen === "menu") return openMenu();
    if (screen === "radd") { screen = "raddOwner"; scroll = 0; return draw(); }
    if (screen === "factions") { screen = "faction"; scroll = 0; page = 0; return draw(); }
    if (screen === "notes") {
      if (selected >= state.notes.length) {
        editText = "";
        editCursor = 0;
        editChar = 0;
        editingExisting = -1;
        screen = "editor";
      } else {
        screen = "note";
      }
      return draw();
    }
    if (screen === "note") {
      editText = state.notes[selected] || "";
      editCursor = editText.length;
      editChar = 0;
      editingExisting = selected;
      screen = "editor";
      return draw();
    }
    if (screen === "checklist") { state.done[selected] = !state.done[selected]; saveState(); return draw(); }
    goBack();
  }

  function pollAccel() {
    try {
      if (!Pip.accel || !Pip.accel.read) return;
      let a = Pip.accel.read();
      let v = Math.abs(a[0]-lastAccel[0]) + Math.abs(a[1]-lastAccel[1]) + Math.abs(a[2]-lastAccel[2]);
      lastAccel = a;
      if (v > 1.5) goBack();
    } catch(e) {}
  }

  function start() {
    h.clear();
    Pip.audioStop();
    loadData();
    try { if (Pip.accel && Pip.accel.init) Pip.accel.init(); } catch(e) {}
    Pip.onExclusive("knob1", onLeftWheel);
    Pip.onExclusive("knob2", onRightWheel);
    if (typeof ENC1_PRESS !== "undefined") {
      leftWheelPressWatch = setWatch(onLeftWheelPress, ENC1_PRESS, { repeat: true, edge: "rising", debounce: 120 });
    }
    draw();
    redrawInterval = setInterval(draw, 1000);
    accelInterval = setInterval(pollAccel, 350);
  }

  function remove() {
    if (removed) return;
    removed = true;
    if (redrawInterval) clearInterval(redrawInterval);
    if (accelInterval) clearInterval(accelInterval);
    if (leftWheelPressWatch) clearWatch(leftWheelPressWatch);
    Pip.removeListener("knob1", onLeftWheel);
    Pip.removeListener("knob2", onRightWheel);
    Pip.audioStop();
    h.clear();
    h.flip();
  }

  start();
  return { id: APP_ID, notDefault: true, fullscreen: true, remove: remove };
});