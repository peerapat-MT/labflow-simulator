"""Deterministic LabFlow social video production. Python, Playwright and imageio-ffmpeg required."""
from pathlib import Path
import http.server, threading, json, subprocess, struct, argparse, concurrent.futures, os
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright
import imageio_ffmpeg

HERE=Path(__file__).resolve().parent
SIM_ROOT=Path(os.environ['LABFLOW_SIMULATOR_ROOT']) if 'LABFLOW_SIMULATOR_ROOT' in os.environ else HERE.parent if (HERE.parent/'dist').exists() else HERE.parent/'simulator'
SIM=SIM_ROOT/'dist'
OUT=HERE/'deliverables'; WORK=HERE/'intermediates'
OUT.mkdir(exist_ok=True);WORK.mkdir(exist_ok=True)
CHAPTERS=[
 (0,6,'01 / CONNECTED LAB','หนึ่งผู้ป่วย<br>สามเส้นทาง','มองเห็นผู้ป่วย สิ่งส่งตรวจ และข้อมูลผลตรวจ<br>ในห้องปฏิบัติการจำลองเดียวกัน','PATIENT · SPECIMEN · INFORMATION'),
 (6,13,'02 / PATIENT JOURNEY','จากขึ้นบัตร<br>สู่ห้องเจาะเลือด','ติดตามคิวรับบริการ การเก็บตัวอย่าง<br>และรหัสที่เชื่อมทุกขั้นตอน','ขึ้นบัตร → ยื่นบัตร → เก็บตัวอย่าง'),
 (13,21,'03 / TRANSPORT','เมื่อกระสวยหยุด<br>งานเดินต่ออย่างไร','ทดลองคิวรอ ความจุ และการส่งสำรอง<br>ก่อนนำไปปรับเทียบกับระบบจริง','กระสวย → จุดรับ → กระจายสิ่งส่งตรวจ'),
 (21,29,'04 / LAB OPERATIONS','เห็นงานเตรียม<br>และงานวิเคราะห์','สำรวจการรอปั่นแยกและคิวเครื่องตรวจ<br>เพื่อค้นหาจุดที่ควรเก็บข้อมูลเพิ่มเติม','เตรียมสิ่งส่งตรวจ → ตรวจวิเคราะห์'),
 (29,37,'05 / RESULT JOURNEY','จากผลใน LIS<br>สู่ผลที่ HIS','แยกการบันทึก ตรวจสอบ และอนุมัติผล<br>รวมถึงการตอบรับจากระบบปลายทาง','บันทึก LIS → ตรวจสอบ → อนุมัติ → HIS'),
 (37,44,'06 / EXPLORE LABFLOW','ทดลองวันนี้<br>ออกแบบงานวันหน้า','เปิดใช้บนเว็บ · ทดลองสถานการณ์<br>เรียนรู้กระบวนการร่วมกันทั้งทีม','peerapat-mt.github.io/labflow-simulator/')
]

class Handler(http.server.SimpleHTTPRequestHandler):
 def translate_path(self,path):
  path=unquote(urlparse(path).path)
  return str((SIM/path[5:]) if path.startswith('/sim/') else HERE/path.lstrip('/'))
 def log_message(self,*args):pass

def overlay(ch,portrait):
 a,b,k,title,desc,flow=ch
 w,h=(1080,1920) if portrait else (1920,1080)
 css='''*{box-sizing:border-box}body{margin:0;color:#edf7ff;font-family:'Noto Sans Thai',sans-serif;background:radial-gradient(ellipse at 90% 5%,#164568,#081a2e 55%,#071222)}.brand{position:absolute;left:64px;top:48px;display:flex;align-items:center;gap:18px;font-size:45px;font-weight:700;letter-spacing:-1px}.brand img{width:61px;height:61px}.tag{position:absolute;right:64px;top:61px;font-size:19px;letter-spacing:3px;color:#86b6d7}.eyebrow{font-size:20px;letter-spacing:4px;color:#57d8ff;font-weight:600}h1{font-size:64px;line-height:1.36;font-weight:650;margin:20px 0 24px;letter-spacing:-1px}p{font-size:26px;line-height:1.8;color:#b6cbe0;margin:0}.flow{font-size:22px;line-height:1.7;color:#77e4ff;margin-top:30px;padding-top:23px;border-top:1px solid #234b65;overflow-wrap:anywhere}.footer{position:absolute;bottom:52px;left:64px;right:64px;color:#99b3cc;font-size:21px}.footline{display:flex;justify-content:space-between;align-items:center}.small{font-size:18px;color:#7997b1;margin-top:10px}.progress{display:flex;gap:10px;margin-top:24px}.progress i{height:5px;border-radius:3px;background:#244359;flex:1}.progress i.on{background:#51d6ff}.scene-border{position:absolute;border:1px solid #2b617e;border-radius:24px;box-shadow:0 30px 90px #0004}.topnote{position:absolute;color:#75a5c4;font-size:18px;letter-spacing:2px}.num{font-size:22px;color:#79e6ff}'''
 if portrait:
  css+='body{width:1080px;height:1920px}.copy{position:absolute;left:64px;right:64px;top:190px}h1{font-size:61px;line-height:1.25;margin:18px 0}.copy p{position:absolute;top:1290px;font-size:28px}.flow{position:absolute;top:1420px;width:952px;margin:0}.scene-border{left:38px;top:448px;width:1004px;height:1004px}.topnote{left:65px;top:412px}.footer{bottom:100px}'
 else:
  css+='body{width:1920px;height:1080px}.copy{position:absolute;left:1090px;top:250px;width:750px}h1{font-size:69px}.scene-border{left:78px;top:158px;width:924px;height:824px}.topnote{left:100px;top:127px}.footer{left:1090px;right:80px;bottom:90px;font-size:18px}.small{font-size:16px}.tag{right:80px}'
 if portrait and a==37:css+='.flow{top:210px;padding:0;border:0;font-size:25px}.topnote{display:none}'
 bars=''.join('<i class="'+('on' if i<=CHAPTERS.index(ch) else '')+'"></i>' for i in range(6))
 return f'''<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/sim/assets/fonts.css"><style>{css}</style></head><body><div class="brand"><img src="/sim/assets/logo.svg">LabFlow</div><div class="tag">LABORATORY SIMULATOR</div><div class="scene-border"></div><div class="topnote">3D WORKFLOW · SIMULATION</div><div class="copy"><div class="eyebrow">{k}</div><h1>{title}</h1><p>{desc}</p><div class="flow">{flow}</div></div><div class="footer"><div class="footline"><span>ข้อมูลสังเคราะห์ · ภาพจำลองกระบวนการ</span><span class="num">{CHAPTERS.index(ch)+1:02d} / 06</span></div><div class="small">ไม่เชื่อม HIS จริง · ต้องปรับเทียบก่อนใช้ตัดสินใจ</div><div class="progress">{bars}</div></div></body></html>'''

