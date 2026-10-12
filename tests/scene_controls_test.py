from playwright.sync_api import sync_playwright, expect
import sys
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1280,'height':900})
    page.goto('http://127.0.0.1:4173');page.wait_for_load_state('networkidle')
    page.wait_for_function('labflow.world?.loaded === true',timeout=60000);page.evaluate('labflow.pause()')
    page.get_by_label('ห้องแล็บเต็มจอ').click()
    page.wait_for_function('document.fullscreenElement !== null')
    expect(page.get_by_label('ห้องแล็บเต็มจอ')).to_have_attribute('aria-pressed','true')
    page.get_by_label('ห้องแล็บเต็มจอ').click();page.wait_for_function('document.fullscreenElement === null')
    print('PASS: Fullscreen entry, exit and accessible state',flush=True)
    # Supply slow display intervals while omitting GPU submission, so this tests
    # adaptation policy reproducibly rather than benchmarking the test machine.
    result=page.evaluate('''()=>{
        const w=labflow.world,time=labflow.engine.time,submit=w.renderer.render;
        w.renderer.render=()=>{};w.setQuality('auto');const before=w.pixelRatio;
        try {for(let i=0;i<180;i++)w.render(.06,true);}finally{w.renderer.render=submit;}
        const auto=w.pixelRatio;w.setQuality('high');const fixed=w.pixelRatio;
        w.renderer.render=()=>{};try {for(let i=0;i<180;i++)w.render(.06,true);}finally{w.renderer.render=submit;}
        return {before,auto,fixed,after:w.pixelRatio,timeUnchanged:time===labflow.engine.time};
    }''')
    assert result['auto']<result['before'] and result['after']==result['fixed'] and result['timeUnchanged'],result
    print('PASS: Sustained slow frames lower auto quality; explicit high quality stays fixed',flush=True)
    blocked=browser.new_page();blocked.route('**/assets/models/*.glb',lambda route:route.abort())
    blocked.goto('http://127.0.0.1:4173');blocked.wait_for_load_state('networkidle')
    expect(blocked.locator('.fallback-map')).to_be_visible()
    expect(blocked.locator('#scene-loading')).to_be_hidden()
    expect(blocked.get_by_label('คุณภาพภาพ 3D')).to_be_disabled()
    blocked.get_by_role('button',name='01 ขึ้นบัตร',exact=False).click()
    expect(blocked.locator('#inspector')).to_contain_text('กำลังรองรับ')
    print('PASS: Failed asset download leaves a usable workflow and 2D station map',flush=True)
    browser.close()
