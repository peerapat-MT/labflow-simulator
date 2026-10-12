"""Real-browser checks for Blender assets, rendering controls and motion isolation."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json,sys
sys.stdout.reconfigure(encoding='utf-8')
out=Path('.qa');out.mkdir(exist_ok=True)
errors=[];failures=[];checks=[]
def passed(name):checks.append(name);print('PASS:',name,flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:failures.append(r.url) if r.status>=400 else None)
    page.goto('http://127.0.0.1:4173');page.wait_for_load_state('networkidle')
    page.wait_for_function('window.labflow?.world?.loaded === true',timeout=60000)
    page.evaluate('labflow.pause()')
    expect(page.locator('#scene-status')).to_contain_text('พร้อมใช้งาน')
    stats=page.evaluate('labflow.world.getStats()')
    assert stats['people']>=11 and stats['drawCalls']<130,stats
    joints=page.evaluate("""()=>{const p=labflow.world.people.entries.values().next().value;return Object.fromEntries(Object.entries(p.joints).map(([k,v])=>[k,v?.position.toArray()]))}""")
    assert all(joints.values()),joints
    assert abs(joints['leftKnee'][1]+.425)<.01,joints
    passed('Blender GLBs loaded; instanced articulated people and valid knee pivots')
    page.screenshot(path=str(out/'v2-desktop.png'),full_page=True)
    before=page.evaluate("JSON.stringify([...labflow.world.people.entries.values()].map(p=>({p:p.root.position.toArray(),r:p.root.rotation.toArray(),j:p.joints.leftLeg.rotation.x})))")
    clock=page.evaluate('labflow.engine.time')
    page.wait_for_timeout(450)
    assert page.evaluate('labflow.engine.time')==clock
    assert before==page.evaluate("JSON.stringify([...labflow.world.people.entries.values()].map(p=>({p:p.root.position.toArray(),r:p.root.rotation.toArray(),j:p.joints.leftLeg.rotation.x})))")
    passed('Pause freezes both workflow clock and articulated presentation')
    page.get_by_label('แสดงป้ายห้อง',exact=True).click();expect(page.locator('#station-labels')).to_be_hidden()
    page.get_by_label('แสดงป้ายห้อง',exact=True).click();expect(page.locator('#station-labels')).to_be_visible()
    page.get_by_label('คุณภาพภาพ 3D').select_option('low')
    assert page.evaluate('labflow.world.renderer.shadowMap.enabled')==False
    page.get_by_label('มุมมองจากด้านบน',exact=True).click()
    page.wait_for_function('labflow.world.cameraMove === null',timeout=15000)
    assert page.evaluate('labflow.world.camera.position.y')>39
    page.get_by_role('button',name='02 เจาะเลือด / เก็บตัวอย่าง',exact=False).click()
    page.get_by_label('ซูมเข้ารายการที่เลือก').click()
    page.wait_for_function('labflow.world.cameraMove === null',timeout=15000)
    assert abs(page.evaluate('labflow.world.camera.zoom')-1.65)<.001
    page.screenshot(path=str(out/'v2-top-focus.png'),full_page=True)
    page.get_by_label('มุมมองสามมิติ',exact=True).click()
    page.wait_for_function('labflow.world.cameraMove === null',timeout=15000)
    page.get_by_label('คุณภาพภาพ 3D').select_option('high')
    assert page.evaluate('labflow.world.sun.shadow.mapSize.x')==2048
    page.get_by_label('คุณภาพภาพ 3D').select_option('auto')
    passed('Quality modes, labels, smoothly animated top/isometric/focus cameras')
    # Exercise render integration while the clinical engine stays paused.
    motion=page.evaluate("""()=>{
      const w=labflow.world,e=[...w.people.entries.values()].find(p=>!p.staff),time=labflow.engine.time;
      const start=[...e.motion.position];e.seated=false;e.motion.setTarget([start[0]+1,start[1],start[2]],{duration:1});
      const positions=[];for(let i=0;i<60;i++){w.render(1/60,true);positions.push(e.root.position.x);}
      return {timeUnchanged:labflow.engine.time===time,unique:new Set(positions.map(x=>x.toFixed(4))).size,delta:positions.at(-1)-start[0],stats:w.getStats()};
    }""")
    assert motion['timeUnchanged'] and motion['unique']>50 and abs(motion['delta']-1)<.001,motion
    passed('60 distinct interpolated positions; render loop never mutates clinical clock')
    # Reset must reuse geometry and remove stale selection and old entities.
    buffers=page.evaluate('labflow.world.getStats().geometryBuffers')
    for _ in range(3):page.get_by_label('เริ่มรอบจำลองใหม่').click()
    page.wait_for_timeout(300)
    after=page.evaluate('labflow.world.getStats()')
    assert after['geometryBuffers']==buffers,(buffers,after)
    assert page.evaluate('labflow.world.selection') is None
    passed('Repeated resets reuse geometry buffers and clear selection')
    page.emulate_media(reduced_motion='reduce');page.reload();page.wait_for_load_state('networkidle')
    page.wait_for_function('labflow.world?.loaded === true',timeout=60000)
    assert page.evaluate('labflow.world.reducedMotion')
    page.evaluate('labflow.pause()')
    passed('System reduced-motion preference is respected')
    assert not errors and not failures,(errors,failures)
    browser.close()
(out/'render-report.json').write_text(json.dumps({'checks':checks,'errors':errors,'failedRequests':failures,'initialStats':stats,'motion':motion,'resetStats':after,'renderer':'Chromium headless / SwiftShader software WebGL; timings are not hardware FPS benchmarks'},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(checks)} rendering checks passed; no page errors or failed assets')