def capture():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',4175),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 errors=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-web-security'])
  page=browser.new_page(viewport={'width':1024,'height':1024},device_scale_factor=1,accept_downloads=True)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:print(m.text,flush=True) if m.text.startswith('LABFLOW_FRAME') else None)
  page.goto('http://127.0.0.1:4175/scene.html');page.wait_for_load_state('networkidle');page.wait_for_function('window.ready===true')
  page.screenshot(path=str(WORK/'scene-inspection.png'))
  print('Scene ready',page.evaluate('world.getStats()'),flush=True)
  if not (WORK/'scene.ivf').exists():
   with page.expect_download(timeout=1200000) as download:
    stats=page.evaluate('window.capture()')
   download.value.save_as(str(WORK/'scene.ivf'));(WORK/'capture.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
   print('Capture complete',stats,flush=True)
  for portrait in [True,False]:
   fmt='portrait' if portrait else 'landscape';w,h=(1080,1920) if portrait else (1920,1080)
   page.set_viewport_size({'width':w,'height':h})
   for i,ch in enumerate(CHAPTERS):
    (HERE/'overlay.html').write_text(overlay(ch,portrait),encoding='utf-8')
    page.goto('http://127.0.0.1:4175/overlay.html');page.wait_for_load_state('networkidle');page.evaluate('document.fonts.ready')
    page.screenshot(path=str(WORK/f'{fmt}-{i}.png'))
  browser.close()
 server.shutdown();(WORK/'browser-errors.json').write_text(json.dumps(errors),encoding='utf-8')
 if errors:raise RuntimeError(errors)

FF=imageio_ffmpeg.get_ffmpeg_exe()
def run(args):
 result=subprocess.run([FF,'-hide_banner','-loglevel','error','-y',*map(str,args)],capture_output=True)
 if result.returncode:raise RuntimeError(result.stderr.decode(errors='replace'))

def segment(task):
 fmt,i=task;a,b,*_=CHAPTERS[i];portrait=fmt=='portrait';size=1000 if portrait else 820;x,y=(40,450) if portrait else (130,160)
 target=WORK/f'{fmt}-{i}.mp4'
 run(['-loop','1','-framerate','30','-i',WORK/f'{fmt}-{i}.png','-ss',a,'-i',WORK/'scene.ivf','-filter_complex',f'[1:v]scale={size}:{size}:flags=lanczos[s];[0:v][s]overlay={x}:{y}:shortest=1,format=yuv420p[v]','-map','[v]','-t',b-a,'-r','30','-c:v','libx264','-preset','fast','-crf','20','-movflags','+faststart','-an',target]);return str(target)

def encode():
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for file in pool.map(segment,[(fmt,i) for fmt in ['portrait','landscape'] for i in range(6)]):print('Encoded',Path(file).name,flush=True)
 for fmt in ['portrait','landscape']:
  listing=WORK/f'{fmt}-concat.txt';listing.write_text('\n'.join(f"file '{fmt}-{i}.mp4'" for i in range(6)),encoding='utf-8')
  target=OUT/f'LabFlow-{fmt}-44s.mp4'
  run(['-f','concat','-safe','0','-i',listing,'-c','copy','-movflags','+faststart',target])
  run(['-ss','3','-i',target,'-frames:v','1',OUT/f'LabFlow-{fmt}-poster.png'])
  run(['-i',target,'-vf','fps=1/7,scale=384:-1,tile=6x1','-frames:v','1',WORK/f'{fmt}-contact.png'])
 srt=[]
 for i,(a,b,_,title,desc,flow) in enumerate(CHAPTERS):
  stamp=lambda t:f'00:00:{t:02d},000'
  srt.append(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n'+title.replace('<br>',' ')+'\n'+desc.replace('<br>',' '))
 (OUT/'LabFlow-th.srt').write_text('\n\n'.join(srt)+'\n',encoding='utf-8')
 manifest={'title':'LabFlow 2.0 social demonstration','duration_seconds':44,'fps':30,'video_codec':'H.264','pixel_format':'yuv420p','audio':'none; intentionally caption-first','synthetic':True,'engine_seed':'default','frames':1320,'render':'Blender-authored GLB assets in actual LabWorld / LabEngine, deterministic 30 fps','scene_resolution':[1024,1024],'outputs':{p.name:p.stat().st_size for p in OUT.glob('*.mp4')},'chapters':[{'start':c[0],'end':c[1],'title':c[3].replace('<br>',' ')} for c in CHAPTERS]}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--encode-only',action='store_true');args=parser.parse_args()
 if not args.encode_only:capture()
 encode()
