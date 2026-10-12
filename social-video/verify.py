"""Decode the complete deliverables and record format/black-frame verification."""
from pathlib import Path
import subprocess,re,json
import imageio_ffmpeg

root=Path(__file__).resolve().parent
reports=[]
for video in sorted((root/'deliverables').glob('*.mp4')):
 p=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-i',str(video),'-vf','blackdetect=d=0.2:pix_th=0.05','-an','-f','null','-'],capture_output=True)
 log=p.stderr.decode(errors='replace')
 (root/'intermediates'/f'{video.stem}-verify.log').write_text(log,encoding='utf-8')
 stream=next((l.strip() for l in log.splitlines() if 'Stream #0:0' in l),'')
 counts=re.findall(r'frame=\s*(\d+)',log)
 report={'file':video.name,'bytes':video.stat().st_size,'decode_exit_code':p.returncode,'input_stream':stream,'decoded_frames':int(counts[-1]) if counts else None,'black_segments':re.findall(r'black_start:([^\n]+)',log),'duration':re.search(r'Duration: ([\d:.]+)',log).group(1),'audio_stream':bool(re.search(r'Stream #0:\d+.*Audio:',log))}
 assert p.returncode==0 and report['decoded_frames']==1320 and not report['black_segments'],report
 assert 'h264' in stream and 'yuv420p' in stream and '30 fps' in stream,report
 reports.append(report)
(root/'deliverables'/'validation.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(reports,ensure_ascii=False,indent=2))
