import urllib.request, re, pathlib
base=pathlib.Path(__file__).resolve().parents[1]/'dist'/'assets'
base.mkdir(parents=True,exist_ok=True)
url='https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap'
req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'})
css=urllib.request.urlopen(req,timeout=30).read().decode()
for i,u in enumerate(dict.fromkeys(re.findall(r'url\((https[^)]+)\)',css))):
    name=f'noto-thai-{i}.woff2'
    (base/name).write_bytes(urllib.request.urlopen(u,timeout=30).read())
    css=css.replace(u,name)
(base/'fonts.css').write_text(css,encoding='utf-8')
print('Fonts downloaded locally')
