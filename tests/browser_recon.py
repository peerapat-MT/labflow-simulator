from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys
sys.stdout.reconfigure(encoding='utf-8')
out=Path('.qa');out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    errors=[];logs=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.on('console',lambda msg:logs.append({'type':msg.type,'text':msg.text[:2000]}))
    page.goto('http://127.0.0.1:4173');page.wait_for_load_state('networkidle')
    page.screenshot(path=str(out/'desktop-initial.png'),full_page=True)
    print(json.dumps({'buttons':page.get_by_role('button').all_text_contents(),'headings':page.get_by_role('heading').all_text_contents(),'errors':errors,'logs':logs,'canvas':page.locator('canvas').evaluate_all('(els)=>els.map(e=>({width:e.width,height:e.height,box:e.getBoundingClientRect().toJSON()}))')},ensure_ascii=False))
    browser.close()
