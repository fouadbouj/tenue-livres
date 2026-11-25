# Logiciel comptable – Boujrad CPA

- `src/index.html` : le logiciel (source unique)
- `build.py` : génère `public/index.html` et `public/app.js` → `python3 build.py src/index.html`
- `public/` : ce que Netlify publie (`config.js` = URL Supabase + clé publique seulement)
- `supabase/` : schéma SQL et fonction IA (la clé Anthropic reste dans les secrets Supabase, jamais ici)
