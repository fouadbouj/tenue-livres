"""Construit la version site web à partir du logiciel (index.html de l'application Claude).
Usage : python3 build.py chemin/vers/index.html"""
import re, sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
src = src.replace('<head>', '<head>\n<link rel="icon" href="favicon.svg" type="image/svg+xml">', 1)
scripts = list(re.finditer(r'<script>\n\{\n(.*?)\n\}\n</script>', src, re.S))
main = scripts[-1]
app = '{\n' + main.group(1) + '\n}\n'
html = src[:main.start()] + (
  '<script src="config.js"></script>\n'
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>\n'
  '<script src="assistant.js"></script>\n<script src="cloud.js"></script>\n') + src[main.end():]
out = pathlib.Path(__file__).parent / 'public'
(out / 'app.js').write_text(app, encoding='utf-8')
(out / 'index.html').write_text(html, encoding='utf-8')
print('ok', len(app), 'car. dans app.js')
